import {
  validateSetup, slots, isAvailable, activeCourts, matchPlayerIds,
  preferenceFits, capacityReport, minutes,
} from './model.js';

/** Deterministic PRNG: the same setup and seed produce the same schedule. */
export function random(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6D2B79F5; let n = t; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const pairKey = (a, b) => JSON.stringify([a, b].sort());
const count = (map, a, b) => map.get(pairKey(a, b)) || 0;
function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Minimum-cost perfect assignment (Hungarian), rows = players, columns = roles.
 * Forbidden mixed roles have a finite sentinel cost, then are checked explicitly.
 * The input is square; every selected player gets exactly one place on court.
 */
function assign(costs) {
  const n = costs.length, u = new Float64Array(n + 1), v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1), way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    const min = new Float64Array(n + 1).fill(Infinity), used = new Uint8Array(n + 1);
    let j0 = 0;
    do {
      used[j0] = 1;
      const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = costs[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < min[j]) { min[j] = cur; way[j] = j0; }
        if (min[j] < delta) { delta = min[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else min[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
  }
  return Array.from(p.subarray(1), row => row - 1);
}
function bestTeams(group, type, partners, opponents) {
  const [a, b, c, d] = group;
  const choices = type === 'mixed'
    ? [[[a, c], [b, d]], [[a, d], [b, c]]]
    : [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
  let best;
  for (const teams of choices) {
    let cost = 0;
    for (const team of teams) cost += count(partners, team[0].id, team[1].id) * 8;
    for (const a of teams[0]) for (const b of teams[1]) cost += count(opponents, a.id, b.id) * 1.2;
    cost += Math.abs(teams[0].reduce((n, p) => n + p.level, 0) - teams[1].reduce((n, p) => n + p.level, 0)) * 3;
    if (!best || cost < best.cost) best = { type, teams: teams.map(t => t.map(p => p.id)), cost };
  }
  return best;
}

/** Make teams within already assigned format pools. Only pairing quality is heuristic. */
function pairPools(pools, kungen, partners, opponents, stats, rng) {
  let best;
  for (let attempt = 0; attempt < 12; attempt++) {
    const matches = []; let cost = 0;
    let singles = shuffle(pools.singles, rng);
    if (kungen) {
      // Prefer players with fewer internal Kungen rests; randomise equal counts.
      singles.sort((a, b) => stats.get(a.id).kungen - stats.get(b.id).kungen);
      const trio = singles.splice(0, 3);
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        cost += count(opponents, trio[i].id, trio[j].id) + Math.abs(trio[i].level - trio[j].level);
      }
      matches.push({ type: 'kungen', rotation: shuffle(trio, rng).map(p => p.id) });
    }
    singles = shuffle(singles, rng);
    for (let i = 0; i < singles.length; i += 2) {
      const a = singles[i], b = singles[i + 1];
      cost += count(opponents, a.id, b.id) * 3 + Math.abs(a.level - b.level) * 3;
      matches.push({ type: 'singles', teams: [[a.id], [b.id]] });
    }
    const doubles = shuffle(pools.doubles, rng), women = shuffle(pools.woman, rng), men = shuffle(pools.man, rng);
    for (let i = 0; i < doubles.length; i += 4) {
      const { cost: c, ...match } = bestTeams(doubles.slice(i, i + 4), 'doubles', partners, opponents);
      cost += c; matches.push(match);
    }
    for (let i = 0; i < women.length; i += 2) {
      const { cost: c, ...match } = bestTeams([...women.slice(i, i + 2), ...men.slice(i, i + 2)], 'mixed', partners, opponents);
      cost += c; matches.push(match);
    }
    if (!best || cost < best.cost) best = { matches, cost };
  }
  return best;
}

/** Enumerate every 2/3/4-player court composition, then optimise preferences.
 * One Kungen group replaces a singles court for an odd selected headcount.
 * Even headcounts use ordinary singles/doubles, not unnecessary Kungen rests.
 */
function arrange(selected, courtCount, partners, opponents, stats, rng) {
  if (selected.length < 2 || !courtCount) return [];
  const n = selected.length, kungen = n % 2;
  const women = selected.filter(p => p.mixedGroup === 'woman').length;
  const men = selected.filter(p => p.mixedGroup === 'man').length;
  // One mismatch outweighs every possible fairness tie-break combined.
  const mismatchWeight = 100_000, forbidden = 1_000_000_000;
  const jitter = new Map(selected.map(p => [p.id, rng()]));
  let best = null;
  for (let fours = 0; fours <= Math.floor((n - 3 * kungen) / 4); fours++) {
    const singles = (n - 3 * kungen - fours * 4) / 2;
    if (singles < 0 || singles + fours + kungen > courtCount) continue;
    for (let mixed = 0; mixed <= Math.min(fours, Math.floor(women / 2), Math.floor(men / 2)); mixed++) {
      const roles = [
        ...Array(singles * 2 + kungen * 3).fill('singles'),
        ...Array((fours - mixed) * 4).fill('doubles'),
        ...Array(mixed * 2).fill('woman'), ...Array(mixed * 2).fill('man'),
      ];
      const costs = selected.map(p => roles.map(role => {
        const mixedRole = role === 'woman' || role === 'man';
        if (mixedRole && p.mixedGroup !== role) return forbidden;
        const fallback = p.preference !== (mixedRole ? 'mixed' : role);
        return fallback ? mismatchWeight + stats.get(p.id).fallbacks * 10 + jitter.get(p.id) : 0;
      }));
      const assignment = assign(costs);
      if (assignment.some((row, col) => costs[row][col] >= forbidden)) continue;
      const pools = { singles: [], doubles: [], woman: [], man: [] };
      let preferenceCost = 0;
      assignment.forEach((row, col) => { pools[roles[col]].push(selected[row]); preferenceCost += costs[row][col]; });
      // Avoid expensive partner search for strictly worse preference assignments.
      if (best && preferenceCost > best.preferenceCost + 0.00001) continue;
      const paired = pairPools(pools, kungen, partners, opponents, stats, rng);
      if (!best || preferenceCost < best.preferenceCost - 0.00001 || paired.cost < best.cost) {
        best = { ...paired, preferenceCost };
      }
    }
  }
  if (!best) throw new Error('Could not construct a valid court layout. Check the session settings.');
  return shuffle(best.matches, rng);
}

/** Maximum-cardinality first-game reservation across the whole session.
 * This is a capacitated bipartite matching: each player needs one round; each
 * round has its achievable 2/3/4-player capacity. Augmenting paths can move a
 * reservation to a later round to make room for someone with fewer options.
 * Already-played people do not consume their later reservation.
 */
function reserveFirstGames(settings, players, rounds) {
  const candidates = rounds.map(slot => players.filter(p => isAvailable(p, slot)));
  const capacities = rounds.map((slot, i) => {
    const maximum = Math.min(candidates[i].length, activeCourts(settings, slot).length * 4);
    return maximum === 1 ? 0 : maximum;
  });
  const choices = new Map(players.map(p => [p.id, rounds.filter((slot, i) => capacities[i] > 0 && isAvailable(p, slot)).map(slot => slot.index)]));
  const owners = rounds.map(() => []);
  function place(id, visited) {
    for (const r of choices.get(id)) {
      if (visited.has(r)) continue;
      visited.add(r);
      if (owners[r].length < capacities[r]) { owners[r].push(id); return true; }
      for (let i = 0; i < owners[r].length; i++) {
        if (place(owners[r][i], visited)) { owners[r][i] = id; return true; }
      }
    }
    return false;
  }
  const ordered = [...players].sort((a, b) => choices.get(a.id).length - choices.get(b.id).length);
  for (const p of ordered) place(p.id, new Set());
  return new Map(owners.flatMap((ids, r) => ids.map(id => [id, r])));
}

/**
 * Hard limits: whole-round availability, no double booking, court capacity, and
 * valid mixed teams. Preferences are soft and never cause avoidable benching.
 * Reserve first games for the largest feasible set of players, then select
 * remaining players fairly and include min(available, 4 * courts), except
 * an isolated single player cannot form a match. Assignment maximises preferred
 * formats for that selected group; partner/level quality remains a heuristic.
 */
export function generateSchedule(input) {
  const { settings, players, seed } = validateSetup(input);
  const rounds = slots(settings), rng = random(seed);
  const stats = new Map(players.map(p => [p.id, { games: 0, eligible: 0, waiting: 0, kungen: 0, fallbacks: 0 }]));
  const partners = new Map(), opponents = new Map(), byId = new Map(players.map(p => [p.id, p]));
  const eligibility = new Map(players.map(p => [p.id, rounds.map(r => isAvailable(p, r) && activeCourts(settings, r).length > 0)]));
  const reservations = reserveFirstGames(settings, players, rounds);
  const result = [];
  for (const slot of rounds) {
    const courts = activeCourts(settings, slot), available = players.filter(p => isAvailable(p, slot));
    const availableIds = new Set(available.map(p => p.id));
    const target = Math.min(available.length, courts.length * 4);
    const priority = new Map(available.map(p => {
      const s = stats.get(p.id);
      if (courts.length) s.eligible++;
      const remaining = eligibility.get(p.id).slice(slot.index).filter(Boolean).length;
      // First games and short availability windows precede repeat games. Then
      // balance participation relative to eligibility, with a waiting boost.
      const score = (s.games === 0 ? 10000 + 1000 / Math.max(1, remaining) : 0)
        + 100 * (1 - s.games / Math.max(1, s.eligible)) + s.waiting * 5
        + 5 / Math.max(1, remaining) + rng() * 0.1;
      return [p.id, score];
    }));
    const reservedNow = p => reservations.get(p.id) === slot.index && stats.get(p.id).games === 0 ? 1 : 0;
    const selected = [...available].sort((a, b) => reservedNow(b) - reservedNow(a) || priority.get(b.id) - priority.get(a.id)).slice(0, target === 1 ? 0 : target);
    const matches = arrange(selected, courts.length, partners, opponents, stats, rng).map((m, i) => ({ courtId: courts[i].id, ...m }));
    const playing = new Set(matches.flatMap(matchPlayerIds));
    for (const match of matches) {
      const ids = matchPlayerIds(match);
      for (const id of ids) {
        const s = stats.get(id);
        if (match.type === 'kungen') s.kungen++;
        if (!preferenceFits(byId.get(id).preference, match.type)) s.fallbacks++;
      }
      if (match.type === 'kungen') {
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
          opponents.set(pairKey(ids[i], ids[j]), count(opponents, ids[i], ids[j]) + 1);
        }
      } else {
        for (const team of match.teams) if (team.length === 2) partners.set(pairKey(...team), count(partners, ...team) + 1);
        for (const a of match.teams[0]) for (const b of match.teams[1]) opponents.set(pairKey(a, b), count(opponents, a, b) + 1);
      }
    }
    for (const p of players) {
      const s = stats.get(p.id);
      if (playing.has(p.id)) { s.games++; s.waiting = 0; }
      else if (availableIds.has(p.id) && courts.length) s.waiting++;
      else s.waiting = 0;
    }
    result.push({ ...slot, matches,
      resting: available.filter(p => !playing.has(p.id)).map(p => p.id),
      unavailable: players.filter(p => !availableIds.has(p.id)).map(p => p.id),
      emptyCourts: courts.slice(matches.length).map(c => c.id),
      closedCourts: settings.courts.filter(c => !courts.some(a => a.id === c.id)).map(c => c.id),
    });
  }
  const warnings = [], capacity = capacityReport(settings, players);
  if (capacity.peak) warnings.push(`Court capacity: ${capacity.affected.length} round(s) require resting players. The largest shortfall is ${capacity.peak.minimumResting}: ${capacity.peak.available} available players for ${capacity.peak.courts} court(s), with room for ${capacity.peak.capacity}. Resting turns rotate; not everyone can play in the same round.`);
  const fallbackCount = [...stats.values()].reduce((n, s) => n + s.fallbacks, 0);
  if (fallbackCount) warnings.push(`${fallbackCount} player-round assignment(s) use another format to keep players involved. Preferences are flexible; availability and mixed pairing groups remain hard limits.`);
  if (result.some(r => r.matches.some(m => m.type === 'kungen'))) warnings.push('Kungen includes three players in one singles rotation: 1 vs 2, then 2 vs 3, then 3 vs 1; repeat. Two play while the third rests within that court group. Allocated minutes include this internal rotation, not continuous playing time.');
  const idle = result.reduce((n, r) => n + r.emptyCourts.length, 0);
  if (idle) warnings.push(`${idle} booked court slot(s) are unused. There may be fewer players than needed, or the preferred formats fit on fewer courts. No available player is benched just to preserve a preference.`);
  const none = players.filter(p => stats.get(p.id).games === 0);
  if (none.length) warnings.push(`No games possible in this line-up for: ${none.map(p => p.name).join(', ')}. Review availability, opted-out rounds, court capacity and the number of rounds; playing time is not guaranteed when those limits conflict.`);
  const unused = minutes(settings.start) + settings.duration - (rounds.at(-1)?.end ?? minutes(settings.start));
  if (unused > 0) warnings.push(`${unused} minutes remain after the final full round. Partial rounds are not scheduled.`);
  return { rounds: result, warnings, totals: Object.fromEntries([...stats].map(([id, s]) => [id, { games: s.games, eligible: s.eligible, kungen: s.kungen }])) };
}
