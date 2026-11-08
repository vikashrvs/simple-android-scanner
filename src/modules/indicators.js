import { compose, couldNotCheck, finding } from "../core/types.js";
import { collectInventory, buildSignals } from "./inventory.js";
import { evaluateApp } from "../rules/severity.js";

const ID = "indicators";
const TITLE = "Stalkerware indicator match";

export const indicators = {
  id: ID,
  title: TITLE,
  description: "Matches installed package names against the bundled indicator list.",
  async run(ctx) {
    const real = ctx.indicators.packages.filter((p) => !p.test);
    if (real.length === 0)
      return couldNotCheck(ID, TITLE, "No verified indicator list is loaded, so nothing real was matched. See the README to import one.");
    const inv = await collectInventory(ctx);
    if (!inv.packages.ok) return couldNotCheck(ID, TITLE, `app list: ${inv.packages.error}`);
    const installed = new Set([...inv.packages.apps.map((a) => a.pkg), ...inv.dump.map.keys()]);
    const signals = buildSignals(inv, ctx.rules, ctx.indicatorMap);
    const findings = signals.flatMap(evaluateApp).filter((f) => f.area === "Indicators");
    for (const [pkg, ind] of ctx.indicatorMap)
      if (installed.has(pkg) && !findings.some((f) => f.item === pkg))
        findings.push(finding("HIGH", "Indicators", pkg, `Package matches the stalkerware indicator list: ${ind.name}.`, `indicator match: ${pkg}`,
          "Only if you installed it yourself on purpose."));
    return compose(ID, TITLE, findings, [{ name: `indicator list (${real.length} entries)`, ok: true }]);
  },
};
