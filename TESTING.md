# Test and release report

## Current reliability changes

- `npm ci` installs the committed dependency lockfile.
- `npm run check` passes locally: **82 unit tests** and the production Vite build.
- The served Playwright suite contains **25 tests**, including the existing axe, mobile layout, persistence, sharing and download checks plus 12 new reliability/export regressions.
- The local macOS command runner cannot launch Chromium because operating-system process permissions reject its launch. This is an environment failure before any browser test runs, not a passing browser result. The PR workflow runs the full suite on a GitHub-hosted Linux runner; consult its checks for the browser result.

The new regressions cover safe timing/count drafts, successful-schedule restoration, asynchronous legacy restoration, worker construction/loading failures, share-fragment preservation, recovery-envelope import, concurrent-tab conflict resolution and deletion, selected ZIP images, export cancellation, canvas cleanup, image/ZIP memory limits, seeded first-game ties, equivalent mixed selection, optional estimated-playing-time rotation and Stockholm daylight-saving boundaries.

Both rotation modes retain the existing maximum-participation and independent whole-session coverage oracles. Preferred-format optimality is checked for the default mode; estimated-playing-time priority intentionally permits extra fallback assignments to distribute Kungen rests. Local maximum-size scheduling remains approximately 0.4 seconds on a desktop and is not a mobile timing guarantee.

## Run before publishing

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

Both the pull-request and GitHub Pages workflows use these checks, including the production browser suite before deployment. Playwright builds and serves the production app. On Linux CI, browser installation uses `--with-deps`.

Smoke-test the final deployed URL, including add/edit, custom court times, all four formats, both rotation priorities, a share link on a phone and JPEG plus HTML exports. Review `ACCESSIBILITY.md` with assistive technology before claiming conformance.

## Maintenance rules

Do not relax availability, booking windows, mixed group validity or no-double-booking rules to fill a court. Preferences are intentionally soft. Keep per-round maximum-participation and whole-session coverage regression tests when changing the scheduler. Use `matchPlayerIds()` rather than assuming every match has four players or a `teams` field.

Kungen stores an ordered `rotation` of three player IDs and no `teams` field. Singles stores two singleton teams; four-person formats store two teams of two. Allocated minutes include internal Kungen rests; estimated active time assumes an equal rotation and is not measured playing time.

Never trust totals in a share URL: recompute them from validated assignments. Keep import/decompression size bounds and HTML escaping. Local saved assignments must additionally satisfy private player availability and mixed pairing groups. Do not replace semantic schedule text with a canvas-only UI.

## Historical preparation evidence

`docs/unit-test-results.txt` and `docs/isolated-browser-checks.json` record the original 1.1.0 preparation: 56 Node tests and 52 isolated Chromium checks. Those isolated checks used injected source, in-memory storage and the main-thread fallback, and do not establish a current hosted-browser or WCAG conformance pass.

