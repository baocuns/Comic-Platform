// ═══════════════════════════════════════
//  Shared Types — Comic Reading Platform
// ═══════════════════════════════════════

// ── Enums ──

export enum UserRole {
  READER = 'READER',
  AUTHOR = 'AUTHOR',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export enum ComicStatus {
  DRAFT = 'DRAFT',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  HIATUS = 'HIATUS',
  CANCELLED = 'CANCELLED',
}

export enum ContentRating {
  EVERYONE = 'EVERYONE',
  TEEN = 'TEEN',
  MATURE = 'MATURE',
}

export enum NotificationType {
  NEW_CHAPTER = 'NEW_CHAPTER',
  COMMENT_REPLY = 'COMMENT_REPLY',
  RATING_RECEIVED = 'RATING_RECEIVED',
  FOLLOW_NEW = 'FOLLOW_NEW',
  SYSTEM = 'SYSTEM',
  ACHIEVEMENT = 'ACHIEVEMENT',
}

export enum ReportReason {
  COPYRIGHT = 'COPYRIGHT',
  INAPPROPRIATE = 'INAPPROPRIATE',
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  OTHER = 'OTHER',
}

// ── API Response Types ──

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

// ── User Types ──

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  bio: string | null;
  coins: number;
  level: number;
  createdAt: string;
}

// ── Comic Types ──

export interface Comic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  status: ComicStatus;
  contentRating: ContentRating;
  originalLanguage: string;
  author: Pick<User, 'id' | 'displayName' | 'avatarUrl'>;
  genres: Genre[];
  stats: ComicStats;
  publishedAt: string | null;
  lastChapterAt: string | null;
}

export interface ComicStats {
  totalViews: number;
  avgRating: number;
  totalRatings: number;
  totalBookmarks: number;
  totalChapters: number;
  totalComments: number;
}

// ── Chapter Types ──

export interface Chapter {
  id: string;
  comicId: string;
  number: number;
  title: string | null;
  totalPages: number;
  isPremium: boolean;
  views: number;
  publishedAt: string | null;
}

export interface Page {
  pageNumber: number;
  imageUrl: string;
  imageUrlWebp: string | null;
  imageUrlAvif: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
}

// ── Genre Types ──

export interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  comicCount: number;
}

// ── Comment Types ──

export interface Comment {
  id: string;
  userId: string;
  chapterId: string;
  parentId: string | null;
  content: string;
  likesCount: number;
  isSpoiler: boolean;
  createdAt: string;
  user: Pick<User, 'id' | 'displayName' | 'avatarUrl'>;
  replies?: Comment[];
}

// ── Rating Types ──

export interface Rating {
  id: string;
  userId: string;
  comicId: string;
  score: number;
  review: string | null;
  helpfulCount: number;
  createdAt: string;
  user: Pick<User, 'id' | 'displayName' | 'avatarUrl'>;
}
