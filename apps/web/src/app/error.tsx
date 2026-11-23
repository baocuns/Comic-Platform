'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
        Rất tiếc, đã xảy ra lỗi khi tải trang
      </h2>
      <p className="mt-1.5 max-w-md text-sm text-[var(--text-secondary)]">
        Bạn có thể thử tải lại để tiếp tục trải nghiệm.
      </p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Thử lại
      </Button>
    </div>
  );
}
