export const MODULE_LOADING_START = 5;
export const MODULE_LOADING_END = 85;

export interface ModuleLoadingProgress {
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
  getServerSnapshot(): number;
  track<T>(load: () => Promise<T>, preloads?: Array<() => Promise<unknown>>): Promise<T>;
}

/** Count completed dependencies declared by the bundler while an import is pending. */
function observeDependencies(report: (fraction: number) => void): () => void {
  if (typeof document === "undefined") return () => {};
  const completed = new Set(performance.getEntriesByType("resource").map(entry => entry.name));
  // Already-cached shell resources are outside this import's remaining work.
  const previous = new Set(completed);
  const dependencies = new Set<string>();
  const selector = 'link[rel="modulepreload"], link[rel="preload"][as="script"], link[rel="stylesheet"]';
  const update = () => {
    if (dependencies.size) report([...dependencies].filter(url => completed.has(url)).length / dependencies.size);
  };
  const discover = () => {
    for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>(selector))) {
      if (!previous.has(link.href)) dependencies.add(link.href);
    }
    update();
  };
  const onLoad = (event: Event) => {
    const link = event.target;
    if (link instanceof HTMLLinkElement && link.matches(selector)) {
      completed.add(link.href);
      discover();
    }
  };
  document.addEventListener("load", onLoad, true);
  const mutations = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(discover);
  mutations?.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "rel", "as"] });
  let resources: PerformanceObserver | undefined;
  if (typeof PerformanceObserver !== "undefined") {
    resources = new PerformanceObserver(list => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        // Failed downloads must not advance the bar.
        if (!entry.responseStatus || entry.responseStatus < 400) completed.add(entry.name);
      }
      discover();
    });
    try { resources.observe({ type: "resource", buffered: true }); }
    catch { resources.disconnect(); resources = undefined; }
  }
  discover();
  return () => {
    document.removeEventListener("load", onLoad, true);
    mutations?.disconnect();
    resources?.disconnect();
  };
}

/** A lightweight store that can update a Suspense fallback before the game imports. */
export function createModuleLoadingProgress(): ModuleLoadingProgress {
  let progress = MODULE_LOADING_START;
  const listeners = new Set<() => void>();
  const advance = (next: number) => {
    if (next <= progress) return;
    progress = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => progress,
    getServerSnapshot: () => MODULE_LOADING_START,
    async track(load, preloads = []) {
      const stop = observeDependencies(fraction => advance(Math.round(MODULE_LOADING_START + fraction * (MODULE_LOADING_END - MODULE_LOADING_START - 5))));
      try {
        // Explicit import milestones also work in development, where Vite does
        // not emit production modulepreload links for the whole dependency graph.
        if (preloads.length) {
          let loaded = 0;
          await Promise.all(preloads.map(async preload => {
            await preload();
            advance(Math.round(MODULE_LOADING_START + ++loaded / preloads.length * (MODULE_LOADING_END - MODULE_LOADING_START - 5)));
          }));
        }
        const result = await load();
        // The final import also waits for module parsing and evaluation.
        advance(MODULE_LOADING_END);
        return result;
      } finally { stop(); }
    },
  };
}
