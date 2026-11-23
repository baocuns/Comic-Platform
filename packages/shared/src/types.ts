import {
  ApprovalStatus,
  AuthorApplicationStatus,
  ComicStatus,
  ComicType,
  ContentRating,
  ModerationTargetType,
  NewsCategory,
  NotificationType,
  QuestAction,
  QuestType,
  ReadingListStatus,
  ReportReason,
  ReportResolutionAction,
  ReportStatus,
  ReportTargetType,
  UserRole,
} from './enums';
import { CultivationInfo } from './cultivation';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode?: number;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface UserPreferences {
  readingMode?: 'scroll' | 'page' | 'double';
  readerTheme?: 'ink' | 'oled' | 'paper' | 'sepia';
  readerWidth?: 'narrow' | 'medium' | 'wide' | 'full';
  pageGap?: number;
  brightness?: number;
  warmth?: number;
  autoLoadNext?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number;
  role: UserRole;
  bio: string | null;
  socialLinks: Record<string, string>;
  isVerified: boolean;
  isTrusted: boolean;
  isBanned: boolean;
  coins: number;
  experience: number;
  totalExperience: number;
  level: number;
  loginStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  chaptersReadCount: number;
  preferences: UserPreferences;
  cultivation?: CultivationInfo;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  bannerPosition?: number;
  role: UserRole;
  bio?: string | null;
  socialLinks?: Record<string, string>;
  isVerified: boolean;
  isTrusted: boolean;
  level: number;
  experience?: number;
  totalExperience?: number;
  chaptersReadCount?: number;
  cultivation?: CultivationInfo;
  createdAt?: string;
}

export interface GenreItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  comicCount: number;
  displayOrder: number;
  isActive: boolean;
}

export interface ComicStats {
  totalViews: number;
  dailyViews: number;
  weeklyViews: number;
  monthlyViews: number;
  avgRating: number;
  totalRatings: number;
  totalBookmarks: number;
  totalChapters: number;
  totalComments: number;
}

export interface ChapterPreview {
  id: string;
  number: number;
  title: string | null;
  isPremium: boolean;
  priceCoins: number;
  publishedAt: string | null;
}

export interface ComicSummary {
  id: string;
  title: string;
  slug: string;
  alternativeTitles: string[];
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number;
  type: ComicType;
  status: ComicStatus;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  contentRating: ContentRating;
  originalLanguage: string;
  releaseYear: number | null;
  tags: string[];
  isFeatured: boolean;
  author: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'level' | 'isVerified' | 'isTrusted'>;
  genres: Array<Pick<GenreItem, 'id' | 'name' | 'slug' | 'icon' | 'color'>>;
  stats: ComicStats;
  latestChapters?: ChapterPreview[];
  publishedAt: string | null;
  lastChapterAt: string | null;
  recommendReason?: string;
}

export interface ChapterSummary {
  id: string;
  comicId: string;
  number: number;
  title: string | null;
  totalPages: number;
  isPremium: boolean;
  priceCoins: number;
  views: number;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  isUnlocked?: boolean;
  isRead?: boolean;
}

export interface RatingBreakdown {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ComicDetail extends ComicSummary {
  artistName: string | null;
  originalAuthor: string | null;
  chapters: ChapterSummary[];
  ratingBreakdown: RatingBreakdown;
  userState?: {
    isBookmarked: boolean;
    readingStatus: ReadingListStatus | null;
    isFavorite: boolean;
    notifyUpdate: boolean;
    lastChapterId: string | null;
    lastPage: number | null;
    unlockedChapterIds: string[];
    readChapterIds: string[];
    myRating: { id: string; score: number; review: string | null } | null;
    isFollowingAuthor: boolean;
  };
}

export interface PageItem {
  id: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  fileSize?: number | null;
}

export interface ChapterNavTarget {
  id: string;
  number: number;
  title: string | null;
  isPremium: boolean;
  priceCoins: number;
  isUnlocked: boolean;
}

export interface ChapterNavigation {
  prev: ChapterNavTarget | null;
  next: ChapterNavTarget | null;
}

export interface ChapterDetail {
  id: string;
  comicId: string;
  number: number;
  title: string | null;
  totalPages: number;
  isPremium: boolean;
  priceCoins: number;
  views: number;
  approvalStatus: ApprovalStatus;
  publishedAt: string | null;
  isLocked: boolean;
  comic: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    type: ComicType;
    authorId: string;
    author?: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  };
  pages: PageItem[];
  navigation: ChapterNavigation;
}

export interface CommentItem {
  id: string;
  userId: string;
  comicId: string;
  chapterId: string | null;
  parentId: string | null;
  content: string;
  likesCount: number;
  isPinned: boolean;
  isSpoiler: boolean;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
  user: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'level' | 'role'>;
  chapter?: { id: string; number: number; title: string | null } | null;
  replies?: CommentItem[];
  _count?: { replies: number };
}

export interface RatingItem {
  id: string;
  userId: string;
  comicId: string;
  score: number;
  review: string | null;
  helpfulCount: number;
  isHelpful?: boolean;
  createdAt: string;
  updatedAt: string;
  user: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'level'>;
}

export interface BookmarkItem {
  id: string;
  comicId: string;
  status: ReadingListStatus;
  isFavorite: boolean;
  notifyUpdate: boolean;
  lastChapterId: string | null;
  lastPage: number | null;
  createdAt: string;
  updatedAt: string;
  comic: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    type: ComicType;
    status: ComicStatus;
    totalChapters: number;
    avgRating: number;
    lastChapterAt: string | null;
    author: Pick<PublicUser, 'id' | 'username' | 'displayName'>;
    latestChapter?: { id: string; number: number } | null;
  };
}

export interface HistoryItem {
  id: string;
  comicId: string;
  chapterId: string;
  lastPage: number;
  totalPages: number;
  isCompleted: boolean;
  readingTimeSeconds: number;
  readAt: string;
  comic: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    type: ComicType;
    totalChapters: number;
  };
  chapter: {
    id: string;
    number: number;
    title: string | null;
    totalPages: number;
  };
}

export interface QuestItem {
  id: string;
  code: string;
  title: string;
  description: string;
  type: QuestType;
  action: QuestAction;
  targetCount: number;
  rewardXp: number;
  rewardCoins: number;
  progress: number;
  isCompleted: boolean;
  claimedAt: string | null;
}

export interface RewardTransactionItem {
  id: string;
  currency: 'XP' | 'COIN';
  amount: number;
  source: string;
  sourceId: string | null;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  content: string | null;
  actionUrl: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverUrl: string | null;
  category: NewsCategory;
  tags: string[];
  readTimeMinutes: number;
  isPinned: boolean;
  isPublished: boolean;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  viewCount: number;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'role'>;
}

export interface ReportTargetOwner {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isTrusted?: boolean;
  isBanned?: boolean;
  bannedUntil?: string | null;
}

export interface ReportTargetPreview {
  exists: boolean;
  isDeleted: boolean;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
  linkUrl?: string | null;
  studioUrl?: string | null;
  statusBadge?: string | null;
  contentRating?: ContentRating | null;
  isSpoiler?: boolean;
  pagesPreview?: Array<{ pageNumber: number; imageUrl: string }>;
  owner?: ReportTargetOwner | null;
}

export interface ReportItem {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  resolutionAction?: ReportResolutionAction | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  relatedPendingCount?: number;
  target?: ReportTargetPreview;
  reporter: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  resolver?: Pick<PublicUser, 'id' | 'username' | 'displayName'> | null;
}

export interface ReportListMeta extends PaginationMeta {
  summary?: {
    pending: number;
    resolved: number;
    dismissed: number;
    total: number;
  };
}

export interface ModerationItem {
  targetType: ModerationTargetType;
  targetId: string;
  title: string;
  author: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'isVerified' | 'isTrusted'>;
  createdAt: string;
  updatedAt: string;
  extraInfo: Record<string, unknown>;
}

export interface ChapterPurchaseItem {
  id: string;
  chapterId: string;
  coinsSpent: number;
  createdAt: string;
  chapter: {
    id: string;
    number: number;
    title: string | null;
    totalPages: number;
    priceCoins: number;
    comic: {
      id: string;
      title: string;
      slug: string;
      coverUrl: string | null;
      author: Pick<PublicUser, 'id' | 'username' | 'displayName'>;
    };
  };
}

export interface PurchaseHistorySummary {
  currentCoins: number;
  totalUnlockedChapters: number;
  totalCoinsSpent: number;
  uniqueComicsCount: number;
}

export interface PurchaseHistoryResponse {
  items: ChapterPurchaseItem[];
  summary: PurchaseHistorySummary;
  meta: PaginationMeta;
}

export interface AuthorApplicationItem {
  id: string;
  userId: string;
  penName: string;
  bio: string;
  portfolioUrl: string | null;
  sampleWorkTitle: string | null;
  sampleWorkLink: string | null;
  experience: string | null;
  status: AuthorApplicationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
    role: UserRole;
  };
  reviewer?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
}
