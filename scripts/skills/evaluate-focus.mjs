import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEngine } from '../../src/engine.ts';
import { runFocusedPolicy, FOCUSED_TARGETS } from './focused-policy.ts';

function round1(value) { return Math.round(value * 10) / 10; }
function wilson95(mastered, total) {
  if (!total) return [0, 0];
  const z = 1.96, p = mastered / total;
  const centre = (p + (z * z) / (2 * total)) / (1 + (z * z) / total);
  const half = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / (1 + (z * z) / total);
  return [round1(Math.max(0, (centre - half) * 100)), round1(Math.min(100, (centre + half) * 100))];
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
export function summarizeSlice(lives) {
  const attempts = lives.length;
  const mastered = lives.filter(l => l.mastered).length;
  const adults = lives.filter(l => l.survived18);
  const adultMastered = adults.filter(l => l.mastered).length;
  const failed = lives.filter(l => !l.mastered);
  const ages = lives.filter(l => l.mastered).map(l => l.age);
  const sum = (fn) => lives.reduce((acc, l) => acc + fn(l), 0);
  const bottleneckAtStop = { cash: 0, materials: 0, opportunity: 0, proof: 0, skills: 0, 'early-death': 0 };
  for (const life of failed) bottleneckAtStop[life.blocker] = (bottleneckAtStop[life.blocker] ?? 0) + 1;
  return {
    attempts,
    mastered,
    ratePercent: attempts ? round1((mastered / attempts) * 100) : 0,
    ci95Percent: wilson95(mastered, attempts),
    diedBefore18: attempts - adults.length,
    medianMasteryAge: median(ages),
    adultAttempts: adults.length,
    adultMasteryPercent: adults.length ? round1((adultMastered / adults.length) * 100) : 0,
    bottleneckAtStop,
    turnDiagnostics: {
      adultTurns: sum(l => l.diagnostics.adultTurns),
      cashBlockedTurns: sum(l => l.diagnostics.cashBlockedTurns),
      materialBlockedTurns: sum(l => l.diagnostics.materialBlockedTurns),
      opportunityBlockedTurns: sum(l => l.diagnostics.opportunityBlockedTurns),
      proofTurns: sum(l => l.diagnostics.proofBlockedTurns),
      skillDetourTurns: sum(l => l.diagnostics.skillDetourTurns),
      apprenticeFallbackTurns: sum(l => l.diagnostics.apprenticeFallbackTurns),
      meanCashBlockedPerLife: attempts ? round1(sum(l => l.diagnostics.cashBlockedTurns) / attempts) : 0,
      meanMaterialBlockedPerLife: attempts ? round1(sum(l => l.diagnostics.materialBlockedTurns) / attempts) : 0,
      meanOpportunityBlockedPerLife: attempts ? round1(sum(l => l.diagnostics.opportunityBlockedTurns) / attempts) : 0,
      meanSkillDetourPerLife: attempts ? round1(sum(l => l.diagnostics.skillDetourTurns) / attempts) : 0,
    },
  };
}

export function buildCohortReport(world, { count = 100, targets = FOCUSED_TARGETS, includeLives = true } = {}) {
  const { fingerprint } = createEngine(world);
  let sourceRevision = 'unknown';
  try { sourceRevision = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}
  const results = [];
  for (const target of targets) {
    const lives = Array.from({ length: count }, (_, i) => runFocusedPolicy(world, target, `skill-focus-${i}`));
    const overall = summarizeSlice(lives);
    const lowWealth = summarizeSlice(lives.filter(l => l.wealthGroup === 'low-wealth'));
    const ordinary = summarizeSlice(lives.filter(l => l.wealthGroup === 'ordinary'));
    const blocked = Object.fromEntries(
      [...new Set(lives.filter(l => !l.mastered).map(l => l.next))].map(n => [n, lives.filter(l => !l.mastered && l.next === n).length]),
    );
    const origins = [...new Set(lives.map(l => l.originId))].sort();
    const byOrigin = Object.fromEntries(origins.map(originId => {
      const group = lives.filter(l => l.originId === originId);
      const mastered = group.filter(l => l.mastered).length;
      return [originId, {
        attempts: group.length,
        mastered,
        ratePercent: round1((mastered / group.length) * 100),
        medianStartCash: median(group.map(l => l.startCash)),
        medianStartNetWorth: median(group.map(l => l.startNetWorth)),
      }];
    }));
    const summary = {
      target,
      ...overall,
      blocked,
      wealthComparison: { lowWealth, ordinary },
      byOrigin,
    };
    results.push(includeLives ? { ...summary, lives } : summary);
  }
  return {
    schemaVersion: 1,
    worldId: world.id,
    worldVersion: world.version,
    worldFingerprint: fingerprint,
    sourceRevision,
    runner: 'scripts/skills/evaluate-focus.mjs',
    policy: 'Disclosed ordinary-command policy: three of every four eligible adult work years pursue the target path (age % 4 !== 3); Auto-mode safe choices; surplus grain sold after reserving next-year seed and household rations; missing skills practiced first; apprentice fallback when cash/materials block work; military appointments sought when required; zero state or cash injection.',
    wealthDefinitions: {
      'low-wealth': 'Starts born into delta-newcomers (initial cash 20-80 dr, initial net worth 207-417 dr).',
      ordinary: 'All other household starting origins (tenant-farming, soldier, artisan, estate, and royal households).',
    },
    balanceTarget: { bandPercent: [45, 65], note: 'Authored design target for birth-cohort completion to depth 10; measured rates describe simulation behavior under the disclosed policy, not guaranteed player outcomes.' },
    cohortSizePerTarget: count,
    seeds: `skill-focus-0 … skill-focus-${count - 1}`,
    results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const world = JSON.parse(await readFile(new URL('../../worlds/demo/alexandria-lives-8.json', import.meta.url), 'utf8'));
  const count = Math.min(1000, Math.max(1, Number(process.argv[2] ?? 100)));
  const targets = process.argv[3] ? process.argv[3].split(',') : FOCUSED_TARGETS;
  const report = buildCohortReport(world, { count, targets, includeLives: Boolean(process.argv[4]) });
  for (const row of report.results) console.log(JSON.stringify(row));
  if (process.argv[4]) await writeFile(process.argv[4], `${JSON.stringify(report, null, 2)}\n`);
}
