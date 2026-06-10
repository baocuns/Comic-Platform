'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/studio', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/studio/comics', label: 'Truyện của tôi', icon: '📚', exact: false },
];

export function StudioSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Mobile overlay */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-white/[0.06] bg-[#0c0c0f] transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.06] px-4">
          <Link href="/studio" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
              C
            </div>
            {!collapsed && (
              <span className="text-base font-semibold tracking-tight text-white animate-fade-in">
                Studio
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
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-violet-500/10 text-violet-300 shadow-sm shadow-violet-500/5'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`text-lg ${active ? 'drop-shadow-[0_0_6px_rgba(139,92,246,0.4)]' : ''}`}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          {/* Back to homepage */}
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
            title={collapsed ? 'Trang chủ' : undefined}
          >
            <span className="text-lg">🏠</span>
            {!collapsed && <span>Trang chủ</span>}
          </Link>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
          >
            <span className={`text-lg transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
              «
            </span>
            {!collapsed && <span>Thu gọn</span>}
          </button>
        </div>
      </aside>

      {/* Spacer to push content right */}
      <div className={`shrink-0 transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[240px]'}`} />
    </>
  );
}
