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

  const roleBadge: Record<string, { color: string; label: string }> = {
    READER: { color: 'bg-zinc-500/20 text-zinc-300', label: 'Độc giả' },
    AUTHOR: { color: 'bg-violet-500/20 text-violet-300', label: 'Tác giả' },
    MODERATOR: { color: 'bg-amber-500/20 text-amber-300', label: 'Quản trị viên' },
    ADMIN: { color: 'bg-red-500/20 text-red-300', label: 'Admin' },
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
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#0a0a0a] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-4xl font-bold text-white shadow-xl sm:h-32 sm:w-32">
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
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
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
                <h1 className="text-2xl font-bold text-white sm:text-3xl">{profileUser.displayName}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${roleBadge[profileUser.role]?.color || roleBadge.READER.color}`}>
                  {roleBadge[profileUser.role]?.label || profileUser.role}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-zinc-500">@{profileUser.username}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pb-1">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    onClick={handleLogout}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${isFollowing
                    ? 'border border-white/10 bg-white/5 text-zinc-300 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400'
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
          <span className="text-sm text-zinc-400">
            <span className="font-bold text-white">{stats.followerCount}</span> người theo dõi
          </span>
          <span className="text-sm text-zinc-400">
            <span className="font-bold text-white">{stats.followingCount}</span> đang theo dõi
          </span>
        </div>

        {/* ──── Level & XP (own profile only) ──── */}
        {isOwnProfile && currentUser && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-lg font-bold text-white shadow-lg">
                  {currentUser.level}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Cấp {currentUser.level}</p>
                  <p className="text-xs text-zinc-500">{currentUser.experience} / {xpForNextLevel} XP</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {currentUser.loginStreak > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5">
                    <span className="text-sm">🔥</span>
                    <span className="text-sm font-semibold text-orange-400">{currentUser.loginStreak} ngày</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5">
                  <span className="text-sm">🪙</span>
                  <span className="text-sm font-semibold text-amber-400">{currentUser.coins} xu</span>
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
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
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <h3 className="mb-2 text-sm font-semibold text-zinc-400">Giới thiệu</h3>
          <p className="text-sm leading-relaxed text-zinc-300">
            {profileUser.bio || (isOwnProfile ? 'Chưa có giới thiệu. Nhấn "Chỉnh sửa" để thêm!' : 'Chưa có giới thiệu.')}
          </p>

          {profileUser.socialLinks && Object.keys(profileUser.socialLinks).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {profileUser.socialLinks.website && (
                <a href={profileUser.socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
                  🌐 Website
                </a>
              )}
              {profileUser.socialLinks.twitter && (
                <a href={profileUser.socialLinks.twitter.startsWith('http') ? profileUser.socialLinks.twitter : `https://twitter.com/${profileUser.socialLinks.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
                  𝕏 Twitter
                </a>
              )}
              {profileUser.socialLinks.facebook && (
                <a href={profileUser.socialLinks.facebook.startsWith('http') ? profileUser.socialLinks.facebook : `https://facebook.com/${profileUser.socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
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

        {/* ──── Activity Tabs (own profile only) ──── */}
        {isOwnProfile && (
          <div className="mt-8">
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
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
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/5">
                        <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                          {bm.comic.coverUrl ? <img src={bm.comic.coverUrl} alt={bm.comic.title} className="h-full w-full object-cover" /> :
                            <div className="flex h-full items-center justify-center text-lg font-bold text-zinc-600">{bm.comic.title[0]}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="truncate text-sm font-semibold text-white">{bm.comic.title}</h4>
                            {bm.isFavorite && <span className="text-xs">❤️</span>}
                          </div>
                          <p className="text-xs text-zinc-500">{bm.comic.author.displayName}</p>
                          <p className="mt-0.5 text-xs text-zinc-600">{bm.comic.totalChapters} chương</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ) : history.length === 0 ? (
                <EmptyState icon="📖" title="Chưa có lịch sử đọc" desc="Bắt đầu đọc truyện ngay!" link="/comics" linkText="Khám phá truyện →" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {history.map((h) => (
                    <Link key={h.id} href={`/comics/${h.chapter.comic.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/5">
                      <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {h.chapter.comic.coverUrl ? <img src={h.chapter.comic.coverUrl} alt={h.chapter.comic.title} className="h-full w-full object-cover" /> :
                          <div className="flex h-full items-center justify-center text-lg font-bold text-zinc-600">{h.chapter.comic.title[0]}</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-white">{h.chapter.comic.title}</h4>
                        <p className="text-xs text-zinc-500">Chương {String(h.chapter.number)} {h.chapter.title ? `— ${h.chapter.title}` : ''}</p>
                        <p className="mt-0.5 text-xs text-zinc-600">{new Date(h.readAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showEditModal && <EditProfileModal onClose={() => { setShowEditModal(false); /* Refresh after edit */ location.reload(); }} />}
      {showCropModal && <AvatarCropModal imageSrc={cropImageSrc} onCropComplete={handleCroppedAvatar} onClose={() => setShowCropModal(false)} />}
    </>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
      <div className="mb-1 text-lg">{icon}</div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${active ? 'bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
      {label}
    </button>
  );
}

function EmptyState({ icon, title, desc, link, linkText }: { icon: string; title: string; desc: string; link: string; linkText: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-zinc-500">{desc}</p>
      <Link href={link} className="mt-4 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25">
        {linkText}
      </Link>
    </div>
  );
}
