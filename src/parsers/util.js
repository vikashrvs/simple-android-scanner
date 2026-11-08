export const lines = (s) => String(s || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
export const PKG_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
