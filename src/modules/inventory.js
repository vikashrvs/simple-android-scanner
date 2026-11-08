import { parsePackageList } from "../parsers/packages.js";
import { parseDumpsysPackages } from "../parsers/dumpsysPackage.js";
import { parseComponentList } from "../parsers/settings.js";
import { parseDeviceAdmins } from "../parsers/devicePolicy.js";
import { parseLauncherPackages } from "../parsers/launcher.js";
import { parseAppopsPackages } from "../parsers/appops.js";
import { installerKind } from "../rules/severity.js";

const fail = (r, extra = "") => ({ ok: false, error: extra || r.stderr || `exit code ${r.code}` });

/** Reads everything about apps once. Modules share this (cached on ctx). */
export async function collectInventory(ctx) {
  if (ctx.cache.inventory) return ctx.cache.inventory;
  const { shell, progress } = ctx;
  const inv = {};

  progress?.("Reading installed apps");
  const pk = await shell("pm list packages -3 -i");
  const apps = pk.ok ? parsePackageList(pk.stdout) : [];
  inv.packages = pk.ok
    ? apps.length > 0 ? { ok: true, apps } : { ok: false, apps, error: "no user apps could be parsed (unexpected)" }
    : { ...fail(pk), apps };

  progress?.("Reading app details");
  const dp = await shell("dumpsys package");
  const dump = dp.ok ? parseDumpsysPackages(dp.stdout) : new Map();
  inv.dump = dp.ok && dump.size > 0 ? { ok: true, map: dump } : { ...fail(dp, dp.ok ? "dumpsys package output not recognized" : ""), map: dump };

  progress?.("Reading accessibility and notification access");
  const ac = await shell("settings get secure enabled_accessibility_services");
  inv.accessibility = ac.ok ? { ok: true, pkgs: parseComponentList(ac.stdout) } : { ...fail(ac), pkgs: [] };
  const nl = await shell("settings get secure enabled_notification_listeners");
  inv.notif = nl.ok ? { ok: true, pkgs: parseComponentList(nl.stdout) } : { ...fail(nl), pkgs: [] };

  progress?.("Reading device administrators");
  const dpm = await shell("dumpsys device_policy");
  if (dpm.ok) {
    const a = parseDeviceAdmins(dpm.stdout);
    inv.admin = a.recognized ? { ok: true, pkgs: a.pkgs } : { ok: false, error: "device_policy output not recognized", pkgs: [] };
  } else inv.admin = { ...fail(dpm), pkgs: [] };

  progress?.("Reading special app permissions");
  for (const [key, op] of [["installUnknown", "REQUEST_INSTALL_PACKAGES"], ["overlay", "SYSTEM_ALERT_WINDOW"]]) {
    const r = await shell(`cmd appops query-op ${op} allow`);
    if (!r.ok) { inv[key] = { ...fail(r), pkgs: [] }; continue; }
    const p = parseAppopsPackages(r.stdout);
    inv[key] = p.recognized ? { ok: true, pkgs: p.pkgs } : { ok: false, error: "appops output format not recognized", pkgs: [] };
  }

  progress?.("Reading launcher icons");
  const ln = await shell("cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER");
  const launcher = ln.ok ? parseLauncherPackages(ln.stdout) : new Set();
  inv.launcher = ln.ok && launcher.size > 0 ? { ok: true, set: launcher } : { ...fail(ln, ln.ok ? "launcher query returned nothing" : ""), set: launcher };

  ctx.cache.inventory = inv;
  return inv;
}

/** Inventory + rules -> one signals object per user app (PURE) */
export function buildSignals(inv, rules, indicatorMap = new Map()) {
  const accessibility = new Set(inv.accessibility.pkgs);
  const admin = new Set(inv.admin.pkgs);
  const notif = new Set(inv.notif.pkgs);
  const installUnknown = new Set(inv.installUnknown.pkgs);
  const overlay = new Set(inv.overlay.pkgs);
  const SMS = ["READ_SMS", "RECEIVE_SMS", "SEND_SMS"];

  return inv.packages.apps.map(({ pkg, installer }) => {
    const detail = inv.dump.map.get(pkg);
    const inst = detail?.installer && installer === "unknown" ? detail.installer : installer;
    return {
      pkg,
      installer: inst,
      installerKind: installerKind(inst, rules),
      accessibility: accessibility.has(pkg),
      admin: admin.has(pkg),
      notifListener: notif.has(pkg),
      installUnknown: installUnknown.has(pkg),
      overlay: overlay.has(pkg),
      hiddenIcon: inv.launcher.ok ? !inv.launcher.set.has(pkg) : null,
      smsPerm: Boolean(detail?.granted.some((p) => SMS.includes(p))),
      indicator: indicatorMap.get(pkg) || null,
      allowlisted: rules.apps[pkg] || null,
    };
  });
}
