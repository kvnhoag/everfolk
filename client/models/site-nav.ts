import { parseChainRoute } from "../chain/chain-route.ts";

export type SiteSection = "play" | "weave" | "market" | "figures" | "mine";
export interface SiteLink { id: SiteSection; label: string; href: string }

/** The one header shared by home, the game and the Weave Mode screens. */
export const SITE_LINKS: readonly SiteLink[] = [
  { id: "play", label: "Play", href: "#" },
  { id: "weave", label: "Weave Mode", href: "#weave" },
  { id: "market", label: "Market", href: "#market" },
  { id: "figures", label: "Figures", href: "/cards" },
  { id: "mine", label: "My lives", href: "#mine" },
];

export function siteSectionForHash(hash: string): SiteSection {
  const route = parseChainRoute(hash);
  if (!route) return "play";
  if (route.kind === "ranked" || route.kind === "pack") return "weave";
  if (route.kind === "token") return "market";
  return route.kind;
}
