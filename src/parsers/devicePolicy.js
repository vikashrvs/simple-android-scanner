/**
 * `dumpsys device_policy` -> { recognized, pkgs }
 * recognized=false means the output did not look like device policy output at all.
 */
export function parseDeviceAdmins(text) {
  const src = String(text || "");
  const recognized = /Device Policy Manager|DevicePolicyManager|Enabled Device Admins/i.test(src);
  const pkgs = new Set();
  const sec = src.match(/Enabled Device Admins[^\n]*\n((?:[ \t]+[^\n]*\n?)*)/i);
  if (sec) {
    for (const l of sec[1].split("\n")) {
      const m = l.match(/^\s{2,}([A-Za-z0-9_.]+)\/[A-Za-z0-9_.$]+:?\s*$/);
      if (m) pkgs.add(m[1]);
    }
  }
  for (const m of src.matchAll(/admin=ComponentInfo\{([^/}]+)\//g)) pkgs.add(m[1]);
  return { recognized, pkgs: [...pkgs] };
}
