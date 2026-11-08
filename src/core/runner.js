import { notRun, couldNotCheck } from "./types.js";
import { supportLevel } from "./support.js";

/** Builds the module context. indicatorMap: pkg -> indicator entry. */
export function makeContext({ shell, rules, indicators, progress, now }) {
  return {
    shell, rules, indicators, progress,
    now: now ?? Date.now(),
    cache: {},
    device: null,
    indicatorMap: new Map(indicators.packages.map((p) => [p.pkg, p])),
  };
}

/**
 * Runs the selected modules in order. A module that throws becomes could_not_check;
 * the rest keep going. Unselected modules become not_run (never "clean").
 * onUpdate(moduleId, status|"running", result?) is called for live UI.
 */
export async function runScan({ modules, selected, ctx, onUpdate }) {
  const startedAt = new Date().toISOString();
  const results = [];
  for (const m of modules) {
    if (!selected[m.id]) {
      const r = notRun(m.id, m.title);
      results.push(r);
      onUpdate?.(m.id, "not_run", r);
      continue;
    }
    onUpdate?.(m.id, "running");
    let r;
    try {
      r = await m.run(ctx);
    } catch (e) {
      r = couldNotCheck(m.id, m.title, e?.message || e);
    }
    results.push(r);
    onUpdate?.(m.id, r.status, r);
  }
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    device: ctx.device,
    support: supportLevel(ctx.device),
    results,
    apps: ctx.cache.inventory?.packages?.apps?.map((a) => ({
      pkg: a.pkg,
      installer: a.installer,
      hidden: ctx.cache.inventory.launcher.ok ? !ctx.cache.inventory.launcher.set.has(a.pkg) : null,
    })) ?? null,
  };
}
