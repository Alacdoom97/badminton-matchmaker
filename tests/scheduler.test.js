import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankSetup, demoSetup, validateSetup, minutes, isAvailable, activeCourts, slots,
  matchPlayerIds, preferenceFits, capacityReport, PREFERENCES,
} from '../src/lib/model.js';
import { generateSchedule, random } from '../src/lib/scheduler.js';

const player = (i, changes = {}) => ({ id: `p${i}`, name: `Player ${i}`, gender: i % 2 ? 'man' : 'woman', mixedGroup: i % 2 ? 'man' : 'woman', preference: 'doubles', level: 3, arrival: '18:00', departure: '20:00', skipRounds: [], ...changes });
function fixture(n = 16, courts = 3) {
  const s = blankSetup(); s.settings.date = '2026-10-01';
  s.settings.courts = Array.from({ length: courts }, (_, i) => ({ id: `court-${i + 1}`, name: `Court ${i + 1}`, from: '18:00', until: '20:00' }));
  s.players = Array.from({ length: n }, (_, i) => player(i)); return s;
}
function invariants(raw, schedule) {
  const setup = validateSetup(raw), byId = new Map(setup.players.map(p => [p.id, p]));
  const actual = Object.fromEntries(setup.players.map(p => [p.id, { games: 0, kungen: 0 }]));
  for (const r of schedule.rounds) {
    assert.ok(r.end <= minutes(setup.settings.start) + setup.settings.duration);
    const ids = r.matches.flatMap(matchPlayerIds), available = setup.players.filter(p => isAvailable(p, r));
    const capacity = activeCourts(setup.settings, r).length * 4;
    const target = Math.min(available.length, capacity);
    assert.equal(ids.length, target === 1 ? 0 : target, 'Maximum participation, independent of preferences');
    assert.equal(new Set(ids).size, ids.length, 'No double-booked player');
    assert.equal(new Set(r.matches.map(m => m.courtId)).size, r.matches.length, 'No double-booked court');
    assert.equal(r.matches.filter(m => m.type === 'kungen').length, ids.length % 2, 'Exactly one Kungen for an odd included group');
    for (const m of r.matches) {
      assert.ok(activeCourts(setup.settings, r).some(c => c.id === m.courtId));
      if (m.type === 'kungen') { assert.equal(m.rotation.length, 3); assert.equal(m.teams, undefined); }
      else {
        assert.equal(m.teams.length, 2);
        for (const team of m.teams) {
          assert.equal(team.length, m.type === 'singles' ? 1 : 2);
          if (m.type === 'mixed') assert.deepEqual(team.map(id => byId.get(id).mixedGroup).sort(), ['man', 'woman']);
        }
      }
      for (const id of matchPlayerIds(m)) {
        const p = byId.get(id); assert.ok(p); actual[id].games++;
        if (m.type === 'kungen') actual[id].kungen++;
        assert.ok(isAvailable(p, r), 'Players are available for the WHOLE round');
      }
    }
    assert.deepEqual([...ids, ...r.resting, ...r.unavailable].sort(), setup.players.map(p => p.id).sort());
    assert.deepEqual([...r.matches.map(m => m.courtId), ...r.emptyCourts, ...r.closedCourts].sort(), setup.settings.courts.map(c => c.id).sort());
    assert.ok(r.resting.every(id => isAvailable(byId.get(id), r)));
    assert.ok(r.unavailable.every(id => !isAvailable(byId.get(id), r)));
  }
  for (const [id, counts] of Object.entries(actual)) {
    assert.equal(schedule.totals[id].games, counts.games);
    assert.equal(schedule.totals[id].kungen, counts.kungen);
  }
}

test('preferences are exactly singles, doubles and mixed', () => assert.deepEqual(Object.keys(PREFERENCES), ['singles', 'doubles', 'mixed']));
test('demo schedule respects every availability and capacity limit', () => { const s = demoSetup(), r = generateSchedule(s); invariants(s, r); assert.equal(r.rounds.length, 6); assert.ok(r.rounds.some(r => r.matches.some(m => m.type === 'mixed'))); });
test('two players can play singles', () => { const s = fixture(2, 1), r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches[0].type === 'singles')); });
test('three players use Kungen with nobody benched', () => { const s = fixture(3, 1), r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches[0].type === 'kungen' && r.resting.length === 0)); });
test('five players on two courts use one singles and one Kungen', () => { const s = fixture(5, 2), r = generateSchedule(s); invariants(s, r); for (const round of r.rounds) assert.deepEqual(round.matches.map(m => m.type).sort(), ['kungen', 'singles']); });
test('seven players on two courts use doubles and Kungen even without singles preferences', () => { const s = fixture(7, 2), r = generateSchedule(s); invariants(s, r); for (const round of r.rounds) assert.deepEqual(round.matches.map(m => m.type).sort(), ['doubles', 'kungen']); });
test('eleven players on three courts all join matches', () => { const s = fixture(11, 3), r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.resting.length === 0 && r.matches.filter(m => m.type === 'kungen').length === 1)); });
test('20 players on five courts all play with no capacity warning', () => { const s = fixture(20, 5), r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches.length === 5 && r.resting.length === 0)); assert.equal(capacityReport(s.settings, s.players).affected.length, 0); assert.ok(!r.warnings.some(w => w.startsWith('Court capacity'))); });
test('22 players on five courts rest two per round and rotate everyone through', () => { const s = fixture(22, 5), r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches.length === 5 && r.resting.length === 2)); assert.ok(Object.values(r.totals).every(s => s.games > 0)); assert.notDeepEqual(r.rounds[0].resting, r.rounds[1].resting); assert.ok(r.warnings.some(w => w.includes('shortfall is 2'))); assert.equal(capacityReport(s.settings, s.players).peak.minimumResting, 2); });
test('odd overflow never replaces doubles with Kungen at the expense of another player', () => { const s = fixture(21, 5), r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.resting.length === 1 && r.matches.every(m => m.type === 'doubles'))); });
test('all-singles preferences fall back to doubles rather than unnecessary benching', () => { const s = fixture(20, 5); s.players.forEach(p => { p.preference = 'singles'; p.mixedGroup = 'none'; }); const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches.every(m => m.type === 'doubles'))); assert.ok(r.warnings.some(w => w.includes('another format'))); });
test('four singles-preferring players use two singles courts when available', () => { const s = fixture(4, 2); s.players.forEach(p => p.preference = 'singles'); const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches.length === 2 && r.matches.every(m => m.type === 'singles'))); });
test('mixed preferences without compatible groups fall back to other games', () => { const s = fixture(8, 2); s.players.forEach(p => { p.preference = 'mixed'; p.mixedGroup = 'man'; }); const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches.length === 2 && r.resting.length === 0)); assert.ok(r.rounds.flatMap(r => r.matches).every(m => m.type !== 'mixed')); });
test('mixed can be saved without a mixed group and will fall back', () => { const s = fixture(4, 1); s.players.forEach(p => { p.preference = 'mixed'; p.mixedGroup = 'none'; }); const r = generateSchedule(s); invariants(s, r); assert.equal(r.rounds[0].matches[0].type, 'doubles'); });
test('gender does not determine mixed grouping', () => { const s = fixture(4, 1); s.players.forEach(p => { p.gender = 'nonbinary'; p.preference = 'mixed'; }); const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches[0].type === 'mixed')); });
test('mixed is preserved when a 2+2 pairing group is available', () => { const s = fixture(8, 2); s.players.slice(0, 4).forEach(p => p.preference = 'mixed'); const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches.some(m => m.type === 'mixed') && r.matches.some(m => m.type === 'doubles'))); });
test('legacy either preferences migrate to flexible doubles without losing player data', () => { const s = fixture(4); s.players[0].preference = 'either'; s.players[0].skipRounds = [2]; const v = validateSetup(s); assert.equal(v.players[0].preference, 'doubles'); assert.deepEqual(v.players[0].skipRounds, [2]); invariants(s, generateSchedule(s)); });
test('late arrivals, early departures, opt-outs and exact boundaries', () => { const s = fixture(); s.players[0].arrival = '18:21'; s.players[1].departure = '19:01'; s.players[2].skipRounds = [0, 2]; s.players[3].departure = '19:00'; const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds[1].unavailable.includes('p0')); assert.ok(r.rounds[2].unavailable.includes('p2')); assert.ok(r.rounds[3].unavailable.includes('p1')); assert.ok(!r.rounds[2].unavailable.includes('p3')); assert.ok(r.rounds[3].unavailable.includes('p3')); });
test('Kungen follows available headcount, not the total registered roster', () => { const s = fixture(6, 2); s.players[0].departure = '18:20'; const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds[0].matches.every(m => m.type !== 'kungen')); assert.ok(r.rounds[1].matches.some(m => m.type === 'kungen')); });
test('court availability is checked independently for full rounds', () => { const s = fixture(20); s.settings.courts[0].from = '18:21'; s.settings.courts[1].until = '19:00'; const r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds[1].closedCourts.includes('court-1')); assert.ok(!r.rounds[2].closedCourts.includes('court-1')); assert.ok(r.rounds[3].closedCourts.includes('court-2')); });
test('live capacity report considers arrival, departure, opt-outs and court windows', () => { const s = fixture(22, 5); s.players[20].arrival = '18:20'; s.players[21].skipRounds = [0]; s.settings.courts[4].until = '19:00'; const c = capacityReport(s.settings, s.players); assert.equal(c.rounds[0].minimumResting, 0); assert.equal(c.rounds[1].minimumResting, 2); assert.equal(c.rounds[3].capacity, 16); assert.equal(c.rounds[3].minimumResting, 6); });
test('non-overlapping roster above capacity does not claim simultaneous overflow', () => { const s = fixture(8, 1); s.players.slice(0, 4).forEach(p => p.departure = '19:00'); s.players.slice(4).forEach(p => p.arrival = '19:00'); const c = capacityReport(s.settings, s.players); assert.equal(c.roster, 8); assert.equal(c.maximum, 4); assert.equal(c.affected.length, 0); invariants(s, generateSchedule(s)); });
test('players leaving after the first round get first-game priority over repeat games', () => { const s = fixture(10, 2); s.players.slice(8).forEach(p => p.departure = '18:20'); const r = generateSchedule(s); assert.ok(r.rounds[0].matches.flatMap(matchPlayerIds).includes('p8')); assert.ok(r.rounds[0].matches.flatMap(matchPlayerIds).includes('p9')); assert.ok(Object.values(r.totals).every(s => s.games > 0)); });
test('one round and insufficient space honestly warns about players with no games', () => { const s = fixture(22, 5); s.settings.duration = 30; const r = generateSchedule(s); assert.equal(Object.values(r.totals).filter(s => s.games === 0).length, 2); assert.ok(r.warnings.some(w => w.includes('No games possible'))); });
test('seed is deterministic and reshuffle changes partners', () => { const s = fixture(); assert.deepEqual(generateSchedule(s), generateSchedule(s)); assert.notDeepEqual(generateSchedule(s).rounds, generateSchedule({ ...s, seed: 2 }).rounds); });
test('equal availability yields near-even resting rotation', () => { const s = fixture(22, 5), r = generateSchedule(s), games = Object.values(r.totals).map(p => p.games); assert.ok(Math.max(...games) - Math.min(...games) <= 1); });
test('five singles players rotate Kungen assignments, not the same trio each round', () => { const s = fixture(5, 2); s.players.forEach(p => p.preference = 'singles'); const r = generateSchedule(s), games = Object.values(r.totals).map(p => p.kungen); assert.ok(Math.max(...games) - Math.min(...games) <= 1); });
test('changeover and trailing minutes never create partial rounds', () => { const s = fixture(); s.settings.duration = 125; s.settings.roundMinutes = 25; s.settings.breakMinutes = 5; const r = generateSchedule(s); assert.equal(r.rounds.length, 4); assert.equal(r.rounds[3].end, 1195); assert.ok(r.warnings.some(w => w.includes('10 minutes remain'))); invariants(s, r); });
test('empty and one-player rosters do not crash or invent a game', () => { for (const n of [0, 1]) { const s = fixture(n), r = generateSchedule(s); invariants(s, r); assert.ok(r.rounds.every(r => r.matches.length === 0)); } });
test('no booked court in a round leaves everyone resting and reports capacity', () => { const s = fixture(3, 1); s.settings.courts[0].from = '19:00'; const r = generateSchedule(s); invariants(s, r); assert.equal(r.rounds[0].resting.length, 3); assert.equal(capacityReport(s.settings, s.players).rounds[0].minimumResting, 3); });
test('validation rejects malformed intervals, duplicate names, bad dates and unsupported preferences', () => { const s = fixture(); assert.throws(() => validateSetup({ ...s, settings: { ...s.settings, start: '23:00' } }), /same day/); assert.throws(() => validateSetup({ ...s, settings: { ...s.settings, roundMinutes: 0 } }), /Round length/); assert.throws(() => validateSetup({ ...s, players: [s.players[0], { ...s.players[1], name: s.players[0].name }] }), /unique/); assert.throws(() => validateSetup({ ...s, settings: { ...s.settings, date: '2026-02-30' } }), /valid date/); assert.throws(() => validateSetup({ ...s, players: [{ ...s.players[0], preference: 'invalid' }] }), /preference/); });
test('last full round stays inside the booking', () => { const s = fixture(8); s.settings.duration = 30; assert.equal(slots(s.settings).length, 1); const r = generateSchedule(s); assert.equal(r.rounds[0].end, 1100); invariants(s, r); });
test('all headcounts 0-32 and 1-8 courts attain maximum participation', () => { for (let n = 0; n <= 32; n++) for (let c = 1; c <= 8; c++) { const s = fixture(n, c); s.settings.duration = 30; s.players.forEach((p, i) => p.preference = ['singles', 'doubles', 'mixed'][i % 3]); invariants(s, generateSchedule(s)); } });
test('60 seeded random sessions preserve limits and use every possible place', () => { const rng = random(731); for (let i = 0; i < 60; i++) { const s = fixture(2 + Math.floor(rng() * 35), 1 + Math.floor(rng() * 8)); s.seed = i; s.settings.duration = 60; s.players.forEach(p => { p.preference = ['singles', 'doubles', 'mixed'][Math.floor(rng() * 3)]; p.mixedGroup = ['woman', 'man', 'none'][Math.floor(rng() * 3)]; p.level = 1 + Math.floor(rng() * 5); p.arrival = rng() < .25 ? '18:20' : '18:00'; p.departure = rng() < .25 ? '18:40' : '20:00'; p.skipRounds = rng() < .2 ? [1] : []; }); invariants(s, generateSchedule(s)); } });

// Independent exhaustive oracle for small full-participation sessions.
function minimumFallbacks(players, courts) {
  const memo = new Map();
  function solve(remaining, left, kungen) {
    if (!remaining.length) return kungen ? Infinity : 0;
    if (!left || remaining.length > left * 4) return Infinity;
    const key = `${remaining.join(',')}/${left}/${kungen}`; if (memo.has(key)) return memo.get(key);
    let best = Infinity;
    for (const size of [2, 3, 4]) {
      if (size > remaining.length || (size === 3 && !kungen)) continue;
      function pick(start, picked) {
        if (picked.length === size) {
          const group = picked.map(i => players[i]);
          const types = size === 2 ? ['singles'] : size === 3 ? ['kungen'] : ['doubles', ...(group.filter(p => p.mixedGroup === 'woman').length === 2 && group.filter(p => p.mixedGroup === 'man').length === 2 ? ['mixed'] : [])];
          const cost = Math.min(...types.map(t => group.filter(p => !preferenceFits(p.preference, t)).length));
          best = Math.min(best, cost + solve(remaining.filter(i => !picked.includes(i)), left - 1, kungen - (size === 3 ? 1 : 0))); return;
        }
        for (let i = start; i < remaining.length; i++) pick(i + 1, [...picked, remaining[i]]);
      }
      pick(1, [remaining[0]]);
    }
    memo.set(key, best); return best;
  }
  return solve(players.map((_, i) => i), courts, players.length % 2);
}
test('preferred format count matches exhaustive optimum in 36 small sessions', () => { const rng = random(872); for (let i = 0; i < 36; i++) { const n = 2 + Math.floor(rng() * 7), c = Math.ceil(n / 4) + (i % 2); const s = fixture(n, c); s.settings.duration = 30; s.players.forEach(p => { p.preference = ['singles', 'doubles', 'mixed'][Math.floor(rng() * 3)]; p.mixedGroup = ['woman', 'man', 'none'][Math.floor(rng() * 3)]; }); const round = generateSchedule(s).rounds[0]; const cost = round.matches.reduce((sum, m) => sum + matchPlayerIds(m).filter(id => !preferenceFits(s.players.find(p => p.id === id).preference, m.type)).length, 0); assert.equal(cost, minimumFallbacks(s.players, c), `case ${i}`); } });

test('first-game reservations cover everyone in tight overlapping arrival/opt-out windows', () => {
  // The first four must all play in round 1; round 2 is needed by the last four.
  // Player 4 must wait for player 5 in round 3, even though player 4 is present
  // in round 1. A purely round-by-round greedy selection can miss this solution.
  const s=fixture(10,1);s.settings.duration=60;
  s.players.slice(0,4).forEach(p=>p.departure='18:40');
  s.players[4].skipRounds=[1];s.players[4].departure='19:00';
  s.players[5].arrival='18:40';s.players[5].departure='19:00';
  s.players.slice(6).forEach(p=>{p.arrival='18:20';p.departure='18:40';});
  for(let seed=0;seed<8;seed++) {const r=generateSchedule({...s,seed});invariants(s,r);assert.ok(Object.values(r.totals).every(t=>t.games===1));}
});

test('whole-session player coverage matches an independent exhaustive oracle in 60 small sessions', () => {
  const rng=random(9923);
  for(let i=0;i<60;i++) {
    const s=fixture(2+Math.floor(rng()*9),1);s.settings.duration=60;
    s.players.forEach(p=>{p.skipRounds=[0,1,2].filter(()=>rng()<.45);});
    const rs=slots(s.settings),capacity=rs.map(r=>{const n=Math.min(4,s.players.filter(p=>isAvailable(p,r)).length);return n===1?0:n;});
    const memo=new Map();
    function best(index,left) {
      if(index===s.players.length)return 0;
      const key=`${index}:${left.join(',')}`;if(memo.has(key))return memo.get(key);
      let value=best(index+1,left);
      for(let r=0;r<3;r++)if(left[r]&&isAvailable(s.players[index],rs[r])){const next=[...left];next[r]--;value=Math.max(value,1+best(index+1,next));}
      memo.set(key,value);return value;
    }
    const result=generateSchedule(s);invariants(s,result);
    assert.equal(Object.values(result.totals).filter(t=>t.games>0).length,best(0,capacity),`coverage case ${i}`);
  }
});

test('maximum size session: 64 players, 12 courts, 48 rounds', () => {
  const s=fixture(64,12);s.settings.start='08:00';s.settings.duration=480;s.settings.roundMinutes=10;
  s.settings.courts.forEach(c=>{c.from='08:00';c.until='16:00';});
  s.players.forEach((p,i)=>{p.arrival='08:00';p.departure='16:00';p.preference=['singles','doubles','mixed'][i%3];});
  const r=generateSchedule(s);invariants(s,r);assert.equal(r.rounds.length,48);
  assert.ok(Object.values(r.totals).every(t=>t.games===36));
});
