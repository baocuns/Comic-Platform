'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useReadingHistoryStore } from '@/stores/reading-history-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateHistory = useReadingHistoryStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateHistory();
  }, [hydrateAuth, hydrateHistory]);

  return <>{children}</>;
}
