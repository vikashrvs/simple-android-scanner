import { describe, it, expect } from "vitest";
import { parsePackageList } from "../../src/parsers/packages.js";
import { parseDumpsysPackages } from "../../src/parsers/dumpsysPackage.js";
import { parseSettingsValue, parseComponentList } from "../../src/parsers/settings.js";
import { parseDeviceAdmins } from "../../src/parsers/devicePolicy.js";
import { parseLauncherPackages } from "../../src/parsers/launcher.js";
import { parseAppopsPackages } from "../../src/parsers/appops.js";
import { magicType, hasMisleadingName } from "../../src/parsers/storage.js";
import { DEMO_OUTPUTS } from "../../src/demo/fakeShell.js";

describe("parsePackageList", () => {
  it("parses installer", () => {
    expect(parsePackageList("package:a.b  installer=com.android.vending\npackage:c.d  installer=null")).toEqual([
      { pkg: "a.b", installer: "com.android.vending" },
      { pkg: "c.d", installer: "null" },
    ]);
  });
  it("handles missing installer, empty and garbage", () => {
    expect(parsePackageList("package:a.b")).toEqual([{ pkg: "a.b", installer: "unknown" }]);
    expect(parsePackageList("")).toEqual([]);
    expect(parsePackageList("Error: boom")).toEqual([]);
  });
});

describe("parseDumpsysPackages", () => {
  const map = parseDumpsysPackages(DEMO_OUTPUTS["dumpsys package"].stdout);
  it("splits blocks and reads fields", () => {
    expect(map.size).toBe(5);
    expect(map.get("com.demo.screenwatch").installer).toBe("com.google.android.packageinstaller");
    expect(map.get("com.demo.screenwatch").granted).toEqual(["READ_SMS", "RECEIVE_SMS"]);
    expect(map.get("com.whatsapp").firstInstall).toBe("2026-01-02 10:00:00");
  });
  it("returns an empty map for garbage", () => {
    expect(parseDumpsysPackages("nothing here").size).toBe(0);
    expect(parseDumpsysPackages("").size).toBe(0);
  });
});

describe("settings parsers", () => {
  it("treats null and empty as not set", () => {
    expect(parseSettingsValue("null")).toBeNull();
    expect(parseSettingsValue("  ")).toBeNull();
    expect(parseSettingsValue("x")).toBe("x");
  });
  it("extracts packages from component lists", () => {
    expect(parseComponentList("a.b/.S1:c.d/.S2:a.b/.S3")).toEqual(["a.b", "c.d"]);
    expect(parseComponentList("null")).toEqual([]);
  });
});

describe("parseDeviceAdmins", () => {
  it("reads the enabled admins section", () => {
    const r = parseDeviceAdmins(DEMO_OUTPUTS["dumpsys device_policy"].stdout);
    expect(r).toEqual({ recognized: true, pkgs: ["com.demo.screenwatch"] });
  });
  it("flags unrecognized output", () => {
    expect(parseDeviceAdmins("Permission Denial").recognized).toBe(false);
  });
  it("recognized with no admins", () => {
    expect(parseDeviceAdmins("Device Policy Manager state:\n  something\n")).toEqual({ recognized: true, pkgs: [] });
  });
});

describe("parseLauncherPackages", () => {
  it("collects packages", () => {
    const s = parseLauncherPackages("2 activities found:\na.b/a.b.Main\nc.d/.Splash");
    expect([...s].sort()).toEqual(["a.b", "c.d"]);
  });
  it("empty on garbage", () => expect(parseLauncherPackages("Error").size).toBe(0));
});

describe("parseAppopsPackages", () => {
  it("parses package lines", () => {
    expect(parseAppopsPackages("Package a.b:\nPackage c.d:")).toEqual({ recognized: true, pkgs: ["a.b", "c.d"] });
  });
  it("empty and 'No operations' are recognized as none", () => {
    expect(parseAppopsPackages("").pkgs).toEqual([]);
    expect(parseAppopsPackages("No operations.")).toEqual({ recognized: true, pkgs: [] });
  });
  it("unknown format is NOT treated as none", () => {
    expect(parseAppopsPackages("???? something weird 123").recognized).toBe(false);
  });
});

describe("storage helpers", () => {
  it("detects real types from headers", () => {
    expect(magicType("ff d8 ff e0 00 10")?.type).toBe("JPEG photo");
    expect(magicType("7f 45 4c 46")?.type).toContain("ELF");
    expect(magicType("00 00 00 18 66 74 79 70 69 73 6f 6d")?.type).toContain("MP4");
    expect(magicType("00 01 02")).toBeNull();
  });
  it("flags misleading names", () => {
    expect(hasMisleadingName("/sdcard/x/file.dat")).toBe(true);
    expect(hasMisleadingName("/sdcard/x/noext")).toBe(true);
    expect(hasMisleadingName("/sdcard/x/photo.jpg")).toBe(false);
  });
});
