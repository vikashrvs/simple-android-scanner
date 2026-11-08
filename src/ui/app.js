import { connectAdb } from "../adb/connection.js";
import { makeShell } from "../adb/shell.js";
import { MODULES, DEFAULT_SELECTED } from "../modules/index.js";
import { makeContext, runScan } from "../core/runner.js";
import { readDeviceInfo } from "../modules/device.js";
import { supportLevel } from "../core/support.js";
import { makeFakeShell } from "../demo/fakeShell.js";
import { summarize, STATUS_LABEL, moduleDetail } from "../report/summary.js";
import { buildReportModel } from "../report/model.js";
import { downloadJson } from "../report/export.js";
import { CANNOT_SEE, DISCLAIMER } from "../core/cannotSee.js";
import baseRules from "../rules/allowlist.json";
import indicators from "../rules/indicators.json";

const STEPS = [
  { id: "connect", label: "Connect" },
  { id: "modules", label: "Choose checks" },
  { id: "scan", label: "Scan" },
  { id: "results", label: "Results" },
  { id: "report", label: "Report" },
];
const KNOWN_KEY = "phone-scanner:known-apps";
const PKG_LIKE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;

const state = {
  step: "connect",
  shell: null,
  device: null,
  demo: false,
  busy: false,
  error: "",
  selected: { ...DEFAULT_SELECTED },
  live: {},
  progressText: "",
  scan: null,
  filters: { sev: "ALL", module: "ALL", q: "" },
  report: { includeApps: false, redact: false },
  pdfUrl: "",
  pdfBusy: false,
  pdfError: "",
  userKnown: loadKnown(),
  markedNow: new Set(),
};

let root;

function loadKnown() {
  try { return JSON.parse(localStorage.getItem(KNOWN_KEY) || "{}"); } catch { return {}; }
}
function saveKnown() {
  try { localStorage.setItem(KNOWN_KEY, JSON.stringify(state.userKnown)); } catch { /* storage may be blocked */ }
}
const effectiveRules = () => ({ ...baseRules, apps: { ...baseRules.apps, ...state.userKnown } });

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- views ---------- */

function railView() {
  const idx = STEPS.findIndex((s) => s.id === state.step);
  const locked = (id) => (id === "modules" && !state.shell) || ((id === "results" || id === "report") && !state.scan) || (id === "scan" && !state.busy && !state.scan);
  return `<nav class="rail" aria-label="Steps">
    <div class="brand"><h1>Phone Scanner</h1><small>Runs in your browser. Nothing is uploaded.</small></div>
    <ol class="steps">${STEPS.map((s, i) => {
      const cls = s.id === state.step ? "current" : i < idx ? "done" : "";
      const dis = locked(s.id) && s.id !== state.step;
      return `<li class="${cls}" ${dis ? 'aria-disabled="true"' : ""}><span class="dot" aria-hidden="true">${i < idx ? "&#10003;" : i + 1}</span>
        <button data-action="goto" data-step="${s.id}" ${dis ? "disabled" : ""} ${s.id === state.step ? 'aria-current="step"' : ""}>${s.label}</button></li>`;
    }).join("")}</ol>
  </nav>`;
}

function cannotSeeView() {
  return `<section class="cannot" aria-labelledby="cs-h"><h3 id="cs-h">What this scan cannot see</h3>
    <ul>${CANNOT_SEE.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="rule">${esc(DISCLAIMER)}</p></section>`;
}

function connectView() {
  const sup = state.device ? supportLevel(state.device) : null;
  return `<h2>Connect your phone</h2>
  <p class="lede">The scanner reads your phone over USB using Android Debugging (ADB). Use it on your own phone, or one you have permission to check.</p>
  <ol class="checklist">
    <li>On the phone: Settings, About phone, tap <b>Build number</b> 7 times.</li>
    <li>Settings, Developer options, turn on <b>USB debugging</b>.</li>
    <li>Plug in the USB-C cable and choose <b>File transfer</b> mode.</li>
    <li>Click <b>Connect phone</b> below, pick the phone, then tap <b>Allow</b> on the phone.</li>
  </ol>
  <div class="notice">Use Chrome or Edge on a desktop. Close Smart Switch, and run <code>adb kill-server</code> if you used ADB before, so the browser can claim the phone.</div>
  ${state.error ? `<div class="notice error" role="alert">${esc(state.error)}</div>` : ""}
  <div class="row">
    <button class="btn" data-action="connect" ${state.busy ? "disabled" : ""}>${state.busy ? "Connecting..." : "Connect phone"}</button>
    <button class="btn secondary" data-action="demo" ${state.busy ? "disabled" : ""}>Try the demo phone</button>
  </div>
  ${state.device ? `<div class="summary"><b>${esc(state.device.manufacturer)} ${esc(state.device.model)}</b>, Android ${esc(state.device.android)}, security patch ${esc(state.device.patch)}${state.demo ? " (demo data, not a real phone)" : ""}
    <div class="notice ${sup.level === "verified" ? "ok" : "warn"}">${esc(sup.label)}</div>
    <div class="row"><button class="btn" data-action="goto" data-step="modules">Choose checks</button></div></div>` : ""}`;
}

function modulesView() {
  return `<h2>Choose checks</h2>
  <p class="lede">The first four are quick. Shared storage is slow and noisy, so it starts switched off.</p>
  <ul class="modlist">${MODULES.map((m) => `<li>
    <input type="checkbox" id="m-${m.id}" data-mod="${m.id}" ${state.selected[m.id] ? "checked" : ""}>
    <label for="m-${m.id}"><b>${esc(m.title)}</b><div class="desc">${esc(m.description)}</div></label><span></span></li>`).join("")}</ul>
  <div class="row"><button class="btn" data-action="scan">Start scan</button></div>`;
}

function scanView() {
  return `<h2>${state.busy ? "Scanning" : "Scan finished"}</h2>
  <p class="lede" aria-live="polite">${esc(state.busy ? state.progressText || "Starting..." : "All selected checks have run.")}</p>
  <ul class="modlist">${MODULES.map((m) => {
    const l = state.live[m.id];
    const st = l ? l.status : state.selected[m.id] ? "pending" : "not_run";
    const label = st === "running" ? "Running" : st === "pending" ? "Waiting" : STATUS_LABEL[st];
    return `<li><span></span><span><b>${esc(m.title)}</b></span><span class="chip ${st === "pending" ? "not_run" : st}">${label}</span></li>`;
  }).join("")}</ul>
  ${!state.busy && state.scan ? `<div class="row"><button class="btn" data-action="goto" data-step="results">See results</button><button class="btn secondary" data-action="goto" data-step="report">Generate report</button></div>` : ""}`;
}

function flatFindings() {
  return state.scan.results.flatMap((r) => r.findings.map((f) => ({ ...f, moduleId: r.id, moduleTitle: r.title })));
}

function filtered() {
  const { sev, module, q } = state.filters;
  const needle = q.trim().toLowerCase();
  return flatFindings().filter((f) =>
    (sev === "ALL" || f.severity === sev) &&
    (module === "ALL" || f.moduleId === module) &&
    (!needle || `${f.item} ${f.reason} ${f.proof}`.toLowerCase().includes(needle))
  );
}

function findingsListView() {
  const list = filtered();
  if (!list.length) return `<p class="lede">No findings match these filters.</p>`;
  const order = { HIGH: 0, MEDIUM: 1, INFO: 2 };
  return [...list].sort((a, b) => order[a.severity] - order[b.severity]).map((f) => {
    const canMark = PKG_LIKE.test(f.item) && ["Special access", "Installs", "Indicators"].includes(f.area);
    const known = state.markedNow.has(f.item) || state.userKnown[f.item];
    return `<details class="finding ${f.severity}"><summary>
      <span class="chip ${f.severity}">${f.severity}</span><span class="item">${esc(f.item)}</span>
      <span class="reason">${esc(f.reason)}</span></summary>
      <div class="body"><dl>
        <dt>Proof</dt><dd><pre class="proof">${esc(f.proof)}</pre></dd>
        ${f.normalWhen ? `<dt>This is normal when</dt><dd>${esc(f.normalWhen)}</dd>` : ""}
        <dt>Found by</dt><dd>${esc(f.moduleTitle)}</dd>
      </dl>
      ${canMark ? (known
        ? `<p class="notice ok">Marked as known. This hides low-level noise on the next scan. Accessibility, admin, notification and indicator findings always stay visible.</p>`
        : `<button class="btn secondary" data-action="known" data-pkg="${esc(f.item)}">Mark as known app</button>`) : ""}
      </div></details>`;
  }).join("");
}

function resultsView() {
  const s = summarize(state.scan.results);
  const sup = state.scan.support;
  const f = state.filters;
  const sevBtn = (v) => `<button data-action="sev" data-sev="${v}" aria-pressed="${f.sev === v}">${v === "ALL" ? "All" : v[0] + v.slice(1).toLowerCase()}</button>`;
  return `<h2>Results</h2>
  <div class="notice ${sup.level === "verified" ? "ok" : "warn"}">${esc(sup.label)}</div>
  <div class="summary"><p>${esc(s.headline)}</p>
    <div class="counts"><span><b>${s.findingCounts.HIGH}</b>high</span><span><b>${s.findingCounts.MEDIUM}</b>medium</span><span><b>${s.findingCounts.INFO}</b>info</span></div>
    <div class="row"><button class="btn" data-action="goto" data-step="report">Generate report</button></div></div>

  <h3>What was checked</h3>
  <table><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>
    ${state.scan.results.map((r) => `<tr><td>${esc(r.title)}</td><td><span class="chip ${r.status}">${STATUS_LABEL[r.status]}</span></td><td class="wrap">${esc(moduleDetail(r))}</td></tr>`).join("")}
  </tbody></table>

  <h3>Findings</h3>
  <div class="filters" role="group" aria-label="Filter findings">
    ${["ALL", "HIGH", "MEDIUM", "INFO"].map(sevBtn).join("")}
    <label>Check <select data-filter="module"><option value="ALL">All</option>${state.scan.results.filter((r) => r.findings.length).map((r) => `<option value="${r.id}" ${f.module === r.id ? "selected" : ""}>${esc(r.title)}</option>`).join("")}</select></label>
    <input type="search" data-filter="q" placeholder="Search findings" aria-label="Search findings" value="${esc(f.q)}">
  </div>
  <div id="findings-list">${findingsListView()}</div>
  <div class="row"><button class="btn" data-action="goto" data-step="report">Generate report</button><button class="btn secondary" data-action="goto" data-step="modules">Scan again</button></div>`;
}

function sheetView(m) {
  const fc = m.summary.findingCounts;
  return `<article class="sheet" aria-label="Report preview">
    <h3>${esc(m.title)}</h3>
    <p class="lede">${esc(m.tool)}, generated ${esc(m.generatedAt)}</p>
    <h4>Device</h4>
    <p>${esc(m.device.manufacturer)} ${esc(m.device.model)}, Android ${esc(m.device.android)}, security patch ${esc(m.device.patch)}</p>
    <p>Support level: ${esc(m.support.label)}</p>
    <h4>Summary</h4>
    <p>${esc(m.summary.headline)}</p>
    <p>Findings: ${fc.HIGH} high, ${fc.MEDIUM} medium, ${fc.INFO} info.</p>
    <p><b>${esc(m.disclaimer)}</b></p>
    <h4>Findings</h4>
    ${m.findings.length ? `<table><thead><tr><th>Level</th><th>Item</th><th>Why</th><th>Normal when</th></tr></thead><tbody>
      ${m.findings.map((f) => `<tr><td><span class="chip ${f.severity}">${f.severity}</span></td><td class="wrap">${esc(f.item)}</td><td class="wrap">${esc(f.reason)}</td><td class="wrap">${esc(f.normalWhen)}</td></tr>`).join("")}
    </tbody></table>` : `<p>No findings from the checks that ran. See below for what was and was not checked.</p>`}
    <h4>What was checked</h4>
    <table><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>
      ${m.modules.map((x) => `<tr><td>${esc(x.title)}</td><td><span class="chip ${x.status}">${esc(x.statusLabel)}</span></td><td class="wrap">${esc(x.detail)}</td></tr>`).join("")}
    </tbody></table>
    ${m.apps ? `<h4>Installed user apps</h4><table><thead><tr><th>Package</th><th>Installer</th><th>Launcher icon</th></tr></thead><tbody>
      ${m.apps.map((a) => `<tr><td class="wrap">${esc(a.pkg)}</td><td class="wrap">${esc(a.installer)}</td><td>${a.hidden === null ? "unknown" : a.hidden ? "none" : "yes"}</td></tr>`).join("")}
    </tbody></table>` : ""}
    <h4>What this scan cannot see</h4>
    <ul>${m.cannotSee.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  </article>`;
}

function reportView() {
  const m = buildReportModel(state.scan, state.report);
  return `<h2>Report</h2>
  <p class="lede">Built from the scan you just ran. It lists findings, what was checked, what could not be checked, and what was not run.</p>
  <div class="opts">
    <label><input type="checkbox" data-ropt="includeApps" ${state.report.includeApps ? "checked" : ""}> Include the list of installed apps</label>
    <p class="hint">Off by default. An app list says a lot about a person.</p>
    <label><input type="checkbox" data-ropt="redact" ${state.report.redact ? "checked" : ""}> Mask package names</label>
    <p class="hint">Shows com.w*** instead of com.whatsapp. Use this before sharing a report.</p>
  </div>
  ${state.pdfError ? `<div class="notice error" role="alert">${esc(state.pdfError)}</div>` : ""}
  <div class="row">
    <button class="btn" data-action="genpdf" ${state.pdfBusy ? "disabled" : ""}>${state.pdfBusy ? "Generating..." : state.pdfUrl ? "Regenerate PDF" : "Generate PDF report"}</button>
    ${state.pdfUrl ? `<a class="btn" href="${state.pdfUrl}" download="phone-scan-report.pdf">Download PDF</a>` : ""}
    <button class="btn secondary" data-action="json">Export JSON</button>
  </div>
  ${state.pdfUrl ? `<h3>PDF</h3><iframe class="pdfframe" src="${state.pdfUrl}" title="PDF report"></iframe>
    <p class="hint">If the PDF does not show here, use Download PDF.</p>` : ""}
  <h3>Report preview</h3>
  ${sheetView(m)}`;
}

/* ---------- rendering ---------- */

function render() {
  const view = { connect: connectView, modules: modulesView, scan: scanView, results: resultsView, report: reportView }[state.step];
  root.innerHTML = `<div class="shell">${railView()}<main id="main">${view()}${cannotSeeView()}</main></div>`;
}

function renderFindingsOnly() {
  const el = document.getElementById("findings-list");
  if (el) el.innerHTML = findingsListView();
}

/* ---------- actions ---------- */

async function afterConnect(shell, demo) {
  state.shell = shell;
  state.demo = demo;
  state.device = await readDeviceInfo(shell);
  if (!state.device.model) throw new Error("Connected, but could not read the phone's properties. Unlock the phone and allow USB debugging, then try again.");
}

async function doConnect() {
  state.busy = true; state.error = ""; render();
  try {
    const adb = await connectAdb();
    await afterConnect(makeShell(adb), false);
  } catch (e) {
    state.shell = null; state.device = null;
    state.error = String(e?.message || e);
  }
  state.busy = false; render();
}

async function doDemo() {
  state.busy = true; state.error = ""; render();
  try { await afterConnect(makeFakeShell(), true); } catch (e) { state.error = String(e?.message || e); }
  state.busy = false; render();
}

async function doScan() {
  if (!state.shell) return;
  clearPdf();
  state.busy = true; state.step = "scan"; state.live = {}; state.scan = null; state.progressText = "";
  state.filters = { sev: "ALL", module: "ALL", q: "" }; state.markedNow = new Set();
  render();
  const ctx = makeContext({
    shell: state.shell,
    rules: effectiveRules(),
    indicators,
    progress: (t) => { state.progressText = t; if (state.step === "scan") render(); },
  });
  ctx.device = state.device;
  try {
    state.scan = await runScan({
      modules: MODULES,
      selected: state.selected,
      ctx,
      onUpdate: (id, status, result) => { state.live[id] = { status, result }; if (state.step === "scan") render(); },
    });
  } catch (e) {
    state.error = String(e?.message || e);
  }
  state.busy = false;
  state.step = state.scan ? "results" : "connect";
  render();
}

function onClick(e) {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const a = t.dataset.action;
  if (a === "goto") { if (!t.disabled) { state.step = t.dataset.step; render(); window.scrollTo(0, 0); } }
  else if (a === "connect") doConnect();
  else if (a === "demo") doDemo();
  else if (a === "scan") doScan();
  else if (a === "sev") { state.filters.sev = t.dataset.sev; render(); }
  else if (a === "known") {
    const pkg = t.dataset.pkg;
    state.userKnown[pkg] = "Marked known by you";
    state.markedNow.add(pkg);
    saveKnown();
    renderFindingsOnly();
  }
  else if (a === "genpdf") generatePdf();
  else if (a === "json") downloadJson(buildReportModel(state.scan, state.report));
}

function clearPdf() {
  if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
  state.pdfUrl = "";
}

async function generatePdf() {
  state.pdfBusy = true; state.pdfError = ""; render();
  try {
    const { renderPdf } = await import("../report/pdf.js");
    const doc = renderPdf(buildReportModel(state.scan, state.report));
    clearPdf();
    state.pdfUrl = URL.createObjectURL(doc.output("blob"));
  } catch (e) {
    state.pdfError = "Could not make the PDF: " + String(e?.message || e);
  }
  state.pdfBusy = false; render();
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.mod) state.selected[t.dataset.mod] = t.checked;
  else if (t.dataset.ropt) { state.report[t.dataset.ropt] = t.checked; clearPdf(); render(); }
  else if (t.dataset.filter === "module") { state.filters.module = t.value; renderFindingsOnly(); }
}

function onInput(e) {
  if (e.target.dataset.filter === "q") { state.filters.q = e.target.value; renderFindingsOnly(); }
}

export function init(el) {
  root = el;
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  root.addEventListener("input", onInput);
  render();
}
