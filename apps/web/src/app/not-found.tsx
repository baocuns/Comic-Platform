import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="rounded-full bg-[var(--accent-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
        404
      </span>
      <h1 className="mt-3 font-serif text-3xl font-bold text-[var(--text-primary)]">
        Trang này không tồn tại
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
        Đường dẫn có thể đã thay đổi hoặc nội dung bạn tìm kiếm chưa được xuất bản.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/">
          <Button>Về trang chủ</Button>
        </Link>
        <Link href="/comics">
          <Button variant="outline">
            <Compass className="h-4 w-4" />
            Khám phá truyện
          </Button>
        </Link>
      </div>
    </div>
  );
}
