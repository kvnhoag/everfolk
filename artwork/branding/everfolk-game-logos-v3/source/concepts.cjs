const p=(d,fill='accent',stroke='none',strokeWidth=0)=>({d,fill,stroke,strokeWidth,cap:'round',join:'round'});
const rule=(d,width=1.5)=>p(d,'none','accent',width);
const star=(x,y,r=12)=>p(`M${x} ${y-r}Q${x+r*.2} ${y-r*.2} ${x+r} ${y}Q${x+r*.2} ${y+r*.2} ${x} ${y+r}Q${x-r*.2} ${y+r*.2} ${x-r} ${y}Q${x-r*.2} ${y-r*.2} ${x} ${y-r}Z`);
const leaf=(x,y,s=1)=>p(`M${x} ${y}C${x-20*s} ${y-8*s} ${x-19*s} ${y-30*s} ${x+6*s} ${y-35*s}C${x+15*s} ${y-16*s} ${x+9*s} ${y-4*s} ${x} ${y}Z`);
const ref={monumental:'Civilization VII · Anno 1800',uncial:'Crusader Kings III',geometric:'Manor Lords',organic:'Old World',display:'Age of Empires IV'};
const base=(id,name,family,extra={})=>({id:String(id).padStart(2,'0'),name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),family,reference:ref[family],background:'#182c32',face:'#eee8cf',accent:'#b99559',mottoY:430,decor:[],...extra});
module.exports=[
 base(1,'Horizon Inscription','monumental',{finish:'gold',lines:[{text:'EVERFOLK',x:80,y:213,w:840,h:148,tracking:13}],mottoY:430}),
 base(2,'The Long Chronicle','monumental',{finish:'gold',lines:[{text:'EVERFOLK',x:105,y:218,w:790,h:146,tracking:7,first:1.25}],decor:[rule('M108 396H416M584 396H895'),star(500,396,10)],mottoY:447}),
 base(3,'Gilded Chapter','monumental',{finish:'pale',background:'#173f45',lines:[{text:'EVERFOLK',x:82,y:225,w:836,h:136,tracking:18,curve:-11}],decor:[star(500,170,13)],mottoY:433}),
 base(4,'A Life in Time','monumental',{finish:'gold',lines:[{text:'EVERFOLK',x:126,y:230,w:748,h:133,tracking:5,last:1.13}],decor:[rule('M126 399H874',1.4),rule('M354 411H646',.8),p('M483 162H517L500 184Z')],mottoY:454}),
 base(5,'Wayfarer Script','uncial',{lines:[{text:'Everfolk',x:93,y:199,w:814,h:168,tracking:1}],mottoY:432}),
 base(6,'Storybound','uncial',{face:'#f7e5bc',background:'#163c3d',lines:[{text:'Everfolk',x:90,y:208,w:820,h:162,tracking:-.5,first:1.08}],decor:[rule('M212 405Q352 381 476 405M524 405Q648 381 788 405',2),star(500,405,10)],mottoY:455}),
 base(7,'The Kinship Chronicle','uncial',{face:'#eee8cf',lines:[{text:'Ever',x:270,y:115,w:460,h:143,tracking:1},{text:'folk',x:283,y:272,w:434,h:144,tracking:2}],decor:[star(500,455,12)],mottoY:506}),
 base(8,'The Open Road','uncial',{background:'#f0e7d4',face:'#26464a',accent:'#a16d3c',lines:[{text:'Everfolk',x:98,y:205,w:804,h:166,tracking:2,curve:-13}],decor:[rule('M177 414Q500 443 823 414',2)],mottoY:472}),
 base(9,'Threshold','geometric',{face:'#eee9d9',background:'#242928',lines:[{text:'EVERFOLK',x:102,y:213,w:796,h:152,tracking:9}],mottoY:433}),
 base(10,'Two Lifetimes','geometric',{face:'#f1ead7',background:'#242928',lines:[{text:'EVER',x:260,y:108,w:480,h:133,tracking:8},{text:'FOLK',x:260,y:285,w:480,h:133,tracking:8}],decor:[rule('M260 263H440M560 263H740',2),p('M484 255H516L500 272Z')],mottoY:479}),
 base(11,'Branching Line','geometric',{face:'#e5ddca',background:'#19383b',lines:[{text:'EVERFOLK',x:128,y:232,w:744,h:145,tracking:2}],decor:[rule('M264 190H448L500 151L552 190H736',3),star(500,142,9)],mottoY:443}),
 base(12,'A New Threshold','geometric',{face:'#253c3d',background:'#e8e0ce',accent:'#a87643',lines:[{text:'EVERFOLK',x:124,y:240,w:752,h:137,tracking:8,first:1.25,last:1.25}],decor:[rule('M125 408H875',2),p('M488 154L500 140L512 154L500 168Z')],mottoY:455}),
 base(13,'Living Stone','organic',{face:'#e6e6cb',background:'#203d35',accent:'#c9a861',lines:[{text:'everfolk',x:80,y:177,w:840,h:190,tracking:1}],mottoY:434}),
 base(14,'Roots and Stories','organic',{face:'#ebdbaf',background:'#263b36',lines:[{text:'ever',x:262,y:82,w:476,h:168,tracking:2},{text:'folk',x:284,y:267,w:432,h:166,tracking:2}],decor:[rule('M351 466Q427 444 500 469Q573 444 649 466',2)],mottoY:518}),
 base(15,'The Turning Leaf','organic',{face:'#24464b',background:'#eee5d1',accent:'#9b753e',lines:[{text:'everfolk',x:80,y:175,w:840,h:186,tracking:2}],decor:[leaf(649,169,.7),rule('M647 176L647 165',2)],mottoY:435}),
 base(16,'Thread of a Life','organic',{face:'#ebe2c4',background:'#233e3e',lines:[{text:'everfolk',x:100,y:184,w:800,h:180,tracking:-1}],decor:[rule('M174 402Q304 424 444 402M556 402Q696 424 826 402',2),star(500,412,12)],mottoY:462}),
 base(17,'The Grand Chronicle','display',{finish:'gold',lines:[{text:'EVERFOLK',x:88,y:234,w:824,h:127,tracking:4,first:1.42,last:1.25}],decor:[rule('M94 399H429M571 399H906'),star(500,399,10)],mottoY:451}),
 base(18,'Another Age','display',{finish:'gold',lines:[{text:'EVER',x:267,y:145,w:466,h:105,tracking:12},{text:'FOLK',x:180,y:293,w:640,h:148,tracking:5}],decor:[rule('M268 271H446M554 271H732',1.5),star(500,271,8)],mottoY:505}),
 base(19,'A Story Unfolds','display',{face:'#eee7d0',background:'#182e36',lines:[{text:'EVERFOLK',x:102,y:225,w:796,h:137,tracking:2,first:1.25,last:1.18}],decor:[rule('M147 405Q343 436 500 403Q657 436 853 405',1.5)],mottoY:470}),
 base(20,'The Everfolk Signature','display',{hybrid:true,face:'#e8ddbb',background:'#254343',lines:[{text:'Everfolk',x:82,y:180,w:836,h:186,tracking:0}],decor:[star(645,161,10)],mottoY:436}),
];
