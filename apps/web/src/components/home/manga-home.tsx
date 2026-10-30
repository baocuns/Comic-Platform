'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { api } from '@/lib/api-client';
import { ComicMascot } from './comic-mascot';
import './manga-home.css';

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface Comic {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  author: { displayName: string };
  genres: { id: string; name: string; icon: string | null }[];
  stats: { totalViews: number; avgRating: number; totalChapters: number };
}
interface HomepageData { trending: Comic[]; latest: Comic[]; topRated: Comic[] }
interface Genre { id: string; name: string; slug: string; icon: string }
interface News { id: string; title: string; slug: string; excerpt: string | null; coverUrl: string | null; category: string; publishedAt: string }
interface NewsData { featured: News | null; latest: News[] }

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>;
}

function ComicCover({ comic }: { comic: Comic }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="ow-cover">
      {comic.coverUrl && !failed ? (
        // API covers keep the existing remote-image contract.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={comic.coverUrl} alt="" width="320" height="448" loading="lazy" onError={() => setFailed(true)} />
      ) : <span className="ow-cover-fallback" aria-hidden="true"><span>OWOC ORIGINAL</span><strong>{comic.title}</strong><span>✦</span></span>}
    </span>
  );
}

function ComicCard({ comic, index }: { comic: Comic; index: number }) {
  return (
    <Link className="ow-comic-card" href={`/comics/${comic.slug}`}>
      <div className="ow-comic-art">
        <ComicCover comic={comic} />
        <span className="ow-comic-number">{String(index + 1).padStart(2, '0')}</span>
        {comic.stats?.avgRating > 0 && <span className="ow-comic-rating"><span aria-hidden="true">★</span> {Number(comic.stats.avgRating).toFixed(1)}</span>}
        <span className="ow-comic-read">Lật trang ngay <Arrow diagonal /></span>
      </div>
      <div className="ow-comic-info"><small>{comic.genres?.[0]?.name || 'Truyện tranh'} <span>· {comic.stats?.totalChapters || 0} chương</span></small><h3>{comic.title}</h3><p>{comic.author?.displayName || 'Tác giả OWOC'}</p></div>
    </Link>
  );
}

function SectionHeading({ eyebrow, title, href, linkText = 'Xem tất cả' }: { eyebrow: string; title: string; href: string; linkText?: string }) {
  return <div className="ow-section-heading"><div><span className="ow-eyebrow">{eyebrow}</span><h2>{title}</h2></div><Link className="ow-text-link" href={href}>{linkText} <Arrow diagonal /></Link></div>;
}

function ShelfState({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <div className="ow-shelf-loading" role="status" aria-label="Đang tải truyện">{Array.from({ length: 5 }, (_, i) => <div key={i}><span /><span /><span /></div>)}<span className="sr-only">Đang mở tủ truyện…</span></div>;
  return (
    <div className="ow-shelf-state" role="status"><span className="ow-state-doodle" aria-hidden="true">{error ? '…' : '✦'}</span><div><h3>{error ? 'Tủ truyện đang nghỉ một nhịp.' : 'Một thế giới mới sắp mở ra.'}</h3><p>{error ? 'Chưa kết nối được kho truyện. Thử tải lại sau một chút nhé!' : 'Những bộ truyện đầu tiên sẽ sớm có mặt tại đây.'}</p></div>{error && <button type="button" onClick={onRetry}>Thử lại <span aria-hidden="true">↻</span></button>}</div>
  );
}

export function MangaHome() {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [data, setData] = useState<HomepageData | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [news, setNews] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [retry, setRetry] = useState(0);
  const stories = (data?.trending.length ? data.trending : data?.latest || []).slice(0, 5);
  const latest = data?.latest.slice(0, 5) || [];
  const ranking = data?.topRated.slice(0, 4) || [];
  const newsItems = news ? [news.featured, ...news.latest].filter((item): item is News => Boolean(item)).filter((item, i, list) => list.findIndex((n) => n.id === item.id) === i).slice(0, 3) : [];

  useEffect(() => {
    let alive = true;
    api.get<{ data: HomepageData }>('/comics/homepage')
      .then((response) => { if (alive) { setData(response.data); setError(false); } })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    api.get<{ data: Genre[] }>('/comics/genres').then((response) => { if (alive) setGenres(response.data); }).catch(() => {});
    api.get<{ data: NewsData }>('/news/featured').then((response) => { if (alive) setNews(response.data); }).catch(() => {});
    return () => { alive = false; };
  }, [retry]);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.ow-hero-enter', { y: 20, opacity: 0, duration: .65, stagger: .085, ease: 'power2.out', clearProps: 'all' });
      gsap.from('.ow-hero-illustration', { y: 32, rotate: -5, opacity: 0, duration: .8, delay: .12, ease: 'back.out(1.2)', clearProps: 'all' });
      gsap.utils.toArray<HTMLElement>('.ow-home-reveal').forEach((section) => {
        gsap.from(section, { y: 26, opacity: .3, duration: .6, ease: 'power2.out', clearProps: 'all', scrollTrigger: { trigger: section, start: 'top 94%', once: true } });
      });
    });
    return () => media.revert();
  }, { scope: root });

  function handleRetry() {
    setLoading(true);
    setError(false);
    setRetry((value) => value + 1);
  }

  return (
    <div ref={root} className="ow-home">
      <section className="ow-hero" aria-labelledby="ow-hero-title">
        <div className="ow-hero-copy">
          <div className="ow-hero-kicker ow-hero-enter"><span className="ow-tiny-star" aria-hidden="true">✦</span> CHÀO MỪNG ĐẾN VỚI VŨ TRỤ OWOC</div>
          <h1 id="ow-hero-title" className="ow-hero-enter">Bật trí<br /><span>tưởng tượng.</span><svg className="ow-title-underline" viewBox="0 0 420 19" fill="none" aria-hidden="true"><path d="M3 12Q180-5 416 8M38 17Q235 4 385 15" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg></h1>
          <p className="ow-hero-description ow-hero-enter">Tạm gác thế giới ngoài kia.<br />Có một cuộc phiêu lưu đang chờ bạn lật mở.</p>
          <div className="ow-hero-actions ow-hero-enter"><Link href="/comics" className="ow-primary-button">Khám phá ngay <Arrow diagonal /></Link><Link href="/bookmarks" className="ow-secondary-button">Tủ truyện của bạn <span aria-hidden="true">♡</span></Link></div>
          <form className="ow-home-search ow-hero-enter" onSubmit={(event) => { event.preventDefault(); if (search.trim()) router.push(`/comics?search=${encodeURIComponent(search.trim())}`); }}>
            <label htmlFor="ow-home-search">Đã có một bộ truyện trong đầu?</label>
            <div><i className="fa-light fa-magnifying-glass" aria-hidden="true" /><input id="ow-home-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên truyện, tác giả..." /><button type="submit" aria-label="Tìm truyện"><Arrow /></button></div>
          </form>
        </div>
        <div className="ow-hero-visual">
          <div className="ow-hero-panel">
            <div className="ow-panel-caption"><span>TRANG 01 / MỞ MỘT THẾ GIỚI</span><span aria-hidden="true">✦</span></div>
            <div className="ow-speech-bubble">Đọc thêm<br /><strong>một chương nữa thôi!</strong></div>
            <div className="ow-hero-illustration"><ComicMascot /></div>
            <span className="ow-hero-orbit" aria-hidden="true" />
            <div className="ow-hero-signoff"><span>NHÂN VẬT CHÍNH HÔM NAY:</span><strong>Chính là bạn. <span aria-hidden="true">↖</span></strong></div>
          </div>
          <span className="ow-hero-sticker"><span aria-hidden="true">✦</span> CỨ ĐỌC ĐI,<br /><strong>VUI LẮM!</strong></span>
          <span className="ow-handwritten" aria-hidden="true">Cẩn thận: dễ đọc quên giờ! <svg viewBox="0 0 75 35" fill="none"><path d="M2 4c13 32 48 35 68 8m-14 2 16-4-1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        </div>
      </section>

      <div className="ow-culture-strip" aria-label="Manga, Manhwa, Manhua, Webtoon, Truyện Việt"><div><span>MANGA</span><b aria-hidden="true">✦</b><span>MANHWA</span><b aria-hidden="true">✦</b><span>MANHUA</span><b aria-hidden="true">✦</b><span>WEBTOON</span><b aria-hidden="true">✦</b><span>TRUYỆN VIỆT</span><b aria-hidden="true">✦</b><span>VÀ CẢ BẠN NỮA!</span></div></div>

      <section className="ow-home-section ow-trending" aria-labelledby="ow-trending-title">
        <div className="ow-section-heading"><div><span className="ow-eyebrow"><span aria-hidden="true">↗</span> HỘI MÊ TRUYỆN ĐANG ĐỌC</span><h2 id="ow-trending-title">Cuốn ngay từ chương đầu<span className="ow-heading-star" aria-hidden="true">✦</span></h2></div><Link className="ow-text-link" href="/comics">Ghé tủ truyện <Arrow diagonal /></Link></div>
        {stories.length > 0 ? <div className="ow-comic-shelf">{stories.map((comic, i) => <ComicCard key={comic.id} comic={comic} index={i} />)}</div> : <ShelfState loading={loading} error={error} onRetry={handleRetry} />}
      </section>

      {genres.length > 0 && <section className="ow-genres ow-home-reveal" aria-labelledby="ow-genres-title"><div><span className="ow-eyebrow">HÔM NAY BẠN CÓ MOOD GÌ?</span><h2 id="ow-genres-title">Chọn một thế giới.</h2></div><div className="ow-genre-links">{genres.slice(0, 8).map((genre, i) => <Link key={genre.id} href={`/comics?genre=${encodeURIComponent(genre.slug)}`}><span aria-hidden="true">{['✦', '♡', '↗', '☾'][i % 4]}</span>{genre.name}<Arrow diagonal /></Link>)}<Link href="/comics" className="ow-genre-all">Tất cả thể loại <Arrow /></Link></div></section>}

      {latest.length > 0 && <section className="ow-home-section ow-home-reveal" id="moi-cap-nhat"><SectionHeading eyebrow="TRANG MỚI VỪA LÊN KỆ" title="Nóng hổi, vừa ra lò!" href="/comics" /><div className="ow-comic-shelf">{latest.map((comic, i) => <ComicCard key={comic.id} comic={comic} index={i} />)}</div></section>}

      <section className="ow-community-row ow-home-reveal">
        <div className="ow-creator-panel"><span className="ow-eyebrow">GÓC DÀNH CHO NGƯỜI KỂ CHUYỆN</span><h2>Vũ trụ này<br />còn thiếu <span>nét vẽ của bạn.</span></h2><p>Một ý tưởng nhỏ cũng có thể mở ra một thế giới lớn.<br />Để câu chuyện của bạn bắt đầu tại OWOC.</p><Link href="/studio" className="ow-primary-button">Ghé studio sáng tác <Arrow diagonal /></Link><svg className="ow-pencil-art" viewBox="0 0 150 260" fill="none" aria-hidden="true"><g stroke="#25251f" strokeWidth="4" strokeLinejoin="round"><path d="m80 10 43 19-70 171-43 39 0-58Z" fill="#fff9ed" /><path d="m80 10 43 19-14 35-43-19Z" fill="#f16b50" /><path d="m66 45 43 19-56 136-43-19Z" fill="#f9d548" /><path d="m10 181 22 10 21 9-43 39Z" fill="#f5d4b0" /><path d="m10 218 16 7-16 14Z" fill="#25251f" /><path d="m88 55-56 136M5 253q55-31 111-12" /></g><path d="m128 135 4 11 13 2-10 8 2 12-10-6-11 6 3-12-10-8 13-2Z" fill="#25251f" /></svg></div>
        {ranking.length > 0 ? <div className="ow-ranking"><span className="ow-eyebrow">KHÔNG PHẢI NGẪU NHIÊN MÀ HAY</span><h2>Điểm cao, mê lâu.</h2>{ranking.map((comic, i) => <Link href={`/comics/${comic.slug}`} key={comic.id}><span className="ow-rank-number">0{i + 1}</span><div><h3>{comic.title}</h3><small>{comic.author?.displayName}</small></div><span className="ow-rank-rating">★ {Number(comic.stats?.avgRating || 0).toFixed(1)}</span></Link>)}</div> : <div className="ow-reader-note"><span aria-hidden="true">“</span><h2>Một ngày bình thường.<br />Một bộ truyện không<br /><em>bình thường chút nào.</em></h2><p>Bạn chưa biết hôm nay đọc gì?<br />Cuộc phiêu lưu tiếp theo chỉ cách một cái chạm.</p><Link href="/comics" className="ow-text-link">Tìm truyện cho hôm nay <Arrow diagonal /></Link><span className="ow-note-star" aria-hidden="true">✦</span></div>}
      </section>

      {newsItems.length > 0 && <section className="ow-home-section ow-home-reveal"><SectionHeading eyebrow="CHUYỆN BÊN LỀ NHỮNG TRANG TRUYỆN" title="A lô, OWOC có tin!" href="/news" /><div className="ow-news-grid">{newsItems.map((item) => <Link key={item.id} href={`/news/${item.slug}`} className="ow-news-card">{item.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.coverUrl} alt="" width="600" height="340" loading="lazy" />
      ) : <div className="ow-news-placeholder" aria-hidden="true">owoc<span>NEWS!</span></div>}<div><span className="ow-eyebrow">BẢN TIN OWOC · {new Date(item.publishedAt).toLocaleDateString('vi-VN')}</span><h3>{item.title}</h3>{item.excerpt && <p>{item.excerpt}</p>}<span className="ow-text-link">Đọc tiếp <Arrow diagonal /></span></div></Link>)}</div></section>}

      <div className="ow-home-endnote"><span aria-hidden="true">✦</span><p>Hết trang rồi, <strong>chưa hết chuyện.</strong></p><Link href="/comics">Lật sang thế giới tiếp theo <Arrow /></Link></div>
    </div>
  );
}
