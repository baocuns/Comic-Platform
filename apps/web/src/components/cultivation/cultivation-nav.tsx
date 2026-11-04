'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface CultivationNavProps {
  currentStreak?: number;
  coins?: number;
}

export function CultivationNav({ currentStreak, coins }: CultivationNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Tổng Quan', href: '/cultivation', icon: 'fa-sparkles' },
    { label: 'Cảnh Giới & Đột Phá', href: '/cultivation/realms', icon: 'fa-sun-bright' },
    { label: 'Nhiệm Vụ Tu Luyện', href: '/cultivation/quests', icon: 'fa-list-check' },
    { label: 'Bảng Phong Thần', href: '/cultivation/leaderboard', icon: 'fa-trophy' },
    { label: 'Tàng Bảo Các', href: '/cultivation/achievements', icon: 'fa-award' },
    { label: 'Túi Trữ Vật', href: '/cultivation/inventory', icon: 'fa-sack-dollar' },
    { label: 'Lịch Sử Tu Hành', href: '/cultivation/history', icon: 'fa-clock-rotate-left' },
  ];

  return (
    <div className="w-full bg-white dark:bg-[#141516] border-b border-zinc-200 dark:border-white/10 sticky top-16 z-40 shadow-xs">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none py-2">
        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          {navItems.map((item) => {
            const isActive =
              item.href === '/cultivation'
                ? pathname === '/cultivation'
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#FF7A1A] text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                }`}
              >
                <i className={`fa-light ${item.icon} text-sm ${isActive ? 'text-white' : 'text-[#FF7A1A]'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {(currentStreak !== undefined || coins !== undefined) && (
          <div className="hidden lg:flex items-center gap-3 shrink-0 text-xs font-bold pl-4 border-l border-zinc-200 dark:border-white/10">
            {currentStreak !== undefined && (
              <span className="flex items-center gap-1 text-orange-500 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-lg">
                <i className="fa-solid fa-fire-flame-curved" />
                <span>{currentStreak} ngày</span>
              </span>
            )}
            {coins !== undefined && (
              <span className="flex items-center gap-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
                <i className="fa-solid fa-gem" />
                <span>{coins.toLocaleString()} Linh Thạch</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

