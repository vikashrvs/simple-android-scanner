import { describe, it, expect } from "vitest";
import { MODULES, DEFAULT_SELECTED } from "../../src/modules/index.js";
import { makeContext, runScan } from "../../src/core/runner.js";
import { makeFakeShell, DEMO_OUTPUTS } from "../../src/demo/fakeShell.js";
import { summarize } from "../../src/report/summary.js";
import rules from "../../src/rules/allowlist.json";
import indicators from "../../src/rules/indicators.json";

const scan = (outputs, selected = DEFAULT_SELECTED, modules = MODULES) =>
  runScan({ modules, selected, ctx: makeContext({ shell: makeFakeShell(outputs), rules, indicators }) });
const byId = (s, id) => s.results.find((r) => r.id === id);
const fail = () => ({ ok: false, stdout: "", stderr: "denied", code: 1 });

describe("full pipeline on the synthetic phone", () => {
  it("finds the planted stalkerware-like app", async () => {
    const s = await scan(DEMO_OUTPUTS);
    const sa = byId(s, "specialAccess");
    expect(sa.status).toBe("found");
    expect(sa.findings.filter((f) => f.severity === "HIGH").map((f) => f.item).sort()).toEqual(
      ["com.demo.screenwatch", "com.example.indicator.test"]
    );
    expect(byId(s, "installs").findings.some((f) => f.item === "com.demo.screenwatch" && f.severity === "HIGH")).toBe(true);
    expect(s.support.level).toBe("untested");
  });

  it("flags sideload + hidden icon + SMS as HIGH", async () => {
    const s = await scan({
      ...DEMO_OUTPUTS,
      "settings get secure enabled_accessibility_services": { ok: true, stdout: "null", stderr: "", code: 0 },
      "dumpsys device_policy": { ok: true, stdout: "Device Policy Manager state:\n", stderr: "", code: 0 },
    });
    const f = byId(s, "installs").findings.find((x) => x.item === "com.demo.screenwatch");
    expect(f.severity).toBe("HIGH");
  });

  it("indicator module cannot claim clean with only a test entry", async () => {
    const s = await scan(DEMO_OUTPUTS);
    expect(byId(s, "indicators").status).toBe("could_not_check");
  });

  it("modules not selected are not_run, never clean", async () => {
    const s = await scan(DEMO_OUTPUTS);
    expect(byId(s, "storage").status).toBe("not_run");
    const sum = summarize(s.results);
    expect(sum.counts.not_run).toBe(1);
    expect(sum.headline).toContain("1 not run");
  });
});

describe("failure handling (no false clean)", () => {
  it("every command failing gives could_not_check, not clean", async () => {
    const s = await scan({});
    for (const id of ["device", "specialAccess", "installs", "network"]) expect(byId(s, id).status).toBe("could_not_check");
    expect(s.results.some((r) => r.status === "clean")).toBe(false);
  });

  it("empty package list is a failure, not 'no apps, clean'", async () => {
    const s = await scan({ ...DEMO_OUTPUTS, "pm list packages -3 -i": { ok: true, stdout: "", stderr: "", code: 0 } });
    expect(byId(s, "specialAccess").status).toBe("could_not_check");
  });

  it("unrecognized appops output is a failed sub-check, partial coverage", async () => {
    const s = await scan({
      ...DEMO_OUTPUTS,
      "settings get secure enabled_accessibility_services": { ok: true, stdout: "null", stderr: "", code: 0 },
      "dumpsys device_policy": { ok: true, stdout: "Device Policy Manager state:\n", stderr: "", code: 0 },
      "cmd appops query-op REQUEST_INSTALL_PACKAGES allow": { ok: true, stdout: "???? weird 123", stderr: "", code: 0 },
      "cmd appops query-op SYSTEM_ALERT_WINDOW allow": fail(),
    });
    const sa = byId(s, "specialAccess");
    expect(sa.coverage.failed.map((f) => f.name)).toContain("install-unknown permission");
    expect(sa.coverage.failed.map((f) => f.name)).toContain("overlay permission");
  });

  it("a module that throws becomes could_not_check and the others still run", async () => {
    const boom = { id: "boom", title: "Boom", run: async () => { throw new Error("kaboom"); } };
    const s = await scan(DEMO_OUTPUTS, { boom: true, network: true }, [boom, MODULES.find((m) => m.id === "network")]);
    expect(s.results[0]).toMatchObject({ id: "boom", status: "could_not_check", error: "kaboom" });
    expect(s.results[1].id).toBe("network");
  });

  it("user CA folder unreadable is listed as not checked", async () => {
    const s = await scan(DEMO_OUTPUTS);
    const n = byId(s, "network");
    expect(n.coverage.failed.map((f) => f.name)).toContain("user CA certificates");
  });

  it("network tampering is found", async () => {
    const s = await scan({
      ...DEMO_OUTPUTS,
      "settings get global http_proxy": { ok: true, stdout: "10.0.0.5:8080", stderr: "", code: 0 },
      "getprop service.adb.tcp.port": { ok: true, stdout: "5555", stderr: "", code: 0 },
    });
    const n = byId(s, "network");
    expect(n.status).toBe("found");
    expect(n.findings.map((f) => f.item)).toEqual(expect.arrayContaining(["Global HTTP proxy", "ADB over TCP is on"]));
  });
});

describe("supported phone", () => {
  it("is verified only for the tested model", async () => {
    const s = await scan({
      ...DEMO_OUTPUTS,
      "getprop ro.product.model": { ok: true, stdout: "SM-G990B2", stderr: "", code: 0 },
      "getprop ro.build.version.release": { ok: true, stdout: "16", stderr: "", code: 0 },
    });
    expect(s.support.level).toBe("verified");
  });
});
