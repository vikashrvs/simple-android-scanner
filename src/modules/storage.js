import { finding, compose } from "../core/types.js";
import { lines } from "../parsers/util.js";
import { magicType, hasMisleadingName, isInterestingHiddenDir, isInterestingNomedia } from "../parsers/storage.js";

const ID = "storage";
const TITLE = "Shared storage (hidden folders, disguised files)";
const ROOT = "/sdcard";
const q = (p) => "'" + p.replace(/'/g, "'\\''") + "'";

export const storage = {
  id: ID,
  title: TITLE,
  description: "Slow and noisy. Hidden folders, .nomedia folders hiding media, APK files, files whose type differs from their name. Shared storage only.",
  async run(ctx) {
    const { shell, progress } = ctx;
    const findings = [];
    const checks = [];

    progress?.("Storage: hidden folders");
    const hd = await shell(`find ${ROOT} -maxdepth 8 -type d -name ".*"`);
    checks.push({ name: "hidden folders", ok: hd.stdout.length > 0 || hd.ok, error: hd.stderr });
    for (const d of lines(hd.stdout).filter((p) => p !== ROOT && isInterestingHiddenDir(p)).slice(0, 60)) {
      const cnt = parseInt((await shell(`find ${q(d)} -type f | wc -l`)).stdout, 10) || 0;
      if (!cnt) continue;
      const kb = parseInt((await shell(`du -sk ${q(d)}`)).stdout.split(/\s+/)[0], 10) || 0;
      const sev = kb > 50000 ? "HIGH" : cnt >= 5 || kb > 5000 ? "MEDIUM" : "INFO";
      findings.push(finding(sev, "Storage", d, `Hidden folder with ${cnt} files (${(kb / 1024).toFixed(1)} MB).`, `${d}: ${cnt} files`,
        "Many apps (editors, cameras, launchers) keep hidden folders."));
    }

    progress?.("Storage: .nomedia folders");
    const nm = await shell(`find ${ROOT} -maxdepth 8 -name ".nomedia"`);
    checks.push({ name: ".nomedia folders", ok: nm.stdout.length > 0 || nm.ok, error: nm.stderr });
    for (const d of lines(nm.stdout).map((p) => p.replace(/\/\.nomedia$/, "")).filter(isInterestingNomedia).slice(0, 60)) {
      const media = parseInt((await shell(`find ${q(d)} -type f | grep -ciE "\\.(jpe?g|png|mp4|webp|heic|mkv|3gp)$"`)).stdout, 10) || 0;
      if (media > 0)
        findings.push(finding(media >= 10 ? "HIGH" : "MEDIUM", "Storage", d, `.nomedia hides ${media} photo or video files from the gallery.`, `${d}/.nomedia (${media} media files)`,
          "Some apps use .nomedia for their own cache."));
    }

    progress?.("Storage: APK files");
    const ap = await shell(`find ${ROOT} -maxdepth 8 -type f -iname "*.apk"`);
    checks.push({ name: "APK files", ok: ap.stdout.length > 0 || ap.ok, error: ap.stderr });
    for (const a of lines(ap.stdout).slice(0, 40))
      findings.push(finding("MEDIUM", "Storage", a, "An APK file is stored on the phone.", a, "Normal if you downloaded an app installer."));

    progress?.("Storage: files with a misleading type");
    const all = await shell(`find ${ROOT} -maxdepth 8 -type f -size +20k`);
    checks.push({ name: "disguised files", ok: all.stdout.length > 0 || all.ok, error: all.stderr });
    const odd = lines(all.stdout).filter((p) => !p.includes("/Android/") && !p.includes("/.thumbnails") && !p.includes("'") && hasMisleadingName(p));
    odd.sort((a, b) => (b.includes("/.") ? 1 : 0) - (a.includes("/.") ? 1 : 0));
    for (const f of odd.slice(0, 150)) {
      const m = magicType((await shell(`od -An -tx1 -N12 ${q(f)}`)).stdout);
      if (m) findings.push(finding(m.severity, "Storage", f, `Name suggests something else, but the file is actually: ${m.type}.`, f,
        "Some apps store media under generic names."));
    }
    return compose(ID, TITLE, findings, checks);
  },
};
