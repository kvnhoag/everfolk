import { useEffect, type RefObject } from 'react';

/** Decorative timelines only: no game state, global selectors or simulation clock. */
export function useLuminousLight(root: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !root.current) return;
    let cancelled = false;
    let cleanup = () => {};
    void import('gsap').then(({ gsap }) => {
      if (cancelled || !root.current) return;
      const element = root.current;
      const media = gsap.matchMedia(element);
      const context = gsap.context(() => {
        media.add('(prefers-reduced-motion: no-preference)', () => {
          const animations: gsap.core.Animation[] = [];
          if (element.querySelector('.ef-royal-pixel-batch')) {
            const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
            entrance
              .fromTo(
                '.ef-royal-pixel-batch',
                { opacity: 0, y: 5, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.36, stagger: 0.05 },
                0,
              );
            if (element.querySelector('.ef-logo-emblem, .ef-logo-lower-rule')) {
              entrance.fromTo(
                '.ef-logo-emblem,.ef-logo-lower-rule',
                { opacity: 0, scaleX: 0.78 },
                { opacity: 1, scaleX: 1, duration: 0.65, transformOrigin: 'center center' },
                0.1,
              );
            }
            animations.push(entrance);
          }
          if (element.querySelector('.ef-logo-reflection')) {
            animations.push(gsap.fromTo('.ef-logo-reflection', { x: 0, opacity: 0 }, {
              x: 820, opacity: 0.48, duration: 7.5, delay: 1.4, ease: 'sine.inOut', repeat: -1, repeatDelay: 11,
            }));
          }
          if (element.querySelector('.ef-royal-dust')) {
            animations.push(gsap.fromTo('.ef-royal-dust', { y: 2, opacity: 0 }, {
              y: -3, opacity: 0.5, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut',
            }));
          }
          element.querySelectorAll('.ef-title-glint').forEach((glint, i) => {
            const pulse = gsap.timeline({ repeat: -1, repeatDelay: 9 + i * 3.7, delay: 2.5 + i * 4.3 });
            pulse.fromTo(glint, { opacity: 0, scale: 0.5 }, { opacity: 0.85, scale: 1, duration: 0.9, ease: 'sine.out' })
              .to(glint, { opacity: 0, scale: 0.65, duration: 1.5, ease: 'sine.in' });
            animations.push(pulse);
          });
          element.querySelectorAll('.ef-light-mote').forEach((mote, i) => {
            const drift = gsap.timeline({ repeat: -1, repeatDelay: 2 + i % 3, delay: i * 1.7 });
            drift.fromTo(mote, { y: 7, x: 0, opacity: 0 }, { y: -8, x: i % 2 ? 4 : -3, opacity: 0.45, duration: 4 + i % 3, ease: 'sine.inOut' })
              .to(mote, { y: -22, opacity: 0, duration: 4, ease: 'sine.inOut' });
            animations.push(drift);
          });
          let inView = true;
          const sync = () => {
            const resting = document.hidden || !inView;
            element.dataset.lightResting = String(resting);
            animations.forEach(animation => animation.paused(resting));
          };
          const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
            inView = entries[0]?.isIntersecting ?? false; sync();
          });
          observer?.observe(element);
          document.addEventListener('visibilitychange', sync);
          sync();
          return () => {
            observer?.disconnect(); document.removeEventListener('visibilitychange', sync);
            delete element.dataset.lightResting;
          };
        });
      }, element);
      cleanup = () => { media.revert(); context.revert(); };
    }).catch(() => { /* Static lettering remains complete if the optional animation chunk fails. */ });
    return () => { cancelled = true; cleanup(); };
  }, [root, enabled]);
}
