"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import { artworkImageSources, artworkImageTimeout, type ArtworkImageSources } from "../lib/artwork-delivery.ts";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet">;
export interface ArtworkImageProps extends ImageProps {
  src?: string;
  /** Optional explicit release for previews; normal views use the public Vite setting. */
  cdnBaseUrl?: string;
  cdnTimeoutMs?: number;
}

function RemoteArtworkImage({ sources, cdnTimeoutMs, onError, onLoad, loading, ...props }: ImageProps & {
  sources: ArtworkImageSources & { fallback: string }; cdnTimeoutMs?: number;
}) {
  const [remote, setRemote] = useState(true);
  const image = useRef<HTMLImageElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const terminalError = useRef(false);
  const activeSource = remote ? sources.primary : sources.fallback;
  const clearTimer = () => { clearTimeout(timer.current); timer.current = undefined; };

  useEffect(() => {
    if (!remote) return;
    const element = image.current;
    if (!element || element.complete && element.naturalWidth > 0) return;
    const start = () => {
      if (timer.current !== undefined || element.complete && element.naturalWidth > 0) return;
      timer.current = setTimeout(() => setRemote(false), artworkImageTimeout(cdnTimeoutMs));
    };
    let observer: IntersectionObserver | undefined;
    if (loading === "lazy") {
      // A lazy image may not request anything until it becomes visible.
      if (typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); start(); }
        });
        observer.observe(element);
      } else {
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom >= 0 && bounds.top <= window.innerHeight) start();
      }
    } else start();
    return () => { clearTimer(); observer?.disconnect(); };
  }, [activeSource, remote, loading, cdnTimeoutMs]);

  const failed = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    clearTimer();
    if (remote) setRemote(false);
    else if (!terminalError.current) {
      terminalError.current = true;
      onError?.(event);
    }
  };
  return <img {...props} key={activeSource} ref={image} src={activeSource} loading={loading}
    crossOrigin="anonymous" data-artwork-path={sources.localPath}
    onError={failed} onLoad={event => { clearTimer(); onLoad?.(event); }} />;
}

/** CDN failure retries the identical repo image once before existing semantic fallbacks run. */
export default function ArtworkImage({ src, cdnBaseUrl, cdnTimeoutMs, ...props }: ArtworkImageProps) {
  const sources = src ? artworkImageSources(src, cdnBaseUrl) : undefined;
  if (!sources?.fallback) return <img {...props} src={src} />;
  return <RemoteArtworkImage key={sources.primary + "\n" + sources.fallback}
    {...props} sources={sources as ArtworkImageSources & { fallback: string }} cdnTimeoutMs={cdnTimeoutMs} />;
}
