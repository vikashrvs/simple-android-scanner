/**
 * Full `dumpsys package` -> Map(pkg -> { versionName, installer, firstInstall, lastUpdate, granted[] })
 * One call for every app instead of one call per app.
 */
export function parseDumpsysPackages(text) {
  const map = new Map();
  const src = String(text || "");
  const re = /^ {2}Package \[([^\]]+)\]/gm;
  const marks = [];
  let m;
  while ((m = re.exec(src))) marks.push({ pkg: m[1], start: m.index });

  marks.forEach((mark, i) => {
    if (map.has(mark.pkg)) return;
    let block = src.slice(mark.start, i + 1 < marks.length ? marks[i + 1].start : src.length);
    const cut = block.search(/\n[A-Za-z][^\n]*:\s*\n/);
    if (cut > 0) block = block.slice(0, cut);
    const pick = (r) => (block.match(r) || [])[1] || null;
    const granted = [...new Set([...block.matchAll(/android\.permission\.([A-Z0-9_]+): granted=true/g)].map((x) => x[1]))];
    map.set(mark.pkg, {
      versionName: pick(/versionName=(\S+)/),
      installer: pick(/installerPackageName=(\S+)/),
      firstInstall: pick(/firstInstallTime=(.+)/),
      lastUpdate: pick(/lastUpdateTime=(.+)/),
      granted,
    });
  });
  return map;
}
