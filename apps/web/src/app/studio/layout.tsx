'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { StudioSidebar } from '@/components/studio/sidebar';
import { StudioHeader } from '@/components/studio/studio-header';
import { AuthorApplicationPanel } from '@/components/studio/AuthorApplicationPanel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user, isHydrated } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent-primary)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4">
        <Card className="max-w-md text-center space-y-4">
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Yêu cầu đăng nhập</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Vui lòng đăng nhập để truy cập khu vực Author Studio & Quản trị.
          </p>
          <Link href="/login?redirect=/studio">
            <Button>Đăng nhập ngay</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 py-10">
        <AuthorApplicationPanel />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)]">
      <StudioSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudioHeader onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
