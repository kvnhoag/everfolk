import { readFile, writeFile } from 'node:fs/promises';
import { runFocusedPolicy, FOCUSED_TARGETS } from './focused-policy.ts';
const world = JSON.parse(await readFile(new URL('../../worlds/demo/alexandria-lives-3.json',import.meta.url),'utf8'));
const count = Math.min(1000,Math.max(1,Number(process.argv[2]??100)));
const targets = process.argv[3] ? process.argv[3].split(',') : FOCUSED_TARGETS;
const results=[];
for (const target of targets) {
 const lives=Array.from({length:count},(_,i)=>runFocusedPolicy(world,target,`skill-focus-${i}`));
 const mastered=lives.filter(l=>l.mastered).length, adults=lives.filter(l=>l.survived18), adultMastered=adults.filter(l=>l.mastered).length;
 const summary={target,attempts:count,mastered,ratePercent:mastered/count*100,adultAttempts:adults.length,adultMasteryPercent:adults.length?adultMastered/adults.length*100:0,blocked: Object.fromEntries([...new Set(lives.filter(l=>!l.mastered).map(l=>l.next))].map(n=>[n,lives.filter(l=>!l.mastered&&l.next===n).length]))};
 console.log(JSON.stringify(summary)); results.push({...summary,lives});
}
if(process.argv[4]) await writeFile(process.argv[4],JSON.stringify({worldVersion:world.version,policy:'three of four eligible work years; ordinary safe choices; no state injection',results},null,2)+'\n');
