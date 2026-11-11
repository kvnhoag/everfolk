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
          const title = element.querySelector('.ef-title-gold');
          animations.push(gsap.fromTo(title, { '--gold-sweep': '140%' }, {
            '--gold-sweep': '-40%', duration: 6.5, ease: 'sine.inOut', repeat: -1, repeatDelay: 7.5,
          }));
          animations.push(gsap.fromTo('.ef-home-tagline', { '--subtitle-sweep': '130%' }, {
            '--subtitle-sweep': '-30%', duration: 5.8, delay: 3, repeat: -1, repeatDelay: 13, ease: 'sine.inOut',
          }));
          element.querySelectorAll('.ef-title-glint').forEach((glint, i) => {
            const pulse = gsap.timeline({ repeat: -1, repeatDelay: 9 + i * 3.7, delay: 2.5 + i * 4.3 });
            pulse.fromTo(glint, { opacity: 0, scale: .5 }, { opacity: .85, scale: 1, duration: .9, ease: 'sine.out' })
              .to(glint, { opacity: 0, scale: .65, duration: 1.5, ease: 'sine.in' });
            animations.push(pulse);
          });
          element.querySelectorAll('.ef-light-mote').forEach((mote, i) => {
            const drift = gsap.timeline({ repeat: -1, repeatDelay: 2 + i % 3, delay: i * 1.7 });
            drift.fromTo(mote, { y: 7, x: 0, opacity: 0 }, { y: -8, x: i % 2 ? 4 : -3, opacity: .45, duration: 4 + i % 3, ease: 'sine.inOut' })
              .to(mote, { y: -22, opacity: 0, duration: 4, ease: 'sine.inOut' });
            animations.push(drift);
          });
          animations.push(gsap.fromTo('.ef-home-primary', { '--button-sheen': '-180%' }, {
            '--button-sheen': '390%', duration: 3.4, delay: 4, repeat: -1, repeatDelay: 14, ease: 'sine.inOut',
          }));
          animations.push(gsap.to('.ef-coast-aureole', { opacity: .75, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
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
    }).catch(() => { /* Static gold lettering remains complete if the optional animation chunk fails. */ });
    return () => { cancelled = true; cleanup(); };
  }, [root, enabled]);
}
