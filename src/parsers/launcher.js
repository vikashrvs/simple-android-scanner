/** `cmd package query-activities --brief ...LAUNCHER` -> Set of packages that have a launcher icon */
export function parseLauncherPackages(text) {
  const set = new Set();
  for (const l of String(text || "").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z][A-Za-z0-9_.]*)\/[A-Za-z0-9_.$]+/);
    if (m) set.add(m[1]);
  }
  return set;
}
