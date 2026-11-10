// Rebuild editable ArtCraft masters and their web exports without a desktop UI.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const helperPath = process.env.ARTCRAFT_MCP_HELPER;
if (!helperPath) throw new Error("Set ARTCRAFT_MCP_HELPER to your local ArtCraft mcp.cjs helper before rebuilding banner artwork.");
const { withMcp } = require(helperPath);
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "artwork", "life-banners");
const publicDir = path.join(root, "public", "assets", "pixel", "banners");
const previewDir = path.join(root, "artifacts", "life-banners");
const args = process.argv.slice(2);
const only = args.find(arg => arg.startsWith("--only="))?.slice(7).split(",");
const scenesOnly = args.includes("--scenes-only");
const actorsOnly = args.includes("--actors-only");
for (const folder of [sourceDir, publicDir, path.join(publicDir, "actors"), previewDir]) fs.mkdirSync(folder, { recursive: true });
const unpack = result => {
  const item = result.content?.find(item => item.type === "text");
  return item ? JSON.parse(item.text) : result;
};

function pathRuns(rects) {
  const runs = [];
  for (const rect of rects) {
    const { x, y, w, h, fill } = rect;
    if (![x, y, w, h].every(Number.isInteger) || w <= 0 || h <= 0 || !/^#[0-9a-f]{6}$/i.test(fill)) throw new Error(`Invalid pixel rectangle ${JSON.stringify(rect)}`);
    // Only adjacent colours are joined: overlapping rectangles keep their order.
    let run = runs.at(-1);
    if (!run || run.fill !== fill) runs.push(run = { fill, d: "" });
    run.d += `M${x} ${y}h${w}v${h}h-${w}z`;
  }
  return runs;
}

(async () => {
  const { BANNER_SITUATIONS, createBannerLayers } = await import(pathToFileURL(path.join(__dirname, "banner-art-scenes.mjs")));
  const { ACTOR_STAGES, createActorLayers } = await import(pathToFileURL(path.join(__dirname, "banner-art-actors.mjs")));
  const { AVATAR_APPEARANCE_ORIGINS, getAvatarAppearance } = await import(pathToFileURL(path.join(root, "client/avatar-appearance.ts")));
  const jobs = [];
  if (!actorsOnly) for (const id of BANNER_SITUATIONS) jobs.push({ id, kind: "scene", layers: createBannerLayers(id) });
  if (!scenesOnly) for (const origin of [null, ...AVATAR_APPEARANCE_ORIGINS]) for (const stage of ACTOR_STAGES) for (const sex of ["male", "female"]) for (let variant = 0; variant < 3; variant++) {
    for (const pose of stage === "infant" ? ["cradle"] : ["standing", "seated", "reclined"]) {
      const id = origin ? `${origin.id}/${sex}/${stage}-${variant}-${pose}` : `${stage}-${sex}-${variant}-${pose}`;
      jobs.push({ id, kind: "actor", originId: origin?.id ?? null, sex, stage, variant, pose,
        appearance: getAvatarAppearance({ originId: origin?.id ?? "merchant-household", sex, variant, stage }),
        layers: createActorLayers(stage, sex, variant, pose, origin?.id ?? "merchant-household") });
    }
  }
  const manifest = [];
  await withMcp("VectorCraft", { readRoot: sourceDir, writeRoot: root, timeoutMs: 120000 }, async ({ listTools, callTool }) => {
    // Schemas and commands are discoverable from the same bundled app version.
    const tools = await listTools();
    for (const name of ["command_batch", "draw_path", "save_file", "export", "inspect_document", "open_file"]) if (!tools.some(tool => tool.name === name)) throw new Error(`Missing ArtCraft tool ${name}`);
    for (const job of jobs.filter(job => !only || only.includes(job.id))) {
      unpack(await callTool("run_command", { command: "file.new", params: { name: `Everfolk — ${job.id}`, width: 240, height: 112, units: "Pixels", backgroundContents: "transparent", colorMode: "rgb", created: 0 } }));
      const steps = [];
      for (const layer of job.layers) {
        if (!layer.rects.length) continue;
        steps.push({ id: "layer.new", params: { name: layer.name, top: true } });
        for (const [index, run] of pathRuns(layer.rects).entries()) steps.push({ id: "draw_path", params: { d: run.d, fill: run.fill, stroke: "none", name: `${layer.name} · pixels ${index + 1}` } });
      }
      for (let start = 0; start < steps.length; start += 200) {
        const batch = unpack(await callTool("command_batch", { steps: steps.slice(start, start + 200), atomic: true, label: `Draw ${job.id}` }));
        if (batch.failed || batch.completed !== Math.min(200, steps.length - start)) throw new Error(`ArtCraft drawing stopped for ${job.id}: ${JSON.stringify(batch)}`);
      }
      const source = path.join(sourceDir, job.originId ? "actors" : "", `${job.id}.vectorcraft`);
      const svg = path.join(publicDir, job.kind === "actor" ? "actors" : "", `${job.id}.svg`);
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.mkdirSync(path.dirname(svg), { recursive: true });
      const saved = unpack(await callTool("save_file", { path: source, compress: true, preview: true }));
      if (saved.warnings?.length) throw new Error(`Master save lost data: ${JSON.stringify(saved.warnings)}`);
      unpack(await callTool("export", { format: "svg", path: svg }));
      // Pixel geometry remains editable in the native master. This delivery hint
      // prevents subpixel smoothing when a responsive banner scales the SVG.
      const appearance = job.appearance;
      const identityData = appearance ? ` data-appearance-key="${appearance.identityKey}" data-origin="${appearance.originId}" data-sex="${appearance.sex}" data-avatar-variant="${appearance.variant}" data-life-stage="${appearance.stage}" data-skin="${appearance.skin}" data-hair="${appearance.hair}" data-hair-style="${appearance.hairStyle}" data-facial-hair="${appearance.facialHair}" data-robe="${appearance.robe}" data-accent="${appearance.accent}"` : "";
      fs.writeFileSync(svg, fs.readFileSync(svg, "utf8").replace("<svg ", `<svg shape-rendering="crispEdges"${identityData} `));
      if (job.kind === "scene") unpack(await callTool("export", { format: "png", path: path.join(previewDir, `${job.id}.png`), scale: 4 }));
      const inspected = unpack(await callTool("inspect_document", { depth: 0 }));
      manifest.push({ id: job.id, kind: job.kind, width: 240, height: 112, source: path.relative(root, source).replaceAll("\\", "/"), asset: `/assets/pixel/banners/${job.kind === "actor" ? "actors/" : ""}${job.id}.svg`, layers: job.layers.filter(layer => layer.rects.length).map(layer => layer.name), rectangles: job.layers.reduce((sum, layer) => sum + layer.rects.length, 0), editable: true, ...(appearance ? { originId: job.originId, sex: job.sex, stage: job.stage, variant: job.variant, pose: job.pose, appearance } : {}) });
      const inspectionPath = path.join(previewDir, `${job.id}.inspection.json`);
      fs.mkdirSync(path.dirname(inspectionPath), { recursive: true });
      fs.writeFileSync(inspectionPath, `${JSON.stringify(inspected, null, 2)}\n`);
      unpack(await callTool("run_command", { command: "file.close", params: {} }));
      console.log(`ArtCraft saved ${job.kind}: ${job.id}`);
    }
    // Reopen one scene and one actor from disk: successful export alone does not
    // establish that the native document kept its editable layer hierarchy.
    for (const record of [manifest.find(item => item.kind === "scene"), manifest.find(item => item.kind === "actor")].filter(Boolean)) {
      unpack(await callTool("open_file", { path: path.join(root, record.source) }));
      const reopened = unpack(await callTool("inspect_document", { depth: 0 }));
      fs.writeFileSync(path.join(previewDir, `${record.id}.reopened.json`), `${JSON.stringify(reopened, null, 2)}\n`);
      unpack(await callTool("run_command", { command: "file.close", params: {} }));
    }
  });
  if (!only && !scenesOnly && !actorsOnly) fs.writeFileSync(path.join(publicDir, "manifest.json"), `${JSON.stringify({ version: 2, tool: "ArtCraft VectorCraft headless MCP", canvas: { width: 240, height: 112 }, scenes: manifest.filter(item => item.kind === "scene"), actors: manifest.filter(item => item.kind === "actor") }, null, 2)}\n`);
  console.log(`Finished ${manifest.length} editable ArtCraft assets.`);
})().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
