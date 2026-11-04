'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/providers/theme-provider';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  iconColor?: string;
  badge?: string;
}

const MAIN_NAV: NavItem[] = [
  { label: 'Trang chủ', href: '/', icon: 'fa-light fa-book-open' },
  { label: 'Khám phá video', href: '/news', icon: 'fa-light fa-video' },
  { label: 'Bảng xếp hạng', href: '/comics?sort=popular', icon: 'fa-light fa-crown' },
  { label: 'Mới cập nhật', href: '/comics?sort=updated', icon: 'fa-light fa-clock' },
  { label: 'Hot nhất', href: '/comics?sort=popular', icon: 'fa-light fa-fire-flame-curved' },
  { label: 'Tủ sách của tôi', href: '/bookmarks', icon: 'fa-light fa-bookmark' },
];

const GENRES_NAV: NavItem[] = [
  { label: 'Truyện Full', href: '/comics?status=completed', icon: 'fa-light fa-book-open', iconColor: 'text-purple-500' },
  { label: 'Ngôn tình', href: '/comics?genre=romance', icon: 'fa-light fa-heart', iconColor: 'text-rose-500' },
  { label: 'BL', href: '/comics?genre=bl', icon: 'fa-light fa-book-open', iconColor: 'text-purple-400' },
  { label: 'Lãng mạn', href: '/comics?genre=romance', icon: 'fa-light fa-book-open', iconColor: 'text-amber-500' },
  { label: 'Hài hước', href: '/comics?genre=comedy', icon: 'fa-light fa-face-smile', iconColor: 'text-amber-500' },
  { label: 'Cổ đại', href: '/comics?genre=historical', icon: 'fa-light fa-landmark', iconColor: 'text-amber-600' },
  { label: 'Xuyên không', href: '/comics?genre=xuyen-khong', icon: 'fa-light fa-hourglass-half', iconColor: 'text-purple-500' },
  { label: 'Trọng sinh', href: '/comics?genre=trong-sinh', icon: 'fa-light fa-rotate-right', iconColor: 'text-emerald-500' },
  { label: 'Hành động', href: '/comics?genre=action', icon: 'fa-light fa-bolt', iconColor: 'text-red-500' },
  { label: 'Học đường', href: '/comics?genre=slice-of-life', icon: 'fa-light fa-graduation-cap', iconColor: 'text-sky-500' },
  { label: 'Linh dị', href: '/comics?genre=horror', icon: 'fa-light fa-book-open', iconColor: 'text-indigo-500' },
  { label: 'Lịch sử Việt Nam', href: '/comics?genre=historical', icon: 'fa-light fa-book-open', iconColor: 'text-blue-600' },
  { label: 'Cổ tích, thần thoại', href: '/comics?genre=fantasy', icon: 'fa-light fa-book-open', iconColor: 'text-emerald-500' },
  { label: 'Truyện thiếu nhi', href: '/comics?genre=fantasy', icon: 'fa-light fa-book-open', iconColor: 'text-emerald-600' },
];

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer when route changes
  useEffect(() => {
    onClose();
  }, [pathname]);

  // Lock body scroll and handle Escape key when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push('/');
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Off-canvas Drawer Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-[1000] flex h-[100dvh] max-h-[100dvh] w-[82vw] max-w-xs sm:max-w-sm flex-col bg-white dark:bg-[#111111] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu điều hướng di động"
        aria-hidden={!isOpen}
      >
        {/* Top Crimson Header Banner */}
        <div className="relative shrink-0 bg-gradient-to-br from-[#c8102e] via-[#b80d28] to-[#96091e] px-5 pt-5 pb-6 text-white shadow-md">
          {/* Top Bar with Brand & Close Button */}
          <div className="flex items-center justify-between pb-3">
            <Link href="/" onClick={onClose} className="flex items-center gap-2">
              <img
                src="/img/owoc_banner_white.png"
                alt="OWOC Logo"
                className="h-10 w-auto object-contain brightness-110"
              />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white/90 hover:bg-black/30 hover:text-white transition-colors cursor-pointer"
              aria-label="Đóng menu"
            >
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>

          {/* Banner User / Greeting Section */}
          {!user ? (
            <div className="space-y-3 pt-1">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white">Bạn đọc OWOC</h3>
                <p className="text-xs text-white/80 mt-0.5 leading-snug">
                  Đăng nhập để đồng bộ tủ sách với app OWOC.
                </p>
              </div>

              <Link
                href="/login"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb703] hover:bg-[#ffa200] py-2.5 px-4 text-sm font-bold text-zinc-950 shadow-md transition-all active:scale-[0.98]"
              >
                <i className="fa-solid fa-user text-sm" />
                <span>Đăng nhập</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 ring-2 ring-white/30 text-sm font-bold text-white shadow">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    user.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-white leading-tight">{user.displayName}</p>
                  <p className="truncate text-xs text-white/80 mt-0.5">@{user.username}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-xs">
                <span className="text-white/90 font-medium">Cấp {user.level || 1}</span>
                <span className="text-white/40">•</span>
                <span className="text-amber-300 font-semibold flex items-center gap-1">🪙 {user.coins || 0} xu</span>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 divide-y divide-zinc-100 dark:divide-white/5">
          {/* Main Navigation Group */}
          <div className="px-2 py-2 space-y-0.5">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 active:bg-zinc-200 dark:active:bg-white/10 transition-colors"
              >
                <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                  <i className={item.icon} />
                </span>
                <span className="flex-1">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Genres Group */}
          <div className="px-2 py-2">
            <h4 className="px-3.5 pt-2 pb-1 text-xs font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
              Thể loại
            </h4>
            <div className="space-y-0.5">
              {GENRES_NAV.map((genre) => (
                <Link
                  key={genre.href + genre.label}
                  href={genre.href}
                  onClick={onClose}
                  className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 active:bg-zinc-200 dark:active:bg-white/10 transition-colors"
                >
                  <span
                    className={`flex w-6 items-center justify-center text-center text-lg ${
                      genre.iconColor || 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <i className={genre.icon} />
                  </span>
                  <span className="flex-1">{genre.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Account Group */}
          <div className="px-2 py-2">
            <h4 className="px-3.5 pt-2 pb-1 text-xs font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
              Tài khoản
            </h4>
            <div className="space-y-0.5">
              {!user ? (
                <>
                  <Link
                    href="/login"
                    onClick={onClose}
                    className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                      <i className="fa-light fa-user" />
                    </span>
                    <span className="flex-1">Đăng nhập</span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={onClose}
                    className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                      <i className="fa-light fa-user-plus" />
                    </span>
                    <span className="flex-1">Đăng ký</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/@${user.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                      <i className="fa-light fa-user" />
                    </span>
                    <span className="flex-1">Trang cá nhân</span>
                  </Link>

                  {['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role) && (
                    <Link
                      href="/studio"
                      onClick={onClose}
                      className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                        <i className="fa-light fa-pen-nib" />
                      </span>
                      <span className="flex-1">Studio</span>
                    </Link>
                  )}

                  <Link
                    href="/bookmarks"
                    onClick={onClose}
                    className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                      <i className="fa-light fa-bookmark" />
                    </span>
                    <span className="flex-1">Truyện đã lưu</span>
                  </Link>

                  <Link
                    href="/history"
                    onClick={onClose}
                    className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                      <i className="fa-light fa-clock-rotate-left" />
                    </span>
                    <span className="flex-1">Lịch sử đọc</span>
                  </Link>
                </>
              )}

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                    <i className={`fa-light ${theme === 'dark' ? 'fa-sun-bright' : 'fa-moon'}`} />
                  </span>
                  <span>Giao diện: {theme === 'dark' ? 'Tối' : 'Sáng'}</span>
                </div>
                <span className="h-2 w-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              </button>

              {/* FAQ */}
              <button
                type="button"
                onClick={() => setFaqModalOpen(true)}
                className="flex w-full items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                  <i className="fa-light fa-circle-question" />
                </span>
                <span className="flex-1">Câu hỏi thường gặp</span>
              </button>

              {/* Support */}
              <button
                type="button"
                onClick={() => setSupportModalOpen(true)}
                className="flex w-full items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <span className="flex w-6 items-center justify-center text-center text-lg text-zinc-700 dark:text-zinc-300">
                  <i className="fa-light fa-comment-dots" />
                </span>
                <span className="flex-1">Gửi yêu cầu hỗ trợ</span>
              </button>

              {/* Logout (if authenticated) */}
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                >
                  <span className="flex w-6 items-center justify-center text-center text-lg text-red-500">
                    <i className="fa-light fa-right-from-bracket" />
                  </span>
                  <span className="flex-1">Đăng xuất</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* FAQ Modal */}
      {faqModalOpen && (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181b] p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <i className="fa-light fa-circle-question text-amber-500" />
                Câu hỏi thường gặp
              </h3>
              <button
                onClick={() => setFaqModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-white"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <div className="rounded-xl bg-zinc-50 dark:bg-white/5 p-3">
                <p className="font-semibold text-zinc-900 dark:text-white">Làm sao để đọc truyện miễn phí?</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Toàn bộ truyện trên hệ thống đều mở đọc miễn phí hoặc mở khóa bằng xu tích lũy hàng ngày.
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 dark:bg-white/5 p-3">
                <p className="font-semibold text-zinc-900 dark:text-white">Làm sao để đăng ký làm tác giả?</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Bạn có thể liên hệ qua hòm thư hỗ trợ hoặc vào phần Studio để bắt đầu đăng tải tác phẩm.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181b] p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <i className="fa-light fa-comment-dots text-amber-500" />
                Gửi yêu cầu hỗ trợ
              </h3>
              <button
                onClick={() => setSupportModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-white"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <p>Mọi góp ý, báo lỗi hoặc thắc mắc bản quyền, bạn có thể gửi phản hồi qua:</p>
              <div className="rounded-xl bg-zinc-50 dark:bg-white/5 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <i className="fa-solid fa-envelope text-amber-500" />
                  <span className="font-medium text-zinc-900 dark:text-white">Email:</span>
                  <a href="mailto:support@owoc.vn" className="text-amber-500 hover:underline">
                    support@owoc.vn
                  </a>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <i className="fa-brands fa-facebook text-blue-500" />
                  <span className="font-medium text-zinc-900 dark:text-white">Cộng đồng:</span>
                  <span className="text-zinc-500 dark:text-zinc-400">OWOC Comics Vietnam</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="rounded-xl bg-zinc-100 dark:bg-white/10 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors"
              >
                Đóng
              </button>
              <a
                href="mailto:support@owoc.vn"
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors inline-flex items-center gap-1.5"
              >
                <i className="fa-regular fa-paper-plane text-xs" />
                Gửi Email
              </a>
            </div>
          </div>
        </div>
      )}
    </>
    ,
    document.body
  );
}
