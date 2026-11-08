import { compose, couldNotCheck } from "../core/types.js";
import { collectInventory, buildSignals } from "./inventory.js";
import { evaluateApp } from "../rules/severity.js";

const ID = "installs";
const TITLE = "Installs (sideloaded and hidden apps)";

export const installs = {
  id: ID,
  title: TITLE,
  description: "Apps installed from APK files, apps without a launcher icon, and risky combinations of both.",
  async run(ctx) {
    const inv = await collectInventory(ctx);
    if (!inv.packages.ok) return couldNotCheck(ID, TITLE, `app list: ${inv.packages.error}`);
    const signals = buildSignals(inv, ctx.rules, ctx.indicatorMap);
    const findings = signals.flatMap(evaluateApp).filter((f) => f.area === "Installs");
    const checks = [
      { name: "installer source", ok: true },
      { name: "launcher icon check", ok: inv.launcher.ok, error: inv.launcher.error },
      { name: "app permissions", ok: inv.dump.ok, error: inv.dump.error },
    ];
    return compose(ID, TITLE, findings, checks);
  },
};
