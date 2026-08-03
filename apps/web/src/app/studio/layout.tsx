'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { StudioSidebar } from '@/components/studio/sidebar';
import { StudioHeader } from '@/components/studio/studio-header';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
      </div>
    );
  }

  if (!user || !['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role)) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-white transition-colors duration-200">
      <StudioSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <StudioHeader />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
