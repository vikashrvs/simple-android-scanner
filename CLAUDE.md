# Phone Scanner: project rules

Browser-based Android scanner (Vite, vanilla JS, WebUSB ADB via @yume-chan). Run tests with `npx vitest run`. Build with `npm run build`.

## Rules that must not break

1. A failed, empty-because-unsupported, or skipped check is never "clean". Statuses: found, clean, could_not_check, not_run. Use `compose()` in `src/core/types.js`.
2. Shell calls return `{ ok, stdout, stderr, code }`. Check `ok`. Never turn errors into empty strings.
3. Parsers in `src/parsers/` are pure (text in, data out) and tested. No I/O there.
4. Severity comes from signals in `src/rules/severity.js`, never from permission counts. Every finding has reason, proof, and normalWhen.
5. Allowlisting hides low-level noise only. Accessibility, admin, notification-listener and indicator findings always show.
6. The "cannot see" panel and disclaimer appear on every screen and in every report.
7. Never commit real fixtures or reports from a real phone. Use the synthetic data in `src/demo/`.
8. Support level is "verified" only for combinations tested on a real phone (see `src/core/support.js`).

## gstack sprint for changes

Think, Plan (`/plan-eng-review`), Build, `/review`, `/qa` (mock ADB layer; WebUSB cannot be automated), `/cso`, `/ship`.
