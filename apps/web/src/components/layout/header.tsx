'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { usePathname, useRouter } from 'next/navigation';
import { useSearchStore } from '@/stores/search-store';

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const openSearch = useSearchStore((state) => state.open);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setIsScrolled(currentScrollY > 0);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (pathname?.startsWith('/read/')) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'
        } ${isScrolled
          ? 'border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent backdrop-blur-none'
        }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
            O
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            OW<span className="text-violet-400">OC</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Trang chủ
          </Link>
          <Link href="/comics" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Khám phá
          </Link>
          {/* {user && (
            <>
              <Link href="/bookmarks" className="text-sm text-zinc-400 transition-colors hover:text-white">
                🔖 Đã lưu
              </Link>
              <Link href="/history" className="text-sm text-zinc-400 transition-colors hover:text-white">
                📖 Lịch sử
              </Link>
              <Link href="/studio" className="text-sm text-zinc-400 transition-colors hover:text-white">
                ✏️ Studio
              </Link>
            </>
          )} */}
        </div>

        {/* Auth Actions */}
        <div className="flex items-center gap-8">
          {/* Search */}
          <button
            onClick={openSearch}
            className="flex items-center gap-2 rounded-full bg-white/5 px-2 py-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <i className="fa-light fa-magnifying-glass" />
          </button>

          {/* User */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 rounded-full bg-white/5 p-1 pr-3 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
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
                <div className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-[#121212]/95 p-1.5 shadow-2xl backdrop-blur-xl animate-slide-up z-50">
                  {/* User Profile Header */}
                  <div className="px-3.5 py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-base font-bold text-white shadow-inner">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                        ) : (
                          user.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white leading-tight">{user.displayName}</p>
                        <p className="truncate text-xs text-zinc-500 mt-0.5">@{user.username}</p>
                      </div>
                    </div>

                    {/* Stats & Levels */}
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                      <span className="text-zinc-400 font-medium">Cấp {user.level || 1}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-amber-400 font-semibold flex items-center gap-1">🪙 {user.coins || 0} xu</span>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href={`/@${user.username}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <i className="fa-light fa-user w-4 text-center text-zinc-400 text-base" />
                      <span>Trang cá nhân</span>
                    </Link>
                    {['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role) && (
                      <Link
                        href="/studio"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <i className="fa-light fa-pen-nib w-4 text-center text-zinc-400 text-base" />
                        <span>Studio tác giả</span>
                      </Link>
                    )}
                    <Link
                      href="/bookmarks"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <i className="fa-light fa-bookmark w-4 text-center text-zinc-400 text-base" />
                      <span>Truyện đã lưu</span>
                    </Link>
                    <Link
                      href="/history"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <i className="fa-light fa-clock-rotate-left w-4 text-center text-zinc-400 text-base" />
                      <span>Lịch sử đọc</span>
                    </Link>
                  </div>

                  <div className="border-t border-white/5 my-1" />

                  <div className="py-1">
                    {/* Theme Toggle (Static Visual Representation) */}
                    <div className="flex items-center justify-between px-3 py-2 text-sm text-zinc-300 rounded-xl hover:bg-white/5 hover:text-white transition-colors cursor-pointer select-none">
                      <div className="flex items-center gap-3">
                        <i className="fa-light fa-moon w-4 text-center text-zinc-400 text-base" />
                        <span>Giao diện: Tối</span>
                      </div>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                    </div>

                    <Link
                      href={`/@${user.username}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
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
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="hidden rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
