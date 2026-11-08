import { PKG_RE } from "./util.js";

/**
 * `cmd appops query-op <OP> allow` -> { recognized, pkgs }
 * Output format differs between Android versions, so this is tolerant:
 * unrecognized non-empty output is reported as recognized=false (never treated as "none").
 */
export function parseAppopsPackages(text) {
  const src = String(text || "").trim();
  if (!src) return { recognized: true, pkgs: [] };
  if (/^no (operations|packages|ops)/i.test(src)) return { recognized: true, pkgs: [] };
  const pkgs = new Set();
  for (const l of src.split(/\r?\n/)) {
    const m = l.trim().match(/^(?:Package\s+)?([A-Za-z0-9_.]+):?$/);
    if (m && PKG_RE.test(m[1])) pkgs.add(m[1]);
  }
  return { recognized: pkgs.size > 0, pkgs: [...pkgs] };
}
