'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Comic } from '@/app/page';

/** Original illustration used when a story has no cover. */
function StoryArt({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      viewBox="0 0 400 520"
      fill="none"
      aria-hidden="true"
      className={`story-art art-${variant % 3}`}
    >
      <path fill="currentColor" d="M0 0h400v520H0z" />
      <circle cx="265" cy="145" r="96" fill="#f8e7bb" />
      <g stroke="#f8e7bb" opacity=".3">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M${i * 45 - 100} 0L200 360`} />
        ))}
      </g>
      <path d="M0 340l55-97 50 53 51-133 61 124 55-68 128 117v184H0z" fill="#182e37" />
      <path d="M0 402l76-72 73 54 46-89 64 75 65-42 76 58v134H0z" fill="#0d1c27" />
      <path d="M156 520l17-154 24-35-9-30 12-30 28 3 13 28-11 29 31 39 26 150" fill="#f2ddaf" />
      <path d="M194 326l-53 91 34-6-12 109h115l-19-151-34-40z" fill="#b54e38" />
      <path d="M196 290l-27-9 39-29 30 26-7 15-12-14zM201 328l-8 35 27-17" fill="#111e27" />
      <path d="M241 373l96-143 8 5-88 151z" fill="#f8e7bb" />
      <path d="M50 464l62-4m210-49l63-13M26 193l57-7" stroke="#f8e7bb" strokeWidth="3" />
    </svg>
  );
}

function Cover({ comic, variant = 0 }: { comic?: Comic; variant?: number }) {
  return comic?.coverUrl ? (
    <img src={comic.coverUrl} alt="" draggable={false} />
  ) : (
    <StoryArt variant={variant} />
  );
}

function ComicSheet({ comic, reverse = false }: { comic?: Comic; reverse?: boolean }) {
  return (
    <div className={`paper-composition${reverse ? ' paper-reverse' : ''}`}>
      <div className="paper-running">
        <span>OWOC / STORIES IN MOTION</span>
        <b>{reverse ? '02' : '01'}</b>
      </div>
      <div className="paper-panel">
        <Cover comic={comic} />
        <span className="paper-dialogue">
          ĐIỀU KỲ DIỆU
          <br />
          BẮT ĐẦU TỪ ĐÂY.
        </span>
      </div>
      <div className="paper-panels">
        <div>
          <Cover comic={comic} variant={1} />
        </div>
        <div>
          <b>WHOOSH!</b>
          <span>MỞ TRANG TIẾP THEO ↗</span>
        </div>
      </div>
    </div>
  );
}

export function MechanicalScene({
  comic,
  companions = [],
  paused,
}: {
  comic?: Comic;
  companions?: Comic[];
  paused: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const transition = useRef<gsap.core.Timeline | null>(null);
  const flip = useRef<gsap.core.Timeline | null>(null);
  const [active, setActive] = useState(0);
  const stories = [comic, ...companions].filter((item): item is Comic => Boolean(item));
  const count = Math.max(1, stories.length);
  const selected = stories[active % Math.max(1, stories.length)];

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        if (paused) return;
        gsap
          .timeline({ defaults: { ease: 'expo.out' } })
          .from('.cinema-frame', { z: -500, rotationY: 35, x: 140, opacity: 0, duration: 1.4 })
          .from(
            '.cinema-slice',
            { z: -200, x: 120, rotationY: -35, opacity: 0, stagger: 0.16, duration: 1.2 },
            0.2,
          )
          .from('.folio', { rotationX: 65, y: 120, z: -180, opacity: 0, duration: 1.4 }, 0.45)
          .from('.folio-left', { rotationY: 88, duration: 1.5, ease: 'power3.inOut' }, 0.65)
          .from('.folio-right', { rotationY: -88, duration: 1.5, ease: 'power3.inOut' }, 0.65)
          .from(
            '.cinema-caption, .cinema-navigation',
            { y: 20, opacity: 0, stagger: 0.12, duration: 0.7 },
            0.9,
          );
        const breathe = gsap
          .timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut', duration: 4 } })
          .to('.cinema-frame', { y: -9, rotationZ: -1.5 }, 0)
          .to('.slice-far', { y: 15, rotationY: 7 }, 0)
          .to('.slice-near', { y: -18, rotationY: -6 }, 0)
          .to('.cinema-word', { x: 15 }, 0);
        const pages = gsap
          .timeline({ repeat: -1, repeatDelay: 3, delay: 2 })
          .to('.folio-leaf', { rotationY: -172, duration: 1.8, ease: 'power3.inOut' })
          .to('.folio-pop', { z: 24, rotationX: -8, duration: 0.6, ease: 'back.out(1.4)' }, '-=.4')
          .to('.folio-pop', { z: 0, rotationX: 0, duration: 0.5 }, '+=1')
          .to('.folio-leaf', { rotationY: 0, duration: 1.6, ease: 'power3.inOut' });
        flip.current = pages;
        const scroll = gsap
          .timeline({
            scrollTrigger: {
              trigger: root.current,
              start: 'top top',
              end: 'bottom top',
              scrub: 0.8,
            },
          })
          .to('.cinema-scroll', { rotationY: -12, rotationX: 9, y: -45, z: -90, ease: 'none' }, 0)
          .to('.slice-near', { x: 60, z: 120, ease: 'none' }, 0);
        const loops = [breathe, pages];
        let visible = true;
        const sync = () => loops.forEach((loop) => loop.paused(!visible || document.hidden));
        const observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        });
        const element = root.current;
        if (element) observer.observe(element);
        document.addEventListener('visibilitychange', sync);
        let removePointer = () => {};
        if (element && window.matchMedia('(hover: hover)').matches) {
          const x = gsap.quickTo(tilt.current, 'rotationY', { duration: 0.8, ease: 'power3.out' });
          const y = gsap.quickTo(tilt.current, 'rotationX', { duration: 0.8, ease: 'power3.out' });
          const move = (event: PointerEvent) => {
            const rect = element.getBoundingClientRect();
            x(((event.clientX - rect.left) / rect.width - 0.5) * 14);
            y(-((event.clientY - rect.top) / rect.height - 0.5) * 10);
          };
          const leave = () => {
            x(0);
            y(0);
          };
          element.addEventListener('pointermove', move);
          element.addEventListener('pointerleave', leave);
          removePointer = () => {
            element.removeEventListener('pointermove', move);
            element.removeEventListener('pointerleave', leave);
          };
        }
        return () => {
          observer.disconnect();
          document.removeEventListener('visibilitychange', sync);
          removePointer();
          scroll.kill();
          flip.current = null;
        };
      },
      root,
    );
    return () => {
      transition.current?.revert();
      transition.current = null;
      media.revert();
    };
  }, [paused]);

  const changeStory = useCallback((next: number) => {
    if (transition.current?.isActive()) return;
    const index = (next + count) % count;
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActive(index);
      return;
    }
    const scope = gsap.utils.selector(root);
    // The outgoing planes fold around their hinges before the next story locks into place.
    transition.current = gsap
      .timeline({
        onComplete: () => {
          transition.current = null;
        },
      })
      .to(scope('.story-change'), {
        rotationY: -75,
        x: -85,
        z: -90,
        opacity: 0,
        duration: 0.45,
        stagger: 0.06,
        ease: 'power3.in',
      })
      .call(() => setActive(index))
      .set(scope('.story-change'), { rotationY: 65, x: 100, z: -160 })
      .to(scope('.story-change'), {
        rotationY: 0,
        x: 0,
        z: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.09,
        ease: 'expo.out',
      });
  }, [count, paused]);

  useEffect(() => {
    const element = root.current;
    if (!element || paused || count < 2) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let visible = false;
      const sync = () => {
        clearTimeout(timer);
        if (visible && !document.hidden && !element.contains(document.activeElement)) {
          timer = setTimeout(() => changeStory(active + 1), 10000);
        }
      };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      });
      const onBlur = () => queueMicrotask(sync);
      observer.observe(element);
      element.addEventListener('focusin', sync);
      element.addEventListener('focusout', onBlur);
      document.addEventListener('visibilitychange', sync);
      return () => {
        clearTimeout(timer);
        observer.disconnect();
        element.removeEventListener('focusin', sync);
        element.removeEventListener('focusout', onBlur);
        document.removeEventListener('visibilitychange', sync);
      };
    });
    return () => media.revert();
  }, [active, changeStory, count, paused]);

  return (
    <div className="manga-cinema" ref={root}>
      <div className="cinema-topline">
        <span>OWOC SELECTED STORIES</span>
        <span>VOL. {String(active + 1).padStart(2, '0')}</span>
      </div>
      <div className="cinema-viewport">
        <div className="cinema-scroll">
          <div className="cinema-camera" ref={tilt}>
            <div className="cinema-word" aria-hidden="true">
              物語
            </div>
            <div className="cinema-slice slice-far">
              <div className="slice-surface story-change">
                <Cover comic={stories[(active + 1) % Math.max(1, stories.length)]} variant={1} />
                <span>ANOTHER WORLD</span>
              </div>
            </div>
            <div className="cinema-frame">
              <Link
                className="cinema-cover story-change"
                href={selected ? `/comics/${selected.slug}` : '/comics'}
                aria-label={selected ? `Khám phá ${selected.title}` : 'Khám phá kho truyện'}
              >
                <Cover comic={selected} />
                <div className="cover-shade" />
                <div className="cover-typeset">
                  <span>ĐỌC. TƯỞNG TƯỢNG. ĐẮM CHÌM.</span>
                  <strong>{selected?.title || 'Phía bên kia\ntrang giấy.'}</strong>
                  <b>KHÁM PHÁ CÂU CHUYỆN ↗</b>
                </div>
                <i className="cover-spine" />
              </Link>
            </div>
            <div className="cinema-slice slice-near" aria-hidden="true">
              <div className="slice-surface story-change">
                <Cover comic={selected} variant={2} />
                <strong>
                  TO BE
                  <br />
                  <em>CONTINUED.</em>
                </strong>
              </div>
            </div>
            <span className="cinema-sound" aria-hidden="true">
              シュッ!
            </span>
            <div className="folio">
              <div className="folio-binding" />
              <div className="folio-left">
                <ComicSheet comic={selected} />
              </div>
              <div className="folio-right">
                <ComicSheet comic={stories[(active + 1) % Math.max(1, stories.length)]} reverse />
              </div>
              <div className="folio-leaf">
                <div className="folio-face">
                  <ComicSheet comic={selected} />
                </div>
                <div className="folio-face folio-back">
                  <ComicSheet comic={selected} reverse />
                </div>
              </div>
              <span className="folio-gutter" />
              <span className="folio-pop" aria-hidden="true">
                BƯỚC VÀO
                <br />
                <b>CÂU CHUYỆN.</b>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="cinema-caption">
        <span>KHÔNG CHỈ LÀ ĐỌC.</span>
        <p>Một trang mở ra. Cả thế giới chuyển mình.</p>
      </div>
      <div className="cinema-navigation">
        <div className="cinema-pagination" aria-label="Chọn truyện tiêu điểm">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Truyện tiêu điểm ${index + 1}`}
              aria-pressed={active === index}
              onClick={() => changeStory(index)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <i />
            </button>
          ))}
        </div>
        <div className="cinema-buttons">
          <button
            type="button"
            aria-label="Lật trang truyện"
            disabled={paused}
            onClick={() => flip.current?.restart()}
          >
            Lật trang <span>↶</span>
          </button>
          <button
            type="button"
            aria-label="Truyện tiếp theo"
            onClick={() => changeStory(active + 1)}
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  );
}
