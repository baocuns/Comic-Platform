'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export function StudioHeader() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0c0c0f]/80 px-6 backdrop-blur-xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-zinc-700">/</span>}
            {i < breadcrumbs.length - 1 ? (
              <Link
                href={crumb.href}
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-zinc-200">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {user && (
          <Link
            href={`/@${user.username}`}
            className="flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:inline">{user.displayName}</span>
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
