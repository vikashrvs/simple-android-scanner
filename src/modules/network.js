import { finding, compose } from "../core/types.js";
import { parseSettingsValue } from "../parsers/settings.js";

const ID = "network";
const TITLE = "Network tampering";

export const network = {
  id: ID,
  title: TITLE,
  description: "Global proxy, always-on VPN, ADB over Wi-Fi, private DNS, user CA certificates (usually unreadable).",
  async run(ctx) {
    const { shell } = ctx;
    const findings = [];
    const checks = [];

    const proxy = await shell("settings get global http_proxy");
    checks.push({ name: "global proxy", ok: proxy.ok, error: proxy.stderr });
    const pv = parseSettingsValue(proxy.stdout);
    if (proxy.ok && pv && pv !== ":0")
      findings.push(finding("HIGH", "Network", "Global HTTP proxy", "All web traffic is routed through a proxy.", `http_proxy=${pv}`,
        "Normal on a corporate or test network you set up yourself."));

    const vpn = await shell("settings get secure always_on_vpn_app");
    checks.push({ name: "always-on VPN", ok: vpn.ok, error: vpn.stderr });
    const vv = parseSettingsValue(vpn.stdout);
    if (vpn.ok && vv)
      findings.push(finding("MEDIUM", "Network", "Always-on VPN", `An always-on VPN app is configured: ${vv}.`, `always_on_vpn_app=${vv}`,
        "Normal if you use a VPN app on purpose."));

    const tcp = await shell("getprop service.adb.tcp.port");
    checks.push({ name: "ADB over TCP", ok: tcp.ok, error: tcp.stderr });
    const tv = tcp.stdout.trim();
    if (tcp.ok && tv && tv !== "-1" && tv !== "0")
      findings.push(finding("HIGH", "Network", "ADB over TCP is on", `Debugging is reachable over the network on port ${tv}.`, `service.adb.tcp.port=${tv}`,
        "Normal only while you are debugging over Wi-Fi yourself."));

    const wifi = await shell("settings get global adb_wifi_enabled");
    checks.push({ name: "wireless debugging", ok: wifi.ok, error: wifi.stderr });
    if (wifi.ok && wifi.stdout.trim() === "1")
      findings.push(finding("MEDIUM", "Network", "Wireless debugging is on", "Wireless debugging is enabled.", "adb_wifi_enabled=1",
        "Turn it off when you are not using it."));

    const dns = await shell("settings get global private_dns_specifier");
    checks.push({ name: "private DNS", ok: dns.ok, error: dns.stderr });
    const dv = parseSettingsValue(dns.stdout);
    if (dns.ok && dv)
      findings.push(finding("INFO", "Network", "Private DNS", `Private DNS provider is set to ${dv}.`, `private_dns_specifier=${dv}`,
        "Normal if you set a DNS provider such as AdGuard or NextDNS."));

    const ca = await shell("ls /data/misc/user/0/cacerts-added");
    const denied = !ca.ok && /denied|No such/i.test(ca.stderr + ca.stdout);
    if (ca.ok && ca.stdout.trim())
      findings.push(finding("HIGH", "Network", "User-installed CA certificates", "Extra certificate authorities are installed.", ca.stdout.trim(),
        "Normal on a corporate phone or if you installed a debugging proxy certificate."));
    checks.push({ name: "user CA certificates", ok: ca.ok, error: denied ? "folder not readable without root" : ca.stderr });

    return compose(ID, TITLE, findings, checks);
  },
};
