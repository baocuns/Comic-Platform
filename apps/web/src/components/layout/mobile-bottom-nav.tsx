'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Trophy, Bookmark, Sparkles } from 'lucide-react';

const ITEMS = [
  { href: '/', label: 'Trang chủ', icon: Home },
  { href: '/comics', label: 'Khám phá', icon: Compass },
  { href: '/rankings', label: 'Xếp hạng', icon: Trophy },
  { href: '/library', label: 'Tủ sách', icon: Bookmark },
  { href: '/cultivation', label: 'Tu Luyện', icon: Sparkles },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  if (pathname?.startsWith('/read/') || pathname?.startsWith('/studio')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/95 backdrop-blur-xl md:hidden">
      <div className="grid h-15 grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
