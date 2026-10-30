'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from './brand';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/studio') || pathname?.startsWith('/read/')) return null;

  return (
    <footer className="ow-footer">
      <div className="ow-footer-main">
        <div><Link href="/" className="ow-footer-logo"><Brand /></Link><p>Một trang truyện. Ngàn thế giới.<br />Nơi những trí tưởng tượng gặp nhau.</p></div>
        <nav aria-label="Khám phá OWOC"><strong>Lật sang trang mới</strong><Link href="/comics">Khám phá truyện <span aria-hidden="true">↗</span></Link><Link href="/news">Bản tin OWOC <span aria-hidden="true">↗</span></Link><Link href="/studio">Góc sáng tác <span aria-hidden="true">↗</span></Link></nav>
        <div className="ow-footer-note"><span aria-hidden="true">✦</span><p>Đọc một chút.<br /><strong>Vui cả ngày!</strong></p></div>
      </div>
      <div className="ow-footer-bottom"><small>© 2026 OWOC. One word, one civilization.</small><span>Dành cho những người mê truyện <span aria-hidden="true">♡</span></span></div>
    </footer>
  );
}
