import { api } from './api-client';

export interface RealmInfo {
  realmIndex: number;
  realmName: string;
  subLevel: number;
  fullName: string;
  title: string;
  badge: string;
  description?: string;
  privileges: {
    title: string;
    description: string;
    icon: string;
  }[];
}

export interface CultivationBuffs {
  veinLevel: number;
  veinName: string;
  realmMultiplier: number;
  realmBonusPercent: number;
  isAuspiciousHour: boolean;
  auspiciousBonusPercent: number;
  auspiciousLabel: string;
  nextAuspiciousWindow: string;
  windowRange: string;
  isReadingGoldenHour: boolean;
  readingGoldenLabel: string;
  effectiveMeditationXp: number;
  baseMeditationXp: number;
}

export interface CultivationProfileResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      rank: number;
      createdAt: string;
    };
    stats: {
      level: number;
      coins: number;
      experience: number;
      xpMax: number;
      expRemaining: number;
      progressPercent: number;
      loginStreak: number;
      canCheckInToday: boolean;
      lastStreakDate: string | null;
      chaptersRead: number;
      canBreakthrough: boolean;
    };
    realm: RealmInfo;
    buffs?: CultivationBuffs;
  };
}

export interface QuestItem {
  id: string;
  type: 'daily' | 'weekly';
  tag: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  rewardXp: number;
  rewardCoins: number;
  rewardPoints: number;
  rewardDisplay: string;
  status: 'IN_PROGRESS' | 'CLAIMABLE' | 'CLAIMED';
  actionUrl: string;
  actionText: string;
}

export interface ChestMilestone {
  points: number;
  rewardXp: number;
  rewardCoins: number;
  isClaimed: boolean;
}

export interface QuestsResponse {
  success: boolean;
  data: {
    completedCount: number;
    totalCount: number;
    activityPoints: number;
    chestMilestones: ChestMilestone[];
    quests: QuestItem[];
  };
}

export interface LeaderboardRanker {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  realmName: string;
  experience: number;
}

export interface LeaderboardResponse {
  success: boolean;
  data: {
    type: string;
    topUsers: LeaderboardRanker[];
    currentUserRank: LeaderboardRanker | null;
  };
}

export interface AchievementItem {
  id: string;
  category?: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  rewardCoins: number;
  isUnlocked: boolean;
  progress: string;
}

export interface AchievementsResponse {
  success: boolean;
  data: AchievementItem[];
}

export interface RealmDefinitionItem {
  name: string;
  minLevel: number;
  maxLevel: number;
  title: string;
  description: string;
  privileges: {
    title: string;
    description: string;
    icon: string;
  }[];
}

export interface HistoryTransactionItem {
  id: string;
  type: string;
  amount: number;
  source: string;
  sourceId: string | null;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export interface HistoryResponse {
  success: boolean;
  data: {
    transactions: HistoryTransactionItem[];
    checkedDates: string[];
  };
}

export interface ShopItem {
  id: string;
  name: string;
  category: string;
  price: number;
  icon: string;
  description: string;
  badge: string;
}

export interface OwnedItem extends ShopItem {
  count: number;
}

export interface InventoryResponse {
  success: boolean;
  data: {
    coins: number;
    shopItems: ShopItem[];
    ownedItems: OwnedItem[];
  };
}

export const cultivationApi = {
  getProfile: (token: string) =>
    api.get<CultivationProfileResponse>('/gamification/profile', { token }),

  dailyCheckin: (token: string) =>
    api.post<{
      success: boolean;
      message: string;
      newStreak?: number;
      xpAwarded?: number;
      coinsAwarded?: number;
      alreadyClaimed?: boolean;
    }>('/gamification/daily-checkin', {}, { token }),

  breakthrough: (token: string) =>
    api.post<{
      success: boolean;
      message: string;
      newLevel?: number;
      newRealm?: RealmInfo;
      coinsAwarded?: number;
    }>('/gamification/breakthrough', {}, { token }),

  getRealms: () =>
    api.get<{ success: boolean; data: RealmDefinitionItem[] }>('/gamification/realms'),

  getQuests: (token: string) =>
    api.get<QuestsResponse>('/gamification/quests', { token }),

  claimQuest: (questId: string, token: string) =>
    api.post<{
      success: boolean;
      message: string;
      rewardXp?: number;
      rewardCoins?: number;
    }>(`/gamification/quests/${questId}/claim`, {}, { token }),

  claimChest: (milestone: number, token: string) =>
    api.post<{
      success: boolean;
      message: string;
      rewardXp?: number;
      rewardCoins?: number;
    }>(`/gamification/quests/chests/${milestone}/claim`, {}, { token }),

  getLeaderboard: (type: 'all' | 'weekly' | 'sect' = 'all', token?: string) =>
    api.get<LeaderboardResponse>(`/gamification/leaderboard?type=${type}`, {
      ...(token ? { token } : {}),
    }),

  getAchievements: (token: string) =>
    api.get<AchievementsResponse>('/gamification/achievements', { token }),

  getHistory: (token: string, limit?: number) =>
    api.get<HistoryResponse>(`/gamification/history${limit ? `?limit=${limit}` : ''}`, { token }),

  getInventory: (token: string) =>
    api.get<InventoryResponse>('/gamification/inventory', { token }),

  redeemItem: (itemId: string, token: string) =>
    api.post<{
      success: boolean;
      message: string;
      remainingCoins?: number;
    }>('/gamification/inventory/redeem', { itemId }, { token }),
};
