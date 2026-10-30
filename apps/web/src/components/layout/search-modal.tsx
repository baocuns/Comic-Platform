'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useSearchStore } from '@/stores/search-store';
import { useAuthStore } from '@/stores/auth-store';
import { trackSearch, trackComicView, getRecentSearches, clearRecentSearches } from '@/lib/recommendation-tracker';
import './search-modal.css';

interface Comic {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  author: { displayName: string };
  genres: { id: string; name: string; slug: string; icon: string | null }[];
  stats: { totalViews: number; avgRating: number; totalRatings: number; totalBookmarks: number; totalChapters: number; totalComments: number };
}

export function SearchModal() {
  const { isOpen, close: onClose } = useSearchStore();
  const { accessToken } = useAuthStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setRecentSearches(getRecentSearches());
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    if (debouncedQuery.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    api.get<{ data: Comic[] }>(`/comics/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((response) => { if (active) setResults(response.data || []); })
      .catch(() => { if (active) setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedQuery]);

  if (!isOpen) return null;

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className="ow-search-backdrop" onClick={(event) => { if (modalRef.current && !modalRef.current.contains(event.target as Node)) onClose(); }}>
      <div ref={modalRef} className="ow-search-dialog" role="dialog" aria-modal="true" aria-labelledby="ow-search-title">
        <div className="ow-search-masthead"><div><span>TRẠM TÌM KIẾM OWOC</span><h2 id="ow-search-title">Cuộc phiêu lưu nào tiếp theo?</h2></div><button type="button" onClick={onClose} aria-label="Đóng tìm kiếm"><i className="fa-light fa-xmark" aria-hidden="true" /></button></div>
        <div className="ow-search-input-row"><i className="fa-light fa-magnifying-glass" aria-hidden="true" /><label className="sr-only" htmlFor="ow-search-input">Tìm truyện tranh, tác giả, thể loại</label><input id="ow-search-input" ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên truyện, tác giả, thể loại..." autoComplete="off" aria-describedby="ow-search-hint" aria-controls="ow-search-results" />{query && <button type="button" onClick={handleClear} aria-label="Xóa từ khóa"><i className="fa-light fa-circle-xmark" aria-hidden="true" /></button>}</div>
        {!query.trim() && recentSearches.length > 0 && <section className="ow-search-recent" aria-label="Tìm kiếm gần đây"><div><strong>Tìm kiếm gần đây</strong><button type="button" onClick={() => { clearRecentSearches(); setRecentSearches([]); }}>Xóa lịch sử</button></div><div className="ow-search-terms">{recentSearches.map((term) => <button type="button" key={term} onClick={() => setQuery(term)}><i className="fa-light fa-clock-rotate-left" aria-hidden="true" />{term}<span aria-hidden="true">↗</span></button>)}</div></section>}
        <div className="ow-search-results" id="ow-search-results" aria-live="polite" aria-busy={loading}>
          {!query.trim() ? <div className="ow-search-empty"><span aria-hidden="true">✦</span><h3>Thế giới mới bắt đầu từ một cái tên.</h3><p>Gõ tên bộ truyện hoặc tác giả bạn yêu thích.</p></div> : query.trim().length < 2 ? <div className="ow-search-message">Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm.</div> : loading ? <div className="ow-search-message" role="status"><i className="fa-light fa-spinner ow-search-spinner" aria-hidden="true" /> Đang lục tìm trong tủ truyện…</div> : error ? <div className="ow-search-message ow-search-error"><i className="fa-light fa-plug-circle-exclamation" aria-hidden="true" />{error}</div> : results.length > 0 ? <><p className="ow-search-count">TÌM THẤY {results.length} BỘ TRUYỆN</p>{results.map((comic) => <Link key={comic.id} className="ow-search-result" href={`/comics/${comic.slug}`} onClick={() => { trackSearch(query, accessToken || undefined); trackComicView(comic); onClose(); }}><span className="ow-search-cover">{comic.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comic.coverUrl} alt="" width="60" height="84" />
          ) : <span aria-hidden="true">{comic.title.charAt(0)}</span>}</span><span className="ow-search-result-copy"><strong>{comic.title}</strong><small>{comic.author?.displayName || 'Ẩn danh'}{comic.status === 'COMPLETED' && ' · Hoàn thành'}</small><span className="ow-search-result-stats"><span>★ {Number(comic.stats?.avgRating || 0).toFixed(1)}</span><span>{(comic.stats?.totalViews || 0).toLocaleString('vi-VN')} lượt đọc</span><span>{comic.stats?.totalChapters || 0} chương</span></span><span className="ow-search-result-genres">{comic.genres?.slice(0, 3).map((genre) => <span key={genre.id}>{genre.name}</span>)}</span></span><span className="ow-search-result-arrow" aria-hidden="true">↗</span></Link>)}</> : <div className="ow-search-empty"><span aria-hidden="true">?</span><h3>Chưa tìm thấy truyện phù hợp.</h3><p>Thử một tên khác thay cho “{debouncedQuery}” nhé.</p></div>}
        </div>
        <div className="ow-search-bottom" id="ow-search-hint"><span>Tìm kiếm từ 2 ký tự</span><span><kbd>esc</kbd> để đóng</span></div>
      </div>
    </div>
  );
}
