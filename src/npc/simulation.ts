import {createEngine} from '../engine.ts';
import type {LifeEngine,LifeState,WorldPack} from '../types.ts';
import type {NpcSessionState,NpcSessionCommand,PlayerCommand} from './types.ts';
import {sessionCommand,NpcInputError} from './validation.ts';
import {createNpcState,stepLegacyNpcSimulation,freeze} from './runtime.ts';
export {availableNpcActions,observeNpc,resources,rulesDecision,isHouseholdNpc,freeze} from './runtime.ts';

export function npcStateFromLife(player:LifeState,commands:NpcSessionCommand[]=[]):NpcSessionState {
  if(!player.npcs)throw new NpcInputError('This life has no core NPCs.');
  return freeze({...player.npcs,player,commands});
}
export function createNpcSimulation(world:WorldPack,seed:string):NpcSessionState {
 const player=createEngine(world).start(seed);
 return player.npcs?npcStateFromLife(player):createNpcState(world,seed,player);
}
export function runPlayerCommand(engine:LifeEngine,life:LifeState,command:PlayerCommand):LifeState {
 switch(command.type){
  case 'advance':return engine.advance(life);
  case 'choose':return engine.choose(life,command.choice);
  case 'act':return engine.act(life,command.activity,command.calendarDeadline?{calendarDeadline:true}:undefined);
  case 'assess-jobs':return engine.assess(life,command.nodeId,command.jobIds);
  case 'avatar':return engine.chooseAvatar(life,command.variant);
  case 'market-order':return engine.orderMarket(life,command);
  case 'market-cancel':return engine.cancelMarketOrder(life,command.orderId);
  default:return engine.demo(life,command);
 }
}
export function stepNpcSimulation(engine:LifeEngine,input:NpcSessionState,raw:unknown):NpcSessionState {
 if(!engine.world.npcAgents)return stepLegacyNpcSimulation(engine,input,raw);
 const command=sessionCommand(raw);
 const next=command.type==='player'?runPlayerCommand(engine,input.player,command.command):engine.npc(input.player,
  command.type==='resolve'?{type:'npc-turn',decisions:command.decisions}:
  command.type==='answer'?{type:'npc-answer',offerId:command.offerId,accept:command.accept}:
  {type:'npc-speech',npcId:command.npcId,text:command.text,reply:command.reply});
 return npcStateFromLife(next,[...input.commands,command]);
}
export function replayNpcSimulation(world:WorldPack,seed:string,commands:readonly NpcSessionCommand[]):NpcSessionState {
 if(!Array.isArray(commands)||commands.length>10000)throw new NpcInputError('Invalid session log.');
 const engine=createEngine(world);let state=createNpcSimulation(world,seed);
 for(const command of commands)state=stepNpcSimulation(engine,state,command);
 return state;
}
