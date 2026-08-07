import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type RewardSource =
  | 'daily_login'
  | 'streak_bonus'
  | 'read_chapter'
  | 'comment'
  | 'rate'
  | 'bookmark'
  | 'level_up';

// Default config values (used if DB config not found)
const DEFAULTS: Record<string, number> = {
  xp_daily_login: 5,
  coin_daily_login: 2,
  xp_read_chapter: 3,
  coin_read_chapter: 1,
  xp_comment: 2,
  xp_rate: 5,
  coin_rate: 1,
  xp_bookmark: 1,
  coin_level_up: 10,
  xp_streak_bonus: 2,
  streak_max_days: 7,
};

@Injectable()
export class GamificationService implements OnModuleInit {
  private readonly logger = new Logger(GamificationService.name);
  private configCache: Map<string, number> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
    await this.loadConfig();
  }

  // ── Config ──

  private async seedDefaults() {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      await this.prisma.gamificationConfig.upsert({
        where: { key },
        update: {},
        create: { key, value },
      });
    }
  }

  private async loadConfig() {
    const rows = await this.prisma.gamificationConfig.findMany();
    this.configCache.clear();
    for (const row of rows) {
      this.configCache.set(row.key, row.value);
    }
    this.logger.log(`Loaded ${this.configCache.size} gamification config entries`);
  }

  private getConfig(key: string): number {
    return this.configCache.get(key) ?? DEFAULTS[key] ?? 0;
  }

  // ── Level formula: 100 * 1.5^(level-1) ──

  private xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  // ── Core: award XP + coins in a transaction ──

  private async award(
    userId: string,
    xpAmount: number,
    coinAmount: number,
    source: RewardSource,
    sourceId?: string,
    note?: string,
  ) {
    if (xpAmount === 0 && coinAmount === 0) return;

    await this.prisma.$transaction(async (tx) => {
      // Lock user row with update
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          experience: { increment: xpAmount },
          coins: { increment: coinAmount },
        },
      });

      const logs: any[] = [];

      if (xpAmount > 0) {
        logs.push({
          userId,
          type: 'XP',
          amount: xpAmount,
          source,
          sourceId,
          balanceAfter: user.experience,
          note,
        });
      }

      if (coinAmount > 0) {
        logs.push({
          userId,
          type: 'COIN',
          amount: coinAmount,
          source,
          sourceId,
          balanceAfter: user.coins,
          note,
        });
      }

      if (logs.length > 0) {
        await tx.rewardTransaction.createMany({ data: logs });
      }

      // Check level up
      await this.processLevelUp(tx, userId, user.experience, user.level);
    });
  }

  private async processLevelUp(
    tx: any,
    userId: string,
    currentXp: number,
    currentLevel: number,
  ) {
    let xp = currentXp;
    let level = currentLevel;
    let totalCoinsAwarded = 0;

    while (xp >= this.xpForLevel(level)) {
      xp -= this.xpForLevel(level);
      level++;
      totalCoinsAwarded += this.getConfig('coin_level_up');
    }

    if (level > currentLevel) {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          level,
          experience: xp,
          coins: { increment: totalCoinsAwarded },
        },
      });

      await tx.rewardTransaction.create({
        data: {
          userId,
          type: 'COIN',
          amount: totalCoinsAwarded,
          source: 'level_up',
          balanceAfter: user.coins,
          note: `Lên cấp ${currentLevel} → ${level}`,
        },
      });

      this.logger.log(`User ${userId} leveled up: ${currentLevel} → ${level} (+${totalCoinsAwarded} coins)`);
    }
  }

  // ── Duplicate check ──

  private async hasReward(userId: string, source: string, sourceId: string): Promise<boolean> {
    const existing = await this.prisma.rewardTransaction.findFirst({
      where: { userId, source, sourceId, type: 'XP' },
      select: { id: true },
    });
    return !!existing;
  }

  // ── Public methods called by other services ──

  async awardDailyLogin(userId: string) {
    // Use UTC-based date to avoid timezone issues
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const today = new Date(todayStr + 'T00:00:00.000Z');

    const yesterdayDate = new Date(today);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);

    // Wrap in transaction to prevent race condition (multiple devices)
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { lastStreakDate: true, loginStreak: true },
      });
      if (!user) return null;

      // Normalize lastStreakDate to UTC date string for comparison
      const lastDateStr = user.lastStreakDate
        ? new Date(user.lastStreakDate).toISOString().slice(0, 10)
        : null;

      // Already claimed today — skip
      if (lastDateStr === todayStr) return null;

      // Calculate streak
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
      let newStreak: number;
      if (lastDateStr === yesterdayStr) {
        // Consecutive day
        const maxStreak = this.getConfig('streak_max_days');
        newStreak = Math.min(user.loginStreak + 1, maxStreak);
      } else {
        // Streak broken or first login
        newStreak = 1;
      }

      // Atomically update streak info
      await tx.user.update({
        where: { id: userId },
        data: { loginStreak: newStreak, lastStreakDate: today },
      });

      return { newStreak };
    });

    // If already claimed or user not found, skip rewards
    if (!result) return;

    // Award daily login XP + coins (outside transaction for performance)
    const xp = this.getConfig('xp_daily_login');
    const coins = this.getConfig('coin_daily_login');
    await this.award(userId, xp, coins, 'daily_login', todayStr, `Đăng nhập ngày ${today.toLocaleDateString('vi-VN')}`);

    // Streak bonus (starting from day 2)
    if (result.newStreak > 1) {
      const streakXp = this.getConfig('xp_streak_bonus') * (result.newStreak - 1);
      await this.award(userId, streakXp, 0, 'streak_bonus', todayStr, `Streak ${result.newStreak} ngày (+${streakXp} XP)`);
    }
  }

  async awardReadChapter(userId: string, chapterId: string) {
    if (await this.hasReward(userId, 'read_chapter', chapterId)) return;
    const xp = this.getConfig('xp_read_chapter');
    const coins = this.getConfig('coin_read_chapter');
    await this.award(userId, xp, coins, 'read_chapter', chapterId);
  }

  async awardComment(userId: string, commentId: string) {
    const xp = this.getConfig('xp_comment');
    await this.award(userId, xp, 0, 'comment', commentId);
  }

  async awardRate(userId: string, comicId: string) {
    if (await this.hasReward(userId, 'rate', comicId)) return;
    const xp = this.getConfig('xp_rate');
    const coins = this.getConfig('coin_rate');
    await this.award(userId, xp, coins, 'rate', comicId);
  }

  async awardBookmark(userId: string, comicId: string) {
    if (await this.hasReward(userId, 'bookmark', comicId)) return;
    const xp = this.getConfig('xp_bookmark');
    await this.award(userId, xp, 0, 'bookmark', comicId);
  }
}
