import { ComicStatus, ComicType, ContentRating, NewsCategory, ReadingListStatus } from 'shared';

export function formatCompactNumber(num?: number | null): string {
  if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return num.toLocaleString('vi-VN');
}

export function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const time = date.getTime();
  if (Number.isNaN(time)) return '';
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} tuần trước`;
  return date.toLocaleDateString('vi-VN');
}

export function formatDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function sanitizeSafeUrl(raw?: string | null, allowRelative = false): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export const COMIC_TYPE_LABEL: Record<string, string> = {
  [ComicType.VIETNAM]: 'Truyện Việt',
  [ComicType.MANGA]: 'Manga',
  [ComicType.MANHWA]: 'Manhwa',
  [ComicType.MANHUA]: 'Manhua',
  [ComicType.WEBTOON]: 'Webtoon',
};

export const COMIC_STATUS_LABEL: Record<string, string> = {
  [ComicStatus.DRAFT]: 'Bản nháp',
  [ComicStatus.ONGOING]: 'Đang tiến hành',
  [ComicStatus.COMPLETED]: 'Hoàn thành',
  [ComicStatus.HIATUS]: 'Tạm ngưng',
  [ComicStatus.CANCELLED]: 'Đã hủy',
};

export const CONTENT_RATING_LABEL: Record<string, string> = {
  [ContentRating.EVERYONE]: 'Mọi lứa tuổi',
  [ContentRating.TEEN]: '13+ Thiếu niên',
  [ContentRating.MATURE]: '18+ Trưởng thành',
};

export const READING_LIST_LABEL: Record<string, string> = {
  [ReadingListStatus.READING]: 'Đang đọc',
  [ReadingListStatus.PLAN_TO_READ]: 'Muốn đọc',
  [ReadingListStatus.COMPLETED]: 'Đã hoàn thành',
  [ReadingListStatus.ON_HOLD]: 'Tạm gác',
  [ReadingListStatus.DROPPED]: 'Đã dừng',
};

export const NEWS_CATEGORY_LABEL: Record<string, string> = {
  [NewsCategory.FEATURED]: 'Tiêu điểm',
  [NewsCategory.ANNOUNCEMENT]: 'Thông báo',
  [NewsCategory.EVENT]: 'Sự kiện',
  [NewsCategory.UPDATE]: 'Cập nhật',
  [NewsCategory.COMMUNITY]: 'Cộng đồng',
};

export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};
