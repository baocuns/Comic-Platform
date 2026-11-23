'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  MessageSquare,
  Newspaper,
  ShieldAlert,
  ShieldOff,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  ContentRating,
  ReportReason,
  ReportResolutionAction,
  ReportStatus,
  ReportTargetType,
  UserRole,
  type ReportItem,
  type ReportListMeta,
} from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { useToast } from '@/components/providers/toast-provider';
import { CommentContent } from '@/components/comments/CommentContent';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface ReportModerationPanelProps {
  accessToken: string | null;
  currentUserId?: string;
  currentUserRole?: UserRole;
  onPendingCountChange?: (pendingCount: number) => void;
  onActionCompleted?: () => void;
}

const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.READER]: 0,
  [UserRole.AUTHOR]: 1,
  [UserRole.MODERATOR]: 2,
  [UserRole.ADMIN]: 3,
};

const TARGET_TYPE_META: Record<
  ReportTargetType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  [ReportTargetType.COMIC]: { label: 'Truyện', icon: BookOpen },
  [ReportTargetType.CHAPTER]: { label: 'Chương', icon: FileText },
  [ReportTargetType.COMMENT]: { label: 'Bình luận', icon: MessageSquare },
  [ReportTargetType.NEWS_COMMENT]: { label: 'BL Tin tức', icon: Newspaper },
  [ReportTargetType.USER]: { label: 'Thành viên', icon: UserIcon },
};

const REASON_LABEL: Record<ReportReason, string> = {
  [ReportReason.COPYRIGHT]: 'Vi phạm bản quyền',
  [ReportReason.INAPPROPRIATE]: 'Nội dung phản cảm',
  [ReportReason.SPAM]: 'Spam / Quảng cáo',
  [ReportReason.HARASSMENT]: 'Quấy rối / Công kích',
  [ReportReason.OTHER]: 'Lý do khác',
};

const ACTION_CONFIG: Record<
  ReportResolutionAction,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    danger?: boolean;
  }
> = {
  [ReportResolutionAction.HIDE_CONTENT]: {
    label: 'Gỡ hiển thị (Yêu cầu sửa)',
    description: 'Chuyển trạng thái sang Từ chối duyệt, ẩn khỏi độc giả và giữ nguyên để tác giả sửa.',
    icon: EyeOff,
    danger: true,
  },
  [ReportResolutionAction.MARK_MATURE]: {
    label: 'Gắn nhãn 18+ (Mature)',
    description: 'Giữ nguyên truyện nhưng bật cảnh báo giới hạn độ tuổi 18+.',
    icon: ShieldAlert,
  },
  [ReportResolutionAction.MARK_SPOILER]: {
    label: 'Gắn thẻ Spoiler',
    description: 'Che mờ nội dung bình luận để tránh tiết lộ tình tiết cho độc giả khác.',
    icon: EyeOff,
  },
  [ReportResolutionAction.DELETE_CONTENT]: {
    label: 'Xóa nội dung vi phạm',
    description: 'Gỡ bỏ nội dung khỏi nền tảng và cập nhật lại số liệu liên quan.',
    icon: Trash2,
    danger: true,
  },
  [ReportResolutionAction.WARN_USER]: {
    label: 'Gửi cảnh cáo tài khoản',
    description: 'Giữ nguyên hiện trạng nhưng gửi thông báo nhắc nhở chính thức.',
    icon: AlertTriangle,
  },
  [ReportResolutionAction.REVOKE_TRUST]: {
    label: 'Thu hồi Tác giả Uy tín',
    description: 'Tác giả sẽ phải chờ kiểm duyệt trước khi xuất bản các tác phẩm mới.',
    icon: ShieldOff,
    danger: true,
  },
  [ReportResolutionAction.BAN_USER]: {
    label: 'Khóa tài khoản vi phạm',
    description: 'Thu hồi phiên đăng nhập hiện tại và khóa tài khoản theo thời hạn.',
    icon: Ban,
    danger: true,
  },
  [ReportResolutionAction.NONE]: {
    label: 'Chỉ đánh dấu đã xử lý',
    description: 'Đóng báo cáo và lưu ghi chú nội bộ, không tác động tới nội dung hay tài khoản.',
    icon: Check,
  },
};

const TARGET_ACTIONS_ORDER: Record<ReportTargetType, ReportResolutionAction[]> = {
  [ReportTargetType.COMIC]: [
    ReportResolutionAction.HIDE_CONTENT,
    ReportResolutionAction.MARK_MATURE,
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.REVOKE_TRUST,
    ReportResolutionAction.BAN_USER,
    ReportResolutionAction.NONE,
  ],
  [ReportTargetType.CHAPTER]: [
    ReportResolutionAction.HIDE_CONTENT,
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.REVOKE_TRUST,
    ReportResolutionAction.BAN_USER,
    ReportResolutionAction.NONE,
  ],
  [ReportTargetType.COMMENT]: [
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.MARK_SPOILER,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.BAN_USER,
    ReportResolutionAction.NONE,
  ],
  [ReportTargetType.NEWS_COMMENT]: [
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.BAN_USER,
    ReportResolutionAction.NONE,
  ],
  [ReportTargetType.USER]: [
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.REVOKE_TRUST,
    ReportResolutionAction.BAN_USER,
    ReportResolutionAction.NONE,
  ],
};

const ACTIONS_REQUIRING_NOTE = new Set<ReportResolutionAction>([
  ReportResolutionAction.HIDE_CONTENT,
  ReportResolutionAction.DELETE_CONTENT,
  ReportResolutionAction.WARN_USER,
  ReportResolutionAction.REVOKE_TRUST,
  ReportResolutionAction.BAN_USER,
]);

const RESOLVED_QUICK_NOTES = [
  'Vi phạm tiêu chuẩn cộng đồng (ngôn từ / hình ảnh phản cảm).',
  'Phát hiện spam, quảng cáo hoặc liên kết không hợp lệ.',
  'Nội dung vi phạm bản quyền theo phản ánh xác thực.',
  'Bình luận tiết lộ nội dung quan trọng (Spoiler) hoặc gây hấn.',
];

const DISMISSED_QUICK_NOTES = [
  'Không đủ căn cứ xác định hành vi vi phạm.',
  'Nội dung vẫn nằm trong giới hạn quy định nền tảng.',
  'Báo cáo nhầm lẫn hoặc trùng lặp không cần xử lý thêm.',
];

const BAN_DURATIONS: Array<{ days: number | null; label: string }> = [
  { days: 1, label: '1 ngày' },
  { days: 3, label: '3 ngày' },
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: null, label: 'Vĩnh viễn' },
];

export function ReportModerationPanel({
  accessToken,
  currentUserId,
  currentUserRole,
  onPendingCountChange,
  onActionCompleted,
}: ReportModerationPanelProps) {
  const { toast } = useToast();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [meta, setMeta] = useState<ReportListMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'ALL'>(ReportStatus.PENDING);
  const [typeFilter, setTypeFilter] = useState<ReportTargetType | 'ALL'>('ALL');

  const [activeReport, setActiveReport] = useState<ReportItem | null>(null);
  const [mode, setMode] = useState<'RESOLVED' | 'DISMISSED'>('RESOLVED');
  const [selectedAction, setSelectedAction] = useState<ReportResolutionAction>(
    ReportResolutionAction.NONE,
  );
  const [banDurationDays, setBanDurationDays] = useState<number | null>(7);
  const [alsoDeleteContent, setAlsoDeleteContent] = useState(false);
  const [resolveRelated, setResolveRelated] = useState(true);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [previewChapterReport, setPreviewChapterReport] = useState<ReportItem | null>(null);
  const onPendingCountChangeRef = useRef(onPendingCountChange);
  onPendingCountChangeRef.current = onPendingCountChange;

  const loadReports = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'ALL') qs.set('status', statusFilter);
      if (typeFilter !== 'ALL') qs.set('targetType', typeFilter);

      const res = await api.get<{ data: ReportItem[]; meta: ReportListMeta }>(
        `/reports?${qs.toString()}`,
        { token: accessToken },
      );
      const list = res.data || [];
      setReports(list);
      setMeta(res.meta || null);
      if (res.meta?.summary && typeof res.meta.summary.pending === 'number') {
        onPendingCountChangeRef.current?.(res.meta.summary.pending);
      } else if (statusFilter === ReportStatus.PENDING) {
        onPendingCountChangeRef.current?.(res.meta?.total ?? list.length);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tải danh sách báo cáo');
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter, typeFilter, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const getActionDisabledReason = useCallback(
    (report: ReportItem, action: ReportResolutionAction): string | null => {
      if (action === ReportResolutionAction.NONE) return null;
      const target = report.target;
      if (!target || !target.exists) {
        return 'Đối tượng không còn tồn tại';
      }
      const owner = target.owner;
      const actorLevel = currentUserRole ? (ROLE_LEVEL[currentUserRole] ?? 0) : 0;
      const ownerLevel = owner ? (ROLE_LEVEL[owner.role] ?? 0) : 0;

      if (action === ReportResolutionAction.DELETE_CONTENT && target.isDeleted) {
        return 'Nội dung đã được xóa trước đó';
      }
      if (action === ReportResolutionAction.HIDE_CONTENT) {
        if (target.isDeleted) return 'Nội dung đã bị xóa';
        if (target.statusBadge === 'REJECTED') return 'Nội dung đã bị gỡ hiển thị trước đó';
      }
      if (action === ReportResolutionAction.MARK_MATURE) {
        if (target.isDeleted) return 'Truyện đã bị xóa';
        if (target.contentRating === ContentRating.MATURE) return 'Truyện đã có nhãn 18+';
      }
      if (action === ReportResolutionAction.MARK_SPOILER) {
        if (target.isDeleted) return 'Bình luận đã bị xóa';
        if (target.isSpoiler) return 'Bình luận đã được gắn Spoiler';
      }
      if (action === ReportResolutionAction.REVOKE_TRUST) {
        if (!owner) return 'Không tìm thấy tác giả';
        if (!owner.isTrusted) return 'Chưa có chứng nhận Uy tín';
        if (owner.id === currentUserId) return 'Không thể thao tác với chính mình';
        if (currentUserRole !== UserRole.ADMIN && actorLevel <= ownerLevel) {
          return 'Không đủ quyền hạn';
        }
      }
      if (action === ReportResolutionAction.BAN_USER) {
        if (!owner) return 'Không tìm thấy tài khoản';
        if (owner.isBanned) return 'Tài khoản này đang bị khóa';
        if (owner.id === currentUserId) return 'Không thể tự khóa tài khoản mình';
        if (actorLevel <= ownerLevel) {
          return 'Không thể khóa tài khoản ngang hoặc cao quyền hơn';
        }
      }
      return null;
    },
    [currentUserId, currentUserRole],
  );

  const pickDefaultAction = useCallback(
    (report: ReportItem): ReportResolutionAction => {
      if (!report.target?.exists) return ReportResolutionAction.NONE;
      const candidates = TARGET_ACTIONS_ORDER[report.targetType] || [];
      let preferred: ReportResolutionAction = ReportResolutionAction.NONE;
      if (
        report.targetType === ReportTargetType.COMMENT ||
        report.targetType === ReportTargetType.NEWS_COMMENT
      ) {
        preferred = ReportResolutionAction.DELETE_CONTENT;
      } else if (
        report.targetType === ReportTargetType.COMIC ||
        report.targetType === ReportTargetType.CHAPTER
      ) {
        preferred = ReportResolutionAction.HIDE_CONTENT;
      } else if (report.targetType === ReportTargetType.USER) {
        preferred = ReportResolutionAction.WARN_USER;
      }

      if (!getActionDisabledReason(report, preferred)) return preferred;
      for (const act of candidates) {
        if (act !== ReportResolutionAction.NONE && !getActionDisabledReason(report, act)) {
          return act;
        }
      }
      return ReportResolutionAction.NONE;
    },
    [getActionDisabledReason],
  );

  const openModal = (report: ReportItem, initialMode: 'RESOLVED' | 'DISMISSED') => {
    setActiveReport(report);
    setMode(initialMode);
    setSelectedAction(
      initialMode === 'DISMISSED' ? ReportResolutionAction.NONE : pickDefaultAction(report),
    );
    setBanDurationDays(7);
    setAlsoDeleteContent(
      report.targetType === ReportTargetType.COMMENT ||
        report.targetType === ReportTargetType.NEWS_COMMENT,
    );
    setResolveRelated(initialMode === 'RESOLVED');
    setResolutionNote('');
  };

  const handleSubmit = async () => {
    if (!accessToken || !activeReport) return;

    const note = resolutionNote.trim();
    if (
      mode === 'RESOLVED' &&
      ACTIONS_REQUIRING_NOTE.has(selectedAction) &&
      !note
    ) {
      toast.error('Vui lòng nhập lý do / ghi chú xử lý');
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        mode === 'DISMISSED'
          ? {
              status: ReportStatus.DISMISSED,
              action: ReportResolutionAction.NONE,
              resolutionNote: note || undefined,
              resolveRelated,
            }
          : {
              status: ReportStatus.RESOLVED,
              action: selectedAction,
              resolutionNote: note || undefined,
              banDurationDays:
                selectedAction === ReportResolutionAction.BAN_USER && banDurationDays
                  ? banDurationDays
                  : undefined,
              alsoDeleteContent:
                selectedAction === ReportResolutionAction.BAN_USER &&
                activeReport.targetType !== ReportTargetType.USER
                  ? alsoDeleteContent
                  : undefined,
              resolveRelated,
            };

      const res = await api.patch<{
        data: ReportItem & { closedRelatedCount?: number };
      }>(`/reports/${activeReport.id}/resolve`, payload, { token: accessToken });

      const extraCount = res.data?.closedRelatedCount || 0;
      toast.success(
        extraCount > 0
          ? `Đã xử lý báo cáo và tự động đóng ${extraCount} báo cáo trùng khác.`
          : mode === 'DISMISSED'
            ? 'Đã bỏ qua báo cáo.'
            : `Đã xử lý: ${ACTION_CONFIG[selectedAction].label}.`,
      );
      setActiveReport(null);
      await loadReports();
      onActionCompleted?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể xử lý báo cáo');
    } finally {
      setSubmitting(false);
    }
  };

  const summary = meta?.summary;

  return (
    <div className="space-y-4">
      {/* Status & Target Type Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { k: ReportStatus.PENDING, l: 'Chờ xử lý', c: summary?.pending },
              { k: ReportStatus.RESOLVED, l: 'Đã xử lý', c: summary?.resolved },
              { k: ReportStatus.DISMISSED, l: 'Đã bỏ qua', c: summary?.dismissed },
              { k: 'ALL', l: 'Tất cả', c: summary?.total },
            ] as const
          ).map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setStatusFilter(f.k)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === f.k
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              {f.l}
              {typeof f.c === 'number' ? ` (${f.c})` : ''}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { k: 'ALL', l: 'Mọi đối tượng' },
              { k: ReportTargetType.COMIC, l: 'Truyện' },
              { k: ReportTargetType.CHAPTER, l: 'Chương' },
              { k: ReportTargetType.COMMENT, l: 'Bình luận' },
              { k: ReportTargetType.NEWS_COMMENT, l: 'BL Tin tức' },
              { k: ReportTargetType.USER, l: 'Thành viên' },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTypeFilter(t.k)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                typeFilter === t.k
                  ? 'border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card className="py-12 text-center text-sm text-[var(--text-muted)]">
          Không có báo cáo nào trong bộ lọc hiện tại.
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const typeMeta = TARGET_TYPE_META[r.targetType];
            const TypeIcon = typeMeta?.icon || Flag;
            const target = r.target;
            const owner = target?.owner;
            const isCommentType =
              r.targetType === ReportTargetType.COMMENT ||
              r.targetType === ReportTargetType.NEWS_COMMENT;

            return (
              <Card key={r.id} className="space-y-3.5">
                {/* Top Badges + Primary Action Buttons */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        r.status === ReportStatus.PENDING
                          ? 'warning'
                          : r.status === ReportStatus.RESOLVED
                            ? 'success'
                            : 'default'
                      }
                    >
                      {r.status === ReportStatus.PENDING
                        ? 'Chờ xử lý'
                        : r.status === ReportStatus.RESOLVED
                          ? 'Đã xử lý'
                          : 'Đã bỏ qua'}
                    </Badge>
                    <Badge variant="outline">
                      <TypeIcon className="h-3 w-3" />
                      {typeMeta?.label || r.targetType}
                    </Badge>
                    <Badge variant="warm">{REASON_LABEL[r.reason] || r.reason}</Badge>
                    {r.status === ReportStatus.PENDING && (r.relatedPendingCount ?? 0) > 1 && (
                      <Badge variant="danger">
                        {r.relatedPendingCount} báo cáo chờ
                      </Badge>
                    )}
                    {r.status === ReportStatus.RESOLVED && r.resolutionAction && (
                      <Badge variant="primary">
                        {ACTION_CONFIG[r.resolutionAction]?.label || r.resolutionAction}
                      </Badge>
                    )}
                  </div>

                  {r.status === ReportStatus.PENDING && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => openModal(r, 'RESOLVED')}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Xử lý vi phạm
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => openModal(r, 'DISMISSED')}
                      >
                        <X className="h-3.5 w-3.5" />
                        Bỏ qua
                      </Button>
                    </div>
                  )}
                </div>

                {/* Target Inspection Box */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5">
                  {!target || !target.exists ? (
                    <p className="text-xs italic text-[var(--text-muted)]">
                      Đối tượng bị báo cáo không còn tồn tại trong hệ thống.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        {target.thumbnailUrl &&
                          (r.targetType === ReportTargetType.USER ? (
                            <Avatar
                              src={target.thumbnailUrl}
                              name={target.title}
                              size="md"
                            />
                          ) : (
                            <img
                              src={target.thumbnailUrl}
                              alt=""
                              className="h-16 w-12 shrink-0 rounded-lg border border-[var(--border-subtle)] object-cover"
                            />
                          ))}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-[var(--text-primary)]">
                              {target.title}
                            </h4>
                            {target.statusBadge && (
                              <Badge variant={target.isDeleted ? 'danger' : 'outline'}>
                                {target.statusBadge}
                              </Badge>
                            )}
                            {target.contentRating === ContentRating.MATURE && (
                              <Badge variant="danger">18+ Mature</Badge>
                            )}
                            {target.isSpoiler && <Badge variant="warning">Spoiler</Badge>}
                            {owner?.isBanned && <Badge variant="danger">Tài khoản bị khóa</Badge>}
                            {owner?.isTrusted && <Badge variant="success">Tác giả Uy tín</Badge>}
                          </div>

                          {target.subtitle && (
                            <p className="text-xs text-[var(--text-secondary)]">
                              {target.subtitle}
                              {owner ? ` (@${owner.username} · ${owner.role})` : ''}
                            </p>
                          )}

                          {/* Action Links & Quick Page Preview */}
                          <div className="flex flex-wrap items-center gap-3 pt-0.5">
                            {target.linkUrl && (
                              <Link
                                href={target.linkUrl}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {isCommentType ? 'Xem ngữ cảnh' : 'Xem trang công khai'}
                              </Link>
                            )}
                            {target.studioUrl && (
                              <Link
                                href={target.studioUrl}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-warm)] hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Mở trong Studio
                              </Link>
                            )}
                            {r.targetType === ReportTargetType.CHAPTER &&
                              target.pagesPreview &&
                              target.pagesPreview.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewChapterReport(r)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Xem nhanh {target.pagesPreview.length} trang đầu
                                </button>
                              )}
                          </div>
                        </div>
                      </div>

                      {isCommentType && target.excerpt && (
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                          <CommentContent content={target.excerpt} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Reporter Description & Audit Footer */}
                <div className="space-y-1 text-xs text-[var(--text-muted)]">
                  {r.description && (
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-semibold text-[var(--text-secondary)]">Mô tả báo cáo:</span>{' '}
                      &ldquo;{r.description}&rdquo;
                    </p>
                  )}
                  <p>
                    Người báo cáo: <strong>{r.reporter.displayName}</strong> (@{r.reporter.username}) ·{' '}
                    {formatRelativeTime(r.createdAt)}
                  </p>
                  {r.status !== ReportStatus.PENDING && r.resolvedAt && (
                    <p className="text-[var(--text-secondary)]">
                      Đã xử lý lúc {formatDate(r.resolvedAt)}
                      {r.resolver ? ` bởi ${r.resolver.displayName}` : ''}
                      {r.resolutionAction
                        ? ` · Biện pháp: ${ACTION_CONFIG[r.resolutionAction]?.label || r.resolutionAction}`
                        : ''}
                      {r.resolutionNote ? ` · Ghi chú: "${r.resolutionNote}"` : ''}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resolution Modal */}
      {activeReport && (
        <Modal
          open
          onClose={() => !submitting && setActiveReport(null)}
          title="Xử lý báo cáo vi phạm"
          maxWidthClass="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Summary of Reported Entity */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {TARGET_TYPE_META[activeReport.targetType]?.label || activeReport.targetType}
                </Badge>
                <Badge variant="warm">
                  {REASON_LABEL[activeReport.reason] || activeReport.reason}
                </Badge>
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)] pt-1">
                {activeReport.target?.title || 'Đối tượng báo cáo'}
              </p>
              {activeReport.target?.owner && (
                <p className="text-[var(--text-secondary)]">
                  Chủ sở hữu: <strong>{activeReport.target.owner.displayName}</strong> (@
                  {activeReport.target.owner.username} · {activeReport.target.owner.role})
                </p>
              )}
              {activeReport.description && (
                <p className="italic text-[var(--text-muted)]">
                  Phản ánh: &ldquo;{activeReport.description}&rdquo;
                </p>
              )}
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('RESOLVED');
                  setSelectedAction(pickDefaultAction(activeReport));
                  setResolveRelated(true);
                }}
                className={`rounded-lg py-2 text-xs font-semibold cursor-pointer transition-colors ${
                  mode === 'RESOLVED'
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Áp dụng biện pháp (Xử lý)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('DISMISSED');
                  setSelectedAction(ReportResolutionAction.NONE);
                  setResolveRelated(false);
                }}
                className={`rounded-lg py-2 text-xs font-semibold cursor-pointer transition-colors ${
                  mode === 'DISMISSED'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Bỏ qua báo cáo
              </button>
            </div>

            {mode === 'RESOLVED' && (
              <>
                {/* Enforcement Actions */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                    Chọn biện pháp xử lý cho {TARGET_TYPE_META[activeReport.targetType]?.label}
                  </label>
                  <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                    {(TARGET_ACTIONS_ORDER[activeReport.targetType] || []).map((action) => {
                      const cfg = ACTION_CONFIG[action];
                      const ActionIcon = cfg.icon;
                      const disabledReason = getActionDisabledReason(activeReport, action);
                      const isDisabled = Boolean(disabledReason);
                      const isSelected = selectedAction === action;

                      return (
                        <label
                          key={action}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-xs transition-colors ${
                            isDisabled
                              ? 'opacity-50 cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)]'
                              : isSelected
                                ? cfg.danger
                                  ? 'border-[var(--danger)] bg-[var(--danger-soft)]/50 cursor-pointer'
                                  : 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] cursor-pointer'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name="report_resolution_action"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => !isDisabled && setSelectedAction(action)}
                            className="mt-0.5 accent-[var(--accent-primary)]"
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                              <ActionIcon className="h-3.5 w-3.5 shrink-0" />
                              <span>{cfg.label}</span>
                            </div>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                              {disabledReason || cfg.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Ban Options */}
                {selectedAction === ReportResolutionAction.BAN_USER && (
                  <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)]/30 p-3.5 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                        Thời hạn khóa tài khoản
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {BAN_DURATIONS.filter(
                          (d) => d.days !== null || currentUserRole === UserRole.ADMIN,
                        ).map((d) => (
                          <button
                            key={String(d.days)}
                            type="button"
                            onClick={() => setBanDurationDays(d.days)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                              banDurationDays === d.days
                                ? 'border-[var(--danger)] bg-[var(--danger)] text-white'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {activeReport.targetType !== ReportTargetType.USER &&
                      !activeReport.target?.isDeleted && (
                        <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={alsoDeleteContent}
                            onChange={(e) => setAlsoDeleteContent(e.target.checked)}
                            className="accent-[var(--danger)]"
                          />
                          <span>Đồng thời xóa nội dung vi phạm này khỏi nền tảng</span>
                        </label>
                      )}
                  </div>
                )}
              </>
            )}

            {/* Duplicate Pending Checkbox */}
            {(activeReport.relatedPendingCount ?? 0) > 1 && (
              <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={resolveRelated}
                  onChange={(e) => setResolveRelated(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
                <span>
                  Tự động đóng luôn{' '}
                  <strong>{(activeReport.relatedPendingCount ?? 1) - 1} báo cáo chờ khác</strong> cho
                  cùng đối tượng này
                </span>
              </label>
            )}

            {/* Quick Note Chips */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">Gợi ý ghi chú nhanh:</p>
              <div className="flex flex-wrap gap-1.5">
                {(mode === 'RESOLVED' ? RESOLVED_QUICK_NOTES : DISMISSED_QUICK_NOTES).map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => setResolutionNote(txt)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer text-left"
                  >
                    + {txt}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label={
                mode === 'RESOLVED' && ACTIONS_REQUIRING_NOTE.has(selectedAction)
                  ? 'Lý do / ghi chú xử lý *'
                  : 'Ghi chú xử lý (tùy chọn)'
              }
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder={
                mode === 'DISMISSED'
                  ? 'Mặc định: Không đủ căn cứ vi phạm'
                  : 'Ghi rõ lý do để thông báo cho người liên quan và lưu nhật ký...'
              }
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                disabled={submitting}
                onClick={() => setActiveReport(null)}
              >
                Hủy
              </Button>
              <Button
                variant={
                  mode === 'DISMISSED'
                    ? 'secondary'
                    : ACTION_CONFIG[selectedAction]?.danger
                      ? 'danger'
                      : 'primary'
                }
                isLoading={submitting}
                disabled={
                  mode === 'RESOLVED' &&
                  ACTIONS_REQUIRING_NOTE.has(selectedAction) &&
                  !resolutionNote.trim()
                }
                onClick={handleSubmit}
              >
                {mode === 'DISMISSED' ? 'Xác nhận bỏ qua' : 'Xác nhận xử lý'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Chapter Pages Preview Modal */}
      {previewChapterReport && (
        <Modal
          open
          onClose={() => setPreviewChapterReport(null)}
          title={previewChapterReport.target?.title || 'Xem nhanh trang chương'}
          maxWidthClass="max-w-2xl"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(previewChapterReport.target?.pagesPreview || []).map((p) => (
              <div key={p.pageNumber} className="space-y-1">
                <img
                  src={p.imageUrl}
                  alt={`Trang ${p.pageNumber}`}
                  className="w-full rounded-lg border border-[var(--border-subtle)] object-cover"
                />
                <p className="text-center text-[11px] text-[var(--text-muted)]">
                  Trang {p.pageNumber}
                </p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
