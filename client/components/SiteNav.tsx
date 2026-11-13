import { useSyncExternalStore } from "react";
import { SITE_LINKS, siteSectionForHash } from "../models/site-nav.ts";
import "../styles/site-nav.css";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export interface ExtraSiteLink { href: string; label: string }

/** The shared site header links: Play · Weave Mode · Market · Figures · My lives, plus any page-specific extras. Hosts keep their own styling. */
export default function SiteNav({ className, linkClassName, onPlay, extra = [] }: { className: string; linkClassName?: string; onPlay?(): void; extra?: readonly ExtraSiteLink[] }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const current = siteSectionForHash(hash);
  return <nav className={className} aria-label="Everfolk">
    {SITE_LINKS.map(link => <a key={link.id} className={linkClassName} href={link.href} aria-current={current === link.id ? "page" : undefined}
      onClick={link.id === "play" && onPlay ? event => { event.preventDefault(); onPlay(); } : undefined}>{link.label}</a>)}
    {extra.map(link => <a key={link.href} className={linkClassName} href={link.href}>{link.label}</a>)}
  </nav>;
}
