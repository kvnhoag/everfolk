import { readFile, writeFile } from 'node:fs/promises';
import { runFocusedPolicy, FOCUSED_TARGETS } from './focused-policy.ts';
const world = JSON.parse(await readFile(new URL('../../worlds/demo/alexandria-lives-5.json',import.meta.url),'utf8'));
const count = Math.min(1000,Math.max(1,Number(process.argv[2]??100)));
const targets = process.argv[3] ? process.argv[3].split(',') : FOCUSED_TARGETS;
const results=[];
for (const target of targets) {
 const lives=Array.from({length:count},(_,i)=>runFocusedPolicy(world,target,`skill-focus-${i}`));
 const mastered=lives.filter(l=>l.mastered).length, adults=lives.filter(l=>l.survived18), adultMastered=adults.filter(l=>l.mastered).length;
 // Wilson 95% interval for the mastery rate; early deaths stay in the primary rate.
 const z=1.96,p=mastered/count,centre=(p+z*z/(2*count))/(1+z*z/count),half=z*Math.sqrt(p*(1-p)/count+z*z/(4*count*count))/(1+z*z/count);
 const ages=lives.filter(l=>l.mastered).map(l=>l.age).sort((a,b)=>a-b);
 const summary={target,attempts:count,mastered,ratePercent:mastered/count*100,ci95Percent:[Math.round((centre-half)*1000)/10,Math.round((centre+half)*1000)/10],diedBefore18:count-adults.length,medianMasteryAge:ages.length?ages[Math.floor(ages.length/2)]:null,adultAttempts:adults.length,adultMasteryPercent:adults.length?adultMastered/adults.length*100:0,blocked: Object.fromEntries([...new Set(lives.filter(l=>!l.mastered).map(l=>l.next))].map(n=>[n,lives.filter(l=>!l.mastered&&l.next===n).length]))};
 console.log(JSON.stringify(summary)); results.push({...summary,lives});
}
if(process.argv[4]) await writeFile(process.argv[4],JSON.stringify({worldVersion:world.version,policy:'three of four eligible work years; Auto-mode choices; seeks military appointments when required; no state injection',seeds:`skill-focus-0 … skill-focus-${count-1}`,results},null,2)+'\n');
