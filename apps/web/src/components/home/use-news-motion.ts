'use client';

import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';

/** Keep editorial panels moving independently from the section entrance. */
export function useNewsMotion(root: RefObject<HTMLDivElement | null>, paused: boolean, ready: boolean) {
  useEffect(() => {
    if (!ready || paused) return;
    const section = root.current?.querySelector<HTMLElement>('.mech-news');
    if (!section) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const panels = gsap.utils.toArray<HTMLElement>('[data-news-plane]', section);
      if (!panels.length) return;
      const motion = gsap.timeline({ repeat: -1, yoyo: true, paused: true });
      panels.forEach((panel, index) => {
        motion.fromTo(panel, { rotationX: 2, rotationY: index % 2 ? 3 : -3, z: 0, y: 0 }, {
          rotationX: -2, rotationY: index % 2 ? -3 : 3, z: 24, y: -8,
          duration: 3.8 + index * 0.3, ease: 'sine.inOut',
        }, index * 0.15);
      });
      let visible = false;
      const sync = () => motion.paused(!visible || document.hidden);
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.1 });
      observer.observe(section);
      document.addEventListener('visibilitychange', sync);
      return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
      };
    }, section);
    return () => media.revert();
  }, [root, paused, ready]);
}
