import type { LifeState, WorldPack } from "../types.ts";
import { hasServiceRole } from "../demo/service-role.ts";

/** Proved service years before an officer's commission and a general's command (attribute-atlas worlds only). */
export const OFFICER_SERVICE_YEARS = 2, GENERAL_SERVICE_YEARS = 5;
export const MILITARY_QUALIFICATIONS: Record<string,string> = {soldier:"M4",officer:"M7",general:"M10"};
export const provedServiceYears = (life:LifeState) => new Set((life.capabilities?.military?.service ?? []).filter(r=>r.paid===r.wage && r.rations===r.ration && r.purseBefore-r.purseAfter===r.paid && r.grainBefore-r.grainAfter===r.rations).map(r=>r.age)).size;
export function militaryCareerReason(world:WorldPack,life:LifeState,job:string):string|undefined {
  if((world.capabilities?.version ?? 0) < 2 || !MILITARY_QUALIFICATIONS[job]) return;
  const id=MILITARY_QUALIFICATIONS[job], node=world.capabilities.nodes.find(n=>n.id===id)!;
  if(!life.capabilities?.learned[id])return `Learn ${node.title} through demonstrated work before seeking this career.`;
  // An appointment checks fitness; knowledge was proved when the qualification was learned.
  const fitness=world.health?.stat ?? "health";
  for(const [stat,value]of Object.entries(node.minimumStats ?? {})) if(stat===fitness && life.stats[stat]<value)return `${world.stats[stat].label} ${value} required for this appointment.`;
  const years=job==='officer'?OFFICER_SERVICE_YEARS:job==='general'?GENERAL_SERVICE_YEARS:0;
  if(provedServiceYears(life)<years)return `This appointment requires ${years} proved service years.`;
  if(job==='officer'&&life.character?.jobId!=='soldier')return "Serve as a Soldier before seeking an Officer commission.";
  if(job==='general'&&life.character?.jobId!=='officer')return "Serve as an Officer before seeking a General appointment.";
  if(life.demo && world.demo && (life.demo.town.army.purse<world.demo.service.wage[life.demo.year.army] || life.demo.town.army.grain<world.demo.service.ration))return "The army must fund the appointment's first wage and rations.";
}
export function militaryWorkReason(life:LifeState,id:string):string|undefined {
  if(!/^M(?:[5-9]|10)$/.test(id))return;
  if(!hasServiceRole(life))return "Enlist and serve in the army before taking this military work.";
  if(['M8','M9','M10'].includes(id) && !['officer','general'].includes(life.character!.jobId!))return "An Officer appointment is required for command assessments.";
  if(id==='M10' && provedServiceYears(life)<GENERAL_SERVICE_YEARS)return `Strategic command requires at least ${GENERAL_SERVICE_YEARS} proved service years.`;
}
/** Deeds settle after actual army payments/rations, never when the work button is clicked. */
export function settleMilitaryProofs(world:WorldPack,life:LifeState,age:number):void {
  if((world.capabilities?.version ?? 0) < 2 || !life.capabilities)return;
  const receipt=life.capabilities.military?.service.find(r=>r.age===age);
  for(const evidence of life.capabilities.evidence.filter(e=>/^M(?:[5-9]|10)$/.test(e.nodeId)&&e.age===age&&e.data.awaitingService===true)) {
    const valid=Boolean(receipt && receipt.paid===receipt.wage && receipt.rations===receipt.ration && receipt.purseBefore-receipt.purseAfter===receipt.paid && receipt.grainBefore-receipt.grainAfter===receipt.rations);
    Object.assign(evidence.data,{awaitingService:false,qualifies:valid && evidence.data.cashConserved===true,
      serviceRole:receipt?.role ?? 'none',wagePaid:receipt?.paid ?? 0,rationsServed:receipt?.rations ?? 0,
      armyPurseOpening:receipt?.purseBefore ?? 0,armyPurseClosing:receipt?.purseAfter ?? 0,
      armyGrainOpening:receipt?.grainBefore ?? 0,armyGrainClosing:receipt?.grainAfter ?? 0,serviceReconciled:valid});
  }
}
