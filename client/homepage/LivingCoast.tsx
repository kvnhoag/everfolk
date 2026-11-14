import { useEffect, useRef, useState } from 'react';
import { createCoastalScene } from './coastal-scene.ts';

const MOTION_KEY = 'everfolk:homepage-motion:v1';
export function useCoastMotion() {
  const [enabled, setEnabled] = useState(true);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try { setEnabled(localStorage.getItem(MOTION_KEY) !== 'off'); } catch { /* Visit-only preference. */ }
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(preference.matches);
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  return { enabled, reduced, toggle() {
    setEnabled(current => {
      try { localStorage.setItem(MOTION_KEY, current ? 'off' : 'on'); } catch { /* Visit-only preference. */ }
      return !current;
    });
  } };
}

/** Presentation-only environment: owns no game clock, save, command or world mutation. */
export default function LivingCoast({ running, active }: { running: boolean; active: boolean }) {
  const element = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0);
  useEffect(() => {
    const canvas = element.current;
    const home = canvas?.closest<HTMLElement>('.ef-home');
    if (!canvas || !home) return;
    const syncSize = () => {
      const viewportWidth = canvas.clientWidth;
      const sceneWidth = Math.max(viewportWidth, canvas.clientHeight * canvas.width / canvas.height);
      home.style.setProperty('--coast-rendered-width', `${sceneWidth}px`);
      home.style.setProperty('--coast-viewport-width', `${viewportWidth}px`);
    };
    // Measure in the next frame so CSS updates cannot feed back into the observer's current delivery.
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(syncSize);
    });
    observer.observe(canvas);
    syncSize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      home.style.removeProperty('--coast-rendered-width');
      home.style.removeProperty('--coast-viewport-width');
    };
  }, []);
  useEffect(() => {
    const canvas = element.current;
    if (!canvas) return;
    const scene = createCoastalScene(canvas);
    if (!scene) return;
    let frame = 0, last = 0, inView = true, disposed = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (now: number) => {
      if (disposed) return;
      if (running && active && !document.hidden && inView && !reduced.matches) {
        if (!last || now - last >= 1000 / 30) {
          if (last) clock.current += Math.min((now - last) / 1000, .1);
          last = now;
          scene.draw(clock.current);
        }
        frame = requestAnimationFrame(draw);
      }
    };
    const sync = () => {
      cancelAnimationFrame(frame); last = 0;
      scene.draw(clock.current);
      if (running && active && !document.hidden && inView && !reduced.matches) frame = requestAnimationFrame(draw);
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false; sync();
    });
    observer?.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    sync();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); scene.dispose();
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
    };
  }, [running, active]);
  return <div className="ef-coast" aria-hidden="true">
    <canvas ref={element} width={768} height={480} className="ef-coast-canvas" />
    <div className="ef-coast-grain" />
  </div>;
}
