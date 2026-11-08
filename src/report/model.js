import { summarize, STATUS_LABEL, moduleDetail } from "./summary.js";
import { CANNOT_SEE, DISCLAIMER } from "../core/cannotSee.js";

const ORDER = { HIGH: 0, MEDIUM: 1, INFO: 2 };
export const TOOL = "Phone Scanner v1.0.0";
const PKG_LIKE = /\b[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+){1,}\b/;

/** com.whatsapp -> com.w*** ; keeps the first segment so the report stays readable */
export function redactPkg(pkg) {
  const parts = String(pkg).split(".");
  if (parts.length < 2) return pkg;
  return [parts[0], ...parts.slice(1).map((p) => (p ? p[0] + "***" : p))].join(".");
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 3) + "..." : s);

/**
 * PURE. scan result + options -> everything the PDF/JSON needs.
 * options: { includeApps (default false), redact (default false) }
 * Modules that did not run are listed as such, never as clean.
 */
export function buildReportModel(scan, options = {}) {
  const opts = { includeApps: false, redact: false, ...options };
  const names = new Set();
  scan.results.forEach((r) => r.findings.forEach((f) => PKG_LIKE.test(f.item) && names.add(f.item)));
  (scan.apps || []).forEach((a) => names.add(a.pkg));
  const sorted = [...names].sort((a, b) => b.length - a.length);

  const mask = (text) => {
    if (!opts.redact) return String(text ?? "");
    let out = String(text ?? "");
    for (const n of sorted) out = out.split(n).join(redactPkg(n));
    return out;
  };

  const findings = scan.results
    .flatMap((r) => r.findings.map((f) => ({ ...f, module: r.title })))
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
    .map((f) => ({
      severity: f.severity,
      module: f.module,
      area: f.area,
      item: mask(f.item),
      reason: mask(f.reason),
      proof: truncate(mask(f.proof), 300),
      normalWhen: mask(f.normalWhen),
    }));

  const summary = summarize(scan.results);
  const d = scan.device || {};

  return {
    title: "Phone security scan report",
    tool: TOOL,
    generatedAt: scan.finishedAt || new Date().toISOString(),
    startedAt: scan.startedAt,
    device: {
      manufacturer: d.manufacturer || "unknown",
      model: d.model || "unknown",
      android: d.android || "unknown",
      patch: d.patch || "unknown",
    },
    support: scan.support,
    summary,
    findings,
    modules: scan.results.map((r) => ({
      title: r.title,
      status: r.status,
      statusLabel: STATUS_LABEL[r.status],
      detail: mask(moduleDetail(r)),
    })),
    apps: opts.includeApps && scan.apps
      ? scan.apps.map((a) => ({ pkg: mask(a.pkg), installer: a.installer, hidden: a.hidden }))
      : null,
    cannotSee: CANNOT_SEE,
    disclaimer: DISCLAIMER,
    options: opts,
  };
}
