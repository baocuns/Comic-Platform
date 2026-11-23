'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, BookOpen, Eye, ShieldAlert, Tags, Sliders, Plus, Trash2, UserCheck, Flag } from 'lucide-react';
import { UserRole, type GenreItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { formatCompactNumber, formatDate } from '@/lib/format';
import { StatCard } from '@/components/studio/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const CONFIG_BOUNDS: Record<string, { min: number; max: number }> = {
  xp_daily_login: { min: 0, max: 100_000 },
  coin_daily_login: { min: 0, max: 100_000 },
  xp_streak_bonus: { min: 0, max: 100_000 },
  coin_streak_7_bonus: { min: 0, max: 100_000 },
  streak_max_days: { min: 1, max: 365 },
  xp_read_chapter: { min: 0, max: 100_000 },
  coin_read_chapter: { min: 0, max: 100_000 },
  xp_comment: { min: 0, max: 100_000 },
  xp_rate: { min: 0, max: 100_000 },
  coin_rate: { min: 0, max: 100_000 },
  xp_bookmark: { min: 0, max: 100_000 },
  coin_level_up: { min: 0, max: 100_000 },
  coin_welcome: { min: 0, max: 100_000 },
  author_revenue_percent: { min: 0, max: 100 },
};

interface AdminOverview {
  totalUsers: number;
  totalComics: number;
  totalChapters: number;
  totalNews: number;
  totalViews: number;
  pendingModerationCount: number;
  pendingReportsCount: number;
  pendingAuthorApplicationsCount?: number;
}

interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isTrusted: boolean;
  isBanned: boolean;
  bannedUntil?: string | null;
  level: number;
  coins: number;
}

interface ConfigRow {
  key: string;
  value: number;
  label: string;
  description: string | null;
}

export default function AdminDashboardPage() {
  const { user, accessToken } = useAuthStore();
  const { toast } = useToast();

  const [tab, setTab] = useState<'users' | 'genres' | 'gamification'>('users');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [newGenreName, setNewGenreName] = useState('');
  const [newGenreIcon, setNewGenreIcon] = useState('✨');
  const [savingConfig, setSavingConfig] = useState(false);
  const [deleteGenreTarget, setDeleteGenreTarget] = useState<GenreItem | null>(null);
  const [deletingGenre, setDeletingGenre] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(userSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) return;
    try {
      const [ov, us, gn, cfg] = await Promise.all([
        api.get<{ data: AdminOverview }>('/admin/overview', { token: accessToken, signal }),
        api.get<{ data: AdminUserRow[] }>(`/admin/users?search=${encodeURIComponent(debouncedSearch)}`, {
          token: accessToken,
          signal,
        }),
        api.get<{ data: GenreItem[] }>('/genres?all=true', { token: accessToken, signal }),
        api.get<{ data: ConfigRow[] }>('/gamification/config', { token: accessToken, signal }),
      ]);
      if (!signal?.aborted) {
        setOverview(ov.data);
        setUsers(us.data || []);
        setGenres(gn.data || []);
        setConfigs(cfg.data || []);
      }
    } catch {
      // Ignore
    }
  }, [accessToken, debouncedSearch]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      const controller = new AbortController();
      loadAll(controller.signal);
      return () => controller.abort();
    }
  }, [user?.role, loadAll]);

  if (user?.role !== 'ADMIN') {
    return (
      <Card className="p-8 text-center text-sm text-[var(--danger)]">
        Chỉ Quản trị viên (ADMIN) mới có quyền truy cập khu vực này.
      </Card>
    );
  }

  const handleRoleChange = async (targetId: string, role: UserRole) => {
    if (!accessToken || targetId === user.id) return;
    try {
      await api.patch(`/admin/users/${targetId}/role`, { role }, { token: accessToken });
      toast.success('Đã cập nhật vai trò người dùng');
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Cập nhật thất bại');
    }
  };

  const handleToggleTrust = async (target: AdminUserRow) => {
    if (!accessToken || target.id === user.id) return;
    try {
      await api.patch(
        `/moderation/users/${target.id}/trust`,
        { isTrusted: !target.isTrusted },
        { token: accessToken },
      );
      toast.success('Đã cập nhật trạng thái Tác giả Uy tín');
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    }
  };

  const handleToggleBan = async (target: AdminUserRow) => {
    if (!accessToken || target.id === user.id) return;
    try {
      await api.patch(
        `/admin/users/${target.id}/ban`,
        { isBanned: !target.isBanned },
        { token: accessToken },
      );
      toast.info(target.isBanned ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    }
  };

  const handleDeleteGenre = async () => {
    if (!accessToken || !deleteGenreTarget || deletingGenre) return;
    setDeletingGenre(true);
    try {
      await api.delete(`/genres/${deleteGenreTarget.id}`, { token: accessToken });
      toast.info(`Đã xóa thể loại "${deleteGenreTarget.name}"`);
      setDeleteGenreTarget(null);
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xóa thể loại thất bại');
    } finally {
      setDeletingGenre(false);
    }
  };

  const handleAddGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newGenreName.trim()) return;
    try {
      await api.post(
        '/genres',
        { name: newGenreName.trim(), icon: newGenreIcon.trim() || undefined },
        { token: accessToken },
      );
      setNewGenreName('');
      toast.success('Đã thêm thể loại mới');
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thêm thất bại');
    }
  };

  const handleSaveConfig = async () => {
    if (!accessToken || savingConfig) return;
    for (const cfg of configs) {
      const bounds = CONFIG_BOUNDS[cfg.key];
      const numVal = Math.floor(Number(cfg.value));
      if (!Number.isFinite(numVal) || (bounds && (numVal < bounds.min || numVal > bounds.max))) {
        toast.error(
          `"${cfg.label}" phải là số nguyên từ ${bounds?.min ?? 0} đến ${(bounds?.max ?? 100000).toLocaleString('vi-VN')}`,
        );
        return;
      }
    }
    setSavingConfig(true);
    try {
      await api.patch(
        '/gamification/config',
        { updates: configs.map((c) => ({ key: c.key, value: Math.floor(Number(c.value) || 0) })) },
        { token: accessToken },
      );
      toast.success('Đã lưu cấu hình Tu Luyện toàn hệ thống!');
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể lưu cấu hình');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Quản trị Hệ thống</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Theo dõi chỉ số nền tảng, phân quyền tài khoản, thể loại và cân bằng kinh tế Tu Luyện.
        </p>
      </div>

      {overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Thành viên" value={overview.totalUsers} icon={<Users className="h-5 w-5" />} />
          <StatCard
            label="Kho Truyện"
            value={overview.totalComics}
            sub={`${overview.totalChapters} chương · ${overview.totalNews} tin tức`}
            icon={<BookOpen className="h-5 w-5" />}
          />
          <StatCard
            label="Tổng lượt đọc"
            value={formatCompactNumber(overview.totalViews)}
            icon={<Eye className="h-5 w-5" />}
          />
          <StatCard
            label="Chờ xử lý"
            value={
              overview.pendingModerationCount +
              overview.pendingReportsCount +
              (overview.pendingAuthorApplicationsCount || 0)
            }
            sub={`${overview.pendingModerationCount} duyệt · ${overview.pendingReportsCount} báo cáo · ${overview.pendingAuthorApplicationsCount || 0} đơn tác giả`}
            icon={<ShieldAlert className="h-5 w-5" />}
          />
        </div>
      )}

      {overview && (overview.pendingAuthorApplicationsCount || 0) > 0 && (
        <Link href="/studio/moderation?tab=authors" className="block">
          <Card className="flex flex-wrap items-center justify-between gap-3 border-[var(--accent-warm)]/40 bg-[var(--accent-warm-soft)]/50 p-4 hover:border-[var(--accent-warm)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-warm)] text-white">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Có {overview.pendingAuthorApplicationsCount} đơn đăng ký Tác giả đang chờ xét duyệt
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Nhấn để xem hồ sơ và phê duyệt mở quyền Author Studio.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--accent-warm)]">Xét duyệt ngay →</span>
          </Card>
        </Link>
      )}

      {overview && overview.pendingReportsCount > 0 && (
        <Link href="/studio/moderation?tab=reports" className="block">
          <Card className="flex flex-wrap items-center justify-between gap-3 border-[var(--danger)]/35 bg-[var(--danger-soft)]/45 p-4 hover:border-[var(--danger)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger)] text-white">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Có {overview.pendingReportsCount} báo cáo vi phạm đang chờ xử lý
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Kiểm tra chi tiết nội dung bị báo cáo và áp dụng biện pháp xử lý trực tiếp.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--danger)]">Xử lý ngay →</span>
          </Card>
        </Link>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'users', label: 'Người dùng', icon: <Users className="h-4 w-4" /> },
          { value: 'genres', label: 'Thể loại', icon: <Tags className="h-4 w-4" /> },
          { value: 'gamification', label: 'Cấu hình Tu Luyện', icon: <Sliders className="h-4 w-4" /> },
        ]}
      />

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="max-w-sm">
            <Input
              placeholder="Tìm theo email, username, tên..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
            {users.map((u) => {
              const isSelf = u.id === user.id;
              return (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{u.displayName}</p>
                        {isSelf && <Badge variant="primary">Bạn</Badge>}
                        {u.isTrusted && <Badge variant="success">Uy tín</Badge>}
                        {u.isBanned && (
                          <Badge variant="danger">
                            {u.bannedUntil ? `Khóa đến ${formatDate(u.bannedUntil)}` : 'Khóa vĩnh viễn'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        @{u.username} · {u.email} · Cấp {u.level} · {u.coins} Xu
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {Object.values(UserRole).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={isSelf}
                      onClick={() => handleToggleTrust(u)}
                    >
                      {u.isTrusted ? 'Gỡ Uy tín' : 'Cấp Uy tín'}
                    </Button>
                    <Button
                      size="xs"
                      variant={u.isBanned ? 'secondary' : 'danger'}
                      disabled={isSelf || u.role === UserRole.ADMIN}
                      onClick={() => handleToggleBan(u)}
                    >
                      {u.isBanned ? 'Mở khóa' : 'Khóa'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab === 'genres' && (
        <div className="space-y-4">
          <form onSubmit={handleAddGenre} className="flex flex-wrap gap-2 items-end">
            <div className="w-24">
              <Input label="Icon" value={newGenreIcon} onChange={(e) => setNewGenreIcon(e.target.value)} />
            </div>
            <div className="flex-1 min-w-48">
              <Input
                label="Tên thể loại mới"
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                placeholder="Ví dụ: Huyền Huyễn"
              />
            </div>
            <Button type="submit" variant="warm">
              <Plus className="h-4 w-4" /> Thêm thể loại
            </Button>
          </form>

          <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
            {genres.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{g.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{g.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">/{g.slug} · {g.comicCount} truyện</p>
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setDeleteGenreTarget(g)}
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </Button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'gamification' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Thông số thưởng XP & Xu</h3>
            <Button size="sm" variant="warm" isLoading={savingConfig} onClick={handleSaveConfig}>
              Lưu tất cả cấu hình
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {configs.map((cfg) => {
              const bounds = CONFIG_BOUNDS[cfg.key] ?? { min: 0, max: 100000 };
              return (
                <div
                  key={cfg.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)]">{cfg.label}</p>
                    {cfg.description && <p className="text-[11px] text-[var(--text-muted)]">{cfg.description}</p>}
                  </div>
                  <input
                    type="number"
                    min={bounds.min}
                    max={bounds.max}
                    value={cfg.value}
                    onChange={(e) =>
                      setConfigs((prev) =>
                        prev.map((row) =>
                          row.key === cfg.key ? { ...row, value: Number(e.target.value) } : row,
                        ),
                      )
                    }
                    className="h-9 w-22 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-right text-sm font-bold"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteGenreTarget}
        onClose={() => setDeleteGenreTarget(null)}
        onConfirm={handleDeleteGenre}
        title="Xóa thể loại?"
        description={`Bạn có chắc muốn xóa thể loại "${deleteGenreTarget?.name || ''}" khỏi hệ thống?`}
        confirmLabel="Xóa thể loại"
        isLoading={deletingGenre}
      />
    </div>
  );
}
