import { lines } from "./util.js";

/** `pm list packages -3 -i` -> [{ pkg, installer }] (installer "unknown" when not printed) */
export function parsePackageList(text) {
  return lines(text)
    .map((l) => l.match(/^package:(\S+)(?:\s+installer=(\S+))?/))
    .filter(Boolean)
    .map((m) => ({ pkg: m[1], installer: m[2] || "unknown" }));
}
