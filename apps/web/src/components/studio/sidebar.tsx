'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { useAuthStore } from '@/stores/auth-store';

export function StudioSidebar({
  mobileOpen = false,
  onCloseMobile,
}: {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const isAdminOrMod = user && (user.role === 'ADMIN' || user.role === 'MODERATOR');

  const navItems = [
    { href: '/studio', label: 'Dashboard', icon: <i className="fa-solid fa-chart-mixed"></i>, exact: true },
    { href: '/studio/comics', label: 'Truyện của tôi', icon: <i className="fa-solid fa-book"></i>, exact: false },
    { href: '/studio/news', label: 'Quản lý tin tức', icon: <i className="fa-solid fa-newspaper"></i>, exact: false },
    ...(isAdminOrMod
      ? [{ href: '/studio/moderation', label: 'Phê duyệt nội dung', icon: <i className="fa-solid fa-shield-check"></i>, exact: false }]
      : []),
  ];

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* ── Mobile Drawer Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[260px] flex-col border-r border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#0c0c0f] shadow-2xl transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] px-4">
          <Link href="/studio" onClick={onCloseMobile} className="flex items-center gap-2">
            <img src="/img/aaa_logo.png" alt="Logo" className="h-8 w-8" />
            <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
              AAA Studio
            </span>
          </Link>
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-700 dark:hover:text-white"
            aria-label="Đóng menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <span className={`text-base ${active ? 'drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]' : ''}`}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 dark:border-white/[0.06] p-3 space-y-1">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <span className="text-base"><i className="fa-slab-press fa-regular fa-house"></i></span>
            <span>Về Trang chủ</span>
          </Link>
        </div>
      </aside>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden md:flex h-full flex-col border-r border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-zinc-200 dark:border-white/[0.06] px-4">
          <Link href="/studio" className="flex items-center gap-2.5">
            <img src="/img/aaa_logo.png" alt="Logo" className="h-8 w-8" />
            {!collapsed && (
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white animate-fade-in">
                AAA Studio
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm shadow-amber-500/5'
                    : 'text-zinc-600 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-300'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`text-base ${active ? 'drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]' : ''}`}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-zinc-200 dark:border-white/[0.06] p-3 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-400"
            title={collapsed ? 'Trang chủ' : undefined}
          >
            <span className="text-base"><i className="fa-slab-press fa-regular fa-house"></i></span>
            {!collapsed && <span>Trang chủ</span>}
          </Link>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-400"
          >
            <span className={`text-sm transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
              «
            </span>
            {!collapsed && <span>Thu gọn</span>}
          </button>
        </div>
      </aside>

      {/* Desktop spacer */}
      <div className={`shrink-0 hidden md:block transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[240px]'}`} />
    </>
  );
}
