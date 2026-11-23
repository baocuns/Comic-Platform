export interface CultivationRealm {
  index: number;
  name: string;
  hanViet: string;
  minLevel: number;
  maxLevel: number;
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  description: string;
}

export const CULTIVATION_REALMS: CultivationRealm[] = [
  {
    index: 1,
    name: 'Phàm Nhân',
    hanViet: '凡人',
    minLevel: 1,
    maxLevel: 3,
    color: '#64748B',
    bgLight: '#F1F5F9',
    bgDark: 'rgba(100, 116, 139, 0.16)',
    borderLight: '#CBD5E1',
    borderDark: 'rgba(148, 163, 184, 0.28)',
    description: 'Khởi đầu hành trình khám phá thế giới truyện tranh.',
  },
  {
    index: 2,
    name: 'Luyện Khí',
    hanViet: '炼气',
    minLevel: 4,
    maxLevel: 9,
    color: '#2F855A',
    bgLight: '#ECFDF5',
    bgDark: 'rgba(52, 211, 153, 0.14)',
    borderLight: '#A7F3D0',
    borderDark: 'rgba(52, 211, 153, 0.28)',
    description: 'Hấp thụ linh khí từ từng trang truyện, khai mở kinh mạch.',
  },
  {
    index: 3,
    name: 'Trúc Cơ',
    hanViet: '筑基',
    minLevel: 10,
    maxLevel: 17,
    color: '#0E7490',
    bgLight: '#ECFEFF',
    bgDark: 'rgba(34, 211, 238, 0.14)',
    borderLight: '#A5F3FC',
    borderDark: 'rgba(34, 211, 238, 0.28)',
    description: 'Đặt nền móng vững chắc, thoát khỏi phàm tục.',
  },
  {
    index: 4,
    name: 'Kim Đan',
    hanViet: '金丹',
    minLevel: 18,
    maxLevel: 27,
    color: '#B45309',
    bgLight: '#FFFBEB',
    bgDark: 'rgba(251, 191, 36, 0.14)',
    borderLight: '#FDE68A',
    borderDark: 'rgba(251, 191, 36, 0.28)',
    description: 'Ngưng tụ kim đan rực rỡ, đọc giả kỳ cựu của cộng đồng.',
  },
  {
    index: 5,
    name: 'Nguyên Anh',
    hanViet: '元婴',
    minLevel: 28,
    maxLevel: 39,
    color: '#5458C4',
    bgLight: '#EEF2FF',
    bgDark: 'rgba(124, 130, 232, 0.16)',
    borderLight: '#C7D2FE',
    borderDark: 'rgba(124, 130, 232, 0.30)',
    description: 'Thần thức bao trùm vạn quyển, bình luận sắc sảo thấu triệt.',
  },
  {
    index: 6,
    name: 'Hóa Thần',
    hanViet: '化神',
    minLevel: 40,
    maxLevel: 54,
    color: '#7C3AED',
    bgLight: '#F5F3FF',
    bgDark: 'rgba(167, 139, 250, 0.16)',
    borderLight: '#DDD6FE',
    borderDark: 'rgba(167, 139, 250, 0.30)',
    description: 'Cảnh giới tinh thần siêu phàm, gắn bó bền bỉ mỗi ngày.',
  },
  {
    index: 7,
    name: 'Luyện Hư',
    hanViet: '炼虚',
    minLevel: 55,
    maxLevel: 71,
    color: '#BE185D',
    bgLight: '#FDF2F8',
    bgDark: 'rgba(244, 114, 182, 0.16)',
    borderLight: '#FBCFE8',
    borderDark: 'rgba(244, 114, 182, 0.30)',
    description: 'Dung hòa hư thực giữa ngôn từ và nét vẽ.',
  },
  {
    index: 8,
    name: 'Hợp Thể',
    hanViet: '合体',
    minLevel: 72,
    maxLevel: 89,
    color: '#C2410C',
    bgLight: '#FFF7ED',
    bgDark: 'rgba(234, 132, 108, 0.16)',
    borderLight: '#FED7AA',
    borderDark: 'rgba(234, 132, 108, 0.30)',
    description: 'Nhất thể đồng tâm cùng giới sáng tác, uy danh lừng lẫy.',
  },
  {
    index: 9,
    name: 'Đại Thừa',
    hanViet: '大乘',
    minLevel: 90,
    maxLevel: 999,
    color: '#9F1239',
    bgLight: '#FFF1F2',
    bgDark: 'rgba(251, 113, 133, 0.18)',
    borderLight: '#FECDD3',
    borderDark: 'rgba(251, 113, 133, 0.32)',
    description: 'Đỉnh cao tu vi truyện giới, truyền thuyết sống của OWOC.',
  },
];

export type CultivationSubStage = 'Sơ Kỳ' | 'Trung Kỳ' | 'Hậu Kỳ' | 'Đỉnh Phong';

export interface CultivationInfo {
  realm: CultivationRealm;
  subStage: CultivationSubStage;
  fullTitle: string;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progressPercent: number;
  nextRealm: CultivationRealm | null;
}

export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel <= 35) {
    return Math.floor(100 * Math.pow(1.35, safeLevel - 1));
  }
  const base35 = Math.floor(100 * Math.pow(1.35, 34));
  return Math.min(10_000_000, base35 + (safeLevel - 35) * 150_000);
}

export function getCultivationInfo(level: number, experience: number): CultivationInfo {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  const safeXp = Math.max(0, Math.floor(experience || 0));

  const realm =
    CULTIVATION_REALMS.find((r) => safeLevel >= r.minLevel && safeLevel <= r.maxLevel) ||
    CULTIVATION_REALMS[CULTIVATION_REALMS.length - 1];

  const nextRealmIndex = CULTIVATION_REALMS.findIndex((r) => r.index === realm.index) + 1;
  const nextRealm = nextRealmIndex < CULTIVATION_REALMS.length ? CULTIVATION_REALMS[nextRealmIndex] : null;

  const span = Math.max(1, Math.min(realm.maxLevel, 105) - realm.minLevel + 1);
  const offset = safeLevel - realm.minLevel;
  const ratio = offset / span;

  let subStage: CultivationSubStage = 'Sơ Kỳ';
  if (ratio >= 0.75) subStage = 'Đỉnh Phong';
  else if (ratio >= 0.5) subStage = 'Hậu Kỳ';
  else if (ratio >= 0.25) subStage = 'Trung Kỳ';

  const nextLevelXp = xpRequiredForLevel(safeLevel);
  const progressPercent = Math.min(100, Math.max(0, Math.round((safeXp / nextLevelXp) * 100)));

  return {
    realm,
    subStage,
    fullTitle: `${realm.name} · ${subStage}`,
    level: safeLevel,
    currentXp: safeXp,
    nextLevelXp,
    progressPercent,
    nextRealm,
  };
}

export function normalizeSearchText(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
