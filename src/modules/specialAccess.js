import { compose, couldNotCheck } from "../core/types.js";
import { collectInventory, buildSignals } from "./inventory.js";
import { evaluateApp } from "../rules/severity.js";

const ID = "specialAccess";
const TITLE = "Special access (accessibility, admin, notifications)";

export const specialAccess = {
  id: ID,
  title: TITLE,
  description: "Accessibility services, device admins, notification access, install-unknown and overlay permissions.",
  async run(ctx) {
    const inv = await collectInventory(ctx);
    if (!inv.packages.ok) return couldNotCheck(ID, TITLE, `app list: ${inv.packages.error}`);
    const signals = buildSignals(inv, ctx.rules, ctx.indicatorMap);
    const findings = signals.flatMap(evaluateApp).filter((f) => f.area === "Special access");
    const checks = [
      { name: "accessibility services", ok: inv.accessibility.ok, error: inv.accessibility.error },
      { name: "notification listeners", ok: inv.notif.ok, error: inv.notif.error },
      { name: "device administrators", ok: inv.admin.ok, error: inv.admin.error },
      { name: "install-unknown permission", ok: inv.installUnknown.ok, error: inv.installUnknown.error },
      { name: "overlay permission", ok: inv.overlay.ok, error: inv.overlay.error },
    ];
    return compose(ID, TITLE, findings, checks);
  },
};
