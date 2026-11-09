// Editable ArtCraft proof: the selected portrait beside its matching scene actor.
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const helperPath = process.env.ARTCRAFT_MCP_HELPER;
if (!helperPath) throw new Error("Set ARTCRAFT_MCP_HELPER to your local ArtCraft mcp.cjs helper before rendering the avatar gallery.");
const { withMcp } = require(helperPath);
const root = path.resolve(__dirname, "..");
const unwrap = result => JSON.parse(result.content.find(item => item.type === "text").text);
(async () => {
  const { renderAvatarPortrait } = await import(pathToFileURL(path.join(__dirname, "build-avatar-assets.mjs")));
  const { createActorLayers } = await import(pathToFileURL(path.join(__dirname, "banner-art-actors.mjs")));
  await withMcp("VectorCraft", { readRoot: root, writeRoot: root }, async ({ listTools, callTool }) => {
    await listTools();
    await callTool("run_command", { command: "file.new", params: { name: "Matching player portraits and scene avatars", width: 960, height: 640, units: "Pixels", created: 0 } });
    await callTool("draw_path", { d: "M0 0h960v640h-960z", fill: "#f7ecd4", stroke: "none", name: "Proof background" });
    for (let row = 0; row < 4; row++) for (let variant = 0; variant < 3; variant++) {
      const stage = row < 2 ? "adult" : "child", sex = row % 2 ? "female" : "male";
      const originId = row < 2 ? "merchant-household" : "fishing-household";
      const dx = variant * 320, dy = row * 160;
      const portrait = renderAvatarPortrait({ originId, sex, variant, stage });
      const portraitRects = [];
      for (const group of portrait.matchAll(/<g fill="(#[\da-f]{6})">([\s\S]*?)<\/g>/gi)) for (const match of group[2].matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g)) {
        const [x, y, w, h] = match.slice(1).map(Number);
        portraitRects.push({ x: dx + 8 + x * 3, y: dy + 8 + y * 3, w: w * 3, h: h * 3, fill: group[1] });
      }
      if (!portraitRects.length) throw new Error("The portrait proof must contain real pixel geometry.");
      const layers = [{ name: "Selected portrait", rects: portraitRects }, ...createActorLayers(stage, sex, variant, "standing", originId).map(layer => ({
        name: layer.name, rects: layer.rects.map(rect => ({ ...rect, x: dx + 124 + (rect.x - 145) * 3, y: dy + 8 + (rect.y - 59) * 3, w: rect.w * 3, h: rect.h * 3 })),
      }))];
      const steps = [];
      for (const layer of layers) {
        if (!layer.rects.length) continue;
        steps.push({ id: "layer.new", params: { name: `${originId} / ${sex} ${variant + 1} / ${stage} / ${layer.name}`, top: true } });
        const runs = [];
        for (const { x, y, w, h, fill } of layer.rects) {
          let run = runs.at(-1);
          if (!run || run.fill !== fill) runs.push(run = { fill, d: "" });
          run.d += `M${x} ${y}h${w}v${h}h-${w}z`;
        }
        for (const run of runs) steps.push({ id: "draw_path", params: { ...run, stroke: "none" } });
      }
      for (let start = 0; start < steps.length; start += 200) {
        const result = unwrap(await callTool("command_batch", { steps: steps.slice(start, start + 200), atomic: true, label: `Avatar ${sex} ${variant + 1}` }));
        if (result.failed) throw new Error("ArtCraft identity proof stopped.");
      }
      await callTool("add_text", { text: `${sex} ${variant + 1} / ${stage} / ${row < 2 ? "merchant" : "fishing"}`, x: dx + 8, y: dy + 150, font: "Courier New", size: 11, color: "#263b43" });
    }
    await callTool("save_file", { path: path.join(root, "artwork/life-banners/avatar-identity-library.vectorcraft"), compress: true, preview: true });
    await callTool("export", { format: "png", path: path.join(root, "artifacts/avatar-identity-match.png"), scale: 1.5 });
    await callTool("run_command", { command: "file.close", params: {} });
    console.log("Saved editable portrait/scene identity comparison and native PNG render.");
  });
})().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
