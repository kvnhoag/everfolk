import { drawHistoricalLifeStage } from './historical-stages.js';

const SCENE_FIGURES={
 'alexander-city':'alexander',
 'aristotle-lyceum':'aristotle',
 'euclid-museum':'euclid',
 'cleomenes-granary':'cleomenes'
};

/** Each historical backdrop advances through five distinct career settings. */
export function drawHistoricalScene(paint,scene,rarity=0){
 const figure=SCENE_FIGURES[scene];
 return figure?drawHistoricalLifeStage(paint,figure,rarity):false;
}
