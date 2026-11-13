const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const COPY=require('../../framed-collection-v14/source/card-copy.json');
for(const dir of ['source','prompts','assets','qa'])fs.mkdirSync(path.join(ROOT,dir),{recursive:true});
const views={
 'nearchus-common-male':'young adult man, open frontal face angled slightly down toward his work, short dark hair, clean shaven',
 'nearchus-common-female':'young adult woman, nearly frontal face with a slight turn to image right, practical tied-back dark hair',
 'nearchus-uncommon-male':'adult man in a clear left-facing profile looking toward a coastal headland, sun-weathered skin, short dark beard',
 'nearchus-uncommon-female':'adult woman in a clear right-facing profile looking toward a coastal headland, practical braided hair',
 'nearchus-rare-male':'mature adult man in a strong right-facing three-quarter view, composed gaze toward the route, close dark beard',
 'nearchus-rare-female':'mature adult woman nearly frontal, head tilted slightly up and gaze directed to image left, dark hair tied at the nape',
 'eumenes-common-male':'young adult man in a left-facing three-quarter view looking down toward a scroll bundle, short dark wavy hair, clean shaven',
 'eumenes-common-female':'young adult woman nearly frontal with chin lowered toward the bundle in her hands, practical dark hair tied up',
 'eumenes-uncommon-male':'adult man in a clear left-facing profile, eyes lowered toward the letter, short straight dark hair, clean shaven',
 'eumenes-uncommon-female':'adult woman in a right-facing three-quarter view, eyes lowered toward the letter, loosely bound dark hair',
 'eumenes-rare-male':'mature adult man with a frontal face looking slightly upward toward image right, short dark hair and restrained beard',
 'eumenes-rare-female':'mature adult woman in a left-facing three-quarter view looking up from the dispatch, confident thoughtful gaze, dark hair secured behind the head'
};
const jobs=[];
for(const id of ['nearchus','eumenes'])for(const tier of ['common','uncommon','rare'])for(const gender of ['male','female']){
 const f=COPY.figures.find(x=>x.figureId===id),r=f.roles[tier],slug=`${id}-${tier}-${gender}`;
 const ref=path.resolve(ROOT,'../figure-inner-art-v12/source',`${id}-title-${gender}.png`);
 const rank=tier==='common'?'Common tier: humble civilian working linen, no jewellery, no armour, no ornate trim or heroic command insignia.':tier==='uncommon'?'Uncommon tier: practical civilian professional tunic and modest worn mantle, modest kit, no royal jewellery or armour.':'Rare tier: distinguished but practical civilian professional, well-kept mantle and tools, no crown, royal diadem, ornate armour, or master ruler insignia.';
 const scene=id==='nearchus'?`A working ship of Alexander's late-fourth-century-BCE fleet close to the Indus and Makran coast; timber, hemp rigging, linen sail and deep blue water. ${r.sceneBrief}`:`A late-fourth-century-BCE Macedonian administrative office or campaign records tent. Wooden shelves, tied papyrus bundles, wax tablets and an earthen oil lamp. ${r.sceneBrief}`;
 const prompt=`Use case: historical-scene. Asset type: Everfolk collectible card inner illustration, one single portrait image in a 4:5 vertical canvas, ideally1122x1402. Reference image: approved higher-tier Everfolk painting for painterly style, period atmosphere and materials ONLY. Generate a NEW scene and a distinct lower-tier individual; do not copy the reference pose or face angle. Subject: ${r.title}, a fictional representative ${gender} contributor in ${f.parent.title}'s world. Face/composition: ${views[slug]}. ${rank}\nScene/action: ${scene}\nComposition: one principal adult waist-up or seated three-quarter figure; complete head and both working hands comfortably within the canvas; main face near the upper centre, duties and tools in the lower half; no limbs entering from another body, no hidden or detached elbows. Calm, capable working presence, not a coronation or military hero pose.\nStyle: match the reference's classical oil painting, visible brushwork, warm gold and ochre highlights, deep umber shadows, dramatic but readable chiaroscuro and richly observed cloth and skin. Realistic anatomy and hand mechanics; visible pupils and a clear gaze, with a distinctive face appropriate to the requested angle. A fresh unpixelated painterly base, no pixel-art filter yet. Correct late-fourth-century-BCE Greek/Macedonian tools: reed stylus or reed pen, papyrus and wax, never a feather quill, modern map labels, magnetic compass, sextant or telescope. Exactly two attached arms and two natural five-fingered hands performing the stated task with credible grip and wrist rotation. Background figures remain subtle. No words, letters, numbers, border, frame, logo, card UI, gender label, watermark, modern clothing or anachronistic equipment. Full-bleed painting. Do not render a contact sheet, panels, alternate views or multiple variants in one image.`;
 const job={slug,roleId:`${id}-${tier}`,figureId:id,figureName:f.parent.title,title:r.title,kind:'contribution',tier,gender,desiredViewAngle:views[slug],reference:ref,prompt:`prompts/${slug}.txt`,sceneBrief:r.sceneBrief};
 fs.writeFileSync(path.join(ROOT,job.prompt),prompt);jobs.push({...job,promptText:prompt});
}
fs.writeFileSync(path.join(ROOT,'source/common-c-jobs.json'),JSON.stringify(jobs,null,2));
console.log(JSON.stringify(jobs));
