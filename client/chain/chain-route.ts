/** Hash routes for the ranked screens. Any other hash leaves the game as it is. */
export type ChainRoute = { kind: "ranked" } | { kind: "market" } | { kind: "figures" } | { kind: "mine" } | { kind: "pack"; lifeId: string } | { kind: "token"; tokenId: string };

export function parseChainRoute(hash: string): ChainRoute | null {
  if (hash === "#ranked") return { kind: "ranked" };
  if (hash === "#figures") return { kind: "figures" };
  if (hash === "#market") return { kind: "market" };
  if (hash === "#mine") return { kind: "mine" };
  const pack = /^#pack\/(\d+)$/.exec(hash);
  if (pack) return { kind: "pack", lifeId: pack[1] };
  const token = /^#token\/(\d+)$/.exec(hash);
  return token ? { kind: "token", tokenId: token[1] } : null;
}

export function chainHref(route: ChainRoute): string {
  return route.kind === "pack" ? `#pack/${route.lifeId}` : route.kind === "token" ? `#token/${route.tokenId}` : `#${route.kind}`;
}
