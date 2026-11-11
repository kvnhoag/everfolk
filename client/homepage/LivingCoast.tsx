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
export default function LivingCoast({ running, active, modern=false }: { running: boolean; active: boolean; modern?:boolean }) {
  const element = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0);
  useEffect(() => {
    const canvas = element.current;
    if (!canvas) return;
    const scene = createCoastalScene(canvas,modern);
    if (!scene) return;
    let frame = 0, last = 0, inView = true, disposed = false;
    let pointerX = 0, pointerY = 0;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (now: number) => {
      if (disposed) return;
      if (running && active && !document.hidden && inView && !reduced.matches) {
        if (!last || now - last >= 1000 / 30) {
          if (last) clock.current += Math.min((now - last) / 1000, .1);
          last = now;
          scene.draw(clock.current, pointerX, pointerY);
        }
        frame = requestAnimationFrame(draw);
      }
    };
    const sync = () => {
      cancelAnimationFrame(frame); last = 0;
      scene.draw(clock.current, 0, 0);
      if (running && active && !document.hidden && inView && !reduced.matches) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (!fine.matches || !running || !active || reduced.matches) return;
      pointerX = event.clientX / window.innerWidth * 2 - 1;
      pointerY = event.clientY / window.innerHeight * 2 - 1;
    };
    const leave = () => { pointerX = 0; pointerY = 0; };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false; sync();
    });
    observer?.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    reduced.addEventListener('change', sync);
    sync();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); scene.dispose();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      reduced.removeEventListener('change', sync);
    };
  }, [running, active, modern]);
  return <div className="ef-coast" aria-hidden="true">
    <canvas ref={element} width={768} height={480} className="ef-coast-canvas" />
    <div className="ef-coast-sunlight" />
    <div className="ef-coast-aureole" />
    <div className="ef-coast-shade" />
    <div className="ef-coast-grain" />
  </div>;
}
