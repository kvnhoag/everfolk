import assert from "node:assert/strict";
import test from "node:test";
import { capabilityPresentations, firstSentence } from "../client/models/capability-presentation.ts";
import { ATTRIBUTE_NODES } from "../src/capabilities/attribute-catalog.ts";
import type { WorldPack } from "../src/types.ts";
import current from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };

const world=current as unknown as WorldPack;
test("crossover badges identify the actual branches and exclude joins within one branch",()=>{
  const view=capabilityPresentations(ATTRIBUTE_NODES,world);
  assert.deepEqual([...view].filter(([,p])=>p.crossover).map(([id])=>id),['M4','M8']);
  for(const id of ['M4','M8'])assert.deepEqual(view.get(id)!.sources,['Physique','Knowledge']);
  assert.equal(view.get('F4')!.crossover,false);
});

test("milestone borders follow career gates or real skill forks",()=>{
  const view=capabilityPresentations(ATTRIBUTE_NODES,world);
  assert.ok(view.get('M4')!.titles.some(t=>/soldier/i.test(t)));
  assert.ok(view.get('M7')!.titles.some(t=>/officer/i.test(t)));
  assert.ok(view.get('M10')!.titles.some(t=>/general/i.test(t)));
  assert.ok(view.get('P4')!.keySkill && view.get('P4')!.milestone);
  assert.equal(view.get('B2')!.milestone,false);
  const changed=structuredClone(world);
  changed.character!.activities=changed.character!.activities.filter(a=>a.id!=='seek-officer-commission');
  assert.equal(capabilityPresentations(ATTRIBUTE_NODES,changed).get('M7')!.titles.length,0);
});

test("compact summaries preserve decimal values and leave complete rules intact",()=>{
  const text='Low-flood factor becomes 0.60. Maintenance still costs 8 dr.';
  assert.equal(firstSentence(text),'Low-flood factor becomes 0.60.');
  assert.equal(firstSentence('No extra sentence'),'No extra sentence');
});
