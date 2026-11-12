import design from "../../design/skill-tree/catalog.json" with { type: "json" };
import type { CapabilityNode } from "./types.ts";
/** One catalog supplies both the saved world rules and the visible graph. */
export const CAPABILITY_NODES: readonly CapabilityNode[] = design.nodes as unknown as CapabilityNode[];
export const capabilityNode = (id: string): CapabilityNode | undefined => CAPABILITY_NODES.find(node => node.id === id);
export const capabilityAction = (id: string): string => `cap-work-${id.toLowerCase()}`;
