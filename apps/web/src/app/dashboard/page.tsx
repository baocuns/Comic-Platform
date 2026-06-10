'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/studio');
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
        <p className="mt-4 text-sm text-zinc-500">Đang chuyển hướng đến Studio...</p>
      </div>
    </div>
  );
}
