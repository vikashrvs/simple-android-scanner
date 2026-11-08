/**
 * Finding: one finding = one reason + one proof.
 * @typedef {Object} Finding
 * @property {"HIGH"|"MEDIUM"|"INFO"} severity
 * @property {string} area
 * @property {string} item
 * @property {string} reason
 * @property {string} proof
 * @property {string} normalWhen   when this is normal (one line)
 *
 * ModuleResult.status: "found" | "clean" | "could_not_check" | "not_run"
 * ModuleResult.coverage: { ok: string[], failed: {name, error}[] }
 *
 * ShellResult: { ok: boolean, stdout: string, stderr: string, code: number|null }
 */

export const SEVERITIES = ["HIGH", "MEDIUM", "INFO"];

export const finding = (severity, area, item, reason, proof = "", normalWhen = "") => ({
  severity, area, item, reason, proof, normalWhen,
});

const base = (id, title, status, findings, coverage = { ok: [], failed: [] }) => ({
  id, title, status, findings, coverage,
});

export const notRun = (id, title) => base(id, title, "not_run", []);

export const couldNotCheck = (id, title, error, failed = []) => ({
  ...base(id, title, "could_not_check", [], { ok: [], failed }),
  error: String(error),
});

/**
 * Build a ModuleResult from findings and the sub-checks that ran.
 * checks: [{ name, ok, error? }]
 *  - any finding            -> "found"
 *  - every sub-check failed -> "could_not_check"
 *  - otherwise              -> "clean" (coverage lists failed sub-checks as partial)
 */
export function compose(id, title, findings, checks) {
  const ok = checks.filter((c) => c.ok).map((c) => c.name);
  const failed = checks.filter((c) => !c.ok).map((c) => ({ name: c.name, error: c.error || "command failed" }));
  const coverage = { ok, failed };
  if (findings.length) return base(id, title, "found", findings, coverage);
  if (checks.length > 0 && ok.length === 0) {
    return {
      ...base(id, title, "could_not_check", [], coverage),
      error: failed.map((f) => `${f.name}: ${f.error}`).join("; "),
    };
  }
  return base(id, title, "clean", [], coverage);
}
