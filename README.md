# Phone Scanner

A browser-based Android scanner. It reads your phone over USB (WebUSB + ADB) and looks for common signs of stalkerware and tampering. Everything runs in your browser. Nothing is uploaded anywhere.

## What it checks

| Check | What it looks for |
|---|---|
| Special access | Accessibility services, device admins, notification listeners, install-unknown and overlay permissions |
| Installs | Apps installed from APK files, apps with no launcher icon, and risky combinations of both |
| Indicators | Package names matched against a stalkerware indicator list (see below) |
| Network | Global proxy, always-on VPN, ADB over Wi-Fi, private DNS |
| Device | Verified boot state, debuggable build, old security patch, extra user profiles |
| Shared storage (off by default) | Hidden folders, `.nomedia` folders hiding media, APK files, files whose type differs from their name |

Every finding has a reason, a proof line, and a line saying when it is normal. Severity comes from signals and combinations, never from a permission count.

## What it cannot see

- Private data inside any app (calculator vaults and hidden-photo apps keep files in private storage)
- Secure Folder and other user or work profiles
- Firmware-level or advanced spyware (Pegasus-type)
- Deleted files and encrypted containers
- What apps are doing right now (no live network monitoring)
- User-installed CA certificates on most phones (not readable without root)
- Anything marked "could not check" or "not run"

**A clean result means common signs were not found. It does not mean the phone is safe.**

Every check ends as one of: `found`, `clean`, `could not check`, `not run`. A failed or skipped check is never shown as clean.

## Tested on

- Samsung SM-G990B2, Android 16: verified
- Everything else: untested. The report says so at the top. Commands and output formats differ between Android versions and brands.

## Privacy and responsible use

- All scanning and PDF generation happens in the browser.
- The only thing stored is your "known apps" list, in your browser's local storage.
- A report contains your app list and device model. The PDF has options to leave out the app list and mask package names.
- Use this on your own phone, or one you have explicit permission to check.

## Run locally (Windows)

```powershell
npm.cmd install
npm.cmd run dev
```

Open the printed `http://localhost:5173/` link in Chrome or Edge (desktop).

On the phone: Settings, About phone, tap Build number 7 times, then Developer options, turn on USB debugging. Plug in the cable, choose File transfer, click Connect phone, and tap Allow on the phone. If you used ADB before, run `adb kill-server` and close Smart Switch so the browser can claim the phone.

No phone handy? Click "Try the demo phone". It runs the real scanner against invented data.

## Tests

```powershell
npm.cmd test
```

Parsers are pure functions tested against saved ADB output. Never commit real fixtures from your own phone: they contain your app list.

## Deploy to GitHub Pages

1. Push to a repo with a `main` branch.
2. Settings, Pages, Source: **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs tests, builds with the right base path, and deploys. WebUSB needs HTTPS, which Pages provides.

## Stalkerware indicator list

`src/rules/indicators.json` ships without a verified list, so the indicator check reports **could not check** instead of pretending to match. To enable it, import a public list (for example the community stalkerware-indicators project, check it is current), and record its `source`, `version`, `fetchedAt` and licence in the file and here. Entries look like `{ "pkg": "com.example.app", "name": "Display name" }`.

## Structure

```
src/
  adb/        connection (WebUSB) and shell wrapper with exit codes
  parsers/    pure functions: ADB text in, data out
  rules/      severity logic, allowlist, indicators
  modules/    one file per check, each returns a ModuleResult
  core/       data shapes, runner, support level, limits text
  report/     summary, report model, PDF, JSON
  ui/         stepped interface
  demo/       synthetic phone for demo mode and tests
tests/
```

## Adding a check

1. Write a pure parser in `src/parsers/` and test it with sample output.
2. Add a module in `src/modules/` that returns `compose(id, title, findings, checks)`.
3. Register it in `src/modules/index.js`.
4. Add what it cannot see to `src/core/cannotSee.js`.
