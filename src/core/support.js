/** Only combinations that were tested on a real phone are "verified". */
export function supportLevel(device) {
  const model = (device?.model || "").toUpperCase();
  const verified =
    (device?.manufacturer || "").toLowerCase() === "samsung" &&
    model.startsWith("SM-G990B") &&
    String(device?.android) === "16";
  return verified
    ? { level: "verified", label: "Verified: Samsung SM-G990B2, Android 16" }
    : { level: "untested", label: "Untested on this Android version or brand. Some checks may be missing or wrong." };
}
