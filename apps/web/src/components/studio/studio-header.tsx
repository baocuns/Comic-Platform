'use client';

import { Menu, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/providers/theme-provider';
import { Avatar } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/layout/notification-bell';

export function StudioHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-15 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-4 sm:px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] lg:hidden cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-[var(--text-primary)]">OWOC Studio Workspace</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {user && <NotificationBell />}
        {user && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1">
            <Avatar src={user.avatarUrl} name={user.displayName} size="xs" />
            <span className="hidden sm:inline text-xs font-semibold text-[var(--text-primary)]">
              {user.displayName}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
