import {
  ApprovalStatus,
  ComicStatus,
  ComicType,
  ContentRating,
  NewsCategory,
  NotificationType,
  PrismaClient,
  QuestAction,
  QuestType,
  ReadingListStatus,
  ReportReason,
  ReportTargetType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { normalizeSearchText } from 'shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding OWOC 2.0 database...');

  // 1. Gamification Config
  const configs = [
    { key: 'xp_daily_login', value: 15, label: 'XP Điểm danh ngày', description: 'Kinh nghiệm điểm danh mỗi ngày' },
    { key: 'coin_daily_login', value: 5, label: 'Xu Điểm danh ngày', description: 'Xu nhận được mỗi ngày điểm danh' },
    { key: 'xp_streak_bonus', value: 5, label: 'XP Thưởng chuỗi ngày', description: 'XP cộng thêm theo từng ngày chuỗi' },
    { key: 'coin_streak_7_bonus', value: 25, label: 'Xu Thưởng mốc 7 ngày', description: 'Xu thưởng thêm ngày thứ 7' },
    { key: 'streak_max_days', value: 7, label: 'Số ngày chuỗi tối đa', description: 'Chu kỳ thưởng chuỗi' },
    { key: 'xp_read_chapter', value: 10, label: 'XP Đọc chương', description: 'XP khi đọc xong chương mới' },
    { key: 'coin_read_chapter', value: 2, label: 'Xu Đọc chương', description: 'Xu khi đọc chương lần đầu' },
    { key: 'xp_comment', value: 5, label: 'XP Bình luận', description: 'XP khi gửi bình luận' },
    { key: 'xp_rate', value: 15, label: 'XP Đánh giá truyện', description: 'XP đánh giá lần đầu' },
    { key: 'coin_rate', value: 5, label: 'Xu Đánh giá truyện', description: 'Xu đánh giá lần đầu' },
    { key: 'xp_bookmark', value: 5, label: 'XP Lưu truyện', description: 'XP khi thêm truyện vào tủ' },
    { key: 'coin_level_up', value: 15, label: 'Xu Thăng cấp', description: 'Xu thưởng mỗi lần thăng cấp' },
    { key: 'coin_welcome', value: 30, label: 'Xu Tân thủ', description: 'Xu tặng tài khoản mới' },
    { key: 'author_revenue_percent', value: 70, label: 'Tỷ lệ chia sẻ tác giả (%)', description: 'Doanh thu Xu cho tác giả' },
  ];

  for (const c of configs) {
    await prisma.gamificationConfig.upsert({
      where: { key: c.key },
      update: c,
      create: c,
    });
  }

  // 2. Genres
  const genreDefs = [
    { name: 'Tu Tiên', slug: 'tu-tien', icon: '✨', color: '#5458C4', description: 'Hành trình tu luyện, đột phá cảnh giới huyền huyễn', displayOrder: 1 },
    { name: 'Hành Động', slug: 'hanh-dong', icon: '⚔️', color: '#D96B52', description: 'Chiến đấu kịch tính, nhịp độ dồn dập', displayOrder: 2 },
    { name: 'Giả Tưởng', slug: 'gia-tuong', icon: '🪄', color: '#6D28D9', description: 'Thế giới ma thuật và sinh vật huyền bí', displayOrder: 3 },
    { name: 'Tình Cảm', slug: 'tinh-cam', icon: '🌸', color: '#E11D48', description: 'Câu chuyện lãng mạn nhẹ nhàng và sâu lắng', displayOrder: 4 },
    { name: 'Đời Thường', slug: 'doi-thuong', icon: '☕', color: '#059669', description: 'Nhịp sống bình dị, ấm áp chữa lành', displayOrder: 5 },
    { name: 'Hài Hước', slug: 'hai-huoc', icon: '😄', color: '#D97706', description: 'Mang lại tiếng cười sảng khoái mỗi ngày', displayOrder: 6 },
    { name: 'Bí Ẩn', slug: 'bi-an', icon: '🕯️', color: '#0E7490', description: 'Phá giải nút thắt và bí mật chôn giấu', displayOrder: 7 },
    { name: 'Lịch Sử', slug: 'lich-su', icon: '📜', color: '#9A3412', description: 'Lấy cảm hứng từ văn hóa và sử thi cổ đại', displayOrder: 8 },
    { name: 'Khoa Huyễn', slug: 'khoa-huyen', icon: '🛰️', color: '#2563EB', description: 'Tương lai công nghệ cao và viễn tưởng', displayOrder: 9 },
    { name: 'Võ Thuật', slug: 'vo-thuat', icon: '🥋', color: '#B45309', description: 'Tôn vinh tinh hoa võ học và môn phái', displayOrder: 10 },
    { name: 'Kinh Dị', slug: 'kinh-di', icon: '🌙', color: '#475569', description: 'Rùng rợn, tâm linh và siêu nhiên', displayOrder: 11 },
    { name: 'Ẩm Thực', slug: 'am-thuc', icon: '🥟', color: '#EA580C', description: 'Hương vị tinh tế qua từng khung tranh', displayOrder: 12 },
  ];

  const genresMap = new Map<string, string>();
  for (const g of genreDefs) {
    const row = await prisma.genre.upsert({
      where: { slug: g.slug },
      update: g,
      create: g,
    });
    genresMap.set(g.slug, row.id);
  }

  // 3. Quests
  const quests = [
    {
      code: 'daily_checkin',
      title: 'Điểm danh mỗi ngày',
      description: 'Đăng nhập và nhận linh khí điểm danh hàng ngày tại Tàng Kinh Các.',
      type: QuestType.DAILY,
      action: QuestAction.DAILY_CHECK_IN,
      targetCount: 1,
      rewardXp: 15,
      rewardCoins: 5,
      displayOrder: 1,
    },
    {
      code: 'daily_read_3',
      title: 'Đọc 3 chương truyện',
      description: 'Thưởng thức ít nhất 3 chương bất kỳ trong ngày hôm nay.',
      type: QuestType.DAILY,
      action: QuestAction.READ_CHAPTERS,
      targetCount: 3,
      rewardXp: 30,
      rewardCoins: 10,
      displayOrder: 2,
    },
    {
      code: 'daily_comment_1',
      title: 'Giao lưu cùng đạo hữu',
      description: 'Để lại 1 bình luận cảm nhận dưới chương hoặc trang truyện.',
      type: QuestType.DAILY,
      action: QuestAction.POST_COMMENT,
      targetCount: 1,
      rewardXp: 20,
      rewardCoins: 5,
      displayOrder: 3,
    },
    {
      code: 'daily_bookmark_1',
      title: 'Sưu tầm bảo điển',
      description: 'Lưu 1 bộ truyện yêu thích vào tủ sách cá nhân.',
      type: QuestType.DAILY,
      action: QuestAction.ADD_BOOKMARK,
      targetCount: 1,
      rewardXp: 15,
      rewardCoins: 5,
      displayOrder: 4,
    },
    {
      code: 'weekly_read_15',
      title: 'Tu luyện chuyên cần',
      description: 'Hoàn thành đọc 15 chương truyện trong tuần này.',
      type: QuestType.WEEKLY,
      action: QuestAction.READ_CHAPTERS,
      targetCount: 15,
      rewardXp: 120,
      rewardCoins: 35,
      displayOrder: 1,
    },
    {
      code: 'weekly_rate_2',
      title: 'Giám định phẩm chất',
      description: 'Đánh giá sao cho 2 bộ truyện bạn tâm đắc trong tuần.',
      type: QuestType.WEEKLY,
      action: QuestAction.RATE_COMIC,
      targetCount: 2,
      rewardXp: 60,
      rewardCoins: 20,
      displayOrder: 2,
    },
    {
      code: 'milestone_follow_1',
      title: 'Kết giao bằng hữu',
      description: 'Theo dõi tác giả hoặc đạo hữu đầu tiên trên nền tảng.',
      type: QuestType.MILESTONE,
      action: QuestAction.FOLLOW_AUTHOR,
      targetCount: 1,
      rewardXp: 40,
      rewardCoins: 15,
      displayOrder: 1,
    },
    {
      code: 'milestone_level_5',
      title: 'Bước vào Luyện Khí',
      description: 'Tu luyện đạt đến Cấp 5 trên hành trình Đạo Lộ.',
      type: QuestType.MILESTONE,
      action: QuestAction.REACH_LEVEL,
      targetCount: 5,
      rewardXp: 100,
      rewardCoins: 50,
      displayOrder: 2,
    },
  ];

  for (const q of quests) {
    await prisma.questDefinition.upsert({
      where: { code: q.code },
      update: q,
      create: q,
    });
  }

  // 4. Users
  const adminHash = await bcrypt.hash('Admin@2026', 12);
  const authorHash = await bcrypt.hash('Author@2026', 12);
  const readerHash = await bcrypt.hash('Reader@2026', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@owoc.vn',
      username: 'admin',
      passwordHash: adminHash,
      displayName: 'Chưởng Môn OWOC',
      role: UserRole.ADMIN,
      bio: 'Quản trị viên và người sáng lập hệ sinh thái truyện tranh bản quyền OWOC.',
      isVerified: true,
      isTrusted: true,
      emailVerifiedAt: new Date(),
      coins: 500,
      level: 42,
      experience: 320,
      totalExperience: 68500,
      loginStreak: 7,
      longestStreak: 21,
      chaptersReadCount: 312,
    },
  });

  const author1 = await prisma.user.create({
    data: {
      email: 'tacgia@owoc.vn',
      username: 'minh_hoa_su',
      passwordHash: authorHash,
      displayName: 'Xưởng Vẽ Lam Sơn',
      role: UserRole.AUTHOR,
      bio: 'Nhóm sáng tác truyện tranh thuần Việt — chuyên dòng Tu Tiên & Dân Gian.',
      isVerified: true,
      isTrusted: true,
      emailVerifiedAt: new Date(),
      coins: 240,
      level: 21,
      experience: 140,
      totalExperience: 19400,
      loginStreak: 5,
      longestStreak: 14,
      chaptersReadCount: 148,
    },
  });

  const author2 = await prisma.user.create({
    data: {
      email: 'saigonstudio@owoc.vn',
      username: 'saigon_ink',
      passwordHash: authorHash,
      displayName: 'Sài Gòn Ink',
      role: UserRole.AUTHOR,
      bio: 'Kể những câu chuyện bình dị và sắc màu đô thị Việt Nam.',
      isVerified: true,
      isTrusted: true,
      emailVerifiedAt: new Date(),
      coins: 180,
      level: 14,
      experience: 95,
      totalExperience: 8200,
      loginStreak: 4,
      longestStreak: 10,
      chaptersReadCount: 92,
    },
  });

  const reader1 = await prisma.user.create({
    data: {
      email: 'docgia@owoc.vn',
      username: 'dao_huu_an',
      passwordHash: readerHash,
      displayName: 'Đạo Hữu Thanh An',
      role: UserRole.READER,
      bio: 'Mê truyện tiên hiệp và đời thường chữa lành.',
      isVerified: true,
      emailVerifiedAt: new Date(),
      coins: 120,
      level: 11,
      experience: 65,
      totalExperience: 5100,
      loginStreak: 3,
      longestStreak: 9,
      chaptersReadCount: 84,
    },
  });

  const reader2 = await prisma.user.create({
    data: {
      email: 'linhchi@owoc.vn',
      username: 'linh_chi_24',
      passwordHash: readerHash,
      displayName: 'Linh Chi',
      role: UserRole.READER,
      bio: 'Đọc truyện mỗi tối trước khi ngủ ✨',
      isVerified: true,
      emailVerifiedAt: new Date(),
      coins: 75,
      level: 6,
      experience: 40,
      totalExperience: 2150,
      loginStreak: 2,
      longestStreak: 6,
      chaptersReadCount: 41,
    },
  });

  const reader3 = await prisma.user.create({
    data: {
      email: 'khaihoan@owoc.vn',
      username: 'khai_hoan',
      passwordHash: readerHash,
      displayName: 'Khải Hoàn',
      role: UserRole.READER,
      isVerified: true,
      emailVerifiedAt: new Date(),
      coins: 45,
      level: 30,
      experience: 200,
      totalExperience: 38900,
      loginStreak: 6,
      longestStreak: 18,
      chaptersReadCount: 224,
    },
  });

  // 5. Seed Comics + Chapters + Pages
  const seedPages = [
    '/seed/pages/page-1.webp',
    '/seed/pages/page-2.webp',
    '/seed/pages/page-3.webp',
    '/seed/pages/page-4.webp',
    '/seed/pages/page-5.webp',
    '/seed/pages/page-6.webp',
  ];

  const comicsSpec = [
    {
      authorId: author1.id,
      title: 'Vân Sơn Kiếm Lộ',
      slug: 'van-son-kiem-lo',
      alternativeTitles: ['Cloud Peak Sword Path'],
      description:
        'Giữa dãy Vân Sơn mù sương, thiếu niên mang thanh cổ kiếm gãy tình cờ khai mở ấn ký thượng cổ. Từ một đệ tử ngoại môn bị xem thường, cậu từng bước tu luyện, kết giao tri kỷ và khám phá bí ẩn sụp đổ của Cửu Châu.',
      artistName: 'Họa sĩ Minh Khôi',
      originalAuthor: 'Xưởng Vẽ Lam Sơn',
      coverUrl: '/seed/covers/cover-1.webp',
      bannerUrl: '/seed/banners/banner-1.webp',
      type: ComicType.VIETNAM,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.TEEN,
      releaseYear: 2026,
      tags: ['Kiếm Hiệp', 'Tu Luyện', 'Thuần Việt'],
      isFeatured: true,
      totalViews: 148500,
      dailyViews: 4200,
      weeklyViews: 26400,
      monthlyViews: 84200,
      genres: ['tu-tien', 'hanh-dong', 'vo-thuat'],
      chapters: [
        { number: 1, title: 'Đêm Đèn Lồng Trên Đỉnh Vân Sơn', isPremium: false, priceCoins: 0, views: 41200 },
        { number: 2, title: 'Cổ Tịch Trong Thạch Động', isPremium: false, priceCoins: 0, views: 34800 },
        { number: 3, title: 'Bước Vào Luyện Khí Tầng Ba', isPremium: false, priceCoins: 0, views: 29500 },
        { number: 4, title: 'Đại Hội Tông Môn (VIP)', isPremium: true, priceCoins: 15, views: 18200 },
      ],
    },
    {
      authorId: author2.id,
      title: 'Hoàng Hôn Trên Sân Thượng',
      slug: 'hoang-hon-tren-san-thuong',
      alternativeTitles: ['Saigon Sunset Sketchbook'],
      description:
        'Câu chuyện dịu dàng về hai họa sĩ trẻ tình cờ chia sẻ một góc sân thượng đầy hoa giấy giữa lòng Sài Gòn. Mỗi trang truyện là một khung màu hoàng hôn ấm áp về ước mơ, tuổi trẻ và những rung động đầu đời.',
      artistName: 'Trà My',
      originalAuthor: 'Sài Gòn Ink',
      coverUrl: '/seed/covers/cover-2.webp',
      bannerUrl: '/seed/banners/banner-2.webp',
      type: ComicType.WEBTOON,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.EVERYONE,
      releaseYear: 2026,
      tags: ['Sài Gòn', 'Hội Họa', 'Chữa Lành'],
      isFeatured: true,
      totalViews: 112400,
      dailyViews: 3900,
      weeklyViews: 24100,
      monthlyViews: 71900,
      genres: ['tinh-cam', 'doi-thuong'],
      chapters: [
        { number: 1, title: 'Mùa Hoa Giấy Tháng Tư', isPremium: false, priceCoins: 0, views: 38200 },
        { number: 2, title: 'Cuốn Phác Thảo Bỏ Quên', isPremium: false, priceCoins: 0, views: 31400 },
        { number: 3, title: 'Tách Cà Phê Chiều Mưa', isPremium: false, priceCoins: 0, views: 24900 },
        { number: 4, title: 'Triển Lãm Đầu Tiên (VIP)', isPremium: true, priceCoins: 10, views: 14100 },
      ],
    },
    {
      authorId: author1.id,
      title: 'Ảnh Đao Thợ Săn',
      slug: 'anh-dao-tho-san',
      alternativeTitles: ['Shadow Rune Hunter'],
      description:
        'Khi những vết nứt không gian xuất hiện khắp các đại đô thị, chỉ những thợ săn mang Song Đao Khắc Ấn mới đủ sức ngăn cản làn sóng ma thú từ khe nứt bóng đêm.',
      artistName: 'Khang Vũ',
      originalAuthor: 'Xưởng Vẽ Lam Sơn',
      coverUrl: '/seed/covers/cover-3.webp',
      bannerUrl: '/seed/banners/banner-3.webp',
      type: ComicType.MANHWA,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.TEEN,
      releaseYear: 2026,
      tags: ['Hầm Ngục', 'Song Đao', 'Huyền Ảo'],
      isFeatured: true,
      totalViews: 196800,
      dailyViews: 5800,
      weeklyViews: 34200,
      monthlyViews: 102000,
      genres: ['hanh-dong', 'gia-tuong', 'bi-an'],
      chapters: [
        { number: 1, title: 'Hồi Chuông Báo Động Hạng S', isPremium: false, priceCoins: 0, views: 54000 },
        { number: 2, title: 'Khế Ước Bóng Tối', isPremium: false, priceCoins: 0, views: 47200 },
        { number: 3, title: 'Cổng Hầm Ngục Đỏ', isPremium: true, priceCoins: 20, views: 31500 },
      ],
    },
    {
      authorId: author1.id,
      title: 'Cổ Tự Rồng Đá',
      slug: 'co-tu-rong-da',
      alternativeTitles: ['Moss Dragon Temple'],
      description:
        'Một nhà nghiên cứu văn hóa dân gian trở về ngôi cổ tự phủ rêu sau 12 năm vắng bóng, nơi bức tượng rồng đá bỗng phát sáng mỗi đêm trăng tròn.',
      artistName: 'Xưởng Vẽ Lam Sơn',
      originalAuthor: 'Xưởng Vẽ Lam Sơn',
      coverUrl: '/seed/covers/cover-4.webp',
      bannerUrl: '/seed/banners/banner-4.webp',
      type: ComicType.VIETNAM,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.TEEN,
      releaseYear: 2025,
      tags: ['Dân Gian', 'Trinh Thám', 'Cổ Trang'],
      isFeatured: false,
      totalViews: 76300,
      dailyViews: 2100,
      weeklyViews: 14800,
      monthlyViews: 42300,
      genres: ['bi-an', 'lich-su', 'kinh-di'],
      chapters: [
        { number: 1, title: 'Lá Thư Từ Ngôi Chùa Cổ', isPremium: false, priceCoins: 0, views: 27400 },
        { number: 2, title: 'Mật Mã Trên Bia Đá', isPremium: false, priceCoins: 0, views: 22100 },
        { number: 3, title: 'Đêm Rằm Tháng Bảy', isPremium: false, priceCoins: 0, views: 19400 },
      ],
    },
    {
      authorId: author2.id,
      title: 'Tiệm Bánh Mây Nhỏ',
      slug: 'tiem-banh-may-nho',
      alternativeTitles: ['Cloud Dumpling Kitchen'],
      description:
        'Hana thừa kế căn bếp gỗ nhỏ ở khu phố cổ với công thức làm bánh bao phát sáng mang lại ký ức hạnh phúc cho bất kỳ ai thưởng thức.',
      artistName: 'Sài Gòn Ink',
      originalAuthor: 'Sài Gòn Ink',
      coverUrl: '/seed/covers/cover-5.webp',
      bannerUrl: '/seed/banners/banner-5.webp',
      type: ComicType.MANGA,
      status: ComicStatus.COMPLETED,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.EVERYONE,
      releaseYear: 2025,
      tags: ['Ẩm Thực', 'Chữa Lành', 'Hoàn Thành'],
      isFeatured: false,
      totalViews: 89400,
      dailyViews: 1950,
      weeklyViews: 12900,
      monthlyViews: 39800,
      genres: ['am-thuc', 'doi-thuong', 'hai-huoc'],
      chapters: [
        { number: 1, title: 'Mẻ Bánh Đầu Ngày', isPremium: false, priceCoins: 0, views: 31200 },
        { number: 2, title: 'Vị Khách Đêm Mưa', isPremium: false, priceCoins: 0, views: 28100 },
        { number: 3, title: 'Hương Vị Quê Nhà (Hết)', isPremium: false, priceCoins: 0, views: 25600 },
      ],
    },
    {
      authorId: author2.id,
      title: 'Người Giao Hàng Đêm Mưa',
      slug: 'nguoi-giao-hang-dem-mua',
      alternativeTitles: ['Neon River Courier'],
      description:
        'Năm 2094, giữa thành phố sông nước rực ánh neon, Kai nhận vận chuyển những kiện hàng ký ức bị cấm mà không biết mình đang nắm giữ chìa khóa giải phóng mạng lưới thành phố.',
      artistName: 'Tuấn Kiệt',
      originalAuthor: 'Sài Gòn Ink',
      coverUrl: '/seed/covers/cover-6.webp',
      bannerUrl: '/seed/banners/banner-6.webp',
      type: ComicType.WEBTOON,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.TEEN,
      releaseYear: 2026,
      tags: ['Cyberpunk', 'Tương Lai', 'Đô Thị'],
      isFeatured: false,
      totalViews: 68200,
      dailyViews: 2650,
      weeklyViews: 16200,
      monthlyViews: 44100,
      genres: ['khoa-huyen', 'hanh-dong', 'bi-an'],
      chapters: [
        { number: 1, title: 'Đơn Hàng Số 009', isPremium: false, priceCoins: 0, views: 25400 },
        { number: 2, title: 'Đường Hầm Ánh Bạc', isPremium: false, priceCoins: 0, views: 21800 },
        { number: 3, title: 'Ký Ức Bị Đánh Cắp', isPremium: false, priceCoins: 0, views: 19000 },
      ],
    },
    {
      authorId: author1.id,
      title: 'Học Viện Trúc Lâm',
      slug: 'hoc-vien-truc-lam',
      alternativeTitles: ['Bamboo Scroll Academy'],
      description:
        'Thiếu niên hậu đậu nhất Trúc Lâm Môn chỉ muốn làm chân bưng trà quét sân, nhưng lại vô tình giải được toàn bộ kỳ trận khó nhất lịch sử học viện.',
      artistName: 'Xưởng Vẽ Lam Sơn',
      originalAuthor: 'Xưởng Vẽ Lam Sơn',
      coverUrl: '/seed/covers/cover-7.webp',
      bannerUrl: '/seed/banners/banner-7.webp',
      type: ComicType.MANHUA,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.EVERYONE,
      releaseYear: 2026,
      tags: ['Học Đường', 'Võ Lâm', 'Hài Hước'],
      isFeatured: false,
      totalViews: 94100,
      dailyViews: 3100,
      weeklyViews: 19400,
      monthlyViews: 58300,
      genres: ['hai-huoc', 'vo-thuat', 'tu-tien'],
      chapters: [
        { number: 1, title: 'Ngày Nhập Môn Bất Ổn', isPremium: false, priceCoins: 0, views: 34200 },
        { number: 2, title: 'Ba Ngàn Cuộn Bí Kíp', isPremium: false, priceCoins: 0, views: 29800 },
        { number: 3, title: 'Ấm Trà Độc Nhất Vô Nhị', isPremium: false, priceCoins: 0, views: 26100 },
      ],
    },
    {
      authorId: author2.id,
      title: 'Nhà Kính Thảo Mộc Pha Lê',
      slug: 'nha-kinh-thao-moc-pha-le',
      alternativeTitles: ['Crystal Herbarium'],
      description:
        'Trong khu nhà kính phủ đầy dương xỉ và tinh thể phát sáng, cô dược sư nhỏ chế tạo những lọ hương hoa giúp chữa lành giấc mơ cho người lữ hành.',
      artistName: 'An Nhiên',
      originalAuthor: 'Sài Gòn Ink',
      coverUrl: '/seed/covers/cover-8.webp',
      bannerUrl: '/seed/banners/banner-8.webp',
      type: ComicType.MANGA,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.APPROVED,
      contentRating: ContentRating.EVERYONE,
      releaseYear: 2026,
      tags: ['Giả Kim', 'Thảo Mộc', 'Nhẹ Nhàng'],
      isFeatured: false,
      totalViews: 61500,
      dailyViews: 2300,
      weeklyViews: 13700,
      monthlyViews: 37400,
      genres: ['gia-tuong', 'doi-thuong'],
      chapters: [
        { number: 1, title: 'Hạt Giống Ánh Trăng', isPremium: false, priceCoins: 0, views: 22900 },
        { number: 2, title: 'Sương Sớm Trên Lá Ngọc', isPremium: false, priceCoins: 0, views: 19800 },
        { number: 3, title: 'Bình Lọc Ký Ức', isPremium: false, priceCoins: 0, views: 17100 },
      ],
    },
    {
      authorId: author2.id,
      title: 'Bình Minh Trên Đỉnh Cổ Thụ',
      slug: 'binh-minh-tren-dinh-co-thu',
      alternativeTitles: ['Dawn Over Ancient Peaks'],
      description: 'Tác phẩm đang chờ kiểm duyệt từ Sài Gòn Ink về hành trình tìm kiếm cây đại thụ ngàn năm.',
      artistName: 'Sài Gòn Ink',
      originalAuthor: 'Sài Gòn Ink',
      coverUrl: '/seed/covers/cover-9.webp',
      bannerUrl: '/seed/banners/banner-9.webp',
      type: ComicType.VIETNAM,
      status: ComicStatus.ONGOING,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      contentRating: ContentRating.EVERYONE,
      releaseYear: 2026,
      tags: ['Phiêu Lưu', 'Chờ Duyệt'],
      isFeatured: false,
      totalViews: 0,
      dailyViews: 0,
      weeklyViews: 0,
      monthlyViews: 0,
      genres: ['gia-tuong', 'hanh-dong'],
      chapters: [
        { number: 1, title: 'Chuyến Đi Đầu Xuân', isPremium: false, priceCoins: 0, views: 0 },
      ],
    },
  ];

  const createdComics: Array<{ id: string; slug: string; title: string; chapters: Array<{ id: string; number: number }> }> = [];

  for (let idx = 0; idx < comicsSpec.length; idx++) {
    const spec = comicsSpec[idx];
    const now = new Date();
    const publishedAt = new Date(now.getTime() - (idx + 1) * 86400000 * 3);
    const lastChapterAt = new Date(now.getTime() - idx * 3600000 * 5);

    const searchText = normalizeSearchText(
      [spec.title, ...spec.alternativeTitles, ...spec.tags, spec.artistName, spec.originalAuthor].join(' '),
    );

    const comic = await prisma.comic.create({
      data: {
        authorId: spec.authorId,
        title: spec.title,
        slug: spec.slug,
        alternativeTitles: spec.alternativeTitles,
        searchText,
        description: spec.description,
        artistName: spec.artistName,
        originalAuthor: spec.originalAuthor,
        coverUrl: spec.coverUrl,
        bannerUrl: spec.bannerUrl,
        bannerPosition: 50,
        type: spec.type,
        status: spec.status,
        approvalStatus: spec.approvalStatus,
        contentRating: spec.contentRating,
        releaseYear: spec.releaseYear,
        tags: spec.tags,
        isFeatured: spec.isFeatured,
        totalViews: spec.totalViews,
        dailyViews: spec.dailyViews,
        weeklyViews: spec.weeklyViews,
        monthlyViews: spec.monthlyViews,
        totalChapters: spec.approvalStatus === ApprovalStatus.APPROVED ? spec.chapters.length : 0,
        publishedAt: spec.approvalStatus === ApprovalStatus.APPROVED ? publishedAt : null,
        lastChapterAt: spec.approvalStatus === ApprovalStatus.APPROVED ? lastChapterAt : null,
        genres: {
          create: spec.genres
            .map((slug) => genresMap.get(slug))
            .filter((id): id is string => Boolean(id))
            .map((genreId) => ({ genreId })),
        },
      },
    });

    const createdChapters: Array<{ id: string; number: number }> = [];
    for (let cIdx = 0; cIdx < spec.chapters.length; cIdx++) {
      const chSpec = spec.chapters[cIdx];
      const ch = await prisma.chapter.create({
        data: {
          comicId: comic.id,
          number: chSpec.number,
          title: chSpec.title,
          totalPages: seedPages.length,
          isPremium: chSpec.isPremium,
          priceCoins: chSpec.priceCoins,
          views: chSpec.views,
          approvalStatus: spec.approvalStatus,
          publishedAt:
            spec.approvalStatus === ApprovalStatus.APPROVED
              ? new Date(publishedAt.getTime() + cIdx * 86400000)
              : null,
          pages: {
            create: seedPages.map((url, pIdx) => ({
              pageNumber: pIdx + 1,
              imageUrl: url,
              thumbnailUrl: url,
              width: 900,
              height: 1350,
            })),
          },
        },
      });
      createdChapters.push({ id: ch.id, number: Number(ch.number) });
    }

    createdComics.push({ id: comic.id, slug: comic.slug, title: comic.title, chapters: createdChapters });
  }

  // Update Genre counts
  for (const genreId of genresMap.values()) {
    const count = await prisma.comicGenre.count({
      where: {
        genreId,
        comic: { approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
      },
    });
    await prisma.genre.update({ where: { id: genreId }, data: { comicCount: count } });
  }

  // 6. Ratings, Comments, Bookmarks, History, Follows
  const ratingSeeds = [
    { userId: reader1.id, comicIdx: 0, score: 5, review: 'Nét vẽ mượt mà, không khí tu tiên thuần Việt rất có chiều sâu!', helpfulCount: 14 },
    { userId: reader2.id, comicIdx: 0, score: 5, review: 'Càng đọc càng cuốn, hóng chương mới mỗi tuần.', helpfulCount: 8 },
    { userId: reader3.id, comicIdx: 0, score: 4, review: 'Mạch truyện chắc tay, xây dựng nhân vật phụ đáng nhớ.', helpfulCount: 5 },
    { userId: reader1.id, comicIdx: 1, score: 5, review: 'Bảng màu hoàng hôn quá dịu mắt, đọc buổi tối cực kỳ thư giãn.', helpfulCount: 19 },
    { userId: reader2.id, comicIdx: 1, score: 5, review: 'Sài Gòn trong truyện đẹp như một thước phim.', helpfulCount: 11 },
    { userId: reader3.id, comicIdx: 2, score: 5, review: 'Pha hành động mãn nhãn, nhịp truyện nhanh gọn.', helpfulCount: 22 },
    { userId: reader1.id, comicIdx: 2, score: 4, review: 'Hơi ngắn nhưng chất lượng từng khung hình rất đỉnh.', helpfulCount: 7 },
    { userId: reader2.id, comicIdx: 4, score: 5, review: 'Truyện ẩm thực chữa lành tuyệt vời nhất mùa này!', helpfulCount: 16 },
    { userId: reader3.id, comicIdx: 6, score: 5, review: 'Hài duyên dáng mà cảnh đánh nhau vẫn nghiêm túc.', helpfulCount: 9 },
  ];

  for (const r of ratingSeeds) {
    const comic = createdComics[r.comicIdx];
    await prisma.rating.create({
      data: {
        userId: r.userId,
        comicId: comic.id,
        score: r.score,
        review: r.review,
        helpfulCount: r.helpfulCount,
      },
    });
  }

  for (const c of createdComics) {
    const agg = await prisma.rating.aggregate({
      where: { comicId: c.id },
      _avg: { score: true },
      _count: { score: true },
    });
    await prisma.comic.update({
      where: { id: c.id },
      data: {
        avgRating: Number((agg._avg.score || 0).toFixed(2)),
        totalRatings: agg._count.score,
      },
    });
  }

  // Comments (Comic-level + Chapter-level + Replies)
  const c1 = await prisma.comment.create({
    data: {
      userId: reader1.id,
      comicId: createdComics[0].id,
      content: 'Tông môn trong Vân Sơn Kiếm Lộ thiết kế kiến trúc đậm nét Việt Nam, rất ấn tượng!',
      likesCount: 12,
      isPinned: true,
    },
  });
  await prisma.comment.create({
    data: {
      userId: author1.id,
      comicId: createdComics[0].id,
      parentId: c1.id,
      content: 'Cảm ơn đạo hữu đã nhận ra tâm huyết của nhóm vẽ! Chương 4 sẽ còn nhiều bất ngờ hơn.',
      likesCount: 8,
    },
  });
  await prisma.comment.create({
    data: {
      userId: reader2.id,
      comicId: createdComics[0].id,
      chapterId: createdComics[0].chapters[0].id,
      content: 'Khung cảnh đèn lồng đầu chương đẹp xuất sắc luôn ✨',
      likesCount: 6,
    },
  });
  await prisma.comment.create({
    data: {
      userId: reader3.id,
      comicId: createdComics[2].id,
      content: 'Đoạn cuối chương 2 nhân vật chính mở ấn ký nhìn ngầu thật sự (Spoiler: thực chất thanh kiếm đó thuộc về sư phụ).',
      isSpoiler: true,
      likesCount: 4,
    },
  });

  for (const c of createdComics) {
    const totalComments = await prisma.comment.count({ where: { comicId: c.id, deletedAt: null } });
    await prisma.comic.update({ where: { id: c.id }, data: { totalComments } });
  }

  // Bookmarks & History
  await prisma.bookmark.createMany({
    data: [
      { userId: reader1.id, comicId: createdComics[0].id, status: ReadingListStatus.READING, isFavorite: true, lastChapterId: createdComics[0].chapters[1].id, lastPage: 3 },
      { userId: reader1.id, comicId: createdComics[1].id, status: ReadingListStatus.READING, isFavorite: true },
      { userId: reader1.id, comicId: createdComics[4].id, status: ReadingListStatus.COMPLETED, isFavorite: false },
      { userId: admin.id, comicId: createdComics[0].id, status: ReadingListStatus.READING, isFavorite: true },
      { userId: admin.id, comicId: createdComics[2].id, status: ReadingListStatus.PLAN_TO_READ, isFavorite: false },
    ],
  });

  for (const c of createdComics) {
    const totalBookmarks = await prisma.bookmark.count({ where: { comicId: c.id } });
    await prisma.comic.update({ where: { id: c.id }, data: { totalBookmarks } });
  }

  await prisma.readingHistory.createMany({
    data: [
      {
        userId: reader1.id,
        comicId: createdComics[0].id,
        chapterId: createdComics[0].chapters[0].id,
        lastPage: 6,
        totalPages: 6,
        isCompleted: true,
        readingTimeSeconds: 185,
      },
      {
        userId: reader1.id,
        comicId: createdComics[0].id,
        chapterId: createdComics[0].chapters[1].id,
        lastPage: 3,
        totalPages: 6,
        isCompleted: false,
        readingTimeSeconds: 90,
      },
    ],
  });

  await prisma.follow.createMany({
    data: [
      { followerId: reader1.id, followingId: author1.id },
      { followerId: reader2.id, followingId: author1.id },
      { followerId: reader1.id, followingId: author2.id },
    ],
  });

  // 7. News Articles
  const newsSeeds = [
    {
      authorId: admin.id,
      title: 'Ra mắt OWOC 2.0: Không gian đọc truyện Warm Editorial & Hệ thống Cảnh giới Tu Luyện mới',
      slug: 'ra-mat-owoc-2-khong-gian-doc-truyen-va-canh-gioi-tu-luyen',
      excerpt: 'Trải nghiệm giao diện Giấy Ấm & Đêm Mực dịu mắt hơn, trình đọc đa chế độ cùng hệ thống nhiệm vụ ngày và mở khóa chương VIP bằng Xu.',
      content: `## Chào mừng đến với OWOC 2.0\n\nSau thời gian tái cấu trúc toàn diện từ nền tảng dữ liệu đến trải nghiệm thị giác, **OWOC 2.0** chính thức ra mắt với triết lý thiết kế **Warm Editorial**.\n\n### Những nâng cấp nổi bật\n\n- **Bảng màu dịu mắt dài lâu**: Giấy ấm \`#FAF8F5\` kết hợp chế độ Đêm mực \`#111318\` cùng điểm nhấn Indigo và San hô ấm, giúp đọc hàng giờ không mỏi mắt.\n- **Trình đọc nâng cấp**: Hỗ trợ Cuộn dọc vô tận, Từng trang, Trang đôi, Tự động cuộn thông minh và bộ lọc ánh sáng ấm.\n- **Tàng Kinh Các & Tu Luyện**: 9 Cảnh giới từ Phàm Nhân đến Đại Thừa, chuỗi điểm danh 7 ngày và bảng nhiệm vụ ngày/tuần sinh động.\n- **Đồng hành cùng Tác giả Việt**: Doanh thu mở khóa chương VIP được chia sẻ trực tiếp 70% về ví tác giả.`,
      coverUrl: '/seed/news/news-1.webp',
      category: NewsCategory.FEATURED,
      tags: ['OWOC 2.0', 'Cập nhật', 'Tu Luyện'],
      isPinned: true,
      viewCount: 1420,
      likesCount: 48,
    },
    {
      authorId: author1.id,
      title: 'Hậu trường sáng tác Vân Sơn Kiếm Lộ: Từ phác thảo chì đến thế giới cổ phong',
      slug: 'hau-truong-sang-tac-van-son-kiem-lo',
      excerpt: 'Chia sẻ từ Xưởng Vẽ Lam Sơn về quá trình nghiên cứu phục trang và kiến trúc đình chùa Việt Nam khi dựng bối cảnh.',
      content: `Khi bắt đầu dự án **Vân Sơn Kiếm Lộ**, đội ngũ muốn mỗi khung tranh không chỉ mang chất kiếm hiệp mà còn gợi nhắc vẻ trầm mặc của núi non Bắc Bộ.\n\nChúng tôi sử dụng bảng màu chàm trầm phối hợp ánh đèn lồng ấm để tạo chiều sâu không gian ngay từ chương đầu tiên.`,
      coverUrl: '/seed/news/news-2.webp',
      category: NewsCategory.COMMUNITY,
      tags: ['Hậu trường', 'Tác giả Việt'],
      isPinned: false,
      viewCount: 680,
      likesCount: 29,
    },
    {
      authorId: admin.id,
      title: 'Sự kiện Đua Top Đạo Lộ Mùa Thu: Săn Xu & Danh hiệu Đại Thừa',
      slug: 'su-kien-dua-top-dao-lo-mua-thu',
      excerpt: 'Hoàn thành nhiệm vụ đọc truyện và điểm danh liên tiếp 7 ngày để nhận gấp đôi Xu thưởng trong tuần lễ khai mở.',
      content: `Trong suốt sự kiện Mùa Thu, mọi độc giả hoàn thành chuỗi điểm danh 7 ngày sẽ nhận thêm gói **25 Xu Linh Thạch** và cơ hội thăng bậc trên Bảng Xếp Hạng Tàng Kinh Các.`,
      coverUrl: '/seed/news/news-3.webp',
      category: NewsCategory.EVENT,
      tags: ['Sự kiện', 'Đua Top'],
      isPinned: false,
      viewCount: 890,
      likesCount: 37,
    },
    {
      authorId: admin.id,
      title: 'Hướng dẫn dành cho Họa sĩ Indie: Tối ưu trang truyện khi tải lên Author Studio',
      slug: 'huong-dan-hoa-si-indie-toi-uu-trang-truyen',
      excerpt: 'Chuẩn kích thước chiều rộng 1280px, tự động chuyển đổi WebP siêu nhẹ và kéo thả sắp xếp thứ tự trang tức thì.',
      content: `Author Studio mới hỗ trợ kéo thả hàng loạt lên đến 100 trang ảnh mỗi lần tải lên. Hệ thống tự động tối ưu WebP giữ trọn độ sắc nét mà tải nhanh hơn gấp 3 lần.`,
      coverUrl: '/seed/news/news-4.webp',
      category: NewsCategory.UPDATE,
      tags: ['Author Studio', 'Hướng dẫn'],
      isPinned: false,
      viewCount: 510,
      likesCount: 21,
    },
    {
      authorId: author2.id,
      title: 'Top 5 bộ truyện nhẹ nhàng chữa lành đáng đọc cuối tuần',
      slug: 'top-5-bo-truyen-chua-lanh-cuoi-tuan',
      excerpt: 'Từ Hoàng Hôn Trên Sân Thượng đến Tiệm Bánh Mây Nhỏ — những câu chuyện ấm áp xua tan mệt mỏi.',
      content: `Cuối tuần này hãy pha một tách trà ấm và ghé qua danh sách những tác phẩm Đời Thường đầy cảm xúc trên OWOC.`,
      coverUrl: '/seed/news/news-5.webp',
      category: NewsCategory.ANNOUNCEMENT,
      tags: ['Đề xuất', 'Chữa lành'],
      isPinned: false,
      viewCount: 730,
      likesCount: 31,
    },
  ];

  for (let i = 0; i < newsSeeds.length; i++) {
    const n = newsSeeds[i];
    await prisma.newsArticle.create({
      data: {
        ...n,
        readTimeMinutes: 3,
        isPublished: true,
        approvalStatus: ApprovalStatus.APPROVED,
        publishedAt: new Date(Date.now() - i * 86400000),
      },
    });
  }

  // 8. Notifications & Reward Ledger & 1 Sample Report
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        type: NotificationType.SYSTEM,
        title: 'Chào mừng trở lại OWOC 2.0!',
        content: 'Có 1 tác phẩm mới đang chờ kiểm duyệt trong Hàng đợi Studio.',
        actionUrl: '/studio/moderation',
      },
      {
        userId: reader1.id,
        type: NotificationType.NEW_CHAPTER,
        title: 'Vân Sơn Kiếm Lộ vừa cập nhật Chương 4!',
        content: 'Chương 4: Đại Hội Tông Môn đã sẵn sàng để mở khóa.',
        actionUrl: `/comics/${createdComics[0].slug}`,
      },
    ],
  });

  await prisma.rewardTransaction.createMany({
    data: [
      { userId: reader1.id, currency: 'COIN', amount: 30, source: 'welcome_bonus', balanceAfter: 30, note: 'Quà tặng gia nhập OWOC' },
      { userId: reader1.id, currency: 'XP', amount: 15, source: 'daily_login', balanceAfter: 5100, note: 'Điểm danh chuỗi 3 ngày' },
      { userId: reader1.id, currency: 'COIN', amount: 10, source: 'quest_claim', balanceAfter: 120, note: 'Hoàn thành nhiệm vụ Đọc 3 chương' },
    ],
  });

  await prisma.report.create({
    data: {
      reporterId: reader2.id,
      targetType: ReportTargetType.COMMENT,
      targetId: c1.id,
      reason: ReportReason.OTHER,
      description: 'Báo cáo thử nghiệm để kiểm tra hàng đợi xử lý khiếu nại trong Admin Dashboard.',
    },
  });

  console.log('✅ Seed completed! Admin: admin@owoc.vn / Admin@2026 | Author: tacgia@owoc.vn / Author@2026 | Reader: docgia@owoc.vn / Reader@2026');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
