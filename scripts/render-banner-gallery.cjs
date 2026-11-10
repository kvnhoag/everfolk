// Native ArtCraft proof sheet: the same scene and actor layers used by the game.
const fs = require("node:fs"), path = require("node:path");
const { pathToFileURL } = require("node:url");
const helperPath = process.env.ARTCRAFT_MCP_HELPER;
if (!helperPath) throw new Error("Set ARTCRAFT_MCP_HELPER to your local ArtCraft mcp.cjs helper before rendering the banner gallery.");
const { withMcp } = require(helperPath);
const root = path.resolve(__dirname, "..");
const unwrap = result => JSON.parse(result.content.find(item => item.type === "text").text);
const samples = [
  ["home", "infant", "female", 1, "cradle"], ["courtyard", "child", "male", 0, "standing"],
  ["study", "youth", "female", 1, "seated"], ["workshop", "adult", "male", 0, "standing"],
  ["sculpture", "adult", "female", 1, "standing"], ["philosophy", "elder", "male", 0, "seated"],
  ["harbor", "adult", "female", 2, "standing"], ["military", "adult", "male", 2, "standing"],
  ["market", "middle", "female", 1, "standing"], ["astronomy", "middle", "male", 0, "seated"],
  ["music", "youth", "female", 2, "seated"], ["friendship", "adult", "female", 1, "standing"],
  ["courtship", "adult", "male", 0, "standing"], ["marriage", "adult", "female", 1, "standing"],
  ["parenthood", "adult", "male", 2, "seated"], ["business", "middle", "female", 2, "standing"],
  ["illness", "elder", "female", 0, "reclined"], ["recovery", "child", "male", 2, "reclined"],
  ["debt", "adult", "male", 1, "seated"], ["danger", "adult", "female", 2, "standing"],
  ["war", "elder", "female", 1, "standing"], ["civic", "youth", "male", 0, "standing"],
  ["retirement", "elder", "male", 1, "seated"], ["memorial", null],
];
(async () => {
  const { createBannerLayers } = await import(pathToFileURL(path.join(__dirname, "banner-art-scenes.mjs")));
  const { createActorLayers } = await import(pathToFileURL(path.join(__dirname, "banner-art-actors.mjs")));
  const { AVATAR_APPEARANCE_ORIGINS } = await import(pathToFileURL(path.join(root, "client/avatar-appearance.ts")));
  await withMcp("VectorCraft", { readRoot: root, writeRoot: root }, async ({ callTool }) => {
    unwrap(await callTool("run_command", { command: "file.new", params: { name: "Everfolk — layered banner library", width: 1000, height: 848, units: "Pixels", created: 0 } }));
    await callTool("draw_path", { d: "M0 0h1000v848h-1000z", fill: "#f7ecd4", stroke: "none", name: "Proof sheet background" });
    for (const [i, [id, stage, sex, variant, pose]] of samples.entries()) {
      const dx = 8 + (i % 4) * 248, dy = 8 + Math.floor(i / 4) * 140;
      const origin = AVATAR_APPEARANCE_ORIGINS[i % AVATAR_APPEARANCE_ORIGINS.length];
      const layers = [...createBannerLayers(id), ...(stage ? createActorLayers(stage, sex, variant, pose, origin.id) : [])];
      const steps = [];
      for (const layer of layers) {
        if (!layer.rects.length) continue;
        steps.push({ id: "layer.new", params: { name: `${id} / ${layer.name}`, top: true } });
        const runs = [];
        for (const { x, y, w, h, fill } of layer.rects) {
          let run = runs.at(-1);
          if (!run || run.fill !== fill) runs.push(run = { fill, d: "" });
          run.d += `M${x + dx} ${y + dy}h${w}v${h}h-${w}z`;
        }
        for (const [index, run] of runs.entries()) steps.push({ id: "draw_path", params: { ...run, stroke: "none", name: `${id} / pixels ${index + 1}` } });
      }
      for (let start = 0; start < steps.length; start += 200) {
        const batch = unwrap(await callTool("command_batch", { steps: steps.slice(start, start + 200), atomic: true, label: id }));
        if (batch.failed) throw new Error(`Proof failed: ${id}`);
      }
      await callTool("add_text", { text: `${id} / ${stage ?? "life ended"}${stage ? ` / ${origin.motif}` : ""}`, x: dx + 2, y: dy + 128, font: "Courier New", size: 9, color: "#263b43" });
    }
    await callTool("save_file", { path: path.join(root, "artwork/life-banners/scene-library.vectorcraft"), compress: true, preview: true });
    await callTool("export", { format: "png", path: path.join(root, "artifacts/life-banners/scene-library.png"), scale: 1.5 });
    await callTool("run_command", { command: "file.close", params: {} });
    console.log("Saved native layered proof sheet and rendered PNG.");
  });
})().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
