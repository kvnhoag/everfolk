import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { clampMapZoom, constrainMapCamera, fitMapCamera, zoomMapCamera, type MapCamera, type MapPoint, type MapSize } from "../models/skill-map-camera.ts";

/** Animate only the canvas transform; the skill graph does not re-render every frame. */
export function useSkillMapNavigation(canvas: MapSize) {
  const viewport = useRef<HTMLDivElement>(null), paper = useRef<HTMLDivElement>(null);
  const current = useRef<MapCamera>({ x: 0, y: 0, scale: .42 });
  const target = useRef(current.current), frame = useRef(0), fitting = useRef(true);
  const zoomLabel = useRef<HTMLSpanElement>(null);
  const lastFrame = useRef(0), direct = useRef(false), reducedMotion = useRef(false);
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [zoom, setZoom] = useState(.42), [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, MapPoint>());
  const gesture = useRef<{ origin: MapPoint; camera: MapCamera; distance?: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const size = () => ({ width: viewport.current?.clientWidth ?? 1, height: viewport.current?.clientHeight ?? 1 });
  const bounded = (camera: MapCamera) => constrainMapCamera(camera, size(), canvas);
  function paint(camera: MapCamera) {
    current.current = camera;
    if (paper.current) paper.current.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`;
    if (zoomLabel.current) zoomLabel.current.textContent = `${Math.round(camera.scale * 100)}%`;
  }
  // Update React controls after a gesture, rather than reconciling 74 nodes per wheel event.
  function publish() {
    clearTimeout(summaryTimer.current);
    summaryTimer.current = setTimeout(() => setZoom(current.current.scale), 70);
  }
  function stop() { cancelAnimationFrame(frame.current); frame.current = 0; lastFrame.current = 0; }
  function tick(time: number) {
    frame.current = 0;
    const before = current.current, end = target.current;
    const dt = lastFrame.current ? Math.min(40, Math.max(1, time - lastFrame.current)) : 16;
    lastFrame.current = time;
    const amount = direct.current || reducedMotion.current ? 1 : 1 - Math.exp(-dt / 32);
    const next = { x: before.x + (end.x - before.x) * amount, y: before.y + (end.y - before.y) * amount, scale: before.scale + (end.scale - before.scale) * amount };
    if (Math.abs(end.x-next.x) < .1 && Math.abs(end.y-next.y) < .1 && Math.abs(end.scale-next.scale) < .0001) {
      paint(end); lastFrame.current = 0; publish();
    } else { paint(next); frame.current = requestAnimationFrame(tick); }
  }
  function move(camera: MapCamera, animate = true) {
    target.current = bounded(camera);
    direct.current = !animate;
    if (reducedMotion.current) { stop(); paint(target.current); publish(); }
    else if (!frame.current) frame.current = requestAnimationFrame(tick);
  }
  function fit(animate = true) { fitting.current = true; move(fitMapCamera(size(), canvas), animate); }
  function changeZoom(scale: number, anchor?: MapPoint) {
    fitting.current = false;
    const bounds = size();
    // Compose input against the intended camera so queued wheel events share the same anchor.
    move(zoomMapCamera(target.current, scale, anchor ?? { x: bounds.width / 2, y: bounds.height / 2 }));
  }
  function zoomBy(factor: number) { changeZoom(target.current.scale * factor); }
  function focusPoint(point: MapPoint, scale = target.current.scale) {
    fitting.current = false;
    const bounds = size(), next = clampMapZoom(scale);
    move({ scale: next, x: bounds.width / 2 - point.x * next, y: bounds.height / 2 - point.y * next });
  }
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => { reducedMotion.current = motion.matches; };
    updateMotion(); motion.addEventListener("change", updateMotion);
    // Keep the intended camera, not the mid-animation one: the first resize can land before a queued focus animates.
    const resize = () => { if (fitting.current) fit(false); else move(target.current, false); };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (pointers.current.size) return;
      const rect = element.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
      changeZoom(target.current.scale * Math.exp(-delta * .003), { x: event.clientX - rect.left - element.clientLeft, y: event.clientY - rect.top - element.clientTop });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    const endOutside = (event: PointerEvent) => {
      if (element.hasPointerCapture(event.pointerId)) return;
      pointers.current.delete(event.pointerId);
      if (!pointers.current.size) { gesture.current = null; setDragging(false); }
    };
    const blur = () => { pointers.current.clear(); gesture.current = null; setDragging(false); };
    window.addEventListener("pointerup", endOutside);
    window.addEventListener("pointercancel", endOutside);
    window.addEventListener("blur", blur);
    return () => {
      stop(); clearTimeout(summaryTimer.current); observer.disconnect(); element.removeEventListener("wheel", wheel); motion.removeEventListener("change", updateMotion);
      window.removeEventListener("pointerup", endOutside); window.removeEventListener("pointercancel", endOutside); window.removeEventListener("blur", blur);
    };
  }, [canvas.width, canvas.height]);

  function local(event: ReactPointerEvent<HTMLDivElement>): MapPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - event.currentTarget.clientLeft, y: event.clientY - rect.top - event.currentTarget.clientTop };
  }
  function beginGesture() {
    const points = [...pointers.current.values()];
    const origin = points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
    gesture.current = origin ? { origin, camera: current.current, moved: false,
      ...(points.length > 1 ? { distance: Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)) } : {}) } : null;
  }
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stop(); clearTimeout(summaryTimer.current); target.current = current.current; setZoom(current.current.scale);
    if (!pointers.current.size) suppressClick.current = false;
    pointers.current.set(event.pointerId, local(event));
    beginGesture();
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, local(event));
    const points = [...pointers.current.values()], start = gesture.current;
    const midpoint = points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
    const dx = midpoint.x - start.origin.x, dy = midpoint.y - start.origin.y;
    if (!start.moved && points.length === 1 && Math.hypot(dx, dy) < 5) return;
    start.moved = true; suppressClick.current = true; fitting.current = false;
    setDragging(true);
    event.preventDefault();
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    let camera = { ...start.camera, x: start.camera.x + dx, y: start.camera.y + dy };
    if (points.length > 1 && start.distance) {
      const scale = start.camera.scale * Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / start.distance;
      camera = zoomMapCamera(start.camera, scale, start.origin);
      camera.x += dx; camera.y += dy;
    }
    move(camera, false);
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current?.moved) { stop(); paint(target.current); publish(); }
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!pointers.current.size) { gesture.current = null; setDragging(false); }
    else beginGesture();
  }
  function onLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointers.current.has(event.pointerId)) onPointerUp(event);
  }
  return { viewport, paper, zoomLabel, zoom, dragging, fit, zoomBy, focusPoint,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onLostPointerCapture,
      onClickCapture(event: ReactMouseEvent<HTMLDivElement>) { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } } } };
}
