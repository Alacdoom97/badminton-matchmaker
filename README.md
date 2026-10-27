# Aura Match 1.1.0

A complete React badminton session planner with flexible **singles, doubles and mixed** preferences, **Kungen** rotations for odd groups, and live court-capacity warnings. The navy, blue and white design from the original release is retained. This is an independent community tool inspired by BMK Aura, not an official club service.

## Run locally

Use Node.js 22.12 or newer in the Node 22 line, and npm. No API keys, database, accounts or environment variables are required by the app.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite. The first visit loads fictional example players. Choose **Start fresh** for your group, or import one of the fictional `examples/*.json` setups.

```bash
npm test                 # scheduler, validation, workspace, sharing, export and contrast tests
npm run build            # production website in dist/
npm run preview          # serve the production build locally
npx playwright install chromium
npm run test:e2e          # actual served-browser and axe checks
```

The committed `package-lock.json` makes local and CI installations reproducible. Both pull requests and GitHub Pages releases run the unit tests, production build and browser checks. See `TESTING.md` for verified scope.

## What changed

**Player preferences:** exactly Singles, Doubles or Mixed. Preferences are requests rather than hard exclusions. The scheduler tries to provide preferred formats, then assigns another format when necessary to include players. A mixed preference can be saved without a pairing group; it falls back to a non-mixed format until a valid mixed group is available.

**Kungen:** a three-player singles rotation. When the available group is odd and fits on the booked courts, one game becomes Kungen instead of leaving a spare player on the bench. Court cards, shared links, HTML/text and JPEG exports show all three participants and the rotation order.

**Capacity warnings:** the planner calculates each round's available players and booked courts. It warns as soon as the setup exceeds capacity, including previews inside the player and court dialogs. Warnings distinguish resting this round from being unable to participate in the whole session.

## Formats and capacity

| Format | Participants per court | Meaning |
| --- | --- | --- |
| Singles | 2 | One player against one player. |
| Doubles | 4 | Two against two, without a gender requirement. |
| Mixed | 4 | Two against two, with one player from each mixed pairing group per team. |
| Kungen | 3 | A three-person singles rotation; two play while the third rests within the court group. |

Kungen's displayed rotation is **1 vs 2, then 2 vs 3, then 3 vs 1**, repeated after each rally or short game as agreed by the group. It is automatic, not a fourth preference selector. It counts as a singles variant when satisfying preferences. This is a social-session convention, not an official tournament rules engine.

| Available players | Booked courts | Result when all are available for the round |
| --- | --- | --- |
| 2 | 1 | One singles game. |
| 3 | 1 | One Kungen group. |
| 5 | 2 | One singles game and one Kungen group. |
| 7 | 2 | One four-person game and one Kungen group. |
| 20 | 5 | Everyone plays in four-person games. |
| 22 | 5 | 20 play; at least two rest that round. |
| 21 | 5 | 20 play; one rests. Kungen cannot expand capacity to 21. |

The maximum is **four participants per available court**. Singles uses two places and Kungen three. The planner changes formats rather than needlessly benching people to preserve singles preferences. Kungen cannot solve a genuine court shortage. One available player alone cannot form a game.

Parity and capacity use the **players available for each complete round**, not just the total registered roster. Late arrival, early departure, round opt-outs and individual court booking windows all apply. For example, 22 registered players may fit on five courts without resting when their availability does not overlap.

## Other features retained

Add, edit, search and remove up to 64 players; record optional gender and playing level; configure 1-12 courts, a 0.5-8 hour session and up to 48 complete rounds. Configure individual arrival/departure times, round opt-outs and court booking times. View court cards or semantic all-round tables. Save/import an editable JSON backup, share a read-only schedule link, or download JPEG, HTML, text and ZIP exports.

All times use the venue's Europe/Stockholm clock. Sessions finish on the same day. Sessions overlapping the skipped or repeated hour during a daylight-saving clock change are rejected. Players and courts must be available for the entire round; leftover time too short for another round is reported. Start time, duration and court count are drafts until you leave the field or press Enter, so clearing a field while typing does not delete existing bookings. Committed timing changes clear round opt-outs and move full-session player/court times to the new booking while retaining custom times. Any setup change clears the generated schedule to prevent stale assignments.

## Scheduler priorities

The scheduler first makes a maximum-cardinality first-game reservation across the whole session. This protects players with limited or overlapping availability: when the available round/court places can give everybody a game, everyone gets at least one. When that is impossible, it covers as many distinct players as possible and reports players with no games.

Every round includes the maximum possible headcount, `min(available players, 4 * available courts)`, except a single isolated participant cannot play alone. First-game reservations are respected; remaining places use playing history, waiting time and future availability to rotate rests.

For the selected players, the planner enumerates valid two-, three- and four-person court layouts and uses minimum-cost role assignment to maximise the number receiving a preferred format. Valid mixed pairing groups remain mandatory. Then a seeded pairing heuristic aims to reduce repeat partners/opponents and balance team levels. Those latter goals and equal playing time are best-effort, not globally optimal guarantees. A court can remain unused when everyone already fits into their preferred formats on fewer courts.

The default **Preferred formats** rotation priority retains that preference ordering. Choose **Estimated playing time** to rotate Kungen's internal rests ahead of format requests and count a Kungen round as two-thirds active time when selecting players. This estimate assumes equal rotation; it is not measured playing time. Both modes retain maximum participation, first-game coverage and all availability limits. Equal-priority first-game reservations use the shuffle seed rather than roster order. Equivalent all-Mixed players can exchange reservations to avoid a needless non-mixed fallback.

Availability and booking times, no double booking and valid mixed groups are hard limits. Preferences are soft. Reshuffling changes the seed, not those limits. Generation normally runs in a module Web Worker; a main-thread fallback exists when Worker is absent.

**Allocated minutes** count a player's assigned court-group rounds, not measured active playing time. Kungen includes internal rests, which are separate from sitting out a whole round. Rotation summaries show Kungen-round counts explicitly.

## Mixed groups and privacy

Mixed pairing groups are selected explicitly with the player's agreement, independently of optional gender. Gender is not inferred from a name and does not automatically select a group. No mixed group means non-mixed formats only, even when Mixed is the preferred format.

Shared schedules include names, match assignments, resting/unavailable status and session details. They omit stored gender, playing level, raw preferences, raw availability and mixed-group fields, although a mixed assignment can still imply pairing categories. Obtain agreement before sharing.

The website is local-first, not live collaboration. Each browser has its own editable planner. A share link is a compressed, fixed snapshot in the URL fragment; send a new link after changes. Anyone with the link can read and forward it. Compression is not encryption, and links cannot be revoked. Browser history/extensions/chat apps may retain them. Large schedules can use the HTML/text/ZIP export instead of a long link.

Keep downloaded backups: browser data can be cleared or unavailable. Invalid saved data is not silently overwritten. Setup backups contain all private profile fields; do not commit them to a public repository. No analytics, application database or external fonts are included; hosting providers can still log ordinary page requests.

Completed schedules are saved with their shuffle seed and restored without rerunning matchmaking. Failed reshuffles preserve the previous schedule. Older setup-only saved sessions regenerate asynchronously. If another planner tab saves or deletes the session, saving pauses and offers a choice of which version to keep. Recovery downloads can be imported through the normal setup importer.

The export dialog lets you choose round images for a ZIP while always including the full HTML and text schedule. Large images automatically reduce resolution to bound bitmap memory. You can cancel image creation or ZIP packaging; exceptionally large packs ask you to choose fewer images.

## Upgrade from 1.0

Save a setup backup before replacing the site. Keep your repository configuration and generated lockfile; replace application files with this complete source release, install dependencies, test and redeploy.

The existing `aura-match:v1` browser storage key and version-1 setup files remain supported. Old `either` preferences migrate to Doubles, which is now flexible; names, gender, mixed group, availability and opt-outs are retained. Existing Singles/Doubles/Mixed fields are not otherwise remapped. Saved generated local schedules are recalculated with the updated scheduler. Old doubles-only read-only snapshots remain readable without regenerating their assignments.

Deploy the complete site, not just one changed file, so recipients can open new Kungen and singles links. Existing source-repository deployment workflows remain included.

## Hosting

Use the supplied GitHub Pages workflow, Netlify configuration or another static host. See `DEPLOYMENT.md` for the original hosting guide and check current provider limits before publishing.

The separate **`aura-match-static-v1.1.0.zip`** contains a ready-to-upload native-module website with local React/ReactDOM/JSZip runtimes. Upload all its contents together; `index.html` must be at the publication root. It was transpiled offline, not generated by Vite. For future source builds, publish `dist/` after `npm run build`. Serve over HTTP/HTTPS, not by double-clicking `file://`.

## Accessibility and verification

The interface targets WCAG 2.2 AA; no full-conformance certification is claimed. Labeled controls, keyboard focus, semantic tables, live capacity announcements, explicit format labels, responsive layouts and text exports are retained. Kungen is shown as an ordered three-player rotation, not a misleading two-person team. Warning meaning is available in text, not color alone.

JPEG is supplementary. Share the matching HTML or text schedule alongside it; both are included in a complete export. See `ACCESSIBILITY.md` for the manual audit checklist and `TESTING.md` for executed checks and environment limitations.

## Project structure

```text
.github/workflows/       CI and GitHub Pages deployment
public/                  Favicon and optional host security headers
src/App.jsx              Workspace, persistence, editing and generation
src/components/          Players, live capacity notice, sessions, matches, dialogs
src/lib/model.js         Validation, migration, time and capacity helpers
src/lib/scheduler.js     First-game coverage, flexible formats, teams and rests
src/lib/sharing.js       Validated and bounded read-only snapshots
src/lib/export.js        JPEG, HTML, text and ZIP exports
examples/                Fictional importable setups for the new features
tests/                   Unit tests and production Playwright/axe checks
docs/                    Executed test results
```

Application code is MIT-licensed; dependencies retain their own licenses. The static distribution includes third-party notices. No club logo or font files are supplied. UI copy is English; player names support Unicode.

