'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { ElDropdown, ElMenu } from '@tailwindplus/elements/react';
import styles from './comics.module.css';

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

interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string;
  comicCount: number;
}

const SORT_OPTIONS = [
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'latest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến' },
  { value: 'rating', label: 'Đánh giá cao' },
];

export default function ComicsPage() {
  return <Suspense fallback={<p className={styles.loading} role="status">Đang mở thư viện truyện…</p>}><ComicsQuery /></Suspense>;
}

function ComicsQuery() {
  const query = useSearchParams();
  return <ComicsCatalog key={query.toString()} initialGenre={query.get('genre')} searchTerm={query.get('search')?.trim() || ''} />;
}

function ComicsCatalog({ initialGenre, searchTerm }: { initialGenre: string | null; searchTerm: string }) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(initialGenre);
  const [sort, setSort] = useState<string>('updated');
  const requestKey = `${selectedGenre || ''}:${sort}:${searchTerm}`;
  const [result, setResult] = useState<{ key: string; comics: Comic[] } | null>(null);
  const loading = result?.key !== requestKey;
  const comics = result?.comics || [];

  useEffect(() => {
    api.get<{ data: Genre[] }>('/comics/genres')
      .then((res) => setGenres(res.data))
      .catch(() => { })
      .finally(() => setGenresLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (selectedGenre) params.set('genre', selectedGenre);
    if (searchTerm) params.set('search', searchTerm);
    params.set('sort', sort);
    params.set('limit', '20');

    api.get<{ data: Comic[]; meta: unknown }>(`/comics?${params}`)
      .then((res) => { if (alive) setResult({ key: requestKey, comics: res.data }); })
      .catch(() => { if (alive) setResult({ key: requestKey, comics: [] }); });
    return () => { alive = false; };
  }, [selectedGenre, sort, searchTerm, requestKey]);

  const currentSortOption = SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0];
  const selectedGenreName = genres.find((genre) => genre.slug === selectedGenre)?.name;

  return (
    <div className={styles.catalog}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}><span aria-hidden="true" /> THƯ VIỆN OWOC</p>
          <h1>{searchTerm ? <>Tìm thấy<br /><em>câu chuyện nào?</em></> : <>Mở truyện.<br /><em>Mở thế giới.</em></>}</h1>
          <p className={styles.mastheadCopy}>{searchTerm ? <>Những câu chuyện dành cho từ khóa <strong>“{searchTerm}”</strong>.</> : 'Từ một trang giấy, đến ngàn cuộc phiêu lưu. Chọn câu chuyện tiếp theo của bạn.'}</p>
          {searchTerm && <Link href="/comics" className={styles.textLink}>Xóa từ khóa · Xem tất cả truyện <span aria-hidden="true">↗</span></Link>}
        </div>
        <div className={styles.catalogStamp} aria-hidden="true">
          <svg viewBox="0 0 160 120" fill="none"><path d="m22 24 49 8v68l-49-8V24Zm49 8 62-11v69l-62 10V32Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /><path d="m35 42 23 4m-23 12 23 4m-23 12 23 4m28-29 31-6m-31 22 31-6m-31 22 31-6M15 9l7 7m121-8-6 8M8 64H1m147 8h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          <span>MỖI TRANG<br />MỘT THẾ GIỚI</span>
        </div>
      </header>

      <section className={styles.filterPanel} aria-labelledby="filter-heading">
        <div className={styles.filterTop}>
          <div><p className={styles.eyebrow}>CHỌN THEO CẢM HỨNG</p><h2 id="filter-heading">Hôm nay, đọc gì?</h2></div>
          <ElDropdown className={styles.sortDropdown}>
            <button type="button" popoverTarget="sort-menu" className={styles.sortButton}>
              <span><span className={styles.sortLabel}>Sắp xếp: </span>{currentSortOption.label}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <ElMenu id="sort-menu" popover="auto" anchor="bottom end" className={styles.sortMenu}>
              {SORT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSort(opt.value)} className={styles.sortOption} aria-pressed={sort === opt.value}>
                  {opt.label}<span aria-hidden="true">{sort === opt.value ? '✓' : ''}</span>
                </button>
              ))}
            </ElMenu>
          </ElDropdown>
        </div>
        <div className={styles.genrePills} aria-label="Lọc theo thể loại">
          <button type="button" onClick={() => setSelectedGenre(null)} className={styles.genrePill} aria-pressed={!selectedGenre}>Tất cả truyện</button>
          {genresLoading ? <span className={styles.filterLoading} role="status">Đang mở các thể loại…</span> : genres.map((g) => (
            <button key={g.id} type="button" onClick={() => setSelectedGenre(g.slug)} className={styles.genrePill} aria-pressed={selectedGenre === g.slug}>{g.name}</button>
          ))}
        </div>
      </section>

      <section aria-labelledby="shelf-heading" aria-busy={loading}>
        <div className={styles.shelfHeading}>
          <h2 id="shelf-heading">{selectedGenreName || (searchTerm ? 'Kết quả tìm kiếm' : 'Kệ truyện của bạn')}</h2>
          <span>{loading ? 'Đang tìm truyện…' : `${comics.length} truyện đang hiển thị`}</span>
        </div>
        {loading ? (
          <div className={styles.bookGrid} role="status" aria-label="Đang tải truyện">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className={styles.bookSkeleton} aria-hidden="true"><div /><span /><span /></div>)}
          </div>
        ) : comics.length === 0 ? (
          <div className={styles.emptyShelf}><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 4h7a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H3V4Zm18 0h-7a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h6V4Z" /></svg><h3>Kệ này đang chờ câu chuyện.</h3><p>Chưa có truyện nào{searchTerm ? ' phù hợp với từ khóa này' : ' trong thể loại này'}. Thử một lựa chọn khác nhé.</p></div>
        ) : (
          <div className={styles.bookGrid}>
            {comics.map((comic) => (
              <Link key={comic.id} href={`/comics/${comic.slug}`} className={styles.bookCard}>
                <div className={styles.bookCover}>
                  {comic.coverUrl ? <img src={comic.coverUrl} alt="" loading="lazy" width="300" height="400" /> : <div className={styles.coverFallback} aria-hidden="true">{comic.title[0]}</div>}
                  <span className={styles.chapterTag}>{comic.stats.totalChapters} chương</span>
                  <span className={styles.openBook} aria-hidden="true">↗</span>
                </div>
                <div className={styles.bookInfo}>
                  <p className={styles.bookGenre}>{comic.genres[0]?.name || 'Truyện tranh'}</p>
                  <h3>{comic.title}</h3>
                  <p className={styles.bookAuthor}>{comic.author.displayName}</p>
                  <div className={styles.bookStats}>
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>{comic.stats.totalViews.toLocaleString('vi-VN')}<span className="sr-only"> lượt xem</span></span>
                    <span><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" /></svg>{comic.stats.avgRating.toFixed(1)}<span className="sr-only"> trên 5 sao</span></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
