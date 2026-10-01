# Changelog

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
