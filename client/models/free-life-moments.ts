import { matchStageFigure } from "../../chain/stage-figures.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";

export interface LifeMomentCard {
  stageId: string;
  stageTitle: string;
  ages: string;
  title: string;
  media: string;
  historical: boolean;
}

function stageLabel(stageId: string): string {
  const words = stageId.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The moments a free life could have kept: one portrait per lived stage, matched like a Weave album. */
export function freeLifeMoments(life: LifeState, world: WorldPack): LifeMomentCard[] {
  return (life.stageRecords ?? []).map(record => {
    const figure = matchStageFigure(record, {
      characterName: life.character?.name, name: life.character?.name, originId: life.originId,
      sex: life.character?.sex, avatarVariant: life.character?.avatarVariant, seed: life.seed,
      worldVersion: world.version, stats: { ...life.stats },
    });
    return {
      stageId: record.stageId, stageTitle: stageLabel(record.stageId), ages: `Ages ${record.fromAge}–${record.toAge}`,
      title: figure.kind === "historical" ? figure.title : record.title, media: figure.media, historical: figure.kind === "historical",
    };
  });
}
