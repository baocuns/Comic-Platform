'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Edit3,
  UserPlus,
  UserCheck,
  BookOpen,
  Bookmark,
  MessageSquare,
  Star,
  Flame,
  Coins,
  Check,
  Globe,
  Flag,
} from 'lucide-react';
import { ReportTargetType, type PublicUser } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { COMIC_STATUS_LABEL, formatDate, sanitizeSafeUrl } from '@/lib/format';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RealmBadge } from '@/components/ui/realm-badge';
import { Modal } from '@/components/ui/modal';
import { ReportModal } from '@/components/ui/report-modal';
import BannerEditor from './banner-editor';
import AvatarCropModal from './avatar-crop-modal';
import EditProfileModal from './edit-profile-modal';

interface ProfileResponse {
  user: PublicUser & {
    loginStreak: number;
    longestStreak: number;
    chaptersReadCount: number;
  };
  stats: {
    bookmarkCount: number;
    commentCount: number;
    ratingCount: number;
    followerCount: number;
    followingCount: number;
  };
  isFollowing: boolean;
  isOwnProfile: boolean;
  authorComics: Array<{
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    status: string;
    totalChapters: number;
    totalViews: number;
    avgRating: number;
  }>;
  recentBookmarks: Array<{
    id: string;
    status: string;
    comic: {
      id: string;
      title: string;
      slug: string;
      coverUrl: string | null;
      totalChapters: number;
      avgRating: number;
    };
  }>;
}

export default function UserProfilePage() {
  const params = useParams();
  const username = decodeURIComponent((params?.username as string) || '').replace(/^@/, '');
  const { user: currentUser, accessToken, isHydrated, fetchProfile, updateUser } = useAuthStore();
  const { toast } = useToast();

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [followListModal, setFollowListModal] = useState<'followers' | 'following' | null>(null);
  const [followUsers, setFollowUsers] = useState<PublicUser[]>([]);
  const [showReportUser, setShowReportUser] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: ProfileResponse }>(`/users/${encodeURIComponent(username)}`, {
        token: accessToken,
        signal,
      });
      if (!signal?.aborted) setData(res.data);
    } catch {
      if (!signal?.aborted) setData(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [username, accessToken]);

  useEffect(() => {
    if (!isHydrated) return;
    const controller = new AbortController();
    loadProfile(controller.signal);
    return () => controller.abort();
  }, [isHydrated, loadProfile]);

  const handleToggleFollow = async () => {
    if (!data || !accessToken) {
      toast.error('Đăng nhập để theo dõi thành viên');
      return;
    }
    try {
      if (data.isFollowing) {
        await api.delete(`/users/${data.user.id}/follow`, { token: accessToken });
        setData((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: false,
                stats: { ...prev.stats, followerCount: Math.max(0, prev.stats.followerCount - 1) },
              }
            : prev,
        );
      } else {
        await api.post(`/users/${data.user.id}/follow`, {}, { token: accessToken });
        setData((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: true,
                stats: { ...prev.stats, followerCount: prev.stats.followerCount + 1 },
              }
            : prev,
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    }
  };

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropDone = async (blob: Blob) => {
    setCropSrc(null);
    if (!accessToken) return;
    try {
      const fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');
      const res = await api.upload<{ data: { url: string } }>('/uploads/users/me/avatar', fd, {
        token: accessToken,
      });
      updateUser({ avatarUrl: res.data.url });
      setData((prev) => (prev ? { ...prev, user: { ...prev.user, avatarUrl: res.data.url } } : prev));
      toast.success('Đã cập nhật ảnh đại diện!');
    } catch {
      toast.error('Không thể tải ảnh đại diện');
    }
  };

  const openFollowModal = async (kind: 'followers' | 'following') => {
    if (!data) return;
    setFollowListModal(kind);
    try {
      const res = await api.get<{ data: PublicUser[] }>(`/users/${data.user.id}/${kind}`);
      setFollowUsers(res.data || []);
    } catch {
      setFollowUsers([]);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="h-64 animate-pulse rounded-3xl bg-[var(--bg-subtle)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center space-y-3">
        <h1 className="font-serif text-2xl font-bold">Không tìm thấy hồ sơ @{username}</h1>
        <Link href="/">
          <Button>Về trang chủ</Button>
        </Link>
      </div>
    );
  }

  const profile = data.user;

  return (
    <div className="pb-16">
      <BannerEditor
        bannerUrl={profile.bannerUrl || null}
        bannerPosition={profile.bannerPosition ?? 50}
        isOwnProfile={data.isOwnProfile}
        onUpdated={(url, pos) =>
          setData((prev) =>
            prev ? { ...prev, user: { ...prev.user, bannerUrl: url, bannerPosition: pos } } : prev,
          )
        }
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 -mt-14 relative z-10 space-y-8">
        <Card className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative w-fit">
                <Avatar src={profile.avatarUrl} name={profile.displayName} size="xl" className="ring-4 ring-[var(--bg-surface)]" />
                {data.isOwnProfile && (
                  <>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow-md hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                      title="Đổi ảnh đại diện"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarSelected}
                    />
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                    {profile.displayName}
                  </h1>
                  <RealmBadge level={profile.level} experience={profile.experience} showSubStage size="md" />
                  {profile.isTrusted && (
                    <Badge variant="success">
                      <Check className="h-3 w-3" />
                      Tác giả Uy tín
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  @{profile.username} · Tham gia {formatDate(profile.createdAt)} · Cấp {profile.level}
                </p>
                {profile.bio && (
                  <p className="max-w-2xl text-sm text-[var(--text-secondary)]">{profile.bio}</p>
                )}
                {profile.socialLinks && Object.values(profile.socialLinks).some((v) => sanitizeSafeUrl(v, false)) && (
                  <div className="flex flex-wrap gap-3 pt-1 text-xs">
                    {Object.entries(profile.socialLinks).map(([k, v]) => {
                      const safeHref = sanitizeSafeUrl(v, false);
                      return safeHref ? (
                        <a
                          key={k}
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          {k}
                        </a>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {data.isOwnProfile ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                    <Edit3 className="h-4 w-4" />
                    Chỉnh sửa hồ sơ
                  </Button>
                  {['AUTHOR', 'MODERATOR', 'ADMIN'].includes(profile.role) && (
                    <Link href="/studio">
                      <Button variant="warm" size="sm">
                        Vào Studio
                      </Button>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant={data.isFollowing ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={handleToggleFollow}
                  >
                    {data.isFollowing ? (
                      <>
                        <UserCheck className="h-4 w-4 text-[var(--success)]" />
                        Đang theo dõi
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Theo dõi
                      </>
                    )}
                  </Button>
                  {currentUser && (
                    <Button variant="ghost" size="sm" onClick={() => setShowReportUser(true)}>
                      <Flag className="h-4 w-4" />
                      Báo cáo
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-6">
            <button
              type="button"
              onClick={() => openFollowModal('followers')}
              className="rounded-xl bg-[var(--bg-canvas)] p-3 text-center hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
            >
              <p className="text-lg font-bold text-[var(--text-primary)]">{data.stats.followerCount}</p>
              <p className="text-xs text-[var(--text-muted)]">Người theo dõi</p>
            </button>
            <button
              type="button"
              onClick={() => openFollowModal('following')}
              className="rounded-xl bg-[var(--bg-canvas)] p-3 text-center hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
            >
              <p className="text-lg font-bold text-[var(--text-primary)]">{data.stats.followingCount}</p>
              <p className="text-xs text-[var(--text-muted)]">Đang theo dõi</p>
            </button>
            <div className="rounded-xl bg-[var(--bg-canvas)] p-3 text-center">
              <p className="inline-flex items-center gap-1 text-lg font-bold text-[var(--text-primary)]">
                <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
                {profile.chaptersReadCount}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Chương đã đọc</p>
            </div>
            <div className="rounded-xl bg-[var(--bg-canvas)] p-3 text-center">
              <p className="inline-flex items-center gap-1 text-lg font-bold text-[var(--text-primary)]">
                <Bookmark className="h-4 w-4 text-[var(--accent-primary)]" />
                {data.stats.bookmarkCount}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Truyện đã lưu</p>
            </div>
            <div className="rounded-xl bg-[var(--bg-canvas)] p-3 text-center">
              <p className="inline-flex items-center gap-1 text-lg font-bold text-[var(--text-primary)]">
                <MessageSquare className="h-4 w-4 text-[var(--accent-warm)]" />
                {data.stats.commentCount}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Bình luận</p>
            </div>
            <div className="rounded-xl bg-[var(--bg-canvas)] p-3 text-center">
              <p className="inline-flex items-center gap-1 text-lg font-bold text-[var(--accent-warm)]">
                {data.isOwnProfile && currentUser ? (
                  <>
                    <Coins className="h-4 w-4" />
                    {currentUser.coins}
                  </>
                ) : (
                  <>
                    <Flame className="h-4 w-4" />
                    {profile.loginStreak}d
                  </>
                )}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {data.isOwnProfile ? 'Xu Linh Thạch' : 'Chuỗi điểm danh'}
              </p>
            </div>
          </div>
        </Card>

        {/* Authored Comics */}
        {data.authorComics.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Tác phẩm đã xuất bản ({data.authorComics.length})
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {data.authorComics.map((c) => (
                <Link key={c.id} href={`/comics/${c.slug}`} className="group space-y-2">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                    {c.coverUrl && (
                      <img
                        src={c.coverUrl}
                        alt={c.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div>
                    <p className="truncate text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                      {c.title}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {COMIC_STATUS_LABEL[c.status]} · {c.totalChapters} ch.
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Public Recent Bookmarks */}
        {data.recentBookmarks.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Tủ sách yêu thích gần đây
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {data.recentBookmarks.map((b) => (
                <Link key={b.id} href={`/comics/${b.comic.slug}`} className="group space-y-1.5">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                    {b.comic.coverUrl && (
                      <img
                        src={b.comic.coverUrl}
                        alt={b.comic.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                    {b.comic.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {cropSrc && (
        <AvatarCropModal imageSrc={cropSrc} onCropComplete={handleCropDone} onClose={() => setCropSrc(null)} />
      )}

      {showEdit && currentUser && (
        <EditProfileModal
          user={currentUser}
          onClose={() => setShowEdit(false)}
          onUpdated={async () => {
            await fetchProfile();
            await loadProfile();
          }}
        />
      )}

      {followListModal && (
        <Modal
          open
          onClose={() => setFollowListModal(null)}
          title={followListModal === 'followers' ? 'Người theo dõi' : 'Đang theo dõi'}
        >
          <div className="space-y-2">
            {followUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">Danh sách trống.</p>
            ) : (
              followUsers.map((u) => (
                <Link
                  key={u.id}
                  href={`/@${u.username}`}
                  onClick={() => setFollowListModal(null)}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--bg-subtle)]"
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{u.displayName}</p>
                    <p className="text-xs text-[var(--text-muted)]">@{u.username}</p>
                  </div>
                  <RealmBadge level={u.level} />
                </Link>
              ))
            )}
          </div>
        </Modal>
      )}
      {showReportUser && (
        <ReportModal
          open={showReportUser}
          onClose={() => setShowReportUser(false)}
          targetType={ReportTargetType.USER}
          targetId={profile.id}
          targetLabel={profile.displayName}
        />
      )}
    </div>
  );
}
