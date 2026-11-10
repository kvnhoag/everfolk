import { FIGURE_DESIGN } from './historical-frame.js';
export const SKINS = [
  {id:'sand',name:'Warm sand',colors:['#8b5846','#ca9167','#efc497']},
  {id:'honey',name:'Honey',colors:['#80503f','#bb8257','#e4b180']},
  {id:'copper',name:'Warm copper',colors:['#734538','#a86b46','#d49665']},
  {id:'clay',name:'Clay',colors:['#623c35','#925737','#bd8254']},
  {id:'umber',name:'Umber',colors:['#4f3432','#77462f','#a36e49']},
  {id:'date',name:'Date brown',colors:['#3f2c30','#603b2c','#895a3d']},
  {id:'ebony',name:'Deep brown',colors:['#30252b','#4b3029','#704b36']}
];
export const CLOTH = [
  {id:'linen',name:'Ivory linen',colors:['#958467','#d8c8a0','#f4e8c6']},
  {id:'sage',name:'Olive sage',colors:['#4c5d49','#7f9364','#b4c494']},
  {id:'terracotta',name:'Terracotta',colors:['#80463d','#b3694c','#d99166']},
  {id:'river',name:'River blue',colors:['#395756','#608b85','#95b8a3']},
  {id:'ochre',name:'Ochre',colors:['#8b633b','#c39b59','#e8c985']}
];
export const HAIR = [
  {id:'ink',name:'Warm black',colors:['#29252a','#3e2e2b','#634532']},
  {id:'brown',name:'Dark brown',colors:['#39292a','#654331','#916441']},
  {id:'chestnut',name:'Chestnut',colors:['#51332d','#895538','#bc8150']},
  {id:'flax',name:'Flax gold',colors:['#695140','#b18a4e','#dfc899']},
  {id:'silver',name:'Salt and pepper',colors:['#595951','#8e9080','#c6c5ad']}
];
export const ACCENTS = [{id:'turquoise',name:'Faience turquoise',colors:['#38665e','#6caaa0','#b0d3bb']},{id:'gold',name:'Gold',colors:['#8b5d35','#d6aa52','#f1d889']},{id:'carnelian',name:'Carnelian red',colors:['#6d3939','#ad5743','#d78c5b']}];
export const ROLES = [
 {id:'gardener',name:'Gardener',short:'Gardening',icon:'sprout',nv:'NV01 / NV02',ng:'NG01',outfit:'wrap',prop:'hoe',jewelry:'amulet',description:'With patience, grow small wonders beside the river.',codes:'TP01/03 · TS01 · DC01',hair:'short'},
 {id:'potter',name:'Potter',short:'Potter',icon:'pot',nv:'NV09',ng:'NG07',outfit:'tunic',prop:'pot',jewelry:'none',description:'Turn a handful of clay into a vessel full of stories.',codes:'TP05 · TS00 · DC10/25',hair:'bun'},
 {id:'scribe',name:'Scribe',short:'Writing',icon:'scroll',nv:'NV16',ng:'NG14',outfit:'tunic',prop:'scroll',jewelry:'amulet',description:'Keep long stories alive in neat lines of writing.',codes:'TP02/05 · TS01 · DC44/45',hair:'short'},
 {id:'merchant',name:'Trader',short:'Trading',icon:'bag',nv:'NV18',ng:'NG15',outfit:'mantle',prop:'bag',jewelry:'bracelet',description:'Always ready with an interesting find and a friendly greeting.',codes:'TP06/07 · TS06 · DC07/51',hair:'wavy'},
 {id:'fisher',name:'Fisher',short:'Fishing',icon:'fish',nv:'NV04',ng:'NG05',outfit:'wrap',prop:'net',jewelry:'none',description:'Read the tides, watch the clouds and wait for a good catch.',codes:'TP01 · TS00 · DC20',hair:'short'},
 {id:'musician',name:'Musician',short:'Music',icon:'music',nv:'NV23',ng:'NG18',outfit:'dress',prop:'sistrum',jewelry:'beads',description:'Keep a joyful rhythm for celebrations beside the river.',codes:'TP04 · TS03 · DC61',hair:'braids'},
 {id:'commander',name:'Macedonian commander',short:'Command',icon:'spear',nv:'NV27 · commander variant',ng:'Greek–Macedonian',outfit:'linothorax',prop:'spear',jewelry:'fibula',description:'Read the terrain and lead the company through new lands.',codes:'TP06/16 · stylized linen armor · spear',hair:'anastole'},
 {id:'geometer',name:'Geometer',short:'Geometry',icon:'geometry',nv:'NV16 · scholar variant',ng:'Early Ptolemaic Alexandria',outfit:'himation',prop:'geometry',jewelry:'none',description:'Find a clear proof in a set of simple geometric figures.',codes:'TP06/07 · DC44/45 · stylized geometry',hair:'curly'}
];
ROLES.push(
 {id:'philosopher',name:'Philosopher',short:'Philosophy',icon:'scroll',nv:'NFT / Aristotle',ng:'Lyceum & court',outfit:'himation',prop:'scroll',jewelry:'none',description:'Teach argument, read and discuss notes from lectures.',codes:'NFT letters · philosophy',hair:'wavy'},
 {id:'grain-official',name:'Grain administrator',short:'Grain',icon:'bag',nv:'NFT / Cleomenes',ng:'Naucratis & Alexandria',outfit:'mantle',prop:'grain',jewelry:'bracelet',description:'Manage accounts, trade and the grain stores.',codes:'NFT commerce · grain',hair:'short'},
 {id:'soldier',name:'Soldier',short:'Military',icon:'spear',nv:'NFT / military',ng:'Alexandria',outfit:'tunic',prop:'spear',jewelry:'none',description:'A veteran who mentors recruits and warns of the next levy.',codes:'NFT military · war',hair:'short'},
 {id:'stargazer',name:'Stargazer',short:'Astronomy',icon:'geometry',nv:'NFT / sky',ng:'Alexandria',outfit:'himation',prop:'divider',jewelry:'amulet',description:'Read signs in the sky and warn of a difficult year.',codes:'NFT sky · fate',hair:'braids'}
);
export const OPTIONS = {
 finish:[['classic','Classic'],['aurum','Royal gold'],['prism','Iridescent jade']],
 backdrop:[['local','Local landscape'],['palace','Sunset palace'],['observatory','Night observatory'],['alexander-city','Alexander · city under construction'],['aristotle-lyceum','Aristotle · Lyceum garden'],['euclid-museum','Euclid · geometry courtyard'],['cleomenes-granary','Cleomenes · granary quay']],
 figure:[['none','Ordinary character'],['alexander','Alexander'],['aristotle','Aristotle'],['euclid','Euclid'],['cleomenes','Cleomenes']],
 presentation:[['neutral','Neutral'],['masculine','Masculine'],['feminine','Feminine']],
 build:[['slim','Slim'],['average','Average'],['sturdy','Sturdy'],['soft','Soft']],
 height:[['short','Short'],['medium','Medium'],['tall','Tall']],
 face:[['round','Round'],['oval','Oval'],['square','Square'],['long','Long'],['heart','Heart'],['diamond','Diamond']],
 hair:[['short','Short hair'],['wavy','Wavy hair'],['bun','Bun'],['braids','Braids'],['shaved','Shaved'],['anastole','Anastole'],['curly','Short curls']],
 beard:[['none','No beard'],['trimmed','Trimmed beard'],['scholar','Scholar’s beard']],
 eyes:[['almond','Almond'],['round','Round'],['relaxed','Relaxed'],['deep','Deep-set'],['narrow','Narrow'],['wide','Wide']],
 brows:[['soft','Soft'],['straight','Straight'],['thick','Thick'],['arched','Arched']],
 nose:[['small','Small'],['straight','Straight'],['broad','Broad'],['aquiline','Aquiline'],['long','Long']],
 expression:[['smile','Smile'],['calm','Calm'],['curious','Curious'],['determined','Determined'],['thoughtful','Thoughtful'],['stern','Stern']],
 marks:[['none','None'],['freckles','Freckles'],['scar','Small scar']],
 outfit:[['wrap','Wrap skirt'],['tunic','Linen tunic'],['dress','Long dress'],['mantle','Mantle'],['linothorax','Linen armor & chlamys'],['himation','Himation']],
 jewelry:[['none','None'],['amulet','Amulet'],['beads','Beads'],['bracelet','Bracelet'],['earrings','Earrings'],['fibula','Cloak fibula']],
 footwear:[['sandals','Leather sandals'],['bare','Barefoot'],['boots','Short leather boots']],
 prop:[['hoe','Hoe'],['pot','Clay pot'],['scroll','Scroll'],['bag','Trade bag'],['net','Fishing net'],['sistrum','Sistrum'],['none','No prop'],['spear','Macedonian spear'],['geometry','Geometry kit'],['divider','Dividers']],
 trait:[['curious','Curious'],['kind','Kind'],['brave','Brave'],['quiet','Quiet'],['strategic','Strategic'],['patient','Patient']],
 birthplace:[['nile','Nile landing'],['memphis','Memphis street'],['fayum','Fayum garden'],['rhakotis','Rhakotis coast'],['pella','Pella, Macedonia'],['alexandria','Alexandria']]
};
export const DEFAULT = {version:1,finish:'classic',backdrop:'local',name:'Neri',presentation:'neutral',build:'average',height:'medium',skin:'copper',face:'round',hair:'wavy',hairColor:'ink',eyes:'almond',brows:'soft',nose:'small',expression:'smile',marks:'freckles',beard:'none',role:'gardener',outfit:'tunic',cloth:'linen',accent:'turquoise',jewelry:'amulet',footwear:'sandals',prop:'hoe',trait:'curious',birthplace:'nile',story:'Dreams of growing a small garden where travelers can stop and rest.'};
OPTIONS.prop.push(['grain','Grain sack & wheat']);
DEFAULT.figure='none';
export const FIGURE_PRESETS = [
 {id:'alexander',name:'Alexander the Great',period:'356–323 BCE',note:'A stylized appearance inspired by swept-back anastole hair and Macedonian clothing.',source:'https://artmuseum.princeton.edu/art/collections/objects/55773',state:{...DEFAULT,name:'Alexander the Great',finish:'aurum',backdrop:'palace',presentation:'masculine',build:'sturdy',height:'medium',skin:'sand',face:'oval',hair:'anastole',hairColor:'flax',beard:'none',eyes:'almond',brows:'thick',nose:'straight',expression:'determined',marks:'none',role:'commander',outfit:'linothorax',cloth:'sage',accent:'gold',jewelry:'fibula',footwear:'boots',prop:'spear',trait:'strategic',birthplace:'pella',story:'King of Macedon, who reached Egypt in 332 BCE. A stylized character wearing linen armor and a chlamys cloak.'}},
 {id:'euclid',name:'Euclid',period:'Active around 300 BCE',note:'Euclid’s appearance and birthplace are uncertain. His beard, hair and clothing are artistic choices; Alexandria was his place of work.',source:'https://mathshistory.st-andrews.ac.uk/Biographies/Euclid/',state:{...DEFAULT,name:'Euclid',finish:'prism',backdrop:'observatory',presentation:'masculine',build:'average',height:'medium',skin:'honey',face:'round',hair:'curly',hairColor:'silver',beard:'scholar',eyes:'relaxed',brows:'soft',nose:'straight',expression:'calm',marks:'none',role:'geometer',outfit:'himation',cloth:'river',accent:'gold',jewelry:'none',footwear:'sandals',prop:'geometry',trait:'patient',birthplace:'alexandria',story:'A mathematician associated with Alexandria around 300 BCE and the Elements. Finds clear proofs in simple geometric figures.'}}
];
for(const preset of FIGURE_PRESETS){preset.state.figure=preset.id;preset.state.backdrop=FIGURE_DESIGN[preset.id].scene;}
export function figurePreset(id) {
 const preset=FIGURE_PRESETS.find(item=>item.id===id);
 if(!preset) throw new Error('Character preset not found.');
 return normalize(preset.state);
}
export const GROUPS = {body:['presentation','build','height','skin'],face:['face','eyes','brows','nose','expression','marks','hair','hairColor','beard'],outfit:['outfit','cloth','jewelry','accent','footwear','finish'],story:['role','trait','birthplace','prop','name','story','backdrop']};
export const PALETTE_CORE = ['#29252a','#493d34','#695140','#9b7852','#c7a66c','#dfc899','#958467','#d8c8a0','#f4e8c6','#fff5d8','#4c5d49','#7f9364','#b4c494','#395756','#608b85','#95b8a3','#38665e','#6caaa0','#b0d3bb','#80463d','#b3694c','#d99166','#8b5d35','#d6aa52','#f1d889','#754335','#efc497'];
export const label = (key,value) => OPTIONS[key]?.find(x=>x[0]===value)?.[1] || value;
export const roleOf = state => ROLES.find(x=>x.id===state.role) || ROLES[0];
GROUPS.story.push('figure');
export function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The profile must be a JSON object.');
  if (input.version != null && input.version !== 1) throw new Error('This profile version is not supported.');
  const state = {...DEFAULT};
  const lists = {skin:SKINS,hairColor:HAIR,cloth:CLOTH,accent:ACCENTS,role:ROLES};
  for (const key of Object.keys(DEFAULT)) {
    if (key==='name' || key==='story') { if (typeof input[key]==='string') state[key]=input[key].trim().slice(0,key==='name'?24:180); }
    else if (OPTIONS[key]?.some(x=>x[0]===input[key]) || lists[key]?.some(x=>x.id===input[key])) state[key]=input[key];
  }
  state.name = state.name || 'New character';
  return state;
}
export function randomState(state, locks={}, rng=Math.random) {
  const result = {...state}; const choose = arr => arr[Math.min(arr.length-1,Math.floor(rng()*arr.length))];
  const locked = key => Object.entries(GROUPS).some(([group,keys])=> locks[group] && keys.includes(key));
  for (const [key,values] of Object.entries(OPTIONS)) if(key!=='figure'&&!locked(key)) result[key]=choose(values)[0];
  for (const [key,values] of Object.entries({skin:SKINS,hairColor:HAIR,cloth:CLOTH,accent:ACCENTS,role:ROLES})) if(!locked(key)) result[key]=choose(values).id;
  if(!locks.story) { const role=roleOf(result); result.prop=role.prop; result.name=choose(['Neri','Tami','Meri','Dori','Ipi','Seni','Niko','Tia']); }
  return normalize(result);
}
export function promptFor(s) {
 const role=roleOf(s);
 const setting=s.role==='commander'?'Greek-Macedonian Egypt in the late fourth century BCE':s.role==='geometer'?'Alexandria around 300 BCE, in the early Ptolemaic period':'Egypt around 270 BCE, in the early Ptolemaic period';
 return `Design a 2D pixel art game character: ${s.name}, ${role.name.toLowerCase()}, set in ${setting}. Warm, charming, nostalgic style; stylized four-head proportions and a native 64×96 sprite. Build: ${label('build',s.build)}; height: ${label('height',s.height)}; presentation: ${label('presentation',s.presentation)}. Skin: ${SKINS.find(x=>x.id===s.skin).name}; hair: ${label('hair',s.hair)} in ${HAIR.find(x=>x.id===s.hairColor).name}. Beard: ${label('beard',s.beard)}. Face: ${label('face',s.face)}; eyes: ${label('eyes',s.eyes)}; eyebrows: ${label('brows',s.brows)}; nose: ${label('nose',s.nose)}; expression: ${label('expression',s.expression)}; marks: ${label('marks',s.marks)}. Outfit: ${label('outfit',s.outfit)} in ${CLOTH.find(x=>x.id===s.cloth).name}; jewelry: ${label('jewelry',s.jewelry)}; footwear: ${label('footwear',s.footwear)}; prop: ${label('prop',s.prop)}. Personality: ${label('trait',s.trait)}; home region: ${label('birthplace',s.birthplace)}. ${s.story} Finish: ${label('finish',s.finish)}; card backdrop: ${label('backdrop',s.backdrop)}. Prioritize a clear silhouette, visible gaps between arms and torso, a convincing grip, restrained detail, dark brown outlines, compact color clusters, warm light from the upper left and soft shadows. Keep the same identity and outfit in every view. No modern objects, late Roman equipment or blurred pixels. Role references: ${role.nv}, ${role.ng}; this design is a stylized artistic interpretation. Export transparent front, side and back views with separate props. Attach the reference PNG to preserve identity.`;
}
