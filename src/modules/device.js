import { finding, compose } from "../core/types.js";
import { lines } from "../parsers/util.js";

const ID = "device";
const TITLE = "Device and system integrity";

export async function readDeviceInfo(shell) {
  const get = async (p) => (await shell(`getprop ${p}`)).stdout;
  return {
    manufacturer: await get("ro.product.manufacturer"),
    model: await get("ro.product.model"),
    android: await get("ro.build.version.release"),
    sdk: await get("ro.build.version.sdk"),
    patch: await get("ro.build.version.security_patch"),
    verifiedBoot: await get("ro.boot.verifiedbootstate"),
    debuggable: await get("ro.debuggable"),
  };
}

export function patchAgeDays(patch, now) {
  const t = Date.parse(patch);
  return Number.isNaN(t) ? null : Math.floor((now - t) / 86400000);
}

export const device = {
  id: ID,
  title: TITLE,
  description: "Model, Android version, security patch, boot integrity, extra user profiles.",
  async run(ctx) {
    const { shell } = ctx;
    const info = await readDeviceInfo(shell);
    ctx.device = info;
    const findings = [];
    const checks = [];

    const haveProps = Boolean(info.model && info.android);
    checks.push({ name: "system properties", ok: haveProps, error: "could not read device properties" });

    if (info.verifiedBoot && info.verifiedBoot !== "green")
      findings.push(finding("HIGH", "Device", "Verified boot", `Boot state is "${info.verifiedBoot}" (bootloader unlocked or system modified).`,
        `ro.boot.verifiedbootstate=${info.verifiedBoot}`, "Normal if you unlocked the bootloader yourself (custom ROM)."));
    if (info.debuggable === "1")
      findings.push(finding("HIGH", "Device", "Debuggable build", "This build is marked debuggable.", "ro.debuggable=1",
        "Normal only on developer or emulator builds."));
    const age = patchAgeDays(info.patch, ctx.now ?? Date.now());
    if (age !== null && age > 365)
      findings.push(finding("INFO", "Device", "Security patch", `Security patch is ${age} days old.`, `ro.build.version.security_patch=${info.patch}`,
        "Normal on phones that no longer get updates."));

    const users = await shell("pm list users");
    checks.push({ name: "user profiles", ok: users.ok, error: users.stderr });
    if (users.ok) {
      const list = lines(users.stdout).filter((l) => l.includes("UserInfo"));
      if (list.length > 1)
        findings.push(finding("INFO", "Device", `${list.length} user profiles`,
          "Secure Folder or a work profile exists. Apps inside it are not scanned.", list.join(" | "),
          "Normal if you use Secure Folder or a work profile."));
    }
    return compose(ID, TITLE, findings, checks);
  },
};
