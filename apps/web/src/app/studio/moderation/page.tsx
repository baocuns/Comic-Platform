'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Check,
  X,
  Flag,
  History,
  Eye,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import {
  AuthorApplicationStatus,
  type AuthorApplicationItem,
  type ModerationItem,
  type ReportItem,
  type ReportListMeta,
} from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { ReportModerationPanel } from '@/components/studio/ReportModerationPanel';
import { Tabs } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';

interface ModerationLogEntry {
  id: string;
  targetType: string;
  targetTitle: string;
  action: string;
  reason: string | null;
  createdAt: string;
  moderator: { displayName: string };
}

type ModerationTab = 'pending' | 'authors' | 'reports' | 'logs';

function resolveRequestedTab(raw: string | null, isAdmin: boolean): ModerationTab {
  if (raw === 'authors' && isAdmin) return 'authors';
  if (raw === 'reports') return 'reports';
  if (raw === 'logs') return 'logs';
  return 'pending';
}

function ModerationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken } = useAuthStore();
  const { toast } = useToast();

  const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const isAdmin = user?.role === 'ADMIN';
  const requestedTab = searchParams.get('tab');

  const [tab, setTab] = useState<ModerationTab>(() =>
    resolveRequestedTab(requestedTab, isAdmin),
  );
  const [authorStatusFilter, setAuthorStatusFilter] = useState<AuthorApplicationStatus | 'ALL'>(
    AuthorApplicationStatus.PENDING,
  );

  const [pending, setPending] = useState<ModerationItem[]>([]);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [logs, setLogs] = useState<ModerationLogEntry[]>([]);
  const [authorApps, setAuthorApps] = useState<AuthorApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [rejectTarget, setRejectTarget] = useState<ModerationItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewItem, setPreviewItem] = useState<ModerationItem | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);

  const [rejectAuthorApp, setRejectAuthorApp] = useState<AuthorApplicationItem | null>(null);
  const [authorRejectNote, setAuthorRejectNote] = useState('');
  const [reviewingAppId, setReviewingAppId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedTab) {
      setTab(resolveRequestedTab(requestedTab, isAdmin));
    }
  }, [requestedTab, isAdmin]);

  const handleTabChange = useCallback(
    (nextTab: ModerationTab) => {
      setTab(nextTab);
      const nextQs = nextTab === 'pending' ? '' : `?tab=${nextTab}`;
      router.replace(`/studio/moderation${nextQs}`, { scroll: false });
    },
    [router],
  );

  const loadData = useCallback(async () => {
    if (!accessToken || !isStaff) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [pRes, rRes, lRes, aRes] = await Promise.all([
        api.get<{ data: ModerationItem[] }>('/moderation/pending', { token: accessToken }),
        api.get<{ data: ReportItem[]; meta?: ReportListMeta }>('/reports?status=PENDING&limit=1', {
          token: accessToken,
        }),
        api.get<{ data: ModerationLogEntry[] }>('/moderation/logs', { token: accessToken }),
        isAdmin
          ? api.get<{ data: AuthorApplicationItem[] }>('/admin/author-applications?status=ALL', {
              token: accessToken,
            })
          : Promise.resolve({ data: [] as AuthorApplicationItem[] }),
      ]);
      setPending(pRes.data || []);
      setPendingReportsCount(
        rRes.meta?.summary?.pending ?? rRes.meta?.total ?? (rRes.data || []).length,
      );
      setLogs(lRes.data || []);
      setAuthorApps(aRes.data || []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tải dữ liệu kiểm duyệt');
    } finally {
      setLoading(false);
    }
  }, [accessToken, isAdmin, isStaff, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (item: ModerationItem) => {
    const key = `${item.targetType}:${item.targetId}`;
    if (!accessToken || actingKey) return;
    setActingKey(key);
    try {
      await api.patch(`/moderation/${item.targetType}/${item.targetId}/approve`, {}, { token: accessToken });
      toast.success(`Đã phê duyệt "${item.title}"`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    } finally {
      setActingKey(null);
    }
  };

  const handleReject = async () => {
    if (!accessToken || !rejectTarget || !rejectReason.trim() || actingKey) return;
    const key = `${rejectTarget.targetType}:${rejectTarget.targetId}`;
    setActingKey(key);
    try {
      await api.patch(
        `/moderation/${rejectTarget.targetType}/${rejectTarget.targetId}/reject`,
        { reason: rejectReason.trim() },
        { token: accessToken },
      );
      toast.info(`Đã từ chối "${rejectTarget.title}"`);
      setRejectTarget(null);
      setRejectReason('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    } finally {
      setActingKey(null);
    }
  };

  const handleApproveAuthor = async (app: AuthorApplicationItem) => {
    if (!accessToken) return;
    setReviewingAppId(app.id);
    try {
      await api.patch(
        `/admin/author-applications/${app.id}/review`,
        { decision: 'APPROVED' },
        { token: accessToken },
      );
      toast.success(`Đã cấp quyền Tác giả cho ${app.user?.displayName || app.penName}`);
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể phê duyệt đơn');
    } finally {
      setReviewingAppId(null);
    }
  };

  const handleRejectAuthor = async () => {
    if (!accessToken || !rejectAuthorApp || !authorRejectNote.trim()) return;
    setReviewingAppId(rejectAuthorApp.id);
    try {
      await api.patch(
        `/admin/author-applications/${rejectAuthorApp.id}/review`,
        { decision: 'REJECTED', reviewNote: authorRejectNote.trim() },
        { token: accessToken },
      );
      toast.info(`Đã từ chối đơn đăng ký "${rejectAuthorApp.penName}"`);
      setRejectAuthorApp(null);
      setAuthorRejectNote('');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    } finally {
      setReviewingAppId(null);
    }
  };

  const pendingAuthorsCount = authorApps.filter((a) => a.status === AuthorApplicationStatus.PENDING).length;
  const filteredAuthorApps =
    authorStatusFilter === 'ALL'
      ? authorApps
      : authorApps.filter((a) => a.status === authorStatusFilter);

  if (!isStaff) {
    return (
      <Card className="p-8 text-center text-sm text-[var(--danger)]">
        Chỉ Kiểm duyệt viên (MODERATOR) hoặc Quản trị viên (ADMIN) mới có quyền truy cập khu vực này.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Trung tâm Kiểm duyệt</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Phê duyệt tác phẩm mới, xét duyệt đơn đăng ký Tác giả và xử lý báo cáo vi phạm.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={handleTabChange}
        items={[
          { value: 'pending', label: 'Chờ duyệt nội dung', badge: pending.length, icon: <ShieldCheck className="h-4 w-4" /> },
          ...(isAdmin
            ? [
                {
                  value: 'authors' as const,
                  label: 'Đơn Tác giả',
                  badge: pendingAuthorsCount,
                  icon: <UserCheck className="h-4 w-4" />,
                },
              ]
            : []),
          {
            value: 'reports',
            label: 'Báo cáo vi phạm',
            badge: pendingReportsCount,
            icon: <Flag className="h-4 w-4" />,
          },
          { value: 'logs', label: 'Nhật ký', icon: <History className="h-4 w-4" /> },
        ]}
      />

      {loading && tab !== 'reports' ? (
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <Card className="py-12 text-center text-sm text-[var(--text-muted)]">
            Hàng đợi kiểm duyệt hiện đang trống.
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((item) => (
              <Card key={`${item.targetType}-${item.targetId}`} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{item.targetType}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(item.updatedAt)}</span>
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">{item.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Tác giả: <strong>{item.author.displayName}</strong> (@{item.author.username})
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="xs" variant="outline" onClick={() => setPreviewItem(item)}>
                    <Eye className="h-3.5 w-3.5" /> Xem trước
                  </Button>
                  <Button
                    size="xs"
                    variant="primary"
                    isLoading={actingKey === `${item.targetType}:${item.targetId}`}
                    disabled={Boolean(actingKey)}
                    onClick={() => handleApprove(item)}
                  >
                    <Check className="h-3.5 w-3.5" /> Phê duyệt
                  </Button>
                  <Button
                    size="xs"
                    variant="danger"
                    disabled={Boolean(actingKey)}
                    onClick={() => setRejectTarget(item)}
                  >
                    <X className="h-3.5 w-3.5" /> Từ chối
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === 'authors' && isAdmin ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { k: AuthorApplicationStatus.PENDING, l: 'Chờ duyệt' },
                { k: AuthorApplicationStatus.APPROVED, l: 'Đã duyệt' },
                { k: AuthorApplicationStatus.REJECTED, l: 'Đã từ chối' },
                { k: 'ALL', l: 'Tất cả' },
              ] as const
            ).map((f) => (
              <button
                key={f.k}
                type="button"
                onClick={() => setAuthorStatusFilter(f.k)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                  authorStatusFilter === f.k
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>

          {filteredAuthorApps.length === 0 ? (
            <Card className="py-12 text-center text-sm text-[var(--text-muted)]">
              Không có đơn đăng ký Tác giả nào trong mục này.
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAuthorApps.map((app) => (
                <Card key={app.id} className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={app.user?.avatarUrl}
                        name={app.user?.displayName || app.penName}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-[var(--text-primary)]">
                            {app.penName}
                          </h3>
                          <Badge
                            variant={
                              app.status === AuthorApplicationStatus.PENDING
                                ? 'warning'
                                : app.status === AuthorApplicationStatus.APPROVED
                                  ? 'success'
                                  : 'danger'
                            }
                          >
                            {app.status === AuthorApplicationStatus.PENDING
                              ? 'Chờ duyệt'
                              : app.status === AuthorApplicationStatus.APPROVED
                                ? 'Đã duyệt'
                                : 'Từ chối'}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          {app.user?.displayName} (@{app.user?.username}) · {app.user?.email} · Cấp{' '}
                          {app.user?.level ?? 1} · Gửi {formatRelativeTime(app.createdAt)}
                        </p>
                      </div>
                    </div>

                    {app.status === AuthorApplicationStatus.PENDING && (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          size="xs"
                          variant="primary"
                          isLoading={reviewingAppId === app.id}
                          onClick={() => handleApproveAuthor(app)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Phê duyệt thành Tác giả
                        </Button>
                        <Button
                          size="xs"
                          variant="danger"
                          disabled={reviewingAppId === app.id}
                          onClick={() => {
                            setRejectAuthorApp(app);
                            setAuthorRejectNote('');
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Từ chối
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 space-y-2 text-sm">
                    {app.sampleWorkTitle && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        <strong>Tác phẩm dự kiến:</strong> {app.sampleWorkTitle}
                      </p>
                    )}
                    <p className="whitespace-pre-line text-[var(--text-primary)] leading-relaxed">
                      {app.bio}
                    </p>
                    {app.experience && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        <strong>Kinh nghiệm:</strong> {app.experience}
                      </p>
                    )}
                    {(app.portfolioUrl || app.sampleWorkLink) && (
                      <div className="flex flex-wrap gap-3 pt-1">
                        {app.portfolioUrl &&
                          (/^https?:\/\//i.test(app.portfolioUrl) ? (
                            <a
                              href={app.portfolioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Portfolio
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)]">
                              Portfolio: {app.portfolioUrl}
                            </span>
                          ))}
                        {app.sampleWorkLink &&
                          (/^https?:\/\//i.test(app.sampleWorkLink) ? (
                            <a
                              href={app.sampleWorkLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-warm)] hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Bản mẫu
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)]">
                              Bản mẫu: {app.sampleWorkLink}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {app.status !== AuthorApplicationStatus.PENDING && app.reviewedAt && (
                    <p className="text-xs text-[var(--text-muted)]">
                      Đã xử lý lúc {formatDate(app.reviewedAt)}
                      {app.reviewer ? ` bởi ${app.reviewer.displayName}` : ''}
                      {app.reviewNote ? ` · Ghi chú: "${app.reviewNote}"` : ''}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'reports' ? (
        <ReportModerationPanel
          accessToken={accessToken}
          currentUserId={user?.id}
          currentUserRole={user?.role}
          onPendingCountChange={setPendingReportsCount}
          onActionCompleted={loadData}
        />
      ) : (
        <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={l.action === 'APPROVED' ? 'success' : 'danger'}>{l.action}</Badge>
                  <span className="text-xs font-semibold text-[var(--text-muted)]">{l.targetType}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{l.targetTitle}</p>
                {l.reason && <p className="text-xs text-[var(--danger)]">Lý do: {l.reason}</p>}
              </div>
              <div className="text-right text-xs text-[var(--text-muted)]">
                <p>{l.moderator.displayName}</p>
                <p>{formatRelativeTime(l.createdAt)}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {rejectTarget && (
        <Modal open onClose={() => setRejectTarget(null)} title="Từ chối nội dung">
          <div className="space-y-4">
            <Textarea
              label="Lý do từ chối *"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ghi rõ lý do để tác giả chỉnh sửa..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectTarget(null)}>Hủy</Button>
              <Button variant="danger" onClick={handleReject} disabled={!rejectReason.trim()}>Xác nhận từ chối</Button>
            </div>
          </div>
        </Modal>
      )}

      {rejectAuthorApp && (
        <Modal
          open
          onClose={() => setRejectAuthorApp(null)}
          title={`Từ chối đơn Tác giả — ${rejectAuthorApp.penName}`}
        >
          <div className="space-y-4">
            <Textarea
              label="Lý do từ chối *"
              rows={3}
              value={authorRejectNote}
              onChange={(e) => setAuthorRejectNote(e.target.value)}
              placeholder="Ví dụ: Vui lòng bổ sung link bản mẫu hoặc mô tả chi tiết hơn về định hướng truyện..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectAuthorApp(null)}>Hủy</Button>
              <Button
                variant="danger"
                onClick={handleRejectAuthor}
                isLoading={reviewingAppId === rejectAuthorApp.id}
                disabled={!authorRejectNote.trim()}
              >
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {previewItem && (
        <Modal open onClose={() => setPreviewItem(null)} title={previewItem.title} maxWidthClass="max-w-2xl">
          <div className="space-y-4 text-sm">
            {Boolean(previewItem.extraInfo?.coverUrl) && (
              <img
                src={String(previewItem.extraInfo.coverUrl)}
                alt=""
                className="h-56 rounded-xl object-cover"
              />
            )}
            {Boolean(previewItem.extraInfo?.description) && (
              <p className="text-[var(--text-secondary)]">{String(previewItem.extraInfo.description)}</p>
            )}
            {Array.isArray(previewItem.extraInfo?.pages) && (
              <div className="grid grid-cols-3 gap-2">
                {(previewItem.extraInfo.pages as Array<{ pageNumber: number; imageUrl: string }>).map((p) => (
                  <img key={p.pageNumber} src={p.imageUrl} alt="" className="rounded-lg border border-[var(--border-subtle)]" />
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />}>
      <ModerationContent />
    </Suspense>
  );
}
