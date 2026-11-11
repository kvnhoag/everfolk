/** Hash routes for the ranked screens. Any other hash leaves the game as it is. */
export type ChainRoute = { kind: "ranked" } | { kind: "market" } | { kind: "token"; tokenId: string };

export function parseChainRoute(hash: string): ChainRoute | null {
  if (hash === "#ranked") return { kind: "ranked" };
  if (hash === "#market") return { kind: "market" };
  const token = /^#token\/(\d+)$/.exec(hash);
  return token ? { kind: "token", tokenId: token[1] } : null;
}

export function chainHref(route: ChainRoute): string {
  return route.kind === "token" ? `#token/${route.tokenId}` : `#${route.kind}`;
}
