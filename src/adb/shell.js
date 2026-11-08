/**
 * Returns shell(cmd) -> { ok, stdout, stderr, code }.
 * Failures are never hidden as empty output: callers check `ok`.
 * Uses shell protocol v2 (real exit codes) when the phone supports it,
 * otherwise appends an exit-code marker.
 */
export function makeShell(adb) {
  const v2 = adb.subprocess.shellProtocol;
  const useV2 = Boolean(v2 && v2.isSupported);

  return async function shell(cmd) {
    try {
      if (useV2) {
        const r = await v2.spawnWaitText([cmd]);
        return { ok: r.exitCode === 0, stdout: r.stdout.trim(), stderr: r.stderr.trim(), code: r.exitCode };
      }
      const out = await adb.subprocess.noneProtocol.spawnWaitText([`(${cmd}) 2>&1; echo "__EXIT:$?"`]);
      const m = out.match(/__EXIT:(\d+)\s*$/);
      const code = m ? parseInt(m[1], 10) : null;
      const stdout = out.replace(/__EXIT:\d+\s*$/, "").trim();
      return { ok: code === 0, stdout, stderr: code === 0 ? "" : stdout, code };
    } catch (e) {
      return { ok: false, stdout: "", stderr: String(e?.message || e), code: null };
    }
  };
}
