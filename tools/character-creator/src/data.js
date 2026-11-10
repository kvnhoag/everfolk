import { FIGURE_DESIGN } from './historical-frame.js';
export const SKINS = [
  {id:'sand',name:'Cát ấm',colors:['#8b5846','#ca9167','#efc497']},
  {id:'honey',name:'Mật ong',colors:['#80503f','#bb8257','#e4b180']},
  {id:'copper',name:'Đồng ấm',colors:['#734538','#a86b46','#d49665']},
  {id:'clay',name:'Đất nung',colors:['#623c35','#925737','#bd8254']},
  {id:'umber',name:'Nâu đất',colors:['#4f3432','#77462f','#a36e49']},
  {id:'date',name:'Chà là',colors:['#3f2c30','#603b2c','#895a3d']},
  {id:'ebony',name:'Nâu sâu',colors:['#30252b','#4b3029','#704b36']}
];
export const CLOTH = [
  {id:'linen',name:'Lanh ngà',colors:['#958467','#d8c8a0','#f4e8c6']},
  {id:'sage',name:'Lá ô liu',colors:['#4c5d49','#7f9364','#b4c494']},
  {id:'terracotta',name:'Đất đỏ',colors:['#80463d','#b3694c','#d99166']},
  {id:'river',name:'Xanh sông',colors:['#395756','#608b85','#95b8a3']},
  {id:'ochre',name:'Vàng đất',colors:['#8b633b','#c39b59','#e8c985']}
];
export const HAIR = [
  {id:'ink',name:'Đen ấm',colors:['#29252a','#3e2e2b','#634532']},
  {id:'brown',name:'Nâu sẫm',colors:['#39292a','#654331','#916441']},
  {id:'chestnut',name:'Nâu hạt',colors:['#51332d','#895538','#bc8150']},
  {id:'flax',name:'Vàng mật',colors:['#695140','#b18a4e','#dfc899']},
  {id:'silver',name:'Muối tiêu',colors:['#595951','#8e9080','#c6c5ad']}
];
export const ACCENTS = [{id:'turquoise',name:'Xanh faience',colors:['#38665e','#6caaa0','#b0d3bb']},{id:'gold',name:'Vàng',colors:['#8b5d35','#d6aa52','#f1d889']},{id:'carnelian',name:'Đỏ carnelian',colors:['#6d3939','#ad5743','#d78c5b']}];
export const ROLES = [
 {id:'gardener',name:'Người làm vườn',short:'Làm vườn',icon:'sprout',nv:'NV01 / NV02',ng:'NG01',outfit:'wrap',prop:'hoe',jewelry:'amulet',description:'Mang theo chút kiên nhẫn, trồng những điều nhỏ bé bên sông.',codes:'TP01/03 · TS01 · DC01',hair:'short'},
 {id:'potter',name:'Thợ gốm',short:'Thợ gốm',icon:'pot',nv:'NV09',ng:'NG07',outfit:'tunic',prop:'pot',jewelry:'none',description:'Biến một nắm đất thành chiếc bình đầy những câu chuyện.',codes:'TP05 · TS00 · DC10/25',hair:'bun'},
 {id:'scribe',name:'Người chép chữ',short:'Chép chữ',icon:'scroll',nv:'NV16',ng:'NG14',outfit:'tunic',prop:'scroll',jewelry:'amulet',description:'Gói những câu chuyện dài vào từng hàng chữ nhỏ.',codes:'TP02/05 · TS01 · DC44/45',hair:'short'},
 {id:'merchant',name:'Người buôn hàng',short:'Buôn hàng',icon:'bag',nv:'NV18',ng:'NG15',outfit:'mantle',prop:'bag',jewelry:'bracelet',description:'Luôn có một món hay và một lời chào dành cho người mới.',codes:'TP06/07 · TS06 · DC07/51',hair:'wavy'},
 {id:'fisher',name:'Người đánh cá',short:'Đánh cá',icon:'fish',nv:'NV04',ng:'NG05',outfit:'wrap',prop:'net',jewelry:'none',description:'Đọc con nước, ngắm mây trôi và chờ một mẻ cá vui.',codes:'TP01 · TS00 · DC20',hair:'short'},
 {id:'musician',name:'Người chơi nhạc',short:'Chơi nhạc',icon:'music',nv:'NV23',ng:'NG18',outfit:'dress',prop:'sistrum',jewelry:'beads',description:'Giữ một nhịp vui cho những ngày lễ bên dòng sông.',codes:'TP04 · TS03 · DC61',hair:'braids'},
 {id:'commander',name:'Người chỉ huy Macedonia',short:'Chỉ huy',icon:'spear',nv:'NV27 · biến thể chỉ huy',ng:'Hy Lạp–Macedonia',outfit:'linothorax',prop:'spear',jewelry:'fibula',description:'Quan sát địa hình và dẫn đoàn qua những vùng đất mới.',codes:'TP06/16 · giáp lanh cách điệu · giáo',hair:'anastole'},
 {id:'geometer',name:'Nhà hình học',short:'Hình học',icon:'geometry',nv:'NV16 · biến thể học giả',ng:'Alexandria đầu thời Ptolemaios',outfit:'himation',prop:'geometry',jewelry:'none',description:'Tìm một lời chứng minh rõ ràng từ những hình vẽ đơn giản.',codes:'TP06/07 · DC44/45 · hình học cách điệu',hair:'curly'}
];
ROLES.push(
 {id:'philosopher',name:'Nhà triết học',short:'Triết học',icon:'scroll',nv:'NFT / Aristotle',ng:'Lyceum & triều đình',outfit:'himation',prop:'scroll',jewelry:'none',description:'Dạy lập luận, đọc và thảo luận những bản ghi bài giảng.',codes:'NFT letters · philosophy',hair:'wavy'},
 {id:'grain-official',name:'Quan quản lý lương thực',short:'Lương thực',icon:'bag',nv:'NFT / Cleomenes',ng:'Naucratis & Alexandria',outfit:'mantle',prop:'grain',jewelry:'bracelet',description:'Quản lý sổ sách, thương mại và các kho lương.',codes:'NFT commerce · grain',hair:'short'},
 {id:'soldier',name:'Người lính',short:'Quân đội',icon:'spear',nv:'NFT / military',ng:'Alexandria',outfit:'tunic',prop:'spear',jewelry:'none',description:'Một cựu binh hướng dẫn tân binh và báo trước đợt tuyển quân.',codes:'NFT military · war',hair:'short'},
 {id:'stargazer',name:'Người quan sát bầu trời',short:'Thiên văn',icon:'geometry',nv:'NFT / sky',ng:'Alexandria',outfit:'himation',prop:'divider',jewelry:'amulet',description:'Đọc các dấu hiệu trên trời và cảnh báo một năm khó khăn.',codes:'NFT sky · fate',hair:'braids'}
);
export const OPTIONS = {
 finish:[['classic','Mộc mạc'],['aurum','Vàng hoàng gia'],['prism','Ngọc ánh kim']],
 backdrop:[['local','Phong cảnh địa phương'],['palace','Cung điện hoàng hôn'],['observatory','Sân thiên văn đêm'],['alexander-city','Alexander · thành phố đang dựng'],['aristotle-lyceum','Aristotle · vườn Lyceum'],['euclid-museum','Euclid · sân hình học'],['cleomenes-granary','Cleomenes · bến kho lương']],
 figure:[['none','Nhân vật thường'],['alexander','Alexander'],['aristotle','Aristotle'],['euclid','Euclid'],['cleomenes','Cleomenes']],
 presentation:[['neutral','Tự nhiên'],['masculine','Nam tính'],['feminine','Nữ tính']],
 build:[['slim','Mảnh'],['average','Vừa vặn'],['sturdy','Chắc khỏe'],['soft','Đầy đặn']],
 height:[['short','Nhỏ nhắn'],['medium','Vừa'],['tall','Cao']],
 face:[['round','Tròn'],['oval','Trái xoan'],['square','Góc cạnh'],['long','Mặt dài'],['heart','Trái tim'],['diamond','Gò má rõ']],
 hair:[['short','Tóc ngắn'],['wavy','Tóc gợn'],['bun','Búi gọn'],['braids','Tóc tết'],['shaved','Cạo sát'],['anastole','Tóc hất trán'],['curly','Tóc xoăn ngắn']],
 beard:[['none','Không râu'],['trimmed','Râu gọn'],['scholar','Râu học giả']],
 eyes:[['almond','Hạnh nhân'],['round','Tròn'],['relaxed','Dịu'],['deep','Mắt sâu'],['narrow','Mắt hẹp'],['wide','Mắt mở lớn']],
 brows:[['soft','Mềm'],['straight','Thẳng'],['thick','Đậm'],['arched','Cong cao']],
 nose:[['small','Nhỏ'],['straight','Thẳng'],['broad','Rộng'],['aquiline','Sống mũi cong'],['long','Mũi dài']],
 expression:[['smile','Mỉm cười'],['calm','Bình thản'],['curious','Tò mò'],['determined','Quyết tâm'],['thoughtful','Trầm tư'],['stern','Nghiêm nghị']],
 marks:[['none','Không'],['freckles','Tàn nhang'],['scar','Sẹo nhỏ']],
 outfit:[['wrap','Váy quấn'],['tunic','Áo lanh'],['dress','Áo dài'],['mantle','Áo choàng'],['linothorax','Giáp lanh & chlamys'],['himation','Áo khoác himation']],
 jewelry:[['none','Không đeo'],['amulet','Bùa nhỏ'],['beads','Chuỗi hạt'],['bracelet','Vòng tay'],['earrings','Khuyên tai'],['fibula','Trâm cài áo choàng']],
 footwear:[['sandals','Dép da'],['bare','Chân trần'],['boots','Ủng da ngắn']],
 prop:[['hoe','Cuốc'],['pot','Bình gốm'],['scroll','Cuộn chữ'],['bag','Túi hàng'],['net','Lưới cá'],['sistrum','Nhạc lắc'],['none','Tay không'],['spear','Giáo Macedonia'],['geometry','Bộ hình học'],['divider','Compa đo']],
 trait:[['curious','Tò mò'],['kind','Ấm áp'],['brave','Can đảm'],['quiet','Trầm lặng'],['strategic','Có tầm nhìn'],['patient','Kiên nhẫn']],
 birthplace:[['nile','Bến sông Nile'],['memphis','Phố nhỏ Memphis'],['fayum','Vườn xanh Fayum'],['rhakotis','Bờ biển Rhakotis'],['pella','Pella, Macedonia'],['alexandria','Alexandria']]
};
export const DEFAULT = {version:1,finish:'classic',backdrop:'local',name:'Neri',presentation:'neutral',build:'average',height:'medium',skin:'copper',face:'round',hair:'wavy',hairColor:'ink',eyes:'almond',brows:'soft',nose:'small',expression:'smile',marks:'freckles',beard:'none',role:'gardener',outfit:'tunic',cloth:'linen',accent:'turquoise',jewelry:'amulet',footwear:'sandals',prop:'hoe',trait:'curious',birthplace:'nile',story:'Muốn trồng một khu vườn nhỏ để ai đi ngang cũng có chỗ nghỉ chân.'};
OPTIONS.prop.push(['grain','Bao lúa & bông lúa']);
DEFAULT.figure='none';
export const FIGURE_PRESETS = [
 {id:'alexander',name:'Alexander Đại đế',period:'356–323 TCN',note:'Diện mạo cách điệu, lấy cảm hứng từ hình tượng tóc hất trán và trang phục Macedonia.',source:'https://artmuseum.princeton.edu/art/collections/objects/55773',state:{...DEFAULT,name:'Alexander Đại đế',finish:'aurum',backdrop:'palace',presentation:'masculine',build:'sturdy',height:'medium',skin:'sand',face:'oval',hair:'anastole',hairColor:'flax',beard:'none',eyes:'almond',brows:'thick',nose:'straight',expression:'determined',marks:'none',role:'commander',outfit:'linothorax',cloth:'sage',accent:'gold',jewelry:'fibula',footwear:'boots',prop:'spear',trait:'strategic',birthplace:'pella',story:'Vua Macedonia, đến Ai Cập năm 332 TCN. Một nhân vật cách điệu với áo giáp lanh và áo choàng chlamys.'}},
 {id:'euclid',name:'Euclid',period:'Hoạt động khoảng 300 TCN',note:'Không biết chắc diện mạo và nơi sinh của Euclid. Râu, tóc và áo là lựa chọn tạo hình; Alexandria là nơi ông làm việc.',source:'https://mathshistory.st-andrews.ac.uk/Biographies/Euclid/',state:{...DEFAULT,name:'Euclid',finish:'prism',backdrop:'observatory',presentation:'masculine',build:'average',height:'medium',skin:'honey',face:'round',hair:'curly',hairColor:'silver',beard:'scholar',eyes:'relaxed',brows:'soft',nose:'straight',expression:'calm',marks:'none',role:'geometer',outfit:'himation',cloth:'river',accent:'gold',jewelry:'none',footwear:'sandals',prop:'geometry',trait:'patient',birthplace:'alexandria',story:'Nhà toán học gắn với Alexandria khoảng 300 TCN và bộ Cơ sở. Thích tìm lời chứng minh mạch lạc từ những hình vẽ đơn giản.'}}
];
for(const preset of FIGURE_PRESETS){preset.state.figure=preset.id;preset.state.backdrop=FIGURE_DESIGN[preset.id].scene;}
export function figurePreset(id) {
 const preset=FIGURE_PRESETS.find(item=>item.id===id);
 if(!preset) throw new Error('Mẫu nhân vật không tồn tại.');
 return normalize(preset.state);
}
export const GROUPS = {body:['presentation','build','height','skin'],face:['face','eyes','brows','nose','expression','marks','hair','hairColor','beard'],outfit:['outfit','cloth','jewelry','accent','footwear','finish'],story:['role','trait','birthplace','prop','name','story','backdrop']};
export const PALETTE_CORE = ['#29252a','#493d34','#695140','#9b7852','#c7a66c','#dfc899','#958467','#d8c8a0','#f4e8c6','#fff5d8','#4c5d49','#7f9364','#b4c494','#395756','#608b85','#95b8a3','#38665e','#6caaa0','#b0d3bb','#80463d','#b3694c','#d99166','#8b5d35','#d6aa52','#f1d889','#754335','#efc497'];
export const label = (key,value) => OPTIONS[key]?.find(x=>x[0]===value)?.[1] || value;
export const roleOf = state => ROLES.find(x=>x.id===state.role) || ROLES[0];
GROUPS.story.push('figure');
export function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Hồ sơ cần là một đối tượng JSON.');
  if (input.version != null && input.version !== 1) throw new Error('Phiên bản hồ sơ chưa được hỗ trợ.');
  const state = {...DEFAULT};
  const lists = {skin:SKINS,hairColor:HAIR,cloth:CLOTH,accent:ACCENTS,role:ROLES};
  for (const key of Object.keys(DEFAULT)) {
    if (key==='name' || key==='story') { if (typeof input[key]==='string') state[key]=input[key].trim().slice(0,key==='name'?24:180); }
    else if (OPTIONS[key]?.some(x=>x[0]===input[key]) || lists[key]?.some(x=>x.id===input[key])) state[key]=input[key];
  }
  state.name = state.name || 'Người bạn mới';
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
export function promptFor(s) { const role=roleOf(s); return `Thiết kế nhân vật game 2D pixel art: ${s.name}, ${role.name.toLowerCase()}, ${s.role==='commander'?'Bối cảnh Hy Lạp–Macedonia và Ai Cập cuối thế kỷ IV TCN':s.role==='geometer'?'Alexandria khoảng 300 TCN, đầu thời Ptolemaios':'Ai Cập khoảng 270 TCN, đầu thời Ptolemaios'}. Phong cách ấm áp, dễ thương, hoài cổ; cơ thể cách điệu khoảng 4 đầu, sprite gốc 64×96 pixel. Dáng ${label('build',s.build).toLowerCase()}, chiều cao ${label('height',s.height).toLowerCase()}, thể hiện ${label('presentation',s.presentation).toLowerCase()}; da ${SKINS.find(x=>x.id===s.skin).name.toLowerCase()}, tóc ${label('hair',s.hair).toLowerCase()} màu ${HAIR.find(x=>x.id===s.hairColor).name.toLowerCase()}. Râu: ${label('beard',s.beard).toLowerCase()}. Mặt ${label('face',s.face).toLowerCase()}, mắt ${label('eyes',s.eyes).toLowerCase()}, mày ${label('brows',s.brows).toLowerCase()}, mũi ${label('nose',s.nose).toLowerCase()}, biểu cảm ${label('expression',s.expression).toLowerCase()}, dấu riêng: ${label('marks',s.marks)}. Mặc ${label('outfit',s.outfit).toLowerCase()} màu ${CLOTH.find(x=>x.id===s.cloth).name.toLowerCase()}, ${label('jewelry',s.jewelry).toLowerCase()}, ${label('footwear',s.footwear).toLowerCase()}, cầm ${label('prop',s.prop).toLowerCase()}. Tính cách ${label('trait',s.trait).toLowerCase()}; nơi gắn bó: ${label('birthplace',s.birthplace)}. ${s.story} Hoàn thiện ${label('finish',s.finish)}; phiên bản thẻ dùng phông ${label('backdrop',s.backdrop)}. Ưu tiên hình bóng rõ, khe tay–thân, tay cầm hợp lý, hạn chế chi tiết, viền nâu đen, mảng màu gọn, nắng ấm trên trái và bóng dịu. Mỗi góc là cùng một người và cùng trang phục. Không chi tiết hiện đại, không trang bị La Mã muộn, không nhòe pixel. Tham chiếu vai trò ${role.nv}, ${role.ng}; tổ hợp hiện tại là phục dựng cách điệu. Xuất nền trong suốt, góc trước/nghiêng/sau, tách đạo cụ; đưa ảnh tham chiếu kèm prompt để giữ diện mạo.`; }
