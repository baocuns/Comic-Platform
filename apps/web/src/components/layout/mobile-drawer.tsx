'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X,
  Home,
  Compass,
  Trophy,
  Sparkles,
  Newspaper,
  Bookmark,
  History,
  Receipt,
  PenTool,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/providers/theme-provider';
import { Avatar } from '@/components/ui/avatar';
import { RealmBadge } from '@/components/ui/realm-badge';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const navItems = [
    { href: '/', label: 'Trang chủ', icon: Home },
    { href: '/comics', label: 'Khám phá truyện', icon: Compass },
    { href: '/rankings', label: 'Bảng xếp hạng', icon: Trophy },
    { href: '/cultivation', label: 'Tàng Kinh Các · Tu Luyện', icon: Sparkles },
    { href: '/news', label: 'Tin tức & Tạp chí', icon: Newspaper },
    { href: '/library', label: 'Tủ sách cá nhân', icon: Bookmark },
    { href: '/history', label: 'Lịch sử đọc', icon: History },
    { href: '/purchases', label: 'Lịch sử mua hàng', icon: Receipt },
  ];

  return (
    <div className="fixed inset-0 z-[140] flex md:hidden animate-fade-in">
      <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-76 max-w-[85vw] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3.5">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <img src="/img/owoc_banner_black.png" className="h-9 w-auto dark:hidden" alt="OWOC" />
            <img src="/img/owoc_banner_white.png" className="hidden h-9 w-auto dark:block" alt="OWOC" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {user ? (
            <Link
              href={`/@${user.username}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
            >
              <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--text-primary)]">{user.displayName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <RealmBadge level={user.level} experience={user.experience} />
                  <span className="text-xs font-semibold text-[var(--accent-warm)]">{user.coins} Xu</span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={onClose}
                className="flex h-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-xs font-semibold text-white"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="flex h-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)]"
              >
                Đăng ký
              </Link>
            </div>
          )}

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {user && ['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role) && (
              <Link
                href="/studio"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--accent-warm)] hover:bg-[var(--accent-warm-soft)]"
              >
                <PenTool className="h-4 w-4" />
                <span>Author Studio</span>
              </Link>
            )}
          </nav>
        </div>

        <div className="border-t border-[var(--border-subtle)] p-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}</span>
          </button>
          {user && (
            <button
              type="button"
              onClick={async () => {
                await logout();
                onClose();
              }}
              className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--danger)] cursor-pointer"
            >
              Đăng xuất
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
