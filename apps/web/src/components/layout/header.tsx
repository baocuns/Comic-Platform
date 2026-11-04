'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationBell } from './notification-bell';
import { useSearchStore } from '@/stores/search-store';
import { useTheme } from '@/components/providers/theme-provider';
import { MobileDrawer } from './mobile-drawer';

export function Header() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const openSearch = useSearchStore((state) => state.open);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current + 10) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY.current - 10) {
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  if (pathname?.startsWith('/read/') || pathname?.startsWith('/studio')) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 border-b border-zinc-200 dark:border-white/10 bg-white/85 dark:bg-[#0a0a0a]/80 backdrop-blur-xl ${isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo & Mobile Menu Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="flex md:hidden p-1.5 sm:p-2 items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 hover:dark:text-white active:scale-95 transition-colors cursor-pointer"
            title="Mở menu"
            aria-label="Mở menu điều hướng"
          >
            <i className="fa-light fa-bars text-[22px]" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <img src="/img/owoc_banner_black.png" className="h-11 sm:h-14 w-auto dark:hidden object-contain" alt="Owoc Logo" />
            <img src="/img/owoc_banner_white.png" className="h-11 sm:h-14 w-auto hidden dark:block object-contain" alt="Owoc Logo" />
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-base font-medium text-zinc-500 dark:text-zinc-400 transition-colors hover:text-zinc-900 hover:dark:text-white">
            TRANG CHỦ
          </Link>
          <Link href="/comics" className="text-base font-medium text-zinc-500 dark:text-zinc-400 transition-colors hover:text-zinc-900 hover:dark:text-white">
            TRUYỆN TRANH
          </Link>
          <Link href="/news" className="text-base font-medium text-zinc-500 dark:text-zinc-400 transition-colors hover:text-zinc-900 hover:dark:text-white">
            TIN TỨC
          </Link>
        </div>

        {/* Auth Actions */}
        <div className="flex items-center gap-2.5 sm:gap-4 md:gap-5">
          {/* Search */}
          <button
            onClick={openSearch}
            className="flex p-1.5 sm:p-2 items-center justify-center text-zinc-600 dark:text-zinc-300 transition-colors hover:text-zinc-900 hover:dark:text-white cursor-pointer"
            title="Tìm kiếm"
            aria-label="Tìm kiếm"
          >
            <i className="fal fa-search text-[21px]"></i>
          </button>

          {/* Theme Toggle (Guest) */}
          {!user && (
            <button
              onClick={toggleTheme}
              className="flex p-1.5 sm:p-2 items-center justify-center text-zinc-600 dark:text-zinc-300 transition-colors hover:text-zinc-900 hover:dark:text-white cursor-pointer"
              title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              aria-label="Chuyển chế độ sáng/tối"
            >
              <i className={`fa-light ${theme === 'dark' ? 'fa-sun-bright' : 'fa-moon'} text-[21px]`} />
            </button>
          )}

          {/* Notifications */}
          {user && <NotificationBell />}

          {/* User */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 p-1 text-sm text-zinc-600 dark:text-zinc-300 transition-colors hover:text-zinc-900 hover:dark:text-white cursor-pointer"
              >
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-xs font-bold text-white shadow-sm">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    user.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="hidden sm:inline font-medium">{user.displayName}</span>
                <i className={`fa-solid fa-chevron-down text-[10px] text-zinc-500 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121212] p-1.5 shadow-2xl animate-slide-up z-50">
                  {/* User Profile Header */}
                  <div className="px-3.5 py-3 border-b border-zinc-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-base font-bold text-white shadow-inner">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                        ) : (
                          user.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white leading-tight">{user.displayName}</p>
                        <p className="truncate text-xs text-zinc-500 mt-0.5">@{user.username}</p>
                      </div>
                    </div>

                    {/* Stats & Levels */}
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-white/5 px-3 py-2 text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">Cấp {user.level || 1}</span>
                      <span className="text-zinc-300 dark:text-zinc-600">•</span>
                      <span className="text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-1">🪙 {user.coins || 0} xu</span>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href={`/@${user.username}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <i className="fa-light fa-user w-4 text-center text-zinc-400 text-base" />
                      <span>Trang cá nhân</span>
                    </Link>
                    {['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role) && (
                      <Link
                        href="/studio"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      >
                        <i className="fa-light fa-pen-nib w-4 text-center text-zinc-400 text-base" />
                        <span>Studio</span>
                      </Link>
                    )}
                    <Link
                      href="/bookmarks"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <i className="fa-light fa-bookmark w-4 text-center text-zinc-400 text-base" />
                      <span>Truyện đã lưu</span>
                    </Link>
                    <Link
                      href="/history"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <i className="fa-light fa-clock-rotate-left w-4 text-center text-zinc-400 text-base" />
                      <span>Lịch sử đọc</span>
                    </Link>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-white/5 my-1" />

                  <div className="py-1">
                    {/* Theme Toggle */}
                    <div
                      onClick={toggleTheme}
                      className="flex items-center justify-between px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <i className={`fa-light ${theme === 'dark' ? 'fa-moon' : 'fa-sun-bright'} w-4 text-center text-zinc-400 text-base`} />
                        <span>Giao diện: {theme === 'dark' ? 'Tối' : 'Sáng'}</span>
                      </div>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-amber-500/50 shadow-sm" />
                    </div>

                    <Link
                      href={`/@${user.username}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <i className="fa-light fa-gear w-4 text-center text-zinc-400 text-base" />
                      <span>Cài đặt tài khoản</span>
                    </Link>
                  </div>

                  <div className="border-t border-white/5 my-1" />

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                    >
                      <i className="fa-light fa-right-from-bracket w-4 text-center text-red-400/80 text-base" />
                      <span className="font-medium">Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="flex p-1.5 sm:p-2 items-center justify-center text-zinc-600 dark:text-zinc-300 transition-colors hover:text-zinc-900 hover:dark:text-white cursor-pointer"
              title="Đăng nhập"
              aria-label="Đăng nhập"
            >
              <i className="fa-light fa-user text-[21px]" />
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile Off-canvas Drawer */}
      <MobileDrawer isOpen={isMobileDrawerOpen} onClose={() => setIsMobileDrawerOpen(false)} />
    </header>
  );
}
