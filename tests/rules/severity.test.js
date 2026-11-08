import { describe, it, expect } from "vitest";
import { evaluateApp, installerKind } from "../../src/rules/severity.js";
import rules from "../../src/rules/allowlist.json";

const base = {
  pkg: "x.y", installer: "com.android.vending", installerKind: "store",
  accessibility: false, admin: false, notifListener: false, installUnknown: false, overlay: false,
  hiddenIcon: false, smsPerm: false, indicator: null, allowlisted: null,
};
const sev = (o) => evaluateApp({ ...base, ...o }).map((f) => `${f.severity}:${f.area}`);

describe("installerKind", () => {
  it("classifies installers", () => {
    expect(installerKind("com.android.vending", rules)).toBe("store");
    expect(installerKind("null", rules)).toBe("sideload");
    expect(installerKind("com.google.android.packageinstaller", rules)).toBe("sideload");
    expect(installerKind("com.some.store", rules)).toBe("other");
    expect(installerKind("unknown", rules)).toBe("unknown");
  });
});

describe("evaluateApp", () => {
  it("a clean store app has no findings", () => expect(sev({})).toEqual([]));
  it("many permissions alone never raise severity", () => expect(sev({ smsPerm: true })).toEqual([]));
  it("accessibility is HIGH", () => expect(sev({ accessibility: true })).toContain("HIGH:Special access"));
  it("admin is HIGH", () => expect(sev({ admin: true })).toContain("HIGH:Special access"));
  it("notification listener is MEDIUM", () => expect(sev({ notifListener: true })).toEqual(["MEDIUM:Special access"]));
  it("indicator match is HIGH", () => expect(sev({ indicator: { name: "t" } })).toContain("HIGH:Indicators"));
  it("sideload alone is INFO", () => expect(sev({ installerKind: "sideload", installer: "null" })).toEqual(["INFO:Installs"]));
  it("hidden icon alone is INFO", () => expect(sev({ hiddenIcon: true })).toEqual(["INFO:Installs"]));
  it("sideload + hidden is MEDIUM", () => expect(sev({ installerKind: "sideload", hiddenIcon: true })).toEqual(["MEDIUM:Installs"]));
  it("sideload + hidden + SMS is HIGH", () =>
    expect(sev({ installerKind: "sideload", hiddenIcon: true, smsPerm: true })).toEqual(["HIGH:Installs"]));
  it("unknown hidden state (null) adds nothing", () => expect(sev({ hiddenIcon: null })).toEqual([]));
  it("allowlist hides noise", () =>
    expect(sev({ allowlisted: "Bank", installerKind: "sideload", hiddenIcon: true, smsPerm: true, installUnknown: true })).toEqual([]));
  it("allowlisted app with accessibility is STILL HIGH", () =>
    expect(sev({ allowlisted: "Bank", accessibility: true })).toContain("HIGH:Special access"));
  it("install-unknown alone is INFO", () => expect(sev({ installUnknown: true })).toEqual(["INFO:Special access"]));
  it("every finding carries reason and proof", () => {
    for (const f of evaluateApp({ ...base, accessibility: true, installerKind: "sideload", hiddenIcon: true }))
      { expect(f.reason.length).toBeGreaterThan(5); expect(f.proof.length).toBeGreaterThan(3); }
  });
});
