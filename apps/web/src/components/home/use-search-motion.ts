'use client';

import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';

export function useSearchMotion(root: RefObject<HTMLDivElement | null>, paused: boolean) {
  useEffect(() => {
    if (paused) return;
    const shell = root.current?.querySelector<HTMLElement>('.search-stage');
    if (!shell) return;
    const form = shell.querySelector('form');
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const motion = gsap.to(form, { rotationX: -5, rotationY: 3, y: -4, z: 10,
        duration: 2.8, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true });
      const letters = shell.querySelectorAll('.search-letter');
      const glints = shell.querySelectorAll('.search-glint');
      const lettering = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true })
        .fromTo(letters, { opacity: 0, y: 8, rotationX: -75, z: -12 }, {
          opacity: 1, y: 0, rotationX: 0, z: 0,
          stagger: 0.055, duration: 0.38, ease: 'power3.out',
        })
        .fromTo(glints, { opacity: 0 }, {
          opacity: 1, stagger: 0.045, duration: 0.18, repeat: 1, yoyo: true,
        }, '+=0.35')
        .to(letters, { opacity: 0, y: -5, rotationX: 45,
          stagger: 0.025, duration: 0.25, ease: 'power2.in',
        }, '+=1.8');
      let visible = false;
      const sync = () => {
        const focused = shell.contains(document.activeElement);
        const stopped = !visible || document.hidden || focused;
        motion.paused(stopped);
        lettering.paused(stopped);
      };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      });
      observer.observe(shell);
      shell.addEventListener('focusin', sync);
      const onBlur = () => queueMicrotask(sync);
      shell.addEventListener('focusout', onBlur);
      document.addEventListener('visibilitychange', sync);
      return () => {
        observer.disconnect();
        shell.removeEventListener('focusin', sync);
        shell.removeEventListener('focusout', onBlur);
        document.removeEventListener('visibilitychange', sync);
      };
    }, shell);
    return () => media.revert();
  }, [root, paused]);
}
