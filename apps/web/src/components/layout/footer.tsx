'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './mechanical-shell.css';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/studio')) return null;
  return (
    <footer className="mech-footer">
      <div className="mechanical-footer-inner">
        <div className="footer-brand">
          <Link href="/" aria-label="OWOC — Trang chủ">
            <img src="/img/owoc_banner_white.png" alt="OWOC" />
          </Link>
          <p>One word. One civilization.</p>
        </div>
        <nav aria-label="Điều hướng cuối trang">
          <Link href="/comics">
            Khám phá truyện <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/news">
            Tin tức cộng đồng <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/studio">
            Không gian sáng tác <span aria-hidden="true">↗</span>
          </Link>
        </nav>
        <div className="footer-signature">
          <span aria-hidden="true">✳</span>
          <p>
            Mọi thế giới lớn
            <br />
            bắt đầu từ một câu chuyện.
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 OWOC. One word one civilization!</p>
        <span>ĐƯỢC KẾT NỐI BỞI TRÍ TƯỞNG TƯỢNG</span>
      </div>
    </footer>
  );
}
