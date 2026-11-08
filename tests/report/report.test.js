import { describe, it, expect } from "vitest";
import { MODULES, DEFAULT_SELECTED } from "../../src/modules/index.js";
import { makeContext, runScan } from "../../src/core/runner.js";
import { makeFakeShell, DEMO_OUTPUTS } from "../../src/demo/fakeShell.js";
import { buildReportModel, redactPkg } from "../../src/report/model.js";
import { renderPdf } from "../../src/report/pdf.js";
import rules from "../../src/rules/allowlist.json";
import indicators from "../../src/rules/indicators.json";

const makeScan = () =>
  runScan({ modules: MODULES, selected: DEFAULT_SELECTED, ctx: makeContext({ shell: makeFakeShell(DEMO_OUTPUTS), rules, indicators }) });

describe("report model", () => {
  it("lists not-run and could-not-check modules, never as clean", async () => {
    const m = buildReportModel(await makeScan());
    expect(m.modules.find((x) => x.title.startsWith("Shared storage")).statusLabel).toBe("Not run");
    expect(m.modules.find((x) => x.title.startsWith("Stalkerware")).statusLabel).toBe("Could not check");
    expect(m.cannotSee.length).toBeGreaterThan(3);
    expect(m.disclaimer).toContain("does not mean the phone is safe");
  });

  it("sorts findings HIGH first", async () => {
    const m = buildReportModel(await makeScan());
    const order = m.findings.map((f) => f.severity);
    expect(order).toEqual([...order].sort((a, b) => ({ HIGH: 0, MEDIUM: 1, INFO: 2 }[a] - { HIGH: 0, MEDIUM: 1, INFO: 2 }[b])));
  });

  it("app list is off by default and on when asked", async () => {
    const s = await makeScan();
    expect(buildReportModel(s).apps).toBeNull();
    expect(buildReportModel(s, { includeApps: true }).apps.length).toBe(5);
  });

  it("redaction masks package names everywhere", async () => {
    const s = await makeScan();
    const json = JSON.stringify(buildReportModel(s, { includeApps: true, redact: true }));
    expect(json).not.toContain("com.demo.screenwatch");
    expect(json).not.toContain("com.whatsapp");
    expect(json).toContain("com.d***.s***");
    expect(redactPkg("com.whatsapp")).toBe("com.w***");
  });
});

describe("pdf", () => {
  it("renders a valid PDF with and without the app list", async () => {
    const s = await makeScan();
    for (const opts of [{}, { includeApps: true, redact: true }]) {
      const doc = renderPdf(buildReportModel(s, opts));
      const bytes = new Uint8Array(doc.output("arraybuffer"));
      expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(3000);
    }
  });
});
