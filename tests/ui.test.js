// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { init } from "../src/ui/app.js";

const $ = (sel) => document.querySelector(sel);
const click = (sel) => $(sel).click();
const wait = async (cond, ms = 4000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for UI");
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe("UI flow with the demo phone", () => {
  beforeAll(() => {
    document.body.innerHTML = '<div id="app"></div>';
    init($("#app"));
  });

  it("starts on Connect and shows the limits panel", () => {
    expect($("h2").textContent).toBe("Connect your phone");
    expect(document.body.textContent).toContain("What this scan cannot see");
  });

  it("demo connect shows device and an untested support warning", async () => {
    click('[data-action="demo"]');
    await wait(() => document.body.textContent.includes("SM-DEMO1"));
    expect(document.body.textContent).toContain("Untested");
  });

  it("scan runs and reaches results", async () => {
    click('[data-action="goto"][data-step="modules"]');
    expect($("h2").textContent).toBe("Choose checks");
    expect($("#m-storage").checked).toBe(false);
    click('[data-action="scan"]');
    await wait(() => $("h2")?.textContent === "Results");
    const text = document.body.textContent;
    expect(text).toContain("Accessibility service is switched on");
    expect(text).toContain("Not run");
    expect(text).toContain("Could not check");
    expect(text).toContain("What this scan cannot see");
  });

  it("severity filter works", () => {
    const all = document.querySelectorAll(".finding").length;
    click('[data-action="sev"][data-sev="HIGH"]');
    const high = document.querySelectorAll(".finding").length;
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThan(all);
    expect([...document.querySelectorAll(".finding")].every((d) => d.classList.contains("HIGH"))).toBe(true);
  });

  it("mark as known stores the app and shows confirmation", () => {
    click('[data-action="known"]');
    expect(document.querySelector(".finding .notice.ok")).not.toBeNull();
    expect(Object.keys(JSON.parse(localStorage.getItem("phone-scanner:known-apps")))).toHaveLength(1);
  });

  it("report page shows privacy options defaulting to off", () => {
    click('[data-action="goto"][data-step="report"]');
    expect($('[data-ropt="includeApps"]').checked).toBe(false);
    expect($('[data-ropt="redact"]').checked).toBe(false);
    expect(document.body.textContent).not.toContain("Installed user apps");
  });

  it("shows the report inside the GUI right after the scan", () => {
    const sheet = $(".sheet");
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain("Phone security scan report");
    expect(sheet.textContent).toContain("SM-DEMO1");
    expect(sheet.textContent).toContain("Accessibility service is switched on");
    expect(sheet.textContent).toContain("Not run");
    expect(sheet.textContent).toContain("What this scan cannot see");
  });

  it("options update the preview live", () => {
    $('[data-ropt="includeApps"]').click();
    $('[data-ropt="includeApps"]').dispatchEvent(new Event("change", { bubbles: true }));
    expect($(".sheet").textContent).toContain("Installed user apps");
    $('[data-ropt="redact"]').click();
    $('[data-ropt="redact"]').dispatchEvent(new Event("change", { bubbles: true }));
    expect($(".sheet").textContent).not.toContain("com.demo.screenwatch");
  });

  it("Generate PDF embeds the PDF in the page", async () => {
    globalThis.URL.createObjectURL = () => "blob:test-pdf";
    globalThis.URL.revokeObjectURL = () => {};
    click('[data-action="genpdf"]');
    await wait(() => $("iframe.pdfframe"));
    expect($("iframe.pdfframe").getAttribute("src")).toBe("blob:test-pdf");
    expect($('a[download="phone-scan-report.pdf"]')).not.toBeNull();
  });

  it("changing an option clears the old PDF", () => {
    $('[data-ropt="redact"]').click();
    $('[data-ropt="redact"]').dispatchEvent(new Event("change", { bubbles: true }));
    expect($("iframe.pdfframe")).toBeNull();
  });
});
