/**
 * Synthetic phone for the demo mode and for tests. Everything here is invented:
 * it shows what the scanner reports when a phone has a stalkerware-like app.
 */
const ok = (stdout = "") => ({ ok: true, stdout, stderr: "", code: 0 });
const bad = (stderr) => ({ ok: false, stdout: "", stderr, code: 1 });

const DUMP = `Packages:
  Package [com.whatsapp] (a1):
    versionName=2.25.1
    installerPackageName=com.android.vending
    firstInstallTime=2026-01-02 10:00:00
    lastUpdateTime=2026-10-01 09:00:00
    runtime permissions:
      android.permission.READ_CONTACTS: granted=true
  Package [com.demo.notes] (a2):
    versionName=1.0
    installerPackageName=com.android.vending
    firstInstallTime=2026-02-02 10:00:00
  Package [com.demo.screenwatch] (a3):
    versionName=3.1
    installerPackageName=com.google.android.packageinstaller
    firstInstallTime=2026-10-20 23:41:00
    runtime permissions:
      android.permission.READ_SMS: granted=true
      android.permission.RECEIVE_SMS: granted=true
  Package [com.example.indicator.test] (a4):
    versionName=1.0
    installerPackageName=null
    firstInstallTime=2026-10-21 00:02:00
  Package [com.demo.fileshare] (a5):
    versionName=2.0
    installerPackageName=com.android.vending
Hidden system packages:
`;

export const DEMO_OUTPUTS = {
  "getprop ro.product.manufacturer": ok("samsung"),
  "getprop ro.product.model": ok("SM-DEMO1"),
  "getprop ro.build.version.release": ok("15"),
  "getprop ro.build.version.sdk": ok("35"),
  "getprop ro.build.version.security_patch": ok("2026-06-05"),
  "getprop ro.boot.verifiedbootstate": ok("green"),
  "getprop ro.debuggable": ok("0"),
  "pm list users": ok("Users:\n\tUserInfo{0:Owner:c13} running"),
  "pm list packages -3 -i": ok(
    [
      "package:com.whatsapp  installer=com.android.vending",
      "package:com.demo.notes  installer=com.android.vending",
      "package:com.demo.screenwatch  installer=com.google.android.packageinstaller",
      "package:com.example.indicator.test  installer=null",
      "package:com.demo.fileshare  installer=com.android.vending",
    ].join("\n")
  ),
  "dumpsys package": ok(DUMP),
  "settings get secure enabled_accessibility_services": ok("com.example.indicator.test/com.example.indicator.test.WatchService"),
  "settings get secure enabled_notification_listeners": ok("null"),
  "dumpsys device_policy": ok("Device Policy Manager state:\n  Enabled Device Admins (User 0, provisioningState: 0):\n    com.demo.screenwatch/com.demo.screenwatch.AdminReceiver:\n      uid=10211\n"),
  "cmd appops query-op REQUEST_INSTALL_PACKAGES allow": ok("Package com.demo.fileshare:\nPackage com.demo.screenwatch:"),
  "cmd appops query-op SYSTEM_ALERT_WINDOW allow": ok("No operations."),
  "cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER": ok(
    "3 activities found:\ncom.whatsapp/com.whatsapp.Main\ncom.demo.notes/com.demo.notes.Main\ncom.demo.fileshare/com.demo.fileshare.Main"
  ),
  "settings get global http_proxy": ok("null"),
  "settings get secure always_on_vpn_app": ok("null"),
  "getprop service.adb.tcp.port": ok(""),
  "settings get global adb_wifi_enabled": ok("0"),
  "settings get global private_dns_specifier": ok("null"),
  "ls /data/misc/user/0/cacerts-added": bad("ls: /data/misc/user/0/cacerts-added: Permission denied"),
};

/** Returns a shell(cmd) with the same contract as the real one. Unknown commands fail loudly. */
export function makeFakeShell(outputs = DEMO_OUTPUTS) {
  return async (cmd) => outputs[cmd] ?? bad(`demo: no canned output for: ${cmd}`);
}
