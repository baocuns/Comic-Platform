'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { StudioSidebar } from '@/components/studio/sidebar';
import { StudioHeader } from '@/components/studio/studio-header';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isHydrated && !user) {
      router.push('/login?redirect=/studio');
    }
    // Only AUTHOR, MODERATOR, ADMIN allowed
    if (isHydrated && user && !['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role)) {
      router.push('/');
    }
  }, [isHydrated, user, router]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
      </div>
    );
  }

  if (!user || !['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role)) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-white transition-colors duration-200">
      <StudioSidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <StudioHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
