import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RewardSource =
  | 'daily_login'
  | 'streak_bonus'
  | 'read_chapter'
  | 'comment'
  | 'rate'
  | 'bookmark'
  | 'level_up'
  | 'quest_claim'
  | 'activity_chest'
  | 'shop_purchase';

// Default config values (used if DB config not found)
const DEFAULTS: Record<string, number> = {
  xp_daily_login: 100, // Tọa Thiền Tụ Khí (+100 EXP)
  coin_daily_login: 5,
  xp_read_chapter: 3,
  coin_read_chapter: 1,
  xp_comment: 2,
  xp_rate: 5,
  coin_rate: 1,
  xp_bookmark: 1,
  coin_level_up: 10,
  xp_streak_bonus: 5,
  streak_max_days: 30,
};

export interface RealmInfo {
  realmIndex: number; // 1 to 8
  realmName: string;
  subLevel: number; // 1 to 10
  fullName: string; // e.g. "Kim Đan Tầng 4"
  title: string; // e.g. "Thiên Đạo Trúc Cơ"
  badge: string; // e.g. "Độc giả chân truyền OWOC"
  privileges: {
    title: string;
    description: string;
    icon: string;
  }[];
}

export const REALM_DEFINITIONS = [
  {
    name: 'Luyện Khí',
    minLevel: 1,
    maxLevel: 10,
    title: 'Phàm Nhân Nhập Đạo',
    description: 'Dẫn khí nhập thể, gột rửa phàm căn, ngưng tụ linh khí trong đan điền.',
    privileges: [
      { title: 'Tích Lũy Cơ Bản', description: 'Bắt đầu tích lũy chân khí từ việc đọc truyện tranh', icon: 'bolt' },
      { title: 'Bình Luận Đạo Hữu', description: 'Giao lưu thảo luận cùng các đạo hữu khác', icon: 'chat' },
      { title: 'Lưu Trữ Tủ Truyện', description: 'Theo dõi tối đa 50 bộ truyện yêu thích', icon: 'bookmarks' },
      { title: 'Nhật Khóa Sơ Khai', description: 'Tham gia nhiệm vụ tu luyện hàng ngày', icon: 'task_alt' },
    ],
  },
  {
    name: 'Trúc Cơ',
    minLevel: 11,
    maxLevel: 20,
    title: 'Đúc Đạo Trúc Cơ',
    description: 'Ngưng khí hóa dịch, đúc vững đạo cơ, thọ nguyên tăng gấp bội.',
    privileges: [
      { title: '+10% Tốc Độ Tích Lũy', description: 'Gia tăng EXP khi đọc truyện tranh đều đặn', icon: 'bolt' },
      { title: 'Khung Avatar Trúc Cơ', description: 'Viền đan khí lục sắc bao quanh hình đại diện', icon: 'palette' },
      { title: 'Huy Hiệu Tán Tu', description: 'Hiển thị huy hiệu Trúc Cơ trong khu bình luận', icon: 'military_tech' },
      { title: 'Mở Rộng Tủ Truyện', description: 'Lưu trữ không giới hạn bộ truyện yêu thích', icon: 'bookmarks' },
    ],
  },
  {
    name: 'Kim Đan',
    minLevel: 21,
    maxLevel: 30,
    title: 'Thiên Đạo Trúc Cơ',
    description: 'Đạo dịch hóa đan, cửu chuyển viên mãn, chân hỏa bất diệt.',
    privileges: [
      { title: '+20% Tốc Độ Tích Lũy', description: 'Gia tăng EXP khi đọc truyện tranh liên tục', icon: 'bolt' },
      { title: 'Khung Avatar Hoàng Kim', description: 'Viền hào quang Kim Đan rực rỡ độc bản', icon: 'palette' },
      { title: 'Danh Hiệu Động Bình Luận', description: 'Nổi bật giữa hàng vạn đạo hữu thảo luận', icon: 'chat' },
      { title: 'Huy Hiệu Thần Thông', description: 'Quyền bỏ phiếu bình chọn siêu phẩm mỗi tháng', icon: 'psychology' },
    ],
  },
  {
    name: 'Nguyên Anh',
    minLevel: 31,
    maxLevel: 40,
    title: 'Nguyên Thần Xuất Khiếu',
    description: 'Phá đan sinh anh, thần thức ngao du thái hư, thọ dữ thiên tề.',
    privileges: [
      { title: '+30% Chân Khí EXP', description: 'Tọa thiền nhận thêm 30% chân khí mỗi ngày', icon: 'bolt' },
      { title: 'Khung Tử Kim Đế Vương', description: 'Hào quang tím lam chuyển động vương giả', icon: 'palette' },
      { title: 'Thần Thức Tông Sư', description: 'Bình luận ghim đầu danh sách chương truyện', icon: 'push_pin' },
      { title: 'Túi Trữ Vật Thượng Phẩm', description: 'Tăng 20% Linh Thạch khi hoàn thành nhiệm vụ', icon: 'diamond' },
    ],
  },
  {
    name: 'Hóa Thần',
    minLevel: 41,
    maxLevel: 50,
    title: 'Thần Thông Quảng Đại',
    description: 'Dung hợp thiên địa, nắm giữ quy tắc tự nhiên, vạn pháp quy tâm.',
    privileges: [
      { title: '+40% Chân Khí EXP', description: 'Tăng tốc đột phá cảnh giới tối thượng', icon: 'bolt' },
      { title: 'Thần Thú Hộ Thể', description: 'Hiệu ứng hoạt họa độc quyền quanh avatar', icon: 'palette' },
      { title: 'Ngũ Hành Chi Lực', description: 'Màu tên tài khoản tùy biến theo sở thích', icon: 'brush' },
      { title: 'Quyền Trưởng Lão OWOC', description: 'Quyền đề xuất truyện vào danh sách Đề Cử', icon: 'verified' },
    ],
  },
  {
    name: 'Luyện Hư',
    minLevel: 51,
    maxLevel: 60,
    title: 'Phá Toái Hư Không',
    description: 'Thân hóa hư vô, siêu thoát lục đạo, xuyên toái càn khôn vũ trụ.',
    privileges: [
      { title: '+50% Chân Khí EXP', description: 'Hấp thu thiên địa linh khí thần tốc', icon: 'bolt' },
      { title: 'Hư Không Chi Giới', description: 'Khung hình đại diện hiệu ứng vũ trụ tinh tú', icon: 'blur_on' },
      { title: 'Tôn Giả Luận Đạo', description: 'Bình luận phát sáng đặc biệt có gắn biểu tượng riêng', icon: 'auto_awesome' },
      { title: 'Cực Phẩm Linh Thạch', description: 'Nhận rương đan dược quý hiếm hàng tuần', icon: 'inventory_2' },
    ],
  },
  {
    name: 'Hợp Thể',
    minLevel: 61,
    maxLevel: 70,
    title: 'Thiên Nhân Hợp Nhất',
    description: 'Chân thân hợp nhất, thiên địa đồng thọ, uy áp bao trùm cửu giới.',
    privileges: [
      { title: '+60% Chân Khí EXP', description: 'Chân khí cuồn cuộn không ngừng nghỉ', icon: 'bolt' },
      { title: 'Hào Quang Cửu Tiêu', description: 'Hào quang vàng ròng thượng cổ độc tôn', icon: 'brightness_high' },
      { title: 'Chân Nhân Lệnh', description: 'Quyền mở phòng thảo luận độc quyền', icon: 'campaign' },
      { title: 'Vạn Cổ Đan Dược', description: 'Nhân đôi phần thưởng chuỗi tu luyện điểm danh', icon: 'workspace_premium' },
    ],
  },
  {
    name: 'Đại Thừa',
    minLevel: 71,
    maxLevel: 100,
    title: 'Độ Kiếp Phi Thăng',
    description: 'Độ kiếp phi thăng, bước vào Tiên Giới, bất tử bất diệt vạn kiếp bất suy.',
    privileges: [
      { title: 'Phi Thăng Giới Bất Hủ', description: 'Tối đa hóa mọi chỉ số chân khí & đan điền', icon: 'stars' },
      { title: 'Vương Miện Tiên Tôn', description: 'Khung rồng thần thoại vĩnh cửu toàn nền tảng', icon: 'crown' },
      { title: 'Độc Bộ Thiên Hạ', description: 'Được ghi danh vĩnh viễn trên Bảng Phong Thần OWOC', icon: 'trophy' },
      { title: 'Vạn Pháp Quy Nhất', description: 'Mở khóa tất cả tính năng đặc biệt của OWOC', icon: 'all_inclusive' },
    ],
  },
];

export const SHOP_ITEMS = [
  {
    id: 'vip_chapter_pass',
    name: 'Thẻ Khóa Chương VIP',
    category: 'Thẻ Đặc Quyền',
    price: 50,
    icon: 'ticket',
    description: 'Mở khóa 1 chương truyện khóa VIP bất kỳ vĩnh viễn',
    badge: 'PHỔ BIẾN',
  },
  {
    id: 'breakthrough_pill',
    name: 'Đan Dược Đột Phá Hộ Thể',
    category: 'Đan Dược',
    price: 150,
    icon: 'flask-round-potion',
    description: 'Tăng 100% tỷ lệ đột phá thành công, phòng tránh tẩu hỏa nhập ma',
    badge: 'QUÝ HIẾM',
  },
  {
    id: 'avatar_frame_gold',
    name: 'Khung Kim Đan Huyễn Ảo',
    category: 'Trang Trí',
    price: 300,
    icon: 'palette',
    description: 'Khung đại diện viền vàng rực rỡ độc bản 30 ngày',
    badge: 'ĐỘC QUYỀN',
  },
  {
    id: 'exp_boost_24h',
    name: 'Thẻ Nhân Đôi EXP 24h',
    category: 'Phụ Trợ',
    price: 80,
    icon: 'bolt-lightning',
    description: 'Nhân đôi toàn bộ EXP nhận được khi đọc truyện trong 24 giờ',
    badge: 'HOT',
  },
  {
    id: 'rename_token',
    name: 'Thẻ Đổi Đạo Hiệu',
    category: 'Đặc Quyền',
    price: 100,
    icon: 'signature',
    description: 'Đổi tên hiển thị / đạo hiệu của bạn trên toàn hệ thống OWOC',
    badge: 'TIỆN ÍCH',
  },
  {
    id: 'author_flower',
    name: 'Hoa Tươi Tặng Tác Giả',
    category: 'Ủng Hộ',
    price: 20,
    icon: 'flower',
    description: 'Tặng hoa ủng hộ tác giả yêu thích, tăng độ hảo cảm',
    badge: 'TƯƠNG TÁC',
  },
];

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

  getConfig(key: string): number {
    return this.configCache.get(key) ?? DEFAULTS[key] ?? 0;
  }

  // ── Level formula: 100 * 1.5^(level-1) ──

  xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, Math.max(1, level) - 1));
  }

  // ── Realm Mapping ──

  calcRealm(level: number): RealmInfo {
    const effectiveLevel = Math.max(1, level);
    const realmIdx = Math.min(8, Math.max(1, Math.ceil(effectiveLevel / 10)));
    const def = REALM_DEFINITIONS[realmIdx - 1];
    const subLevel = ((effectiveLevel - 1) % 10) + 1;

    return {
      realmIndex: realmIdx,
      realmName: def.name,
      subLevel,
      fullName: `${def.name} Tầng ${subLevel}`,
      title: def.title,
      badge: `Độc giả chân truyền OWOC #${effectiveLevel.toString().padStart(4, '0')}`,
      privileges: def.privileges,
    };
  }

  // ── Cultivation Buff Engine ──

  getAuspiciousState(now: Date = new Date()) {
    // Giờ Việt Nam (UTC+7)
    const vnHour = (now.getUTCHours() + 7) % 24;

    // 3 khung giờ Hoàng Đạo tọa thiền:
    // 06:00 - 09:00: Tử Khí Đông Lai (Bình Minh)
    // 12:00 - 14:00: Dương Khí Cực Thịnh (Chính Ngọ)
    // 18:00 - 21:00: Âm Dương Giao Thoa (Hoàng Hôn)
    const windows = [
      { start: 6, end: 9, name: 'Tử Khí Đông Lai (Bình Minh)', range: '06:00 - 09:00' },
      { start: 12, end: 14, name: 'Dương Khí Cực Thịnh (Chính Ngọ)', range: '12:00 - 14:00' },
      { start: 18, end: 21, name: 'Âm Dương Giao Thoa (Hoàng Hôn)', range: '18:00 - 21:00' },
    ];

    const currentWindow = windows.find((w) => vnHour >= w.start && vnHour < w.end);
    const isAuspiciousHour = !!currentWindow;

    let nextWindow = '06:00 - 09:00 (Tử Khí Đông Lai)';
    if (vnHour < 6) {
      nextWindow = '06:00 - 09:00 (Tử Khí Đông Lai)';
    } else if (vnHour < 12) {
      nextWindow = '12:00 - 14:00 (Chính Ngọ)';
    } else if (vnHour < 18) {
      nextWindow = '18:00 - 21:00 (Hoàng Hôn)';
    } else if (vnHour >= 21) {
      nextWindow = '06:00 - 09:00 ngày mai (Tử Khí Đông Lai)';
    }

    return {
      isAuspiciousHour,
      multiplier: isAuspiciousHour ? 1.25 : 1.0,
      bonusPercent: 25,
      label: currentWindow ? currentWindow.name : 'Chưa đến giờ',
      windowRange: currentWindow ? currentWindow.range : nextWindow,
      nextWindow,
      vnHour,
    };
  }

  getReadingGoldenHourState(now: Date = new Date()) {
    const vnHour = (now.getUTCHours() + 7) % 24;
    // 20:00 - 23:00 Giờ Vàng Ngộ Đạo (x2 EXP đọc truyện)
    const isGoldenHour = vnHour >= 20 && vnHour < 23;
    return {
      isGoldenHour,
      multiplier: isGoldenHour ? 2.0 : 1.0,
      bonusPercent: 100,
      label: 'Tịch Mịch Huyền Quan (20:00 - 23:00)',
    };
  }

  getVeinAndRealmBuff(level: number) {
    const realm = this.calcRealm(level);
    const veinLevel = realm.realmIndex; // 1 to 8
    const multiplierMap: Record<number, number> = {
      1: 1.0,  // Luyện Khí: Linh Mạch Cấp 1 (Cơ bản)
      2: 1.1,  // Trúc Cơ: Linh Mạch Cấp 2 (+10% EXP)
      3: 1.2,  // Kim Đan: Linh Mạch Cấp 3 (+20% EXP)
      4: 1.3,  // Nguyên Anh: Linh Mạch Cấp 4 (+30% EXP)
      5: 1.4,  // Hóa Thần: Linh Mạch Cấp 5 (+40% EXP)
      6: 1.5,  // Luyện Hư: Linh Mạch Cấp 6 (+50% EXP)
      7: 1.6,  // Hợp Thể: Linh Mạch Cấp 7 (+60% EXP)
      8: 2.0,  // Đại Thừa: Linh Mạch Cấp 8 (+100% EXP - Đỉnh phong)
    };
    const realmMultiplier = multiplierMap[veinLevel] ?? 1.0;
    const bonusPercent = Math.round((realmMultiplier - 1) * 100);

    return {
      veinLevel,
      veinName: `Linh Mạch Cấp ${veinLevel}`,
      realmMultiplier,
      bonusPercent,
    };
  }


  // ── Core: award XP + coins in a transaction ──

  async award(
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

      if (xpAmount !== 0) {
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

      if (coinAmount !== 0) {
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

      // Check level up (auto level up nếu vượt ngưỡng)
      if (xpAmount > 0) {
        await this.processLevelUp(tx, userId, user.experience, user.level);
      }
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

  // ── Cultivation Profile ──

  async getCultivationProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        level: true,
        experience: true,
        coins: true,
        loginStreak: true,
        lastStreakDate: true,
        createdAt: true,
      },
    });

    if (!user) return null;

    const realm = this.calcRealm(user.level);
    const xpMax = this.xpForLevel(user.level);
    const expCurrent = user.experience;
    const expRemaining = Math.max(0, xpMax - expCurrent);
    const progressPercent = Math.min(100, Math.round((expCurrent / xpMax) * 10000) / 100);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastStreakStr = user.lastStreakDate
      ? new Date(user.lastStreakDate).toISOString().slice(0, 10)
      : null;
    const canCheckInToday = lastStreakStr !== todayStr;

    // Tính rank hiện tại trong máy chủ
    const higherUsersCount = await this.prisma.user.count({
      where: {
        OR: [
          { level: { gt: user.level } },
          { level: user.level, experience: { gt: user.experience } },
        ],
      },
    });
    const rank = higherUsersCount + 1;

    // Đếm số chương đã đọc ở cảnh giới này
    const chaptersRead = await this.prisma.readingHistory.count({
      where: { userId },
    });

    const veinBuff = this.getVeinAndRealmBuff(user.level);
    const auspicious = this.getAuspiciousState(now);
    const goldenHour = this.getReadingGoldenHourState(now);
    const baseMeditationXp = this.getConfig('xp_daily_login');
    const effectiveMeditationXp = Math.round(
      baseMeditationXp * auspicious.multiplier * veinBuff.realmMultiplier,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        rank,
        createdAt: user.createdAt,
      },
      stats: {
        level: user.level,
        coins: user.coins,
        experience: expCurrent,
        xpMax,
        expRemaining,
        progressPercent,
        loginStreak: user.loginStreak,
        canCheckInToday,
        lastStreakDate: user.lastStreakDate,
        chaptersRead,
        canBreakthrough: expCurrent >= xpMax,
      },
      realm,
      buffs: {
        veinLevel: veinBuff.veinLevel,
        veinName: veinBuff.veinName,
        realmMultiplier: veinBuff.realmMultiplier,
        realmBonusPercent: veinBuff.bonusPercent,
        isAuspiciousHour: auspicious.isAuspiciousHour,
        auspiciousBonusPercent: auspicious.bonusPercent,
        auspiciousLabel: auspicious.label,
        nextAuspiciousWindow: auspicious.nextWindow,
        windowRange: auspicious.windowRange,
        isReadingGoldenHour: goldenHour.isGoldenHour,
        readingGoldenLabel: goldenHour.label,
        effectiveMeditationXp,
        baseMeditationXp,
      },
    };
  }

  // ── Breakthrough (Độ Kiếp Đột Phá) ──

  async breakthrough(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, level: true, experience: true, coins: true },
    });

    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    const reqXp = this.xpForLevel(user.level);
    if (user.experience < reqXp) {
      return {
        success: false,
        message: `Chân khí chưa đầy! Cần tích lũy thêm ${reqXp - user.experience} EXP để ngưng tụ đạo quả.`,
      };
    }

    const newLevel = user.level + 1;
    const coinsReward = this.getConfig('coin_level_up') * 2; // Thưởng gấp đôi khi chủ động độ kiếp

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          level: newLevel,
          experience: Math.max(0, user.experience - reqXp),
          coins: { increment: coinsReward },
        },
      });

      await tx.rewardTransaction.create({
        data: {
          userId,
          type: 'COIN',
          amount: coinsReward,
          source: 'level_up',
          balanceAfter: user.coins + coinsReward,
          note: `Độ kiếp thành công thăng cấp ${user.level} → ${newLevel}`,
        },
      });
    });

    const newRealm = this.calcRealm(newLevel);

    return {
      success: true,
      newLevel,
      newRealm,
      coinsAwarded: coinsReward,
      message: `Chúc mừng đạo hữu độ kiếp thành công, bước vào ${newRealm.fullName}! (+${coinsReward} Linh Thạch)`,
    };
  }

  // ── Public checkin action ──

  async awardDailyLogin(userId: string) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + 'T00:00:00.000Z');

    const yesterdayDate = new Date(today);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { lastStreakDate: true, loginStreak: true, level: true },
      });
      if (!user) return { status: 'not_found' as const };

      const lastDateStr = user.lastStreakDate
        ? new Date(user.lastStreakDate).toISOString().slice(0, 10)
        : null;

      if (lastDateStr === todayStr) {
        return { status: 'already_claimed' as const, streak: user.loginStreak, level: user.level };
      }

      let newStreak: number;
      if (lastDateStr === yesterdayStr) {
        const maxStreak = this.getConfig('streak_max_days');
        newStreak = Math.min(user.loginStreak + 1, maxStreak);
      } else {
        newStreak = 1;
      }

      await tx.user.update({
        where: { id: userId },
        data: { loginStreak: newStreak, lastStreakDate: today },
      });

      return { status: 'success' as const, newStreak, level: user.level };
    });

    if (result.status === 'not_found') {
      return { success: false, message: 'Người dùng không tồn tại' };
    }

    if (result.status === 'already_claimed') {
      return {
        success: false,
        alreadyClaimed: true,
        streak: result.streak,
        message: 'Hôm nay đạo hữu đã tọa thiền tụ khí rồi, hãy quay lại vào ngày mai!',
      };
    }

    const baseXp = this.getConfig('xp_daily_login');
    const coins = this.getConfig('coin_daily_login');

    // Buff mechanics
    const auspicious = this.getAuspiciousState(now);
    const veinBuff = this.getVeinAndRealmBuff(result.level);

    const meditationXp = Math.round(baseXp * auspicious.multiplier * veinBuff.realmMultiplier);

    const buffNotes: string[] = [];
    if (auspicious.isAuspiciousHour) buffNotes.push(`Giờ Hoàng Đạo (+${auspicious.bonusPercent}%)`);
    if (veinBuff.bonusPercent > 0) buffNotes.push(`${veinBuff.veinName} (+${veinBuff.bonusPercent}%)`);
    const buffSuffix = buffNotes.length > 0 ? ` [${buffNotes.join(' • ')}]` : '';

    await this.award(
      userId,
      meditationXp,
      coins,
      'daily_login',
      todayStr,
      `Tọa thiền tụ khí ngày ${today.toLocaleDateString('vi-VN')}${buffSuffix}`,
    );

    let streakXp = 0;
    if (result.newStreak > 1) {
      streakXp = this.getConfig('xp_streak_bonus') * (result.newStreak - 1);
      await this.award(userId, streakXp, 0, 'streak_bonus', todayStr, `Streak ${result.newStreak} ngày (+${streakXp} EXP)`);
    }

    const totalXp = meditationXp + streakXp;

    return {
      success: true,
      newStreak: result.newStreak,
      xpAwarded: totalXp,
      meditationXp,
      streakXp,
      coinsAwarded: coins,
      isAuspiciousHour: auspicious.isAuspiciousHour,
      auspiciousLabel: auspicious.label,
      veinLevel: veinBuff.veinLevel,
      realmMultiplier: veinBuff.realmMultiplier,
      message: `Tọa thiền thành công! Tiếp nhận +${totalXp} chân khí EXP${buffSuffix} và +${coins} Linh Thạch.`,
    };
  }

  // ── Daily & Weekly Quests & Activity Chests ──

  async getDailyQuests(userId: string) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');

    // Đầu tuần (Thứ Hai 00:00 UTC)
    const dayOfWeek = now.getUTCDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(todayStart);
    monday.setUTCDate(monday.getUTCDate() - diffToMonday);

    // 1. Kiểm tra quest claims & chest claims
    const claimedRows = await this.prisma.rewardTransaction.findMany({
      where: {
        userId,
        source: { in: ['quest_claim', 'activity_chest'] },
        createdAt: { gte: monday },
      },
      select: { sourceId: true },
    });
    const claimedIds = new Set(claimedRows.map((r) => r.sourceId));

    // 2. Đếm số chương đọc hôm nay
    const chaptersReadToday = await this.prisma.rewardTransaction.count({
      where: {
        userId,
        source: 'read_chapter',
        createdAt: { gte: todayStart },
      },
    });

    // 3. Kiểm tra check-in hôm nay
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastStreakDate: true },
    });
    const lastStreakStr = user?.lastStreakDate
      ? new Date(user.lastStreakDate).toISOString().slice(0, 10)
      : null;
    const isCheckedInToday = lastStreakStr === todayStr;

    // 4. Đếm số bình luận hôm nay
    const commentsToday = await this.prisma.comment.count({
      where: {
        userId,
        createdAt: { gte: todayStart },
      },
    });

    // 5. Đếm số bookmark hôm nay
    const bookmarksToday = await this.prisma.bookmark.count({
      where: {
        userId,
        createdAt: { gte: todayStart },
      },
    });

    // 6. Tính số giờ đọc truyện tuần này
    const weeklyHistory = await this.prisma.readingHistory.findMany({
      where: {
        userId,
        readAt: { gte: monday },
      },
      select: { readingTime: true },
    });
    const totalSeconds = weeklyHistory.reduce((acc, h) => acc + (h.readingTime || 0), 0);
    const effectiveSeconds = Math.max(totalSeconds, weeklyHistory.length * 300);
    const estimatedReadingHours = Math.round((effectiveSeconds / 3600) * 10) / 10;

    const quests = [
      {
        id: 'read_5_chapters',
        type: 'daily',
        tag: 'Nhật Khóa',
        title: 'Đọc 5 chương truyện mới',
        current: Math.min(5, chaptersReadToday),
        target: 5,
        unit: 'chương',
        rewardXp: 80,
        rewardCoins: 10,
        rewardPoints: 25,
        rewardDisplay: '+80 EXP • +10 Linh Thạch',
        status: claimedIds.has(`read_5_chapters_${todayStr}`)
          ? 'CLAIMED'
          : chaptersReadToday >= 5
          ? 'CLAIMABLE'
          : 'IN_PROGRESS',
        actionUrl: '/the-loai',
        actionText: 'Đọc Truyện',
      },
      {
        id: 'daily_checkin',
        type: 'daily',
        tag: 'Nhật Khóa',
        title: 'Điểm danh tu luyện mỗi ngày',
        current: isCheckedInToday ? 1 : 0,
        target: 1,
        unit: 'lần',
        rewardXp: 100,
        rewardCoins: 5,
        rewardPoints: 20,
        rewardDisplay: '+100 EXP • +5 Linh Thạch',
        status: isCheckedInToday ? 'CLAIMED' : 'IN_PROGRESS',
        actionUrl: '#meditate',
        actionText: 'Tọa Thiền',
      },
      {
        id: 'comment_2_times',
        type: 'daily',
        tag: 'Nhật Khóa',
        title: 'Để lại 2 bình luận luận đạo có tâm',
        current: Math.min(2, commentsToday),
        target: 2,
        unit: 'bình luận',
        rewardXp: 60,
        rewardCoins: 5,
        rewardPoints: 20,
        rewardDisplay: '+60 EXP • +5 Linh Thạch',
        status: claimedIds.has(`comment_2_times_${todayStr}`)
          ? 'CLAIMED'
          : commentsToday >= 2
          ? 'CLAIMABLE'
          : 'IN_PROGRESS',
        actionUrl: '/the-loai',
        actionText: 'Làm Ngay',
      },
      {
        id: 'bookmark_1_comic',
        type: 'daily',
        tag: 'Nhật Khóa',
        title: 'Theo dõi 1 bộ truyện mới',
        current: Math.min(1, bookmarksToday),
        target: 1,
        unit: 'bộ',
        rewardXp: 50,
        rewardCoins: 0,
        rewardPoints: 15,
        rewardDisplay: '+50 EXP',
        status: claimedIds.has(`bookmark_1_comic_${todayStr}`)
          ? 'CLAIMED'
          : bookmarksToday >= 1
          ? 'CLAIMABLE'
          : 'IN_PROGRESS',
        actionUrl: '/the-loai',
        actionText: 'Khám Phá',
      },
      {
        id: 'read_3_hours_weekly',
        type: 'weekly',
        tag: 'Chu Kỳ Tuần',
        title: 'Tích lũy 3 giờ đọc truyện',
        current: Math.min(3.0, estimatedReadingHours),
        target: 3.0,
        unit: 'giờ',
        rewardXp: 300,
        rewardCoins: 20,
        rewardPoints: 50,
        rewardDisplay: '+300 EXP • 1 Rương Đan Dược Cổ',
        status: claimedIds.has(`read_3_hours_weekly_${monday.toISOString().slice(0, 10)}`)
          ? 'CLAIMED'
          : estimatedReadingHours >= 3.0
          ? 'CLAIMABLE'
          : 'IN_PROGRESS',
        actionUrl: '/truyen-moi',
        actionText: 'Tiếp Tục Đọc',
      },
    ];

    // Tính điểm năng động trong ngày
    let currentActivityPoints = 0;
    quests.forEach((q) => {
      if (q.type === 'daily' && (q.status === 'CLAIMED' || q.status === 'CLAIMABLE')) {
        currentActivityPoints += q.rewardPoints;
      }
    });

    const chestMilestones = [
      { points: 20, rewardXp: 30, rewardCoins: 2, isClaimed: claimedIds.has(`chest_20_${todayStr}`) },
      { points: 40, rewardXp: 50, rewardCoins: 5, isClaimed: claimedIds.has(`chest_40_${todayStr}`) },
      { points: 60, rewardXp: 80, rewardCoins: 8, isClaimed: claimedIds.has(`chest_60_${todayStr}`) },
      { points: 80, rewardXp: 120, rewardCoins: 12, isClaimed: claimedIds.has(`chest_80_${todayStr}`) },
      { points: 100, rewardXp: 200, rewardCoins: 20, isClaimed: claimedIds.has(`chest_100_${todayStr}`) },
    ];

    const completedCount = quests.filter((q) => q.status === 'CLAIMED' || q.status === 'CLAIMABLE').length;

    return {
      completedCount,
      totalCount: quests.length,
      activityPoints: Math.min(100, currentActivityPoints),
      chestMilestones,
      quests,
    };
  }

  async claimQuest(userId: string, questId: string) {
    const questsData = await this.getDailyQuests(userId);
    const quest = questsData.quests.find((q) => q.id === questId);

    if (!quest) {
      return { success: false, message: 'Nhiệm vụ không hợp lệ' };
    }

    if (quest.status === 'CLAIMED') {
      return { success: false, message: 'Nhiệm vụ này đạo hữu đã nhận thưởng rồi!' };
    }

    if (quest.status !== 'CLAIMABLE') {
      return { success: false, message: 'Chưa đủ điều kiện hoàn thành nhiệm vụ này' };
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sourceId = `${quest.id}_${todayStr}`;

    await this.award(
      userId,
      quest.rewardXp,
      quest.rewardCoins,
      'quest_claim',
      sourceId,
      `Thưởng nhiệm vụ: ${quest.title}`,
    );

    return {
      success: true,
      rewardXp: quest.rewardXp,
      rewardCoins: quest.rewardCoins,
      message: `Nhận thưởng thành công! +${quest.rewardXp} EXP và +${quest.rewardCoins} Linh Thạch.`,
    };
  }

  async claimChest(userId: string, milestone: number) {
    const questsData = await this.getDailyQuests(userId);
    const chest = questsData.chestMilestones.find((c) => c.points === milestone);

    if (!chest) return { success: false, message: 'Mốc rương không hợp lệ' };
    if (chest.isClaimed) return { success: false, message: 'Rương này đạo hữu đã mở hôm nay rồi!' };
    if (questsData.activityPoints < milestone) {
      return { success: false, message: `Chưa đủ điểm năng động! Cần ${milestone} điểm.` };
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sourceId = `chest_${milestone}_${todayStr}`;

    await this.award(
      userId,
      chest.rewardXp,
      chest.rewardCoins,
      'activity_chest',
      sourceId,
      `Mở rương năng động mốc ${milestone} điểm`,
    );

    return {
      success: true,
      rewardXp: chest.rewardXp,
      rewardCoins: chest.rewardCoins,
      message: `Mở rương thành công! +${chest.rewardXp} EXP và +${chest.rewardCoins} Linh Thạch.`,
    };
  }

  // ── Cultivation History (Lịch Sử Tu Hành) ──

  async getCultivationHistory(userId: string, limit = 50) {
    const transactions = await this.prisma.rewardTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        amount: true,
        source: true,
        sourceId: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const checkinLogs = await this.prisma.rewardTransaction.findMany({
      where: {
        userId,
        source: 'daily_login',
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    });

    const checkedDates = new Set(
      checkinLogs.map((l) => l.createdAt.toISOString().slice(0, 10))
    );

    return {
      transactions,
      checkedDates: Array.from(checkedDates),
    };
  }

  // ── Inventory & Shop (Túi Trữ Vật & Tiệm Linh Thạch) ──

  async getInventory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, experience: true, level: true },
    });

    if (!user) return null;

    const purchases = await this.prisma.rewardTransaction.findMany({
      where: {
        userId,
        source: 'shop_purchase',
      },
      select: {
        sourceId: true,
        createdAt: true,
      },
    });

    const itemCounts: Record<string, number> = {};
    purchases.forEach((p) => {
      if (p.sourceId) {
        itemCounts[p.sourceId] = (itemCounts[p.sourceId] || 0) + 1;
      }
    });

    const ownedItems = Object.entries(itemCounts).map(([itemId, count]) => {
      const shopItem = SHOP_ITEMS.find((s) => s.id === itemId) || {
        id: itemId,
        name: 'Vật phẩm tu tiên',
        category: 'Đặc Quyền',
        price: 0,
        icon: 'box',
        description: 'Vật phẩm quý hiếm',
        badge: 'SỞ HỮU',
      };
      return {
        ...shopItem,
        count,
      };
    });

    return {
      coins: user.coins,
      shopItems: SHOP_ITEMS,
      ownedItems,
    };
  }

  async redeemItem(userId: string, itemId: string) {
    const item = SHOP_ITEMS.find((s) => s.id === itemId);
    if (!item) return { success: false, message: 'Vật phẩm không tồn tại trong tiệm!' };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });

    if (!user) return { success: false, message: 'Người dùng không tồn tại' };

    if (user.coins < item.price) {
      return {
        success: false,
        message: `Linh Thạch không đủ! Cần ${item.price} Linh Thạch (Hiện có: ${user.coins}).`,
      };
    }

    await this.award(
      userId,
      0,
      -item.price,
      'shop_purchase',
      item.id,
      `Đổi tiên bảo: ${item.name}`,
    );

    return {
      success: true,
      message: `Đổi thành công "${item.name}"! Tiêu hao ${item.price} Linh Thạch.`,
      remainingCoins: user.coins - item.price,
    };
  }

  // ── Leaderboard ──

  async getLeaderboard(type: 'all' | 'weekly' | 'sect' = 'all', currentUserId?: string) {
    let topUsers: any[] = [];

    if (type === 'weekly') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const txs = await this.prisma.rewardTransaction.groupBy({
        by: ['userId'],
        where: {
          type: 'XP',
          createdAt: { gte: oneWeekAgo },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 30,
      });

      if (txs.length > 0) {
        const userIds = txs.map((t) => t.userId);
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, displayName: true, avatarUrl: true, level: true, experience: true },
        });

        const userMap = new Map(users.map((u) => [u.id, u]));
        topUsers = txs
          .map((t, idx) => {
            const u = userMap.get(t.userId);
            if (!u) return null;
            const realm = this.calcRealm(u.level);
            return {
              rank: idx + 1,
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              avatarUrl: u.avatarUrl,
              level: u.level,
              realmName: realm.fullName,
              experience: t._sum.amount || 0,
            };
          })
          .filter(Boolean);
      }
    }

    if (topUsers.length === 0) {
      const users = await this.prisma.user.findMany({
        take: 30,
        orderBy: [{ level: 'desc' }, { experience: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          level: true,
          experience: true,
        },
      });

      topUsers = users.map((u, idx) => {
        const realm = this.calcRealm(u.level);
        return {
          rank: idx + 1,
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          level: u.level,
          realmName: realm.fullName,
          experience: u.experience,
        };
      });
    }

    let currentUserRank: any = null;
    if (currentUserId) {
      const existingInTop = topUsers.find((u) => u.id === currentUserId);
      if (existingInTop) {
        currentUserRank = existingInTop;
      } else {
        const currUser = await this.prisma.user.findUnique({
          where: { id: currentUserId },
          select: { id: true, username: true, displayName: true, avatarUrl: true, level: true, experience: true },
        });
        if (currUser) {
          const higherCount = await this.prisma.user.count({
            where: {
              OR: [
                { level: { gt: currUser.level } },
                { level: currUser.level, experience: { gt: currUser.experience } },
              ],
            },
          });
          const realm = this.calcRealm(currUser.level);
          currentUserRank = {
            rank: higherCount + 1,
            id: currUser.id,
            username: currUser.username,
            displayName: currUser.displayName,
            avatarUrl: currUser.avatarUrl,
            level: currUser.level,
            realmName: realm.fullName,
            experience: currUser.experience,
          };
        }
      }
    }

    return {
      type,
      topUsers,
      currentUserRank,
    };
  }

  // ── Achievements ──

  async getAchievements(userId: string) {
    const chaptersRead = await this.prisma.readingHistory.count({ where: { userId } });
    const userComments = await this.prisma.comment.findMany({
      where: { userId },
      select: { likesCount: true },
    });
    const totalLikes = userComments.reduce((acc, c) => acc + c.likesCount, 0);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, coins: true },
    });

    const daysJoined = user
      ? Math.max(1, Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    return [
      {
        id: 'ancient_bookworm',
        category: 'Đọc Truyện',
        name: 'Mọt Sách Thượng Cổ',
        description: 'Đọc trên 500 chương truyện tranh',
        icon: 'menu_book',
        tier: chaptersRead >= 500 ? 'BẬC III' : chaptersRead >= 200 ? 'BẬC II' : 'BẬC I',
        rewardCoins: 100,
        isUnlocked: chaptersRead >= 50,
        progress: `${chaptersRead}/500`,
      },
      {
        id: 'discussion_master',
        category: 'Luận Đạo',
        name: 'Tông Sư Luận Đạo',
        description: 'Nhận 200 lượt thích cho các bình luận luận đạo',
        icon: 'forum',
        tier: totalLikes >= 200 ? 'BẬC III' : totalLikes >= 50 ? 'BẬC II' : 'BẬC I',
        rewardCoins: 80,
        isUnlocked: totalLikes >= 10,
        progress: `${totalLikes}/200`,
      },
      {
        id: 'reincarnation_warrior',
        category: 'Khám Phá',
        name: 'Chiến Binh Trùng Sinh',
        description: 'Đọc và lưu vào tủ truyện 10 bộ truyện trọng sinh',
        icon: 'cycle',
        tier: 'BẬC I',
        rewardCoins: 50,
        isUnlocked: true,
        progress: '10/10',
      },
      {
        id: 'owoc_guardian',
        category: 'Tu Hành',
        name: 'Hộ Pháp OWOC',
        description: 'Gắn bó tu hành cùng OWOC trên 100 ngày',
        icon: 'shield',
        tier: daysJoined >= 100 ? 'VINH DANH' : 'BẬC I',
        rewardCoins: 200,
        isUnlocked: daysJoined >= 30,
        progress: `${daysJoined}/100 ngày`,
      },
      {
        id: 'immortal_tycoon',
        category: 'Cống Hiến',
        name: 'Vạn Cổ Phú Hào',
        description: 'Tích lũy đạt mốc 1,000 Linh Thạch OWOC',
        icon: 'gem',
        tier: (user?.coins || 0) >= 1000 ? 'BẬC III' : 'BẬC I',
        rewardCoins: 150,
        isUnlocked: (user?.coins || 0) >= 300,
        progress: `${user?.coins || 0}/1000`,
      },
      {
        id: 'realm_sovereign',
        category: 'Tu Hành',
        name: 'Đế Vương Tiên Tôn',
        description: 'Đột phá đạt cảnh giới Nguyên Anh trở lên',
        icon: 'crown',
        tier: 'THƯỢNG CỔ',
        rewardCoins: 300,
        isUnlocked: false,
        progress: 'Kim Đan Tầng 4',
      },
    ];
  }

  // ── Existing awards ──

  async awardReadChapter(userId: string, chapterId: string) {
    if (await this.hasReward(userId, 'read_chapter', chapterId)) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { level: true },
    });
    const userLevel = user?.level ?? 1;

    const baseXp = this.getConfig('xp_read_chapter');
    const coins = this.getConfig('coin_read_chapter');

    const veinBuff = this.getVeinAndRealmBuff(userLevel);
    const goldenHour = this.getReadingGoldenHourState(new Date());

    const finalXp = Math.round(baseXp * goldenHour.multiplier * veinBuff.realmMultiplier);

    const buffNotes: string[] = [];
    if (goldenHour.isGoldenHour) buffNotes.push('Giờ Vàng Đọc Truyện (x2)');
    if (veinBuff.bonusPercent > 0) buffNotes.push(`${veinBuff.veinName} (+${veinBuff.bonusPercent}%)`);
    const buffSuffix = buffNotes.length > 0 ? ` [${buffNotes.join(' • ')}]` : '';

    await this.award(
      userId,
      finalXp,
      coins,
      'read_chapter',
      chapterId,
      `Đọc chương truyện${buffSuffix}`,
    );
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

  private async hasReward(userId: string, source: string, sourceId: string): Promise<boolean> {
    const existing = await this.prisma.rewardTransaction.findFirst({
      where: { userId, source, sourceId, type: 'XP' },
      select: { id: true },
    });
    return !!existing;
  }
}
