import { PKG_RE } from "./util.js";

/** `settings get ...` -> string or null ("null"/empty both mean "not set") */
export function parseSettingsValue(text) {
  const v = String(text || "").trim();
  return !v || v === "null" ? null : v;
}

/** "pkg/.Service:pkg2/.Other" -> ["pkg", "pkg2"] */
export function parseComponentList(text) {
  const v = parseSettingsValue(text);
  if (!v) return [];
  return [...new Set(v.split(":").map((s) => s.split("/")[0].trim()).filter((p) => PKG_RE.test(p)))];
}
