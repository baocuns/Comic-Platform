'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Newspaper,
  ShieldCheck,
  Sliders,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function StudioSidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = user?.role || 'READER';

  const isModOrAdmin = role === 'MODERATOR' || role === 'ADMIN';
  const isAdmin = role === 'ADMIN';

  const navGroups = [
    {
      label: 'Tác giả (Creator)',
      items: [
        { href: '/studio', label: 'Tổng quan Studio', icon: LayoutDashboard, exact: true },
        { href: '/studio/comics', label: 'Quản lý Truyện', icon: BookOpen },
        { href: '/studio/news', label: 'Bài viết & Tin tức', icon: Newspaper },
      ],
    },
    ...(isModOrAdmin
      ? [
          {
            label: 'Kiểm duyệt (Moderation)',
            items: [
              { href: '/studio/moderation', label: 'Duyệt nội dung & Báo cáo', icon: ShieldCheck },
            ],
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            label: 'Quản trị (Admin)',
            items: [
              { href: '/studio/admin', label: 'Hệ thống & Người dùng', icon: Sliders },
            ],
          },
        ]
      : []),
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2">
            <img src="/img/owoc_banner_black.png" className="h-9 w-auto dark:hidden" alt="OWOC" />
            <img src="/img/owoc_banner_white.png" className="hidden h-9 w-auto dark:block" alt="OWOC" />
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <Link
        href="/"
        className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Quay về trang đọc truyện</span>
      </Link>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0">{sidebarContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[130] flex lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
          <div className="relative z-10 w-68 max-w-[82vw] h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
