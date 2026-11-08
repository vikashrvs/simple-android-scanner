/** File header (hex of first bytes) -> what the file really is, or null */
export function magicType(hexRaw) {
  const h = String(hexRaw || "").replace(/\s+/g, "").toLowerCase();
  if (h.startsWith("ffd8ff")) return { type: "JPEG photo", severity: "HIGH" };
  if (h.startsWith("89504e47")) return { type: "PNG image", severity: "HIGH" };
  if (h.startsWith("47494638")) return { type: "GIF image", severity: "HIGH" };
  if (h.slice(8, 16) === "66747970") return { type: "MP4/MOV/HEIC video or photo", severity: "HIGH" };
  if (h.startsWith("52494646")) return { type: "RIFF media (webp/avi/wav)", severity: "MEDIUM" };
  if (h.startsWith("504b0304")) return { type: "ZIP or APK archive", severity: "MEDIUM" };
  if (h.startsWith("6465780a")) return { type: "DEX (Android app code)", severity: "HIGH" };
  if (h.startsWith("7f454c46")) return { type: "ELF native binary", severity: "HIGH" };
  return null;
}

/** Names whose extension does not say what is inside (or has no extension) */
export function hasMisleadingName(path) {
  const name = String(path).split("/").pop();
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return true;
  return /\.(dat|bin|tmp|temp|cache|bak|db|dll|log|data|file|res|obj|so|0|1|x)$/i.test(name);
}

const HIDDEN_IGNORE = /(\/\.thumbnails|\/\.trash|\/\.pending|\/\.cache|\/\.globalTrash|\/\.face|\/\.Gallery2|\/\.estrongs)/i;
const NOMEDIA_IGNORE = /(\/Android\/|\/WhatsApp\/|\/Telegram\/|\/\.thumbnails)/i;

export const isInterestingHiddenDir = (p) => !HIDDEN_IGNORE.test(p) && !p.includes("'");
export const isInterestingNomedia = (p) => !NOMEDIA_IGNORE.test(p + "/") && !p.includes("'");
