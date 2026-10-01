# Test and release report - 1.1.0

## Executed successfully

**56 Node tests**, run using `npm test` with the application modules directly. The result log is in `docs/unit-test-results.txt`.

Coverage includes singles/doubles/mixed preferences, flexible fallback, Kungen, maximum per-round participation, 20-on-five versus 22-on-five capacity, no player/court double booking, valid mixed groups, full-round availability, opt-outs, early departures, legacy preference migration, deterministic seeds, resting rotation, Kungen rotation counts, warnings, snapshot privacy/validation, old snapshots, Unicode links, bounded decoding, HTML escaping, complete text exports and the existing contrast palette.

Property and independent-oracle checks include every headcount 0-32 on 1-8 courts; 60 random multi-round sessions; exact preferred-format comparisons against an exhaustive oracle in 36 small sessions; first-game coverage compared with an independent exhaustive oracle in 60 small sessions; a tight overlapping-availability scenario; and 64 players on 12 courts over 48 rounds.

**52 isolated Chromium UI checks** passed using the updated source with the actual React/ReactDOM runtime. The report is `docs/isolated-browser-checks.json`. They cover live capacity warnings, court-count changes, draft court booking capacity, preference choices, mixed-without-group saving, add/edit/delete, minimum two-player generation, singles/Kungen cards and tables, participation counts, allocated-time wording, keyboard skip navigation, modal Escape/focus return, responsive layouts, read-only sharing and preservation of the local setup.

**Actual browser exports** were downloaded and checked: a Kungen JPEG, HTML, plain text and a ZIP containing six round JPEGs plus both text alternatives. All participants and rotation instructions were present. Desktop, mobile and JPEG output were visually inspected. No JavaScript runtime errors were recorded during these checks.

The source JSX and native-module static distribution also passed syntax checks.

## Scope limitations

The environment could not access the npm registry (`EAI_AGAIN`). Chromium blocked navigation to local and test web origins (`ERR_BLOCKED_BY_ADMINISTRATOR`). Therefore `npm install`, the production Vite build, the provided served Playwright/axe suite, normal ESM/module-worker loading, real-origin browser persistence and actual public hosting were **not verified here**.

For isolated checks, source was transpiled and injected into a browser document. Local storage was represented by an in-memory implementation, and the real main-thread scheduler fallback was exercised. Those checks are useful but do not establish a hosted release pass, an axe pass, or WCAG conformance.

The prebuilt distribution was transpiled offline to native JavaScript modules with the existing locally bundled licensed runtimes. It is not labelled as a successful Vite build. It must still be smoke-tested on the target host.

## Run before publishing

```bash
npm install
npm run check
npx playwright install chromium
npm run test:e2e
```

The Playwright configuration builds and serves the production app. Its tests include real-origin persistence, module-worker generation, axe scans, preference editing, 20/22-player capacity, two-player singles, Kungen, read-only links, mobile overflow and downloads.

Test the final deployed URL as well: add/edit a player, vary court count, check a court closing early, generate all four formats, open the share link on a phone and export a JPEG plus HTML. Review `ACCESSIBILITY.md` with assistive technology before claiming conformance.

## Maintenance rules

Do not relax availability, booking windows, mixed group validity or no-double-booking rules to fill a court. Preferences are intentionally soft. Keep per-round maximum-participation and whole-session coverage regression tests when changing the scheduler. Use `matchPlayerIds()` instead of assuming four people or `teams.flat()` for every match. Kungen stores an ordered `rotation` of three player IDs and no `teams` field. Singles stores two singleton teams; four-person formats store two teams of two.

Never trust totals in a share URL: recompute them from validated assignments, including Kungen counts. Keep import/decompression size bounds and HTML escaping. Do not replace semantic schedule text with a canvas-only UI.
