# Changelog

## Unreleased - Reliable edits, fairer rotation and bounded exports

- Keep start time, duration and court count as drafts until a valid value is committed.
- Save successful schedules and shuffle seeds together; restore exact assignments without blocking startup.
- Pause saving when another tab changes the session, and support importing recovery envelopes.
- Preserve shared links during brand navigation and reset generation state after worker failures.
- Seed equal-priority first-game reservations and improve equivalent all-Mixed selections.
- Offer estimated-playing-time rotation priority to spread Kungen's internal rests.
- Reject session windows containing skipped or repeated Stockholm clock times.
- Bound image resolution and ZIP image data, select round images and cancel exports.
- Commit a dependency lockfile and require production browser checks before Pages deployment.

## 1.1.0 - Singles, flexible preferences, capacity and Kungen

- Replace the preference selector with Singles, Doubles and Mixed.
- Treat preferences as flexible requests; fall back to other formats instead of needlessly benching players.
- Support singles from two players and Kungen for an odd included group.
- Check simultaneous court capacity per round, using full player/court availability, and announce shortages while editing.
- Reserve first games across the session so the maximum feasible number of distinct players can participate.
- Rotate whole-round rests and aim to spread internal Kungen rests.
- Update cards, summaries, shared snapshots and every export for one-, two- and three-person sides/groups.
- Describe time totals as allocated court-group minutes; display Kungen-round counts.
- Accept mixed preference without a pairing group and use non-mixed fallback.
- Migrate old `either` preferences to flexible doubles; retain existing workspace/setup compatibility and old share links.
- Add fictional examples and regression/property/oracle tests.

Verification: 56 Node tests and 52 isolated Chromium UI/export checks passed. A normally served Vite build, module-worker loading, full Playwright/axe suite and actual hosting were not verified in the restricted preparation environment. See TESTING.md.

