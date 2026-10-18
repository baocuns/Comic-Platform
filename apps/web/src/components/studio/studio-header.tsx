'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/providers/theme-provider';
import { NotificationBell } from '@/components/layout/notification-bell';

export function StudioHeader({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-13 sm:h-14 items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0c0c0f]/80 px-3 sm:px-6 backdrop-blur-xl transition-colors duration-200">
      <div className="flex items-center min-w-0 mr-2">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileMenu}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 md:hidden mr-2"
          aria-label="Mở menu điều hướng"
        >
          <i className="fa-solid fa-bars text-sm" />
        </button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm truncate">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {i > 0 && <span className="text-zinc-400 dark:text-zinc-700">/</span>}
              {i < breadcrumbs.length - 1 ? (
                <Link
                  href={crumb.href}
                  className="text-zinc-600 dark:text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-300 truncate max-w-[80px] xs:max-w-[120px] sm:max-w-none"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/[0.08] hover:text-zinc-900 dark:hover:text-zinc-200"
          title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
        >
          <i className={`fa-light ${theme === 'dark' ? 'fa-sun-bright' : 'fa-moon'} text-xs sm:text-sm`} />
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {user && (
          <Link
            href={`/@${user.username}`}
            className="flex items-center gap-2 rounded-full border border-zinc-200 dark:border-transparent bg-zinc-100 dark:bg-white/[0.04] p-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/[0.08] hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-xs font-bold text-white shadow-sm">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
              ) : (
                user.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <span className="hidden sm:inline font-medium">{user.displayName}</span>
          </Link>
        )}
      </div>
    </header>
  );
}

function buildBreadcrumbs(pathname: string) {
  const crumbs: { label: string; href: string }[] = [
    { label: 'Studio', href: '/studio' },
  ];

  const segments = pathname.replace('/studio', '').split('/').filter(Boolean);

  if (segments[0] === 'comics') {
    crumbs.push({ label: 'Truyện', href: '/studio/comics' });

    if (segments[1] && segments[1] !== 'new') {
      // comic id — label will be updated by the page component
      crumbs.push({ label: 'Chi tiết', href: `/studio/comics/${segments[1]}` });

      if (segments[2] === 'chapters' && segments[3]) {
        crumbs.push({
          label: 'Canvas Editor',
          href: `/studio/comics/${segments[1]}/chapters/${segments[3]}`,
        });
      }
    }
  }

  return crumbs;
}
