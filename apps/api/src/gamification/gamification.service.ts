import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { NotificationType, Prisma, QuestAction, QuestType } from '@prisma/client';
import { CULTIVATION_REALMS, getCultivationInfo, xpRequiredForLevel } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { GAMIFICATION_CONFIG_BOUNDS } from './dto/gamification.dto';

export type RewardSource =
  | 'welcome_bonus'
  | 'daily_login'
  | 'streak_bonus'
  | 'read_chapter'
  | 'comment'
  | 'rate'
  | 'bookmark'
  | 'follow'
  | 'quest_claim'
  | 'level_up'
  | 'unlock_chapter'
  | 'author_revenue'
  | 'admin_grant';

interface ConfigDefaultItem {
  value: number;
  label: string;
  description: string;
}

const MAX_DAILY_COMMENT_REWARDS = 5;

const DEFAULT_CONFIG: Record<string, ConfigDefaultItem> = {
  xp_daily_login: { value: 15, label: 'XP Điểm danh ngày', description: 'Kinh nghiệm nhận được mỗi ngày điểm danh' },
  coin_daily_login: { value: 5, label: 'Xu Điểm danh ngày', description: 'Linh thạch/Xu nhận được mỗi ngày điểm danh' },
  xp_streak_bonus: { value: 5, label: 'XP Thưởng chuỗi ngày', description: 'XP cộng thêm theo từng ngày trong chuỗi' },
  coin_streak_7_bonus: { value: 25, label: 'Xu Thưởng mốc 7 ngày', description: 'Xu thưởng thêm khi đạt chuỗi 7 ngày liên tiếp' },
  streak_max_days: { value: 7, label: 'Số ngày chuỗi tối đa', description: 'Chu kỳ tối đa tính thưởng chuỗi điểm danh' },
  xp_read_chapter: { value: 10, label: 'XP Đọc chương', description: 'Kinh nghiệm nhận khi đọc xong chương mới' },
  coin_read_chapter: { value: 2, label: 'Xu Đọc chương', description: 'Xu nhận khi đọc chương lần đầu' },
  xp_comment: { value: 5, label: 'XP Bình luận', description: 'Kinh nghiệm nhận khi gửi bình luận' },
  xp_rate: { value: 15, label: 'XP Đánh giá truyện', description: 'Kinh nghiệm nhận khi đánh giá truyện lần đầu' },
  coin_rate: { value: 5, label: 'Xu Đánh giá truyện', description: 'Xu nhận khi đánh giá truyện lần đầu' },
  xp_bookmark: { value: 5, label: 'XP Lưu truyện', description: 'Kinh nghiệm nhận khi theo dõi truyện mới' },
  coin_level_up: { value: 15, label: 'Xu Thăng cấp', description: 'Xu thưởng mỗi lần thăng 1 cấp tu vi' },
  coin_welcome: { value: 30, label: 'Xu Tân thủ', description: 'Xu tặng khi đăng ký tài khoản mới' },
  author_revenue_percent: { value: 70, label: 'Tỷ lệ chia sẻ tác giả (%)', description: 'Phần trăm doanh thu Xu chuyển cho tác giả khi độc giả mở khóa chương' },
};

interface AwardOutcome {
  updatedUser: {
    id: string;
    level: number;
    experience: number;
    totalExperience: number;
    coins: number;
    loginStreak: number;
  };
  oldLevel: number;
  newLevel: number;
  levelUpCoins: number;
}

@Injectable()
export class GamificationService implements OnModuleInit {
  private readonly logger = new Logger(GamificationService.name);
  private configCache = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
    await this.loadConfig();
  }

  private async seedDefaults() {
    for (const [key, item] of Object.entries(DEFAULT_CONFIG)) {
      await this.prisma.gamificationConfig.upsert({
        where: { key },
        update: {},
        create: {
          key,
          value: item.value,
          label: item.label,
          description: item.description,
        },
      });
    }
  }

  private async loadConfig() {
    const rows = await this.prisma.gamificationConfig.findMany();
    this.configCache.clear();
    for (const row of rows) {
      this.configCache.set(row.key, row.value);
    }
    await this.redis.set(
      'gamification:config',
      Object.fromEntries(this.configCache.entries()),
      300,
    ).catch(() => {});
    this.logger.log(`Loaded ${this.configCache.size} gamification config entries`);
  }

  getConfigValue(key: string, fallback = 0): number {
    return this.configCache.get(key) ?? DEFAULT_CONFIG[key]?.value ?? fallback;
  }

  async getAllConfig() {
    return this.prisma.gamificationConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async updateConfigValues(updates: Array<{ key: string; value: number }>) {
    for (const u of updates) {
      const bounds = GAMIFICATION_CONFIG_BOUNDS[u.key];
      if (!bounds) {
        throw new BadRequestException(`Khóa cấu hình "${u.key}" không hợp lệ`);
      }
      if (!Number.isFinite(u.value) || !Number.isInteger(u.value)) {
        throw new BadRequestException(`Giá trị cho "${u.key}" phải là số nguyên hợp lệ`);
      }
      if (u.value < bounds.min || u.value > bounds.max) {
        throw new BadRequestException(
          `Giá trị "${u.key}" phải nằm trong khoảng ${bounds.min} đến ${bounds.max}`,
        );
      }
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.gamificationConfig.updateMany({
          where: { key: u.key },
          data: { value: u.value },
        }),
      ),
    );
    await this.loadConfig();
    return this.getAllConfig();
  }

  // Vietnam (+07:00) calendar period keys
  private getVnDateParts(date = new Date()) {
    const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const dateStr = vn.toISOString().slice(0, 10);
    const yesterday = new Date(vn);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // ISO week calculation
    const tmp = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const weekStr = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

    return { dateStr, yesterdayStr, weekStr };
  }

  private getPeriodKey(type: QuestType): string {
    const { dateStr, weekStr } = this.getVnDateParts();
    if (type === QuestType.DAILY) return `daily:${dateStr}`;
    if (type === QuestType.WEEKLY) return `weekly:${weekStr}`;
    return 'lifetime';
  }

  // ── Core atomic reward engine ──

  private async awardInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    xpAmount: number,
    coinAmount: number,
    source: RewardSource,
    sourceId?: string,
    note?: string,
  ): Promise<AwardOutcome | null> {
    if (xpAmount <= 0 && coinAmount <= 0) return null;

    const [existingUser] = await tx.$queryRaw<
      Array<{ level: number; experience: number; total_experience: number; coins: number }>
    >`SELECT level, experience, total_experience, coins FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

    if (!existingUser) return null;

    const safeXpDelta = Math.max(0, Math.floor(xpAmount));
    const safeCoinDelta = Math.max(0, Math.floor(coinAmount));

    let newXp = existingUser.experience + safeXpDelta;
    const newTotalXp = existingUser.total_experience + safeXpDelta;
    let newLevel = existingUser.level;
    let levelUpCoins = 0;

    while (newXp >= xpRequiredForLevel(newLevel)) {
      newXp -= xpRequiredForLevel(newLevel);
      newLevel++;
      levelUpCoins += this.getConfigValue('coin_level_up', 15);
    }

    const finalCoins = existingUser.coins + safeCoinDelta + levelUpCoins;

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        experience: newXp,
        totalExperience: newTotalXp,
        level: newLevel,
        coins: finalCoins,
      },
      select: {
        id: true,
        level: true,
        experience: true,
        totalExperience: true,
        coins: true,
        loginStreak: true,
      },
    });

    const logs: Prisma.RewardTransactionCreateManyInput[] = [];

    if (safeXpDelta > 0) {
      logs.push({
        userId,
        currency: 'XP',
        amount: safeXpDelta,
        source,
        sourceId,
        balanceAfter: newTotalXp,
        note,
      });
    }

    if (safeCoinDelta > 0) {
      logs.push({
        userId,
        currency: 'COIN',
        amount: safeCoinDelta,
        source,
        sourceId,
        balanceAfter: existingUser.coins + safeCoinDelta,
        note,
      });
    }

    if (levelUpCoins > 0) {
      logs.push({
        userId,
        currency: 'COIN',
        amount: levelUpCoins,
        source: 'level_up',
        sourceId: String(newLevel),
        balanceAfter: finalCoins,
        note: `Thăng cấp tu vi ${existingUser.level} → ${newLevel}`,
      });
    }

    if (logs.length > 0) {
      await tx.rewardTransaction.createMany({ data: logs });
    }

    return {
      updatedUser,
      oldLevel: existingUser.level,
      newLevel,
      levelUpCoins,
    };
  }

  private async notifyLevelUpIfNeeded(userId: string, outcome: AwardOutcome | null) {
    if (!outcome || outcome.newLevel <= outcome.oldLevel) return;

    const oldRealm = getCultivationInfo(outcome.oldLevel, 0).realm;
    const newCultivation = getCultivationInfo(outcome.newLevel, outcome.updatedUser.experience);
    const brokeRealm = newCultivation.realm.index > oldRealm.index;

    await this.syncLevelQuests(userId, outcome.newLevel).catch(() => {});

    await this.notificationService
      .createPersonal({
        userId,
        type: NotificationType.ACHIEVEMENT,
        title: brokeRealm
          ? `Đột phá cảnh giới: ${newCultivation.realm.name}!`
          : `Thăng cấp tu vi lên Cấp ${outcome.newLevel}!`,
        content: `Bạn nhận được +${outcome.levelUpCoins} Xu thưởng đột phá (${newCultivation.fullTitle}).`,
        actionUrl: '/cultivation',
        data: {
          oldLevel: outcome.oldLevel,
          newLevel: outcome.newLevel,
          realm: newCultivation.realm.name,
          coinsAwarded: outcome.levelUpCoins,
        },
      })
      .catch(() => {});
  }

  async award(
    userId: string,
    xpAmount: number,
    coinAmount: number,
    source: RewardSource,
    sourceId?: string,
    note?: string,
  ) {
    if (xpAmount <= 0 && coinAmount <= 0) return null;

    const outcome = await this.prisma.$transaction((tx) =>
      this.awardInTx(tx, userId, xpAmount, coinAmount, source, sourceId, note),
    );
    if (!outcome) return null;

    await this.notifyLevelUpIfNeeded(userId, outcome);
    return outcome.updatedUser;
  }

  async spendCoins(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    source: RewardSource,
    sourceId: string,
    note?: string,
  ): Promise<number> {
    if (amount <= 0) return 0;

    const [lockedUser] = await tx.$queryRaw<Array<{ coins: number }>>`
      SELECT coins FROM users WHERE id = ${userId}::uuid FOR UPDATE
    `;
    if (!lockedUser || lockedUser.coins < amount) {
      throw new BadRequestException('Số Xu trong ví không đủ để thực hiện giao dịch');
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { coins: lockedUser.coins - amount },
      select: { coins: true },
    });

    await tx.rewardTransaction.create({
      data: {
        userId,
        currency: 'COIN',
        amount: -amount,
        source,
        sourceId,
        balanceAfter: updatedUser.coins,
        note,
      },
    });

    return updatedUser.coins;
  }

  // ── Daily Check-in (Single Locked Transaction) ──

  async processDailyCheckIn(userId: string, silent = false) {
    const { dateStr, yesterdayStr } = this.getVnDateParts();
    const todayDate = new Date(`${dateStr}T00:00:00.000Z`);
    const maxStreak = Math.max(1, this.getConfigValue('streak_max_days', 7));

    const result = await this.prisma.$transaction(async (tx) => {
      const [user] = await tx.$queryRaw<
        Array<{ last_streak_date: Date | null; login_streak: number; longest_streak: number }>
      >`SELECT last_streak_date, login_streak, longest_streak FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

      if (!user) return null;

      const lastDateStr = user.last_streak_date
        ? this.getVnDateParts(new Date(user.last_streak_date)).dateStr
        : null;

      if (lastDateStr === dateStr) {
        return {
          alreadyCheckedIn: true,
          newStreak: user.login_streak,
          xpEarned: 0,
          coinsEarned: 0,
          outcome: null as AwardOutcome | null,
        };
      }

      const existingTx = await tx.rewardTransaction.findFirst({
        where: { userId, source: 'daily_login', sourceId: dateStr },
        select: { id: true },
      });
      if (existingTx) {
        return {
          alreadyCheckedIn: true,
          newStreak: user.login_streak,
          xpEarned: 0,
          coinsEarned: 0,
          outcome: null as AwardOutcome | null,
        };
      }

      const isConsecutive = lastDateStr === yesterdayStr;
      const newStreak = isConsecutive ? (user.login_streak >= maxStreak ? 1 : user.login_streak + 1) : 1;
      const longestStreak = Math.max(user.longest_streak || 0, newStreak);

      await tx.user.update({
        where: { id: userId },
        data: {
          loginStreak: newStreak,
          longestStreak,
          lastStreakDate: todayDate,
        },
      });

      const baseXp = this.getConfigValue('xp_daily_login', 15);
      const baseCoins = this.getConfigValue('coin_daily_login', 5);
      const streakXp =
        newStreak > 1 ? this.getConfigValue('xp_streak_bonus', 5) * (newStreak - 1) : 0;
      const day7BonusCoins =
        newStreak === maxStreak ? this.getConfigValue('coin_streak_7_bonus', 25) : 0;

      const totalXp = baseXp + streakXp;
      const totalCoins = baseCoins + day7BonusCoins;

      const outcome = await this.awardInTx(
        tx,
        userId,
        totalXp,
        totalCoins,
        'daily_login',
        dateStr,
        `Điểm danh ngày ${dateStr} (Chuỗi ${newStreak} ngày)`,
      );

      return {
        alreadyCheckedIn: false,
        newStreak,
        xpEarned: totalXp,
        coinsEarned: totalCoins,
        outcome,
      };
    });

    if (!result) {
      if (silent) return null;
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    if (result.alreadyCheckedIn) {
      return {
        alreadyCheckedIn: true,
        streak: result.newStreak,
        xpEarned: 0,
        coinsEarned: 0,
      };
    }

    await this.notifyLevelUpIfNeeded(userId, result.outcome);
    await this.incrementQuestProgress(userId, QuestAction.DAILY_CHECK_IN, 1).catch(() => {});

    return {
      alreadyCheckedIn: false,
      streak: result.newStreak,
      xpEarned: result.xpEarned,
      coinsEarned: result.coinsEarned,
    };
  }

  // ── Triggered Unique / Capped Rewards ──

  async hasReward(userId: string, source: RewardSource, sourceId: string): Promise<boolean> {
    const existing = await this.prisma.rewardTransaction.findFirst({
      where: { userId, source, sourceId },
      select: { id: true },
    });
    return !!existing;
  }

  private async awardOnceForTarget(
    userId: string,
    source: RewardSource,
    sourceId: string,
    xpAmount: number,
    coinAmount: number,
    note: string,
    questAction?: QuestAction,
  ): Promise<boolean> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const existing = await tx.rewardTransaction.findFirst({
        where: { userId, source, sourceId },
        select: { id: true },
      });
      if (existing) return null;
      return this.awardInTx(tx, userId, xpAmount, coinAmount, source, sourceId, note);
    });

    if (!outcome) return false;
    await this.notifyLevelUpIfNeeded(userId, outcome);
    if (questAction) {
      await this.incrementQuestProgress(userId, questAction, 1).catch(() => {});
    }
    return true;
  }

  async awardReadChapter(userId: string, chapterId: string): Promise<boolean> {
    return this.awardOnceForTarget(
      userId,
      'read_chapter',
      chapterId,
      this.getConfigValue('xp_read_chapter', 10),
      this.getConfigValue('coin_read_chapter', 2),
      'Đọc chương mới',
      QuestAction.READ_CHAPTERS,
    );
  }

  async awardComment(userId: string, commentId: string): Promise<boolean> {
    const { dateStr } = this.getVnDateParts();
    const vnDayStart = new Date(`${dateStr}T00:00:00.000+07:00`);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const todayRewardCount = await tx.rewardTransaction.count({
        where: {
          userId,
          source: 'comment',
          createdAt: { gte: vnDayStart },
        },
      });
      if (todayRewardCount >= MAX_DAILY_COMMENT_REWARDS) {
        return null;
      }
      return this.awardInTx(
        tx,
        userId,
        this.getConfigValue('xp_comment', 5),
        0,
        'comment',
        commentId,
        'Đóng góp bình luận',
      );
    });

    if (!outcome) return false;
    await this.notifyLevelUpIfNeeded(userId, outcome);
    await this.incrementQuestProgress(userId, QuestAction.POST_COMMENT, 1).catch(() => {});
    return true;
  }

  async awardRate(userId: string, comicId: string): Promise<boolean> {
    return this.awardOnceForTarget(
      userId,
      'rate',
      comicId,
      this.getConfigValue('xp_rate', 15),
      this.getConfigValue('coin_rate', 5),
      'Đánh giá tác phẩm',
      QuestAction.RATE_COMIC,
    );
  }

  async awardBookmark(userId: string, comicId: string): Promise<boolean> {
    return this.awardOnceForTarget(
      userId,
      'bookmark',
      comicId,
      this.getConfigValue('xp_bookmark', 5),
      0,
      'Lưu truyện vào tủ sách',
      QuestAction.ADD_BOOKMARK,
    );
  }

  async awardFollow(userId: string, targetUserId: string): Promise<boolean> {
    return this.awardOnceForTarget(
      userId,
      'follow',
      targetUserId,
      5,
      0,
      'Theo dõi thành viên',
      QuestAction.FOLLOW_AUTHOR,
    );
  }

  // ── Quest System ──

  async incrementQuestProgress(userId: string, action: QuestAction, delta = 1) {
    if (delta <= 0) return;
    const quests = await this.prisma.questDefinition.findMany({
      where: { isActive: true, action },
    });

    for (const quest of quests) {
      const periodKey = this.getPeriodKey(quest.type);
      const id = crypto.randomUUID();
      const target = Math.max(1, quest.targetCount);
      const initialProgress = Math.min(target, delta);
      const initialCompleted = initialProgress >= target;

      await this.prisma.$executeRaw`
        INSERT INTO user_quest_progress (id, user_id, quest_id, period_key, progress, is_completed, updated_at)
        VALUES (${id}::uuid, ${userId}::uuid, ${quest.id}::uuid, ${periodKey}, ${initialProgress}, ${initialCompleted}, NOW())
        ON CONFLICT (user_id, quest_id, period_key)
        DO UPDATE SET
          progress = LEAST(${target}, user_quest_progress.progress + ${delta}),
          is_completed = (LEAST(${target}, user_quest_progress.progress + ${delta}) >= ${target}),
          updated_at = NOW()
        WHERE user_quest_progress.claimed_at IS NULL
      `;
    }
  }

  private async syncLevelQuests(userId: string, level: number) {
    const quests = await this.prisma.questDefinition.findMany({
      where: { isActive: true, action: QuestAction.REACH_LEVEL },
    });

    for (const quest of quests) {
      const periodKey = this.getPeriodKey(quest.type);
      const progress = Math.min(quest.targetCount, level);
      const isCompleted = level >= quest.targetCount;

      await this.prisma.userQuestProgress.upsert({
        where: { userId_questId_periodKey: { userId, questId: quest.id, periodKey } },
        update: { progress, isCompleted },
        create: {
          userId,
          questId: quest.id,
          periodKey,
          progress,
          isCompleted,
        },
      });
    }
  }

  async getQuestsForUser(userId?: string) {
    const definitions = await this.prisma.questDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
    });

    if (!userId) {
      return definitions.map((d) => ({
        ...d,
        progress: 0,
        isCompleted: false,
        claimedAt: null,
      }));
    }

    const activePeriodKeys = Array.from(new Set(definitions.map((d) => this.getPeriodKey(d.type))));
    const progressRows = await this.prisma.userQuestProgress.findMany({
      where: { userId, periodKey: { in: activePeriodKeys } },
    });

    const progressMap = new Map(progressRows.map((p) => [`${p.questId}:${p.periodKey}`, p]));

    return definitions.map((d) => {
      const periodKey = this.getPeriodKey(d.type);
      const row = progressMap.get(`${d.id}:${periodKey}`);
      return {
        id: d.id,
        code: d.code,
        title: d.title,
        description: d.description,
        type: d.type,
        action: d.action,
        targetCount: d.targetCount,
        rewardXp: d.rewardXp,
        rewardCoins: d.rewardCoins,
        progress: row?.progress || 0,
        isCompleted: row?.isCompleted || false,
        claimedAt: row?.claimedAt || null,
      };
    });
  }

  async claimQuest(userId: string, questId: string) {
    const quest = await this.prisma.questDefinition.findUnique({ where: { id: questId } });
    if (!quest || !quest.isActive) {
      throw new NotFoundException('Nhiệm vụ không tồn tại');
    }

    const periodKey = this.getPeriodKey(quest.type);

    const outcome = await this.prisma.$transaction(async (tx) => {
      const progress = await tx.userQuestProgress.findUnique({
        where: { userId_questId_periodKey: { userId, questId, periodKey } },
      });

      if (!progress || !progress.isCompleted) {
        throw new BadRequestException('Bạn chưa hoàn thành nhiệm vụ này');
      }
      if (progress.claimedAt) {
        throw new BadRequestException('Phần thưởng nhiệm vụ này đã được nhận');
      }

      const updatedFlag = await tx.userQuestProgress.updateMany({
        where: { id: progress.id, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (updatedFlag.count === 0) {
        throw new BadRequestException('Phần thưởng nhiệm vụ này đã được nhận');
      }

      return this.awardInTx(
        tx,
        userId,
        quest.rewardXp,
        quest.rewardCoins,
        'quest_claim',
        `${quest.code}:${periodKey}`,
        `Hoàn thành nhiệm vụ: ${quest.title}`,
      );
    });

    await this.notifyLevelUpIfNeeded(userId, outcome);

    return {
      questId: quest.id,
      rewardXp: quest.rewardXp,
      rewardCoins: quest.rewardCoins,
      user: outcome?.updatedUser || null,
    };
  }

  // ── User Cultivation Summary, Ledger & Leaderboards ──

  async getMyCultivation(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coins: true,
        experience: true,
        totalExperience: true,
        level: true,
        loginStreak: true,
        longestStreak: true,
        lastStreakDate: true,
        chaptersReadCount: true,
      },
    });

    const { dateStr, yesterdayStr } = this.getVnDateParts();
    const lastCheckInDate = user.lastStreakDate
      ? this.getVnDateParts(new Date(user.lastStreakDate)).dateStr
      : null;
    const isActiveStreak = lastCheckInDate === dateStr || lastCheckInDate === yesterdayStr;

    const [quests, recentTransactions] = await Promise.all([
      this.getQuestsForUser(userId),
      this.prisma.rewardTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    return {
      profile: {
        ...user,
        loginStreak: isActiveStreak ? user.loginStreak : 0,
        checkedInToday: lastCheckInDate === dateStr,
        cultivation: getCultivationInfo(user.level, user.experience),
      },
      quests,
      recentTransactions,
      realms: CULTIVATION_REALMS,
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20, currency?: string) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 50);
    const skip = (safePage - 1) * safeLimit;
    const where: Prisma.RewardTransactionWhereInput = { userId };
    if (currency === 'XP' || currency === 'COIN') where.currency = currency;

    const [items, total] = await Promise.all([
      this.prisma.rewardTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.rewardTransaction.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: skip + safeLimit < total,
      },
    };
  }

  async getLeaderboard(metric: 'xp' | 'streak' | 'chapters' = 'xp', limit = 20) {
    const take = Math.min(Math.max(Number(limit) || 20, 5), 50);
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      metric === 'streak'
        ? [{ longestStreak: 'desc' }, { loginStreak: 'desc' }, { totalExperience: 'desc' }]
        : metric === 'chapters'
          ? [{ chaptersReadCount: 'desc' }, { totalExperience: 'desc' }]
          : [{ totalExperience: 'desc' }, { level: 'desc' }];

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, isBanned: false },
      orderBy,
      take,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isVerified: true,
        isTrusted: true,
        level: true,
        experience: true,
        totalExperience: true,
        loginStreak: true,
        longestStreak: true,
        chaptersReadCount: true,
      },
    });

    return users.map((u, idx) => ({
      rank: idx + 1,
      ...u,
      cultivation: getCultivationInfo(u.level, u.experience),
    }));
  }
}
