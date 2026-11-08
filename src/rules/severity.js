import { finding } from "../core/types.js";

/**
 * installer string -> "store" | "sideload" | "other" | "unknown"
 * sideload: installed from an APK file; other: some other installer app.
 */
export function installerKind(installer, rules) {
  if (!installer || installer === "unknown") return "unknown";
  if (installer === "null") return "sideload";
  if (rules.safeInstallers.includes(installer)) return "store";
  if (rules.sideloadInstallers.includes(installer)) return "sideload";
  return "other";
}

/**
 * PURE. Signals for one app -> findings.
 * Severity comes from signals and combinations, never from a permission count.
 *
 * signals: {
 *   pkg, installer, installerKind, accessibility, admin, notifListener,
 *   installUnknown, overlay, hiddenIcon (true|false|null), smsPerm,
 *   indicator (null | {name}), allowlisted (null | string)
 * }
 */
export function evaluateApp(s) {
  const out = [];
  const known = s.allowlisted;
  const tag = known ? ` (you marked this app as known: ${known})` : "";
  const SA = "Special access";
  const INS = "Installs";

  if (s.indicator) {
    out.push(finding("HIGH", "Indicators", s.pkg,
      `Package matches the stalkerware indicator list: ${s.indicator.name}.`,
      `indicator match: ${s.pkg}`,
      "Only if you installed it yourself on purpose (for example a parental-control app you set up)."));
  }
  if (s.accessibility) {
    out.push(finding("HIGH", SA, s.pkg,
      `Accessibility service is switched on for this app.${tag}`,
      `enabled_accessibility_services contains ${s.pkg}`,
      "Password managers, screen readers, automation tools and some assistants use this legitimately."));
  }
  if (s.admin) {
    out.push(finding("HIGH", SA, s.pkg,
      `This app is an active device administrator.${tag}`,
      `device_policy lists ${s.pkg} as an enabled admin`,
      "Work-profile management, Find My Device and some security or parental apps use this legitimately."));
  }
  if (s.notifListener) {
    out.push(finding("MEDIUM", SA, s.pkg,
      `This app can read all your notifications.${tag}`,
      `enabled_notification_listeners contains ${s.pkg}`,
      "Smartwatch, car and automation apps use this legitimately."));
  }

  const strongAlready = s.accessibility || s.admin || s.indicator;

  if (s.installerKind === "sideload" && s.hiddenIcon === true) {
    if (s.smsPerm && !known) {
      out.push(finding("HIGH", INS, s.pkg,
        "Installed from an APK file, has no launcher icon, and can read or send SMS.",
        `installer=${s.installer}; launcher icon: none; SMS permission granted`,
        "Rare. Normal only for an app you deliberately sideloaded."));
    } else if (!known) {
      out.push(finding("MEDIUM", INS, s.pkg,
        "Installed from an APK file and has no launcher icon.",
        `installer=${s.installer}; launcher icon: none`,
        "Some background or companion apps have no icon."));
    }
  } else if (!known && !strongAlready) {
    if (s.installerKind === "sideload")
      out.push(finding("INFO", INS, s.pkg, "Installed from an APK file, not from a store.", `installer=${s.installer}`,
        "Normal if you installed an APK on purpose."));
    else if (s.installerKind === "other")
      out.push(finding("INFO", INS, s.pkg, `Installed by an unrecognized installer: ${s.installer}.`, `installer=${s.installer}`,
        "Some phone makers and app stores use their own installer."));
    if (s.hiddenIcon === true)
      out.push(finding("INFO", INS, s.pkg, "Has no launcher icon.", "launcher icon: none",
        "Many legitimate background and service apps have no icon."));
  }

  if (!known && !strongAlready) {
    if (s.installUnknown)
      out.push(finding("INFO", SA, s.pkg, "Allowed to install other apps.", "REQUEST_INSTALL_PACKAGES: allow",
        "Browsers, file managers and chat apps often have this."));
    if (s.overlay)
      out.push(finding("INFO", SA, s.pkg, "Allowed to draw over other apps.", "SYSTEM_ALERT_WINDOW: allow",
        "Chat bubbles, screen recorders and some utilities use this."));
  }
  return out;
}
