'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import BannerEditor from './banner-editor';
import AvatarCropModal from './avatar-crop-modal';
import EditProfileModal from './edit-profile-modal';

interface BannerData {
  url?: string;
  position?: number;
}

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  banner: BannerData | null;
  role: string;
  bio: string | null;
  socialLinks: Record<string, string>;
  level: number;
  createdAt: string;
  // Only present for own profile
  email?: string;
  coins?: number;
  experience?: number;
}

interface ProfileStats {
  bookmarkCount: number;
  commentCount: number;
  ratingCount: number;
  followerCount: number;
  followingCount: number;
}

interface ProfileData {
  user: PublicUser;
  stats: ProfileStats;
  isFollowing: boolean;
  isOwnProfile: boolean;
  authorComics?: AuthorComic[];
}

interface AuthorComic {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  totalChapters: number;
  totalViews: number;
  avgRating: number;
  lastChapterAt: string | null;
}

interface FollowUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  level: number;
}

interface BookmarkItem {
  id: string;
  isFavorite: boolean;
  comic: {
    id: string; title: string; slug: string; coverUrl: string | null;
    totalChapters: number; author: { displayName: string };
  };
}

interface HistoryItem {
  id: string;
  lastPage: number;
  readAt: string;
  chapter: {
    id: string; number: number; title: string | null;
    comic: { id: string; title: string; slug: string; coverUrl: string | null };
  };
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const { user: currentUser, accessToken, isHydrated, logout, updateUser } = useAuthStore();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history'>('bookmarks');
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  // Follow list modal
  const [followModal, setFollowModal] = useState<{ type: 'followers' | 'following'; open: boolean }>({ type: 'followers', open: false });
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListTotal, setFollowListTotal] = useState(0);
  const [followListPage, setFollowListPage] = useState(1);
  const [followListTotalPages, setFollowListTotalPages] = useState(1);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile data
  useEffect(() => {
    if (!isHydrated) return;
    setLoading(true);
    setNotFound(false);

    const opts = accessToken ? { token: accessToken } : {};
    api.get<{ data: ProfileData }>(`/users/${username}/profile`, opts)
      .then((r) => setProfile(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username, isHydrated, accessToken]);

  // Fetch tab data (only for own profile)
  useEffect(() => {
    if (!profile?.isOwnProfile || !accessToken) return;
    setLoadingTab(true);
    if (activeTab === 'bookmarks') {
      api.get<{ data: BookmarkItem[] }>('/bookmarks', { token: accessToken })
        .then((r) => setBookmarks(r.data))
        .catch(() => { })
        .finally(() => setLoadingTab(false));
    } else {
      api.get<{ data: HistoryItem[] }>('/history', { token: accessToken })
        .then((r) => setHistory(r.data))
        .catch(() => { })
        .finally(() => setLoadingTab(false));
    }
  }, [accessToken, activeTab, profile?.isOwnProfile]);

  // Loading state
  if (!isHydrated || loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-4">
        <div className="text-6xl">😵</div>
        <h1 className="text-2xl font-bold text-white">Không tìm thấy người dùng</h1>
        <p className="text-sm text-zinc-500">@{username} không tồn tại</p>
        <Link href="/" className="mt-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white">
          Về trang chủ
        </Link>
      </div>
    );
  }

  const { user: profileUser, stats, isFollowing, isOwnProfile } = profile;

  // Avatar file pick → open crop modal
  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  // Upload cropped avatar
  const handleCroppedAvatar = async (blob: Blob) => {
    if (!accessToken) return;
    setShowCropModal(false);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');
      const res = await api.upload<{ data: { url: string } }>('/upload/users/avatar', formData, { token: accessToken });
      updateUser({ avatarUrl: res.data.url });
      setProfile((p) => p ? { ...p, user: { ...p.user, avatarUrl: res.data.url } } : p);
    } catch { }
    setUploadingAvatar(false);
  };

  // Follow / Unfollow
  const handleFollowToggle = async () => {
    if (!accessToken) {
      router.push(`/login?redirect=/@${username}`);
      return;
    }
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.delete(`/users/${profileUser.id}/follow`, { token: accessToken });
        setProfile((p) => p ? { ...p, isFollowing: false, stats: { ...p.stats, followerCount: p.stats.followerCount - 1 } } : p);
      } else {
        await api.post(`/users/${profileUser.id}/follow`, undefined, { token: accessToken });
        setProfile((p) => p ? { ...p, isFollowing: true, stats: { ...p.stats, followerCount: p.stats.followerCount + 1 } } : p);
      }
    } catch { }
    setFollowLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Open follow list modal
  const openFollowModal = async (type: 'followers' | 'following') => {
    setFollowModal({ type, open: true });
    setFollowList([]);
    setFollowListPage(1);
    setFollowListLoading(true);
    try {
      const res = await api.get<{ data: { items: FollowUser[]; total: number; totalPages: number } }>(
        `/users/${profileUser.id}/${type}?page=1&limit=20`,
      );
      setFollowList(res.data.items);
      setFollowListTotal(res.data.total);
      setFollowListTotalPages(res.data.totalPages);
    } catch { }
    setFollowListLoading(false);
  };

  const loadMoreFollows = async () => {
    const nextPage = followListPage + 1;
    setFollowListLoading(true);
    try {
      const res = await api.get<{ data: { items: FollowUser[]; total: number; totalPages: number } }>(
        `/users/${profileUser.id}/${followModal.type}?page=${nextPage}&limit=20`,
      );
      setFollowList((prev) => [...prev, ...res.data.items]);
      setFollowListPage(nextPage);
      setFollowListTotalPages(res.data.totalPages);
    } catch { }
    setFollowListLoading(false);
  };

  const roleBadge: Record<string, { color: string; label: string }> = {
    READER: { color: 'bg-zinc-500/10 text-zinc-700 border border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-300 dark:border-zinc-500/30', label: 'Độc giả' },
    AUTHOR: { color: 'bg-violet-500/10 text-violet-700 border border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30', label: 'Tác giả' },
    MODERATOR: { color: 'bg-amber-500/10 text-amber-700 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30', label: 'Quản trị viên' },
    ADMIN: { color: 'bg-red-500/10 text-red-700 border border-red-500/20 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30', label: 'Admin' },
  };

  const xpForNextLevel = Math.floor(100 * Math.pow(1.5, (currentUser?.level ?? 1) - 1));
  const xpProgress = isOwnProfile && currentUser ? Math.min((currentUser.experience / xpForNextLevel) * 100, 100) : 0;

  return (
    <>
      {/* ──── Banner ──── */}
      <BannerEditor
        banner={profileUser.banner}
        isOwnProfile={isOwnProfile}
        onBannerChange={(b) => setProfile((p) => p ? { ...p, user: { ...p.user, banner: b } } : p)}
      />
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-8">
        {/* ──── Avatar + Info ──── */}
        <div className="relative -mt-24 px-4 sm:px-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
            {/* Avatar */}
            <div className="group relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 text-4xl font-bold text-white shadow-xl sm:h-32 sm:w-32">
                {profileUser.avatarUrl ? (
                  <img src={profileUser.avatarUrl} alt={profileUser.displayName} className="h-full w-full object-cover" />
                ) : (
                  profileUser.displayName.charAt(0).toUpperCase()
                )}
              </div>
              {isOwnProfile && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
            </div>

            {/* Name & Role */}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">{profileUser.displayName}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${roleBadge[profileUser.role]?.color || roleBadge.READER.color}`}>
                  {roleBadge[profileUser.role]?.label || profileUser.role}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">@{profileUser.username}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pb-1">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="rounded bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110 cursor-pointer"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    onClick={handleLogout}
                    className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`rounded px-6 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer ${isFollowing
                    ? 'border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400'
                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:brightness-110'
                    }`}
                >
                  {followLoading ? '...' : isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ──── Follow stats ──── */}
        <div className="mt-4 flex items-center gap-5 px-4 sm:px-6">
          <button
            onClick={() => openFollowModal('followers')}
            className="text-sm text-zinc-500 dark:text-zinc-400 transition-colors hover:text-violet-600 dark:hover:text-violet-400 cursor-pointer"
          >
            <span className="font-bold text-zinc-900 dark:text-white">{stats.followerCount}</span> người theo dõi
          </button>
          <button
            onClick={() => openFollowModal('following')}
            className="text-sm text-zinc-500 dark:text-zinc-400 transition-colors hover:text-violet-600 dark:hover:text-violet-400 cursor-pointer"
          >
            <span className="font-bold text-zinc-900 dark:text-white">{stats.followingCount}</span> đang theo dõi
          </button>
        </div>

        {/* ──── Level & XP (own profile only) ──── */}
        {isOwnProfile && currentUser && (
          <div className="mt-4 rounded border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-gradient-to-br from-amber-500 to-orange-600 text-lg font-bold text-white shadow-lg">
                  {currentUser.level}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Cấp {currentUser.level}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentUser.experience} / {xpForNextLevel} XP</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {currentUser.loginStreak > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5">
                    <span className="text-sm">🔥</span>
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{currentUser.loginStreak} ngày</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5">
                  <span className="text-sm">🪙</span>
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{currentUser.coins} xu</span>
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${xpProgress}%`,
                  background: 'linear-gradient(to right, #f59e0b, #f97316)',
                }}
              />
            </div>
          </div>
        )}

        {/* ──── Bio ──── */}
        <div className="mt-4 rounded border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] p-5 backdrop-blur-xl">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-400">Giới thiệu</h3>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {profileUser.bio || (isOwnProfile ? 'Chưa có giới thiệu. Nhấn "Chỉnh sửa" để thêm!' : 'Chưa có giới thiệu.')}
          </p>

          {profileUser.socialLinks && Object.keys(profileUser.socialLinks).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {profileUser.socialLinks.website && (
                <a href={profileUser.socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white">
                  🌐 Website
                </a>
              )}
              {profileUser.socialLinks.twitter && (
                <a href={profileUser.socialLinks.twitter.startsWith('http') ? profileUser.socialLinks.twitter : `https://twitter.com/${profileUser.socialLinks.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white">
                  𝕏 Twitter
                </a>
              )}
              {profileUser.socialLinks.facebook && (
                <a href={profileUser.socialLinks.facebook.startsWith('http') ? profileUser.socialLinks.facebook : `https://facebook.com/${profileUser.socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white">
                  ⓕ Facebook
                </a>
              )}
            </div>
          )}
        </div>

        {/* ──── Stats Grid ──── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="🔖" label="Đã lưu" value={stats.bookmarkCount} />
          <StatCard icon="💬" label="Bình luận" value={stats.commentCount} />
          <StatCard icon="⭐" label="Đánh giá" value={stats.ratingCount} />
          <StatCard
            icon="📅"
            label="Tham gia"
            value={new Date(profileUser.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })}
          />
        </div>

        {/* ──── Author Comics (visible on author profiles) ──── */}
        {profile.authorComics && profile.authorComics.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-white">
              <span>✍️</span> Truyện của {profileUser.displayName}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {profile.authorComics.map((comic) => (
                <Link
                  key={comic.id}
                  href={`/comics/${comic.slug}`}
                  className="flex items-center gap-3 rounded border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] p-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/5"
                >
                  <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                    {comic.coverUrl ? (
                      <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg font-bold text-zinc-400 dark:text-zinc-600">
                        {comic.title[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{comic.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{comic.totalChapters} chương</span>
                      <span>·</span>
                      <span>{comic.totalViews.toLocaleString('vi-VN')} lượt xem</span>
                      {Number(comic.avgRating) > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-500">⭐ {Number(comic.avgRating).toFixed(1)}</span>
                        </>
                      )}
                    </div>
                    <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      comic.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : comic.status === 'ONGOING'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {comic.status === 'COMPLETED' ? 'Hoàn thành' : comic.status === 'ONGOING' ? 'Đang tiến hành' : comic.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        {isOwnProfile && (
          <div className="mt-8">
            <div className="flex gap-1 rounded border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/[0.02] p-1">
              <TabButton label="🔖 Truyện đã lưu" active={activeTab === 'bookmarks'} onClick={() => setActiveTab('bookmarks')} />
              <TabButton label="📖 Lịch sử đọc" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
            </div>

            <div className="mt-4">
              {loadingTab ? (
                <div className="flex justify-center py-16">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
                </div>
              ) : activeTab === 'bookmarks' ? (
                bookmarks.length === 0 ? (
                  <EmptyState icon="🔖" title="Chưa lưu truyện nào" desc="Khám phá và lưu truyện yêu thích!" link="/comics" linkText="Khám phá truyện →" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {bookmarks.map((bm) => (
                      <Link key={bm.id} href={`/comics/${bm.comic.slug}`}
                        className="flex items-center gap-3 rounded border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] p-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/5">
                        <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                          {bm.comic.coverUrl ? <img src={bm.comic.coverUrl} alt={bm.comic.title} className="h-full w-full object-cover" /> :
                            <div className="flex h-full items-center justify-center text-lg font-bold text-zinc-400 dark:text-zinc-600">{bm.comic.title[0]}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{bm.comic.title}</h4>
                            {bm.isFavorite && <span className="text-xs">❤️</span>}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{bm.comic.author.displayName}</p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{bm.comic.totalChapters} chương</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ) : (() => {
                const groupedUserHistory = history.reduce<HistoryItem[]>((acc, item) => {
                  const comicId = item.chapter.comic.id;
                  if (!acc.some((existing) => existing.chapter.comic.id === comicId)) {
                    acc.push(item);
                  }
                  return acc;
                }, []);

                if (groupedUserHistory.length === 0) {
                  return <EmptyState icon="📖" title="Chưa có lịch sử đọc" desc="Bắt đầu đọc truyện ngay!" link="/comics" linkText="Khám phá truyện →" />;
                }

                return (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {groupedUserHistory.map((h) => (
                      <Link key={h.id} href={`/read/${h.chapter.id}`}
                        className="flex items-center gap-3 rounded border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] p-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/5">
                        <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                          {h.chapter.comic.coverUrl ? <img src={h.chapter.comic.coverUrl} alt={h.chapter.comic.title} className="h-full w-full object-cover" /> :
                            <div className="flex h-full items-center justify-center text-lg font-bold text-zinc-400 dark:text-zinc-600">{h.chapter.comic.title[0]}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{h.chapter.comic.title}</h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Đã đọc: Chương {String(h.chapter.number)}{h.chapter.title ? ` — ${h.chapter.title}` : ''}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{new Date(h.readAt).toLocaleDateString('vi-VN')}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {showEditModal && <EditProfileModal onClose={() => { setShowEditModal(false); /* Refresh after edit */ location.reload(); }} />}
      {showCropModal && <AvatarCropModal imageSrc={cropImageSrc} onCropComplete={handleCroppedAvatar} onClose={() => setShowCropModal(false)} />}

      {/* ──── Follow List Modal ──── */}
      {followModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFollowModal({ ...followModal, open: false })}>
          <div
            className="relative mx-4 w-full max-w-md rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 px-5 py-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {followModal.type === 'followers' ? `Người theo dõi (${followListTotal})` : `Đang theo dõi (${followListTotal})`}
              </h3>
              <button
                onClick={() => setFollowModal({ ...followModal, open: false })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {followListLoading && followList.length === 0 ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
                </div>
              ) : followList.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-2 text-3xl">😶</div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {followModal.type === 'followers' ? 'Chưa có người theo dõi nào' : 'Chưa theo dõi ai'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    {followList.map((u) => (
                      <Link
                        key={u.id}
                        href={`/user/${u.username}`}
                        onClick={() => setFollowModal({ ...followModal, open: false })}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-zinc-100 dark:hover:bg-white/5"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" />
                          ) : (
                            u.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{u.displayName}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">@{u.username} · Lv.{u.level}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {followListPage < followListTotalPages && (
                    <button
                      onClick={loadMoreFollows}
                      disabled={followListLoading}
                      className="mt-3 w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50 cursor-pointer"
                    >
                      {followListLoading ? 'Đang tải...' : 'Xem thêm'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="rounded border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] p-4 text-center">
      <div className="mb-1 text-lg">{icon}</div>
      <p className="text-lg font-bold text-zinc-900 dark:text-white">{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${active ? 'bg-white dark:bg-white/10 text-violet-600 dark:text-white font-semibold shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}>
      {label}
    </button>
  );
}

function EmptyState({ icon, title, desc, link, linkText }: { icon: string; title: string; desc: string; link: string; linkText: string }) {
  return (
    <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-12 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{desc}</p>
      <Link href={link} className="mt-4 inline-block rounded bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25">
        {linkText}
      </Link>
    </div>
  );
}
