/** The life path as the player sees it: stage, district, trades in demand, pull toward a field, people met, past stages. */
import { affinityView, fieldNeedsView, lifeStageView, stageRecordsView } from "../../src/index.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";

export interface LifePathNeed { title: string; label: "scarce" | "crowded"; pay: string; reason: string }
export interface LifePathAffinity { title: string; value: number; sources: string[] }
export interface LifePathRecord { stage: string; title: string; ages: string; district: string }
export interface LifePathModel {
  stage: { title: string } | null;
  home: string; current: string; away: boolean;
  needs: LifePathNeed[];
  affinities: LifePathAffinity[];
  /** What the journal says of the people met, newest first. Nobody unmet is listed. */
  people: string[];
  records: LifePathRecord[];
}

const MAX_PEOPLE = 5, MAX_AFFINITIES = 3, MAX_SOURCES = 3;

/** Read-only; null in worlds without life paths. */
export function lifePathModel(world: WorldPack, life: LifeState): LifePathModel | null {
  if (!world.paths || !life.paths) return null;
  const districts = world.paths.districts, stage = lifeStageView(world, life.age);
  const titleOf = (id: string) => districts[id]?.title ?? id;
  return {
    stage: stage ? { title: stage.title } : null,
    home: titleOf(life.paths.home), current: titleOf(life.paths.district), away: life.paths.home !== life.paths.district,
    needs: fieldNeedsView(world, life).flatMap(need => need.label === "steady" ? [] :
      [{ title: need.title, label: need.label, pay: `${(need.needBps / 10_000).toFixed(1)}×`, reason: need.reason }]),
    affinities: affinityView(world, life).filter(entry => entry.affinity > 0).slice(0, MAX_AFFINITIES)
      .map(entry => ({ title: entry.title, value: entry.affinity, sources: entry.sources.slice(-MAX_SOURCES) })),
    people: life.journal.filter(entry => entry.id.startsWith("paths-meet-")).map(entry => entry.text).reverse().slice(0, MAX_PEOPLE),
    records: stageRecordsView(world, life).map(record => ({
      stage: world.lifeStages?.stages.find(item => item.id === record.stageId)?.title ?? record.stageId,
      title: record.title, ages: `${record.fromAge}–${record.toAge}`, district: titleOf(record.district),
    })),
  };
}
