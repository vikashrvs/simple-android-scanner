import { SEVERITIES } from "../core/types.js";

/**
 * results -> counts. "could_not_check" and "not_run" are never counted as clean.
 * A clean module with failed sub-checks counts as "clean" but also as "partial".
 */
export function summarize(results) {
  const counts = { found: 0, clean: 0, could_not_check: 0, not_run: 0, partial: 0 };
  const findingCounts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const r of results) {
    counts[r.status] += 1;
    if (r.status === "clean" && r.coverage?.failed?.length) counts.partial += 1;
    for (const f of r.findings) findingCounts[f.severity] += 1;
  }
  const parts = [
    `${counts.clean} clean`,
    `${counts.found} with findings`,
    `${counts.could_not_check} could not check`,
    `${counts.not_run} not run`,
  ];
  let headline = `Checks: ${parts.join(", ")}.`;
  if (counts.partial) headline += ` ${counts.partial} clean result(s) were only partly checked.`;
  return { counts, findingCounts, headline };
}

export const STATUS_LABEL = {
  found: "Findings",
  clean: "Clean",
  could_not_check: "Could not check",
  not_run: "Not run",
};

export function moduleDetail(r) {
  if (r.status === "could_not_check") return r.error || "Could not run.";
  if (r.status === "not_run") return "Not selected for this scan.";
  const failed = r.coverage?.failed || [];
  if (failed.length) return "Not checked: " + failed.map((f) => `${f.name} (${f.error})`).join("; ");
  if (r.status === "found") return `${r.findings.length} finding(s).`;
  return "Everything this module can check was checked.";
}
