'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Sun,
  Moon,
  ChevronDown,
  User as UserIcon,
  Bookmark,
  History,
  Receipt,
  Sparkles,
  PenTool,
  LogOut,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useSearchStore } from '@/stores/search-store';
import { useTheme } from '@/components/providers/theme-provider';
import { Avatar } from '@/components/ui/avatar';
import { RealmBadge } from '@/components/ui/realm-badge';
import { NotificationBell } from './notification-bell';
import { MobileDrawer } from './mobile-drawer';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/comics', label: 'Khám phá' },
  { href: '/rankings', label: 'Xếp hạng' },
  { href: '/cultivation', label: 'Tu Luyện' },
  { href: '/news', label: 'Tin tức' },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const openSearch = useSearchStore((s) => s.open);

  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y <= 50) setIsVisible(true);
      else if (y > lastScrollY.current + 12) setIsVisible(false);
      else if (y < lastScrollY.current - 12) setIsVisible(true);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  if (pathname?.startsWith('/read/') || pathname?.startsWith('/studio')) {
    return null;
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/90 backdrop-blur-xl transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Mobile Trigger + Brand + Desktop Links */}
          <div className="flex items-center gap-2 sm:gap-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] md:hidden cursor-pointer"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/" prefetch={false} className="flex items-center gap-2 shrink-0">
              <img
                src="/img/owoc_banner_black.png"
                className="h-10 sm:h-11 w-auto dark:hidden object-contain"
                alt="OWOC"
              />
              <img
                src="/img/owoc_banner_white.png"
                className="hidden h-10 sm:h-11 w-auto dark:block object-contain"
                alt="OWOC"
              />
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const active =
                  link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Search + Theme + Notifications + User */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 sm:px-3 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Tìm kiếm"
            >
              <Search className="h-4 w-4 text-[var(--accent-primary)]" />
              <span className="hidden lg:inline">Tìm truyện, tác giả...</span>
              <kbd className="hidden lg:inline rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-semibold">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
              title={theme === 'dark' ? 'Chuyển sang Giấy Ấm (Sáng)' : 'Chuyển sang Đêm Mực (Tối)'}
              aria-label="Chuyển giao diện sáng tối"
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            {user && <NotificationBell />}

            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 pr-2.5 transition-colors hover:border-[var(--border-strong)] cursor-pointer"
                >
                  <Avatar src={user.avatarUrl} name={user.displayName} size="sm" className="h-7 w-7" />
                  <span className="hidden sm:inline max-w-28 truncate text-xs font-semibold text-[var(--text-primary)]">
                    {user.displayName}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 shadow-xl z-50 animate-slide-up">
                    <div className="rounded-xl bg-[var(--bg-subtle)]/70 p-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                            {user.displayName}
                          </p>
                          <p className="truncate text-xs text-[var(--text-muted)]">@{user.username}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <RealmBadge level={user.level} experience={user.experience} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent-warm)] border border-[var(--border-subtle)]">
                          <Coins className="h-3 w-3" />
                          {user.coins.toLocaleString('vi-VN')} Xu
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 space-y-0.5">
                      <Link
                        href={`/@${user.username}`}
                        prefetch={false}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <UserIcon className="h-4 w-4 text-[var(--text-muted)]" />
                        <span>Hồ sơ cá nhân</span>
                      </Link>
                      <Link
                        href="/library"
                        prefetch={false}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <Bookmark className="h-4 w-4 text-[var(--text-muted)]" />
                        <span>Tủ sách của tôi</span>
                      </Link>
                      <Link
                        href="/history"
                        prefetch={false}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <History className="h-4 w-4 text-[var(--text-muted)]" />
                        <span>Lịch sử đọc</span>
                      </Link>
                      <Link
                        href="/purchases"
                        prefetch={false}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <Receipt className="h-4 w-4 text-[var(--text-muted)]" />
                        <span>Lịch sử mua hàng</span>
                      </Link>
                      <Link
                        href="/cultivation"
                        prefetch={false}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                        <span>Tàng Kinh Các · Tu Luyện</span>
                      </Link>

                      {['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role) && (
                        <Link
                          href="/studio"
                          prefetch={false}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--accent-warm)] hover:bg-[var(--accent-warm-soft)]"
                        >
                          <PenTool className="h-4 w-4" />
                          <span>Author Studio</span>
                        </Link>
                      )}

                      {['MODERATOR', 'ADMIN'].includes(user.role) && (
                        <Link
                          href="/studio/moderation"
                          prefetch={false}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)]"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>Trung tâm Kiểm duyệt</span>
                        </Link>
                      )}
                    </div>

                    <div className="mt-1.5 border-t border-[var(--border-subtle)] pt-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          setMenuOpen(false);
                          await logout();
                          router.push('/');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/login"
                  prefetch={false}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-3.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)]"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  prefetch={false}
                  className="hidden sm:inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </nav>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
