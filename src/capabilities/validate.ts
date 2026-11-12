import type { CapabilityDefinition } from "./types.ts";
import { CAPABILITY_NODES } from "./catalog.ts";
/** Strict JSON and the supported 65-node graph, before any behavior reads pack data. */
export function validateCapabilities(input: unknown, skills: Set<string>, fail: (path: string, message: string) => never): asserts input is CapabilityDefinition {
  const path = "world.capabilities";
  const object = (value: unknown, at: string, keys?: string[], required = keys): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail(at, "expected plain JSON object");
    for (const key of Reflect.ownKeys(value as object)) {
      if (typeof key !== "string" || ["__proto__","constructor","prototype"].includes(key) || keys && !keys.includes(key)) fail(at, "unknown or reserved field");
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!("value" in descriptor) || !descriptor.enumerable) fail(at, "expected JSON data");
    }
    for (const key of required ?? []) if (!Object.hasOwn(value as object, key)) fail(at, "required field missing");
    return value as Record<string,unknown>;
  };
  const array = (value: unknown, max: number): unknown[] => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype || value.length>max || Reflect.ownKeys(value).length!==value.length+1) fail(path,"expected dense JSON array");
    for(let i=0;i<(value as unknown[]).length;i++) {
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(path,"expected dense JSON data array");
    }
    return value as unknown[];
  };
  const root = object(input,path,["version","nodes"]);
  const nodes = array(root.nodes,65);
  if (root.version !== 1 || nodes.length !== 65) fail(path,"expected capability version 1 and 65 nodes");
  const ids = new Set<string>();
  for (const value of nodes) {
    const node = object(value,path,["id","depth","title","branch","specialization","prerequisites","minimumProficiency","proof","reward","anyProficiency"],["id","depth","title","branch","specialization","prerequisites","minimumProficiency","proof","reward"]);
    if(typeof node.id!=="string" || ids.has(node.id)) fail(path,"invalid or duplicate capability id");
    const canonical=CAPABILITY_NODES.find(candidate=>candidate.id===node.id);
    if(!canonical || node.depth!==canonical.depth || node.branch!==canonical.branch || node.specialization!==canonical.specialization) fail(path,"unsupported node or graph position");
    ids.add(node.id as string);
    for (const key of ["title","proof","reward"]) if (typeof node[key]!=="string" || !node[key] || String(node[key]).length>3000) fail(path,"invalid node text");
    const checkSkills = (value: unknown): void => {
      const gates=object(value,path);
      if(Object.keys(gates).length>10) fail(path,"too many proficiency gates");
      for (const [skill,n] of Object.entries(gates)) if (!skills.has(skill) || !Number.isInteger(n) || Number(n)<0 || Number(n)>100) fail(path,"invalid proficiency gate");
    };
    checkSkills(node.minimumProficiency);
    if (node.anyProficiency!==undefined) {
      const alternatives=array(node.anyProficiency,4);
      if(!alternatives.length) fail(path,"empty alternative proficiency gates");
      for(const gate of alternatives) checkSkills(gate);
    }
    const parents=object(node.prerequisites,path,["all"]);
    const all=array(parents.all,4);
    if(all.some(id=>typeof id!=="string") || new Set(all).size!==all.length || all.length!==canonical!.prerequisites.all.length || canonical!.prerequisites.all.some(id=>!all.includes(id))) fail(path,"unsupported prerequisite graph");
  }
  if(CAPABILITY_NODES.some(node=>!ids.has(node.id))) fail(path,"missing supported capability");
}
