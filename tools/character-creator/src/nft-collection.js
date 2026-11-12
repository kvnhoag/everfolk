import { DEFAULT, figurePreset, normalize } from './data.js';
import { FIGURE_DESIGN } from './historical-frame.js';

// Visual art direction only. Supply, actions and descriptions are joined from
// the actual chain catalog by build-collection.mjs, never invented here.
const profile = overrides => normalize({...DEFAULT, marks:'none', finish:'classic', birthplace:'alexandria', ...overrides});
export const NFT_PROFILES = [
 {id:'alexander',kind:'figure',accent:'#c39b59',motif:'spear',state:profile({...figurePreset('alexander'),name:'Alexander',story:'Royal commander: levy the city, or found and build.'})},
 {id:'aristotle',kind:'figure',accent:'#b3694c',motif:'scroll',state:profile({name:'Aristotle',presentation:'masculine',skin:'sand',face:'oval',build:'slim',hair:'wavy',hairColor:'brown',beard:'scholar',eyes:'relaxed',nose:'straight',expression:'calm',role:'philosopher',outfit:'himation',cloth:'terracotta',prop:'scroll',jewelry:'none',finish:'aurum',backdrop:'palace',trait:'curious',story:'A philosopher and teacher: found the Lyceum, or tutor the court.'})},
 {id:'euclid',kind:'figure',accent:'#95b8a3',motif:'geometry',state:profile({...figurePreset('euclid'),story:'A geometer of Alexandria: open a school, or keep to the Museum.'})},
 {id:'cleomenes',kind:'figure',accent:'#d6aa52',motif:'grain',state:profile({name:'Cleomenes',presentation:'masculine',skin:'honey',face:'square',build:'soft',hair:'short',hairColor:'ink',beard:'trimmed',brows:'thick',nose:'broad',expression:'calm',role:'grain-official',outfit:'mantle',cloth:'ochre',prop:'grain',accent:'gold',jewelry:'bracelet',finish:'aurum',backdrop:'palace',trait:'strategic',birthplace:'rhakotis',story:'A grain administrator: corner the grain, or fill the granaries.'})},
 {id:'letters',kind:'npc',accent:'#7f9364',motif:'scroll',state:profile({name:'The Scholar',presentation:'feminine',skin:'copper',face:'oval',build:'slim',hair:'bun',hairColor:'ink',expression:'curious',role:'scribe',outfit:'tunic',cloth:'sage',prop:'scroll',jewelry:'amulet',trait:'patient',story:'Teach the young and lend books to those who want to learn.'})},
 {id:'military',kind:'npc',accent:'#b3694c',motif:'spear',state:profile({name:'The Veteran',presentation:'masculine',skin:'clay',face:'square',build:'sturdy',hair:'short',hairColor:'brown',beard:'trimmed',marks:'scar',brows:'thick',expression:'determined',role:'soldier',outfit:'tunic',cloth:'terracotta',prop:'spear',jewelry:'none',footwear:'boots',birthplace:'rhakotis',trait:'brave',story:'Mentor a recruit or warn a household that the levy is coming.'})},
 {id:'commerce',kind:'npc',accent:'#c39b59',motif:'bag',state:profile({name:'The Trader',presentation:'feminine',skin:'umber',face:'round',build:'soft',hair:'braids',hairColor:'ink',expression:'smile',role:'merchant',outfit:'mantle',cloth:'ochre',prop:'bag',jewelry:'bracelet',accent:'gold',birthplace:'rhakotis',trait:'kind',story:'Extend credit or hire someone for paid work on the quays.'})},
 {id:'craft',kind:'npc',accent:'#d99166',motif:'pot',state:profile({name:'The Craftworker',presentation:'masculine',skin:'date',face:'round',build:'sturdy',hair:'curly',hairColor:'ink',expression:'smile',role:'potter',outfit:'wrap',cloth:'terracotta',prop:'pot',jewelry:'none',trait:'patient',birthplace:'memphis',story:'Take an apprentice and share the proceeds of a paid commission.'})},
 {id:'sky',kind:'npc',accent:'#608b85',motif:'divider',state:profile({name:'The Stargazer',presentation:'feminine',skin:'ebony',face:'oval',build:'slim',height:'tall',hair:'braids',hairColor:'silver',expression:'calm',role:'stargazer',outfit:'himation',cloth:'river',prop:'divider',jewelry:'amulet',accent:'turquoise',backdrop:'local',trait:'quiet',story:'Read a favourable omen or warn the household of a difficult year.'})},
 {id:'farming',kind:'npc',accent:'#7f9364',motif:'hoe',state:profile({name:'The Farmer',presentation:'masculine',skin:'copper',face:'square',build:'sturdy',hair:'short',hairColor:'brown',beard:'trimmed',role:'farmer',outfit:'wrap',cloth:'linen',prop:'hoe',jewelry:'none',birthplace:'nile',trait:'patient',story:'Stock a granary for a household in need, or share seed for the next harvest.'})},
 {id:'performance',kind:'npc',accent:'#b4c494',motif:'sistrum',state:profile({name:'The Performer',presentation:'neutral',skin:'honey',face:'round',build:'average',hair:'wavy',hairColor:'chestnut',expression:'smile',role:'musician',outfit:'dress',cloth:'sage',prop:'sistrum',jewelry:'beads',accent:'carnelian',birthplace:'fayum',trait:'kind',story:'Lift spirits with music and lend a hand to struggling households.'})}
];

// Face direction is authored separately from costume so identities do not
// collapse into one head with a different beard or color of clothing.
const faces={
 alexander:{face:'diamond',eyes:'almond',brows:'thick',nose:'aquiline',expression:'determined'},
 aristotle:{face:'long',eyes:'deep',brows:'arched',nose:'long',expression:'thoughtful'},
 euclid:{face:'oval',eyes:'narrow',brows:'soft',nose:'straight',expression:'calm'},
 cleomenes:{face:'heart',eyes:'deep',brows:'thick',nose:'broad',expression:'stern'},
 letters:{face:'oval',eyes:'round',brows:'arched',nose:'small',expression:'curious'},
 military:{face:'square',eyes:'narrow',brows:'thick',nose:'aquiline',expression:'stern'},
 commerce:{face:'heart',eyes:'wide',brows:'arched',nose:'broad',expression:'smile'},
 craft:{face:'round',eyes:'wide',brows:'straight',nose:'broad',expression:'smile'},
 sky:{face:'diamond',eyes:'relaxed',brows:'arched',nose:'long',expression:'thoughtful'},
 farming:{face:'square',eyes:'relaxed',brows:'straight',nose:'broad',expression:'calm'},
 performance:{face:'long',eyes:'round',brows:'soft',nose:'small',expression:'smile'}
};
for(const entry of NFT_PROFILES){
 const historical=entry.kind==='figure'?FIGURE_DESIGN[entry.id]:null;
 entry.state=profile({...entry.state,...faces[entry.id],figure:historical?entry.id:'none',...(historical?{backdrop:historical.scene}:{})});
 entry.frame=historical?.frame??'citizen';
}
