'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

interface PendingItem {
  targetType: 'COMIC' | 'CHAPTER' | 'NEWS';
  targetId: string;
  title: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  extraInfo?: Record<string, any>;
}

interface ModerationLogItem {
  id: string;
  targetType: 'COMIC' | 'CHAPTER' | 'NEWS';
  targetId: string;
  title: string;
  action: 'APPROVED' | 'REJECTED';
  reason: string | null;
  createdAt: string;
  moderator: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
  extraInfo?: Record<string, any>;
}

const typeBadges: Record<string, { label: string; class: string; icon: string }> = {
  COMIC: { label: 'Truyện tranh', class: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20', icon: '📚' },
  CHAPTER: { label: 'Chương truyện', class: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20', icon: '📖' },
  NEWS: { label: 'Tin tức', class: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', icon: '📰' },
};

const quickReasons = [
  'Nội dung không phù hợp với quy chuẩn cộng đồng',
  'Tiêu đề hoặc mô tả chứa từ ngữ vi phạm',
  'Hình ảnh chất lượng kém, bị lặp hoặc không mở được',
  'Chưa đăng tải đủ trang cho chương truyện',
  'Trùng lặp với bài đăng đã có trên hệ thống',
];

export default function StudioModerationPage() {
  const { accessToken, user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'LOGS'>('PENDING');

  // Pending queue states
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'COMIC' | 'CHAPTER' | 'NEWS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // History logs states
  const [logs, setLogs] = useState<ModerationLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED'>('ALL');

  // Reject modal
  const [rejectingItem, setRejectingItem] = useState<PendingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Preview modal
  const [previewItem, setPreviewItem] = useState<PendingItem | null>(null);

  const isAdminOrMod = user && (user.role === 'ADMIN' || user.role === 'MODERATOR');

  const fetchPending = () => {
    if (!accessToken || !isAdminOrMod) return;
    setLoading(true);
    const param = filterType !== 'ALL' ? `?targetType=${filterType}` : '';
    api
      .get<{ data: PendingItem[] }>(`/admin/moderation/pending${param}`, { token: accessToken })
      .then((res) => setItems(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchLogs = () => {
    if (!accessToken || !isAdminOrMod) return;
    setLogsLoading(true);
    const queryParams = new URLSearchParams();
    if (filterType !== 'ALL') queryParams.append('targetType', filterType);
    if (logActionFilter !== 'ALL') queryParams.append('action', logActionFilter);

    api
      .get<{ data: ModerationLogItem[] }>(`/admin/moderation/logs?${queryParams.toString()}`, { token: accessToken })
      .then((res) => setLogs(res.data || []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'PENDING') {
      fetchPending();
    } else {
      fetchLogs();
    }
  }, [accessToken, filterType, logActionFilter, activeTab, user]);

  const handleApprove = async (item: PendingItem) => {
    if (!accessToken) return;
    setApprovingId(item.targetId);
    try {
      await api.post(`/admin/moderation/${item.targetType}/${item.targetId}/approve`, {}, { token: accessToken });
      setItems((prev) => prev.filter((i) => !(i.targetType === item.targetType && i.targetId === item.targetId)));
      if (previewItem?.targetId === item.targetId) setPreviewItem(null);
    } catch (err: any) {
      alert(err?.message || 'Phê duyệt thất bại');
    }
    setApprovingId(null);
  };

  const handleConfirmReject = async () => {
    if (!accessToken || !rejectingItem || !rejectionReason.trim()) return;
    setSubmittingReject(true);
    try {
      await api.post(
        `/admin/moderation/${rejectingItem.targetType}/${rejectingItem.targetId}/reject`,
        { reason: rejectionReason.trim() },
        { token: accessToken },
      );
      setItems((prev) => prev.filter((i) => !(i.targetType === rejectingItem.targetType && i.targetId === rejectingItem.targetId)));
      if (previewItem?.targetId === rejectingItem.targetId) setPreviewItem(null);
      setRejectingItem(null);
      setRejectionReason('');
    } catch (err: any) {
      alert(err?.message || 'Từ chối thất bại');
    }
    setSubmittingReject(false);
  };

  if (user && !isAdminOrMod) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="mb-3 text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Quyền truy cập bị hạn chế</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Chỉ có Quản trị viên (Admin) và Kiểm duyệt viên (Moderator) mới có quyền truy cập trang này.
        </p>
      </div>
    );
  }

  const comicCount = items.filter((i) => i.targetType === 'COMIC').length;
  const chapterCount = items.filter((i) => i.targetType === 'CHAPTER').length;
  const newsCount = items.filter((i) => i.targetType === 'NEWS').length;

  const filteredItems = items.filter((i) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.author?.displayName?.toLowerCase().includes(q) ||
      i.author?.username?.toLowerCase().includes(q)
    );
  });

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.moderator?.displayName?.toLowerCase().includes(q) ||
      l.moderator?.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            🛡️ Trung tâm Kiểm duyệt Nội dung
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Phê duyệt bài đăng và tra cứu Lịch sử nhật ký kiểm duyệt của Kiểm duyệt viên
          </p>
        </div>
        <button
          onClick={activeTab === 'PENDING' ? fetchPending : fetchLogs}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1]"
        >
          🔄 Làm mới dữ liệu
        </button>
      </div>

      {/* Primary Tab Switcher */}
      <div className="mb-6 border-b border-zinc-200 dark:border-white/10 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'PENDING'
              ? 'text-violet-600 dark:text-violet-400'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          ⏳ Hàng chờ phê duyệt
          {items.length > 0 && (
            <span className="ml-2 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-300 px-2 py-0.5 text-xs font-bold">
              {items.length}
            </span>
          )}
          {activeTab === 'PENDING' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full animate-fade-in" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('LOGS')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'LOGS'
              ? 'text-violet-600 dark:text-violet-400'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          📜 Lịch sử kiểm duyệt
          {activeTab === 'LOGS' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full animate-fade-in" />
          )}
        </button>
      </div>

      {/* ── TAB 1: PENDING QUEUE ── */}
      {activeTab === 'PENDING' && (
        <>
          {/* Counter Stats Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div
              onClick={() => setFilterType('ALL')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                filterType === 'ALL'
                  ? 'border-violet-500 bg-violet-500/10 dark:bg-violet-500/15 shadow-md shadow-violet-500/10'
                  : 'border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Tất cả yêu cầu</span>
                <span className="text-lg">📋</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{items.length}</div>
            </div>

            <div
              onClick={() => setFilterType('COMIC')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                filterType === 'COMIC'
                  ? 'border-violet-500 bg-violet-500/10 dark:bg-violet-500/15 shadow-md shadow-violet-500/10'
                  : 'border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Truyện mới</span>
                <span className="text-lg">📚</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{comicCount}</div>
            </div>

            <div
              onClick={() => setFilterType('CHAPTER')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                filterType === 'CHAPTER'
                  ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 shadow-md shadow-blue-500/10'
                  : 'border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Chương mới</span>
                <span className="text-lg">📖</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{chapterCount}</div>
            </div>

            <div
              onClick={() => setFilterType('NEWS')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                filterType === 'NEWS'
                  ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 shadow-md shadow-emerald-500/10'
                  : 'border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Bài viết News</span>
                <span className="text-lg">📰</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{newsCount}</div>
            </div>
          </div>

          {/* Search bar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tiêu đề hoặc tên tác giả..."
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2.5 pl-10 pr-4 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Pending List */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-white/[0.08] bg-white dark:bg-transparent p-16 text-center shadow-sm dark:shadow-none">
              <div className="mb-3 text-4xl">🎉</div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Hàng chờ kiểm duyệt đang trống'}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {searchQuery ? 'Thử thay đổi từ khóa tìm kiếm' : 'Toàn bộ nội dung gửi lên đã được xử lý xong!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const badge = typeBadges[item.targetType] || { label: item.targetType, class: 'bg-zinc-500/15 text-zinc-600', icon: '📄' };
                return (
                  <div
                    key={`${item.targetType}-${item.targetId}`}
                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-sm dark:shadow-none transition-all duration-200 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800">
                        {item.extraInfo?.coverUrl ? (
                          <img src={item.extraInfo.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : item.author?.avatarUrl ? (
                          <img src={item.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-lg text-zinc-400">
                            {badge.icon}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badge.class}`}>
                            {badge.icon} {badge.label}
                          </span>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                            {item.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>Tác giả: <strong className="text-zinc-700 dark:text-zinc-300">{item.author?.displayName}</strong> (@{item.author?.username})</span>
                          <span>Gửi lúc: {new Date(item.updatedAt).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="rounded-lg bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        👁️ Xem trước & Nội dung
                      </button>

                      <button
                        onClick={() => handleApprove(item)}
                        disabled={approvingId === item.targetId}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {approvingId === item.targetId ? '...' : '✅ Phê duyệt'}
                      </button>

                      <button
                        onClick={() => { setRejectingItem(item); setRejectionReason(''); }}
                        className="rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 px-3.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition-all"
                      >
                        ❌ Từ chối
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: MODERATION HISTORY LOGS ── */}
      {activeTab === 'LOGS' && (
        <>
          {/* Filters Bar */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">Lọc kết quả:</span>
              <button
                onClick={() => setLogActionFilter('ALL')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  logActionFilter === 'ALL'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10'
                }`}
              >
                Tất cả hành động
              </button>
              <button
                onClick={() => setLogActionFilter('APPROVED')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  logActionFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10'
                }`}
              >
                ✅ Đã duyệt
              </button>
              <button
                onClick={() => setLogActionFilter('REJECTED')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  logActionFilter === 'REJECTED'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10'
                }`}
              >
                ❌ Bị từ chối
              </button>
            </div>

            <div className="relative max-w-xs w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tiêu đề hoặc tên Mod..."
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Logs List */}
          {logsLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-white/[0.08] bg-white dark:bg-transparent p-16 text-center shadow-sm dark:shadow-none">
              <div className="mb-3 text-4xl">📜</div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Chưa có nhật ký kiểm duyệt nào</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Lịch sử phê duyệt và từ chối sẽ được lưu vết tại đây</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const badge = typeBadges[log.targetType] || { label: log.targetType, class: 'bg-zinc-500/15 text-zinc-600', icon: '📄' };
                const isApproved = log.action === 'APPROVED';
                return (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 text-xs transition-all hover:border-zinc-300 dark:hover:border-white/10"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800">
                        {log.extraInfo?.coverUrl ? (
                          <img src={log.extraInfo.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-base">{badge.icon}</div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.class}`}>
                            {badge.icon} {badge.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isApproved ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
                            }`}
                          >
                            {isApproved ? '✅ ĐÃ PHÊ DUYỆT' : '❌ ĐÃ TỪ CHỐI'}
                          </span>
                          <h4 className="font-bold text-zinc-900 dark:text-white">{log.title}</h4>
                        </div>

                        {log.reason && (
                          <p className="text-red-600 dark:text-red-400 italic bg-red-500/5 p-2 rounded-lg border border-red-500/10 mt-1">
                            Lý do từ chối: "{log.reason}"
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <span>
                            Kiểm duyệt bởi: <strong className="text-zinc-700 dark:text-zinc-300">{log.moderator?.displayName}</strong> (@{log.moderator?.username})
                          </span>
                          <span>•</span>
                          <span>Thời gian: {new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── RICH PREVIEW MODAL ── */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121217] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 px-6 py-4 shrink-0 bg-zinc-50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${typeBadges[previewItem.targetType]?.class}`}>
                  {typeBadges[previewItem.targetType]?.icon} {typeBadges[previewItem.targetType]?.label}
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate max-w-md">
                  {previewItem.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-white/[0.03] p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-zinc-200 dark:border-white/10">
                    {previewItem.author?.avatarUrl ? (
                      <img src={previewItem.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-bold text-zinc-400">
                        {previewItem.author?.displayName?.[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">{previewItem.author?.displayName}</p>
                    <p>@{previewItem.author?.username}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-zinc-700 dark:text-zinc-300">Gửi duyệt lúc</p>
                  <p>{new Date(previewItem.updatedAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>

              {/* 1. COMIC PREVIEW */}
              {previewItem.targetType === 'COMIC' && (
                <div className="space-y-5">
                  <div className="relative h-44 w-full rounded-2xl overflow-hidden bg-gradient-to-r from-violet-900 to-zinc-900 border border-zinc-200 dark:border-white/10">
                    {previewItem.extraInfo?.bannerUrl && (
                      <img src={previewItem.extraInfo.bannerUrl} alt="" className="h-full w-full object-cover opacity-50" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 flex items-end gap-4">
                      {previewItem.extraInfo?.coverUrl && (
                        <img
                          src={previewItem.extraInfo.coverUrl}
                          alt=""
                          className="h-24 w-18 shrink-0 rounded-lg border-2 border-white/20 object-cover shadow-xl"
                        />
                      )}
                      <div>
                        <h2 className="text-xl font-bold text-white">{previewItem.title}</h2>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-300">
                          <span>🌐 Ngôn ngữ: {previewItem.extraInfo?.originalLanguage || 'vi'}</span>
                          <span>•</span>
                          <span>🔞 Đánh giá: {previewItem.extraInfo?.contentRating || 'EVERYONE'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {previewItem.extraInfo?.genres && previewItem.extraInfo.genres.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Thể loại</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {previewItem.extraInfo.genres.map((g: string) => (
                          <span key={g} className="rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20 px-2.5 py-1 text-xs font-medium">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Mô tả nội dung</h4>
                    <div className="rounded-xl bg-zinc-50 dark:bg-white/[0.03] p-4 text-sm text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.06] whitespace-pre-wrap leading-relaxed">
                      {previewItem.extraInfo?.description || 'Chưa có mô tả'}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. CHAPTER PREVIEW (FULL IMAGES READER) */}
              {previewItem.targetType === 'CHAPTER' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-xs text-blue-700 dark:text-blue-300">
                    <span className="font-semibold">📖 Xem trước danh sách trang ảnh trong chương</span>
                    <span className="font-bold">Tổng cộng: {previewItem.extraInfo?.pages?.length || 0} trang</span>
                  </div>

                  {previewItem.extraInfo?.pages && previewItem.extraInfo.pages.length > 0 ? (
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto p-2 bg-zinc-950 rounded-2xl border border-zinc-800">
                      {previewItem.extraInfo.pages.map((p: { pageNumber: number; imageUrl: string }) => (
                        <div key={p.pageNumber} className="relative group flex flex-col items-center">
                          <span className="mb-1 text-[10px] font-mono text-zinc-400">Trang {p.pageNumber}</span>
                          <img
                            src={p.imageUrl}
                            alt={`Trang ${p.pageNumber}`}
                            className="max-w-full rounded-lg shadow-lg object-contain border border-zinc-800"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center text-sm text-zinc-500 bg-zinc-50 dark:bg-white/5 rounded-xl">
                      Chương này chưa có hình ảnh nào được tải lên!
                    </div>
                  )}
                </div>
              )}

              {/* 3. NEWS PREVIEW */}
              {previewItem.targetType === 'NEWS' && (
                <div className="space-y-4">
                  {previewItem.extraInfo?.coverUrl && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-900">
                      <img src={previewItem.extraInfo.coverUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}

                  {previewItem.extraInfo?.category && (
                    <span className="inline-block rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-semibold">
                      🏷️ Danh mục: {previewItem.extraInfo.category}
                    </span>
                  )}

                  {previewItem.extraInfo?.excerpt && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium italic">
                      " {previewItem.extraInfo.excerpt} "
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Nội dung bài viết</h4>
                    <div className="rounded-xl bg-zinc-50 dark:bg-white/[0.03] p-4 text-sm text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/[0.06] whitespace-pre-wrap leading-relaxed">
                      {previewItem.extraInfo?.content || 'Chưa có nội dung'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-white/10 px-6 py-4 shrink-0 bg-zinc-50 dark:bg-white/[0.02]">
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
              >
                Đóng
              </button>

              <button
                onClick={() => { setRejectingItem(previewItem); setRejectionReason(''); }}
                className="rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 px-5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors"
              >
                ❌ Từ chối
              </button>

              <button
                onClick={() => handleApprove(previewItem)}
                disabled={approvingId === previewItem.targetId}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {approvingId === previewItem.targetId ? 'Đang duyệt...' : '✅ Phê duyệt ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121217] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Từ chối bài đăng: "{rejectingItem.title}"
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Chọn nhanh hoặc nhập lý do chi tiết để thông báo cho tác giả:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((qr) => (
                <button
                  key={qr}
                  onClick={() => setRejectionReason(qr)}
                  className="rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 px-2.5 py-1 text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors text-left"
                >
                  + {qr}
                </button>
              ))}
            </div>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Nhập chi tiết lý do từ chối..."
              className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3 text-xs text-zinc-900 dark:text-white outline-none focus:border-red-500/50"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setRejectingItem(null)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={submittingReject || !rejectionReason.trim()}
                className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submittingReject ? 'Đang gửi...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
