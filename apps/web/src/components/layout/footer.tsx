'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Sparkles, PenTool } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/read/') || pathname?.startsWith('/studio')) {
    return null;
  }

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/45 pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2 space-y-3">
            <Link href="/" prefetch={false} className="inline-block">
              <img src="/img/owoc_banner_black.png" className="h-10 w-auto dark:hidden" alt="OWOC" />
              <img src="/img/owoc_banner_white.png" className="hidden h-10 w-auto dark:block" alt="OWOC" />
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              Nền tảng truyện tranh bản quyền thế hệ mới — nơi độc giả thưởng thức tác phẩm trong không gian dịu mắt và đồng hành trực tiếp cùng họa sĩ Việt.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              <BookOpen className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Khám phá
            </h4>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li><Link href="/comics" prefetch={false} className="hover:text-[var(--accent-primary)]">Kho truyện tranh</Link></li>
              <li><Link href="/rankings" prefetch={false} className="hover:text-[var(--accent-primary)]">Bảng xếp hạng</Link></li>
              <li><Link href="/news" prefetch={false} className="hover:text-[var(--accent-primary)]">Tạp chí & Tin tức</Link></li>
              <li><Link href="/library" prefetch={false} className="hover:text-[var(--accent-primary)]">Tủ sách & Lịch sử</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
              Hệ sinh thái
            </h4>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li><Link href="/cultivation" prefetch={false} className="hover:text-[var(--accent-primary)]">Tàng Kinh Các (Tu Luyện)</Link></li>
              <li><Link href="/studio" prefetch={false} className="inline-flex items-center gap-1 hover:text-[var(--accent-warm)]"><PenTool className="h-3.5 w-3.5" />Author Studio</Link></li>
              <li><Link href="/notifications" prefetch={false} className="hover:text-[var(--accent-primary)]">Trung tâm Thông báo</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row">
          <p>© {new Date().getFullYear()} OWOC Comics. Nền tảng truyện tranh bản quyền & Tu Luyện.</p>
          <p>Thiết kế Warm Editorial · Tối ưu cho trải nghiệm đọc dài lâu</p>
        </div>
      </div>
    </footer>
  );
}
