'use client';

import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';

/** Animate the inner paper planes, never the wrapping links or their layout. */
export function useGenreMotion(root: RefObject<HTMLDivElement | null>, paused: boolean, count: number) {
  useEffect(() => {
    if (paused) return;
    const section = root.current?.querySelector<HTMLElement>('.mech-genre-rail');
    if (!section) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const planes = gsap.utils.toArray<HTMLElement>('.genre-plane', section);
      if (!planes.length) return;
      const motion = gsap.timeline({ repeat: -1, paused: true });
      planes.forEach((plane, index) => {
        motion.fromTo(plane, { rotationX: 0, rotationY: 0, z: 0 }, {
          keyframes: [
            { rotationX: -10, rotationY: index % 2 ? -9 : 9, z: 12, duration: 0.8 },
            { rotationX: 3, rotationY: index % 2 ? 3 : -3, z: 3, duration: 0.55 },
            { rotationX: 0, rotationY: 0, z: 0, duration: 0.65 },
          ],
          ease: 'power2.inOut',
        }, index * 0.16);
      });
      motion.to({}, { duration: 1.8 });
      let visible = false;
      const sync = () => motion.paused(!visible || document.hidden);
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      }, { threshold: 0.1 });
      observer.observe(section);
      document.addEventListener('visibilitychange', sync);
      return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
      };
    }, section);
    return () => media.revert();
  }, [root, paused, count]);
}
