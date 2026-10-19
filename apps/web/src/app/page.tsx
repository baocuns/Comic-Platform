'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MechanicalScene } from '@/components/home/mechanical-scene';
import { useNewsMotion } from '@/components/home/use-news-motion';
import { useGenreMotion } from '@/components/home/use-genre-motion';
import { useSearchMotion } from '@/components/home/use-search-motion';
import { api } from '@/lib/api-client';
import './mechanical.css';
import '@/components/home/story-engine.css';

export interface Comic {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  author: { displayName: string };
  genres: { id: string; name: string; icon: string | null }[];
  stats: { totalViews: number; avgRating: number; totalChapters: number };
}
interface HomepageData {
  trending: Comic[];
  latest: Comic[];
  topRated: Comic[];
}
interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string;
}
interface FeaturedNews {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string;
  publishedAt: string;
  author: { displayName: string; avatarUrl: string | null };
}
interface FeaturedNewsData {
  featured: FeaturedNews | null;
  latest: FeaturedNews[];
}

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [data, setData] = useState<HomepageData | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [news, setNews] = useState<FeaturedNewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newsError, setNewsError] = useState(false);
  const [search, setSearch] = useState('');
  const [request, setRequest] = useState(0);
  const [motionPaused, setMotionPaused] = useState(false);
  useNewsMotion(root, motionPaused, !newsLoading && !newsError && !!news);
  useGenreMotion(root, motionPaused, genres.length);
  useSearchMotion(root, motionPaused);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: HomepageData }>('/comics/homepage')
      .then((r) => {
        if (active) {
          setData(r.data);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    api
      .get<{ data: Genre[] }>('/comics/genres')
      .then((r) => {
        if (active) setGenres(r.data);
      })
      .catch(() => {});
    api
      .get<{ data: FeaturedNewsData }>('/news/featured')
      .then((r) => {
        if (active) {
          setNews(r.data);
          setNewsError(false);
        }
      })
      .catch(() => {
        if (active) setNewsError(true);
      })
      .finally(() => {
        if (active) setNewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        if (motionPaused) return;
        gsap
          .timeline({ defaults: { duration: 0.8, ease: 'expo.out' } })
          .from('.hero-line', { y: 46, rotationX: -16, opacity: 0, stagger: 0.12 })
          .from(
            '.hero-intro, .hero-actions, .search-stage',
            { y: 22, opacity: 0, stagger: 0.1 },
            '-=0.5',
          );
        return undefined;
      },
      root,
    );
    return () => media.revert();
  }, [motionPaused]);

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        if (motionPaused) return;
        root.current?.querySelectorAll<HTMLElement>('[data-reveal]').forEach((section) => {
          const pieces = section.querySelectorAll('[data-piece]');
          if (!pieces.length) return;
          gsap.from(pieces, {
            y: 65,
            z: -100,
            opacity: 0,
            rotationY: -32,
            rotationX: 18,
            transformOrigin: 'left bottom',
            stagger: 0.09,
            duration: 1.1,
            ease: 'expo.out',
            scrollTrigger: { trigger: section, start: 'top 92%', once: true },
          });
        });
        ScrollTrigger.refresh();
      },
      root,
    );
    return () => media.revert();
  }, [data, genres, news, loading, newsLoading, motionPaused]);

  const featured = data?.trending[0] || data?.latest[0];
  const retry = () => {
    setLoading(true);
    setNewsLoading(true);
    setRequest((value) => value + 1);
  };

  return (
    <div ref={root} className={`mech-home${motionPaused ? ' motion-paused' : ''}`}>
      <section className="mech-hero mech-container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">
            <span className="hero-line">Mỗi trang truyện.</span>
            <span className="hero-line">
              Một <em>vũ trụ</em>
            </span>
            <span className="hero-line">đang chuyển động.</span>
          </h1>
          <p className="hero-intro">
            Mở cánh cửa vào thế giới Manga, Manhwa và truyện tranh Việt. Câu chuyện tiếp theo của
            bạn bắt đầu ở đây.
          </p>
          <div className="hero-actions">
            <Link href="/comics" className="mech-button mech-primary">
              Khám phá truyện <Arrow />
            </Link>
            <Link href="/studio" className="mech-text-link">
              Không gian sáng tác <i className="fa-light fa-arrow-up-right" aria-hidden="true" />
            </Link>
          </div>
          <div className="search-stage">
          <form
            className="hero-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (search.trim()) router.push(`/comics?search=${encodeURIComponent(search.trim())}`);
            }}
          >
            <i className="fa-light fa-magnifying-glass" aria-hidden="true" />
            <div className="search-field">
            <input
              aria-label="Tìm tên truyện hoặc tác giả"
              placeholder="Bạn muốn bước vào thế giới nào?"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="search-prompt" aria-hidden="true" data-filled={!!search}>
              {Array.from('Bạn muốn bước vào thế giới nào?').map((letter, index) => (
                <span className="search-letter" key={index}>
                  {letter === ' ' ? '\u00a0' : letter}
                  <span className="search-glint">{letter === ' ' ? '\u00a0' : letter}</span>
                </span>
              ))}
            </span>
            </div>
            <button type="submit" aria-label="Tìm truyện">
              <Arrow />
            </button>
          </form>
          </div>
        </div>
        <div className="hero-machine">
          <MechanicalScene
            comic={featured}
            companions={data?.trending.slice(1, 3)}
            paused={motionPaused}
          />
          <div className="machine-controls">
            <span>
              <span className="status-light" /> OWOC · BETA 1.0
            </span>
            <button
              type="button"
              onClick={() => setMotionPaused((value) => !value)}
              aria-pressed={motionPaused}
            >
              <i
                className={`fa-light ${motionPaused ? 'fa-play' : 'fa-pause'}`}
                aria-hidden="true"
              />{' '}
              {motionPaused ? 'Bật chuyển động' : 'Dừng chuyển động'}
            </button>
          </div>
        </div>
      </section>

      <div className="mech-genre-rail" data-reveal>
        <div className="mech-container genre-inner">
          <span className="genre-label">
            <i className="fa-light fa-sliders" aria-hidden="true" /> Chọn thế giới
          </span>
          <div className="genre-links">
            {genres.length > 0 ? (
              genres.map((genre) => (
                <Link key={genre.id} href={`/comics?genre=${genre.slug}`}>
                  <span className="genre-plane">
                    <span className="genre-name">{genre.name}</span>
                    <span className="genre-arrow" aria-hidden="true">↗</span>
                  </span>
                </Link>
              ))
            ) : (
              <Link href="/comics">
                Khám phá tất cả thể loại <Arrow />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mech-container mech-content">
        {loading ? (
          <section className="mech-loading" aria-label="Đang tải truyện" aria-busy="true">
            <div className="loading-rail" />
            <p>Đang mở kho truyện…</p>
            <div className="comic-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="comic-skeleton" />
              ))}
            </div>
          </section>
        ) : error ? (
          <div className="mech-empty" role="alert">
            <i className="fa-light fa-plug" aria-hidden="true" />
            <h2>Chưa kết nối được kho truyện</h2>
            <p>Dữ liệu chưa tải được. Bạn có thể thử kết nối lại.</p>
            <button className="mech-button" onClick={retry}>
              Thử lại <Arrow />
            </button>
          </div>
        ) : data &&
          (data.trending.length > 0 || data.latest.length > 0 || data.topRated.length > 0) ? (
          <>
            {data.trending.length > 0 && (
              <ComicSection
                title="Đang được khám phá"
                subtitle="Những câu chuyện đang thịnh hành trên OWOC."
                comics={data.trending}
              />
            )}
            {data.latest.length > 0 && (
              <ComicSection
                title="Trang mới vừa mở"
                subtitle="Theo kịp những chương truyện mới cập nhật."
                comics={data.latest}
              />
            )}
            {data.topRated.length > 0 && (
              <ComicSection
                title="Được độc giả yêu thích"
                subtitle="Những tác phẩm được đánh giá cao."
                comics={data.topRated}
              />
            )}
          </>
        ) : (
          <div className="mech-empty">
            <i className="fa-light fa-books" aria-hidden="true" />
            <h2>Vũ trụ đang chờ câu chuyện đầu tiên</h2>
            <p>Chưa có truyện nào. Hãy là người đầu tiên đăng truyện!</p>
            <Link className="mech-button mech-primary" href="/studio">
              Bắt đầu sáng tác <Arrow />
            </Link>
          </div>
        )}

        <section className="mech-news" data-reveal aria-labelledby="news-title">
          <div className="mech-section-head" data-piece>
            <div>
              <h2 id="news-title">Bên kia trang truyện</h2>
              <p>Tin tức, cảm hứng và những câu chuyện từ cộng đồng.</p>
            </div>
            <Link className="mech-section-link" href="/news">
              Tất cả tin tức <Arrow />
            </Link>
          </div>
          {newsLoading ? (
            <div className="news-skeleton" aria-busy="true">
              Đang tải tin tức…
            </div>
          ) : newsError ? (
            <div className="mech-empty" role="alert">
              <p>Chưa tải được tin tức.</p>
              <button className="mech-button" onClick={retry}>
                Thử lại <Arrow />
              </button>
            </div>
          ) : news && (news.featured || news.latest.length > 0) ? (
            <div className="mech-news-grid">
              {news.featured && (
                <Link href={`/news/${news.featured.slug}`} className="news-feature" data-news-plane>
                  {news.featured.coverUrl ? (
                    <img src={news.featured.coverUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="news-art">
                      <i className="fa-light fa-newspaper" aria-hidden="true" />
                    </div>
                  )}
                  <div className="news-feature-copy">
                    <span className="news-category">{news.featured.category}</span>
                    <h3>{news.featured.title}</h3>
                    <span className="news-read">
                      Đọc câu chuyện <Arrow />
                    </span>
                  </div>
                </Link>
              )}
              <div className="news-feed">
                {news.latest.map((item) => (
                  <Link className="news-row" data-news-plane href={`/news/${item.slug}`} key={item.id}>
                    <div className="news-row-image">
                      {item.coverUrl ? (
                        <img src={item.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <i className="fa-light fa-newspaper" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <span className="news-category">{item.category}</span>
                      <h3>{item.title}</h3>
                      <p>{item.excerpt}</p>
                    </div>
                    <Arrow />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="mech-empty">
              <p>Chưa có tin tức nào. Những câu chuyện mới sẽ sớm xuất hiện tại đây.</p>
              <Link className="mech-text-link" href="/news">
                Đến trang tin tức <Arrow />
              </Link>
            </div>
          )}
        </section>
        <section className="creator-bay" data-reveal>
          <div className="creator-gear" aria-hidden="true">
            <i className="fa-light fa-pen-nib" />
          </div>
          <div data-piece>
            <h2>
              Đừng chỉ đọc thế giới.
              <br />
              <em>Hãy tạo nên một thế giới.</em>
            </h2>
            <p>Đưa câu chuyện và nét vẽ của bạn đến với cộng đồng OWOC.</p>
          </div>
          <Link data-piece href="/studio" className="mech-button mech-primary">
            Bước vào Studio <Arrow />
          </Link>
        </section>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M4 12h15M13 5l7 7-7 7" />
    </svg>
  );
}

function ComicSection({
  title,
  subtitle,
  comics,
}: {
  title: string;
  subtitle: string;
  comics: Comic[];
}) {
  return (
    <section className="mech-comic-section" data-reveal>
      <div className="mech-section-head" data-piece>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <Link className="mech-section-link" href="/comics">
          Xem tất cả <Arrow />
        </Link>
      </div>
      <div className="comic-grid">
        {comics.map((comic, index) => (
          <div data-piece key={comic.id}>
            <Link href={`/comics/${comic.slug}`} className="mech-comic">
              <div className="comic-cover">
                <div className="comic-binding" />
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} loading="lazy" />
                ) : (
                  <div className="cover-placeholder">{comic.title}</div>
                )}
                <span className="comic-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="comic-open">
                  <Arrow /> Khám phá
                </span>
              </div>
              <h3>{comic.title}</h3>
              <p className="comic-author">{comic.author.displayName}</p>
              <div className="comic-meta">
                <span>
                  <i className="fa-light fa-book-open" aria-hidden="true" />{' '}
                  {comic.stats.totalChapters} chương
                </span>
                <span>
                  <i className="fa-light fa-eye" aria-hidden="true" />{' '}
                  {comic.stats.totalViews.toLocaleString('vi-VN')}
                </span>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
