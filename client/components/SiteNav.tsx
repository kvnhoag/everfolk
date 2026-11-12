import { useSyncExternalStore } from "react";
import { SITE_LINKS, siteSectionForHash } from "../models/site-nav.ts";
import "../styles/site-nav.css";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

/** The shared site header links: Play · Weave Mode · Market · Figures · My lives. Hosts keep their own styling. */
export default function SiteNav({ className, linkClassName, onPlay }: { className: string; linkClassName?: string; onPlay?(): void }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const current = siteSectionForHash(hash);
  return <nav className={className} aria-label="Everfolk">
    {SITE_LINKS.map(link => <a key={link.id} className={linkClassName} href={link.href} aria-current={current === link.id ? "page" : undefined}
      onClick={link.id === "play" && onPlay ? event => { event.preventDefault(); onPlay(); } : undefined}>{link.label}</a>)}
  </nav>;
}
