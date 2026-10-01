/** Shared limits keep imports, generation and exports bounded on mobile devices. */
export const LIMITS = Object.freeze({ players: 64, courts: 12, rounds: 48, importBytes: 1_000_000, shareBytes: 500_000, shareCharacters: 24000 });
export const STORAGE_KEY = 'aura-match:v1';
export const GENDERS = { woman: 'Woman', man: 'Man', nonbinary: 'Non-binary', undisclosed: 'Prefer not to say' };
export const PREFERENCES = { singles: 'Singles', doubles: 'Doubles', mixed: 'Mixed' };
export const LEVELS = { 1: 'New to the game', 2: 'Casual', 3: 'Intermediate', 4: 'Experienced', 5: 'Competitive' };
export const FORMAT_NAMES = { singles: 'Singles', doubles: 'Doubles', mixed: 'Mixed doubles', kungen: 'Kungen' };
export const KUNGEN_HELP = 'Three-player singles rotation: 1 vs 2, then 2 vs 3, then 3 vs 1. Repeat, switching after each rally or short game as agreed. Two play while the third rests within the court group.';
export function matchPlayerIds(match) { return match.type === 'kungen' ? [...match.rotation] : match.teams.flat(); }
export function preferenceFits(preference, format) { return preference === format || (preference === 'singles' && format === 'kungen'); }

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function minutes(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function clock(value) {
  if (!Number.isFinite(value)) return '--:--';
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
export function localDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function prettyDate(date) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }).format(new Date(`${date}T12:00:00Z`));
}
export function slots(settings) {
  const result = [];
  const begin = minutes(settings.start);
  const finish = begin + settings.duration;
  const step = settings.roundMinutes + settings.breakMinutes;
  if (!Number.isFinite(begin) || !Number.isFinite(step) || step <= 0 || !Number.isFinite(finish)) return result;
  for (let start = begin; start + settings.roundMinutes <= finish && result.length < LIMITS.rounds; start += step) {
    result.push({ index: result.length, start, end: start + settings.roundMinutes });
  }
  return result;
}
export function isAvailable(player, slot) {
  return minutes(player.arrival) <= slot.start && minutes(player.departure) >= slot.end && !player.skipRounds.includes(slot.index);
}
export function activeCourts(settings, slot) {
  return settings.courts.filter(c => minutes(c.from) <= slot.start && minutes(c.until) >= slot.end);
}
export function sessionSignature(setup) { return JSON.stringify([setup.settings, setup.players]); }

function fail(message) { throw new Error(message); }
function text(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label} must be ${min}-${max} characters, without control characters.`);
  return value.trim();
}
function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
function time(value, label) { if (!Number.isFinite(minutes(value))) fail(`${label} must be a valid 24-hour time.`); return value; }
function record(v, label) { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${label} is invalid.`); }
function unique(values, label) { if (new Set(values).size !== values.length) fail(`${label} must be unique.`); }
export function validateSettings(raw) {
  record(raw, 'Session');
  const s = {
    title: text(raw.title, 1, 70, 'Session name'), venue: text(raw.venue, 1, 80, 'Venue'),
    date: text(raw.date, 10, 10, 'Date'), start: time(raw.start, 'Start time'),
    duration: integer(raw.duration, 30, 480, 'Session duration'),
    roundMinutes: integer(raw.roundMinutes, 10, 60, 'Round length'),
    breakMinutes: integer(raw.breakMinutes, 0, 15, 'Changeover'), courts: [],
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !Number.isFinite(Date.parse(s.date)) || new Date(`${s.date}T12:00:00Z`).toISOString().slice(0, 10) !== s.date) fail('Choose a valid date.');
  const end = minutes(s.start) + s.duration;
  if (end > 1439) fail('Sessions must finish by 23:59 on the same day. Start earlier or reduce the duration.');
  if (s.roundMinutes > s.duration) fail('A round cannot be longer than the session.');
  if (!Array.isArray(raw.courts) || raw.courts.length < 1 || raw.courts.length > LIMITS.courts) fail('Choose 1-12 courts.');
  s.courts = raw.courts.map(c => {
    record(c, 'Court');
    const court = { id: text(c.id, 1, 80, 'Court ID'), name: text(c.name, 1, 30, 'Court name'), from: time(c.from, 'Court start'), until: time(c.until, 'Court end') };
    if (minutes(court.from) >= minutes(court.until)) fail(`${court.name}: the end must be after the start.`);
    return court;
  });
  unique(s.courts.map(c => c.id), 'Court IDs');
  unique(s.courts.map(c => c.name.toLocaleLowerCase()), 'Court names');
  return s;
}
export function validatePlayer(raw) {
  record(raw, 'Player');
  const p = {
    id: text(raw.id, 1, 80, 'Player ID'), name: text(raw.name, 1, 40, 'Player name'),
    gender: raw.gender, preference: raw.preference === 'either' ? 'doubles' : raw.preference, mixedGroup: raw.mixedGroup,
    level: integer(raw.level, 1, 5, 'Playing level'), arrival: time(raw.arrival, 'Arrival'), departure: time(raw.departure, 'Departure'),
    skipRounds: [],
  };
  if (!Object.hasOwn(GENDERS, p.gender)) fail('Choose a valid gender option.');
  if (!Object.hasOwn(PREFERENCES, p.preference)) fail('Choose a valid match preference.');
  if (!['woman', 'man', 'none'].includes(p.mixedGroup)) fail('Choose a valid mixed pairing group.');
  if (minutes(p.arrival) >= minutes(p.departure)) fail('Departure must be later than arrival.');
  if (!Array.isArray(raw.skipRounds) || raw.skipRounds.length > LIMITS.rounds) fail('Round opt-outs are invalid.');
  p.skipRounds = [...new Set(raw.skipRounds.map(n => integer(n, 0, LIMITS.rounds - 1, 'Round opt-out')))];
  return p;
}
export function validateSetup(raw) {
  record(raw, 'Setup');
  if (raw.version !== 1) fail('This setup version is not supported.');
  const settings = validateSettings(raw.settings);
  if (!Array.isArray(raw.players) || raw.players.length > LIMITS.players) fail('A setup supports up to 64 players.');
  const players = raw.players.map(validatePlayer);
  unique(players.map(p => p.id), 'Player IDs');
  unique(players.map(p => p.name.toLocaleLowerCase()), 'Player names (add an initial to distinguish people)');
  return { version: 1, settings, players, seed: integer(raw.seed ?? 1, 0, 2147483647, 'Shuffle seed') };
}
export function blankSetup() {
  return { version: 1, seed: 1, settings: { title: 'Thursday club night', venue: 'Malm\u00f6 BadmintonCenter', date: localDate(), start: '18:00', duration: 120, roundMinutes: 20, breakMinutes: 0, courts: [1,2,3].map(n => ({ id: `court-${n}`, name: `Court ${n}`, from: '18:00', until: '20:00' })) }, players: [] };
}
export function demoSetup() {
  const setup = blankSetup();
  const names = ['Emma Lind','Oliver Berg','Sofia Nilsson','Hugo Andersson','Alice Svensson','Elias Holm','Maja Larsson','William Ek','Alma Lund','Noah Eriksson','Freja Dahl','Lucas Sj\u00f6berg','Alex Nord','Kim Lindgren','Ebba Sand','Leo Strand'];
  setup.players = names.map((name, i) => ({
    id: `demo-${i + 1}`, name,
    gender: i === 12 ? 'nonbinary' : i === 13 ? 'undisclosed' : i % 2 === 0 ? 'woman' : 'man',
    mixedGroup: i >= 12 && i < 14 ? 'none' : i % 2 === 0 ? 'woman' : 'man',
    preference: [0,1,8,9].includes(i) ? 'mixed' : [2,3,12].includes(i) ? 'singles' : 'doubles',
    level: [3,3,4,4,2,3,3,2,4,3,2,4,3,2,3,3][i],
    arrival: i === 14 ? '18:20' : i === 15 ? '18:40' : '18:00',
    departure: i === 4 || i === 5 ? '19:20' : '20:00', skipRounds: [],
  }));
  return setup;
}

/** Capacity warnings use whole-round availability, not just the roster total. */
export function capacityReport(settings, players) {
  const rounds = slots(settings).map(slot => {
    const available = players.filter(p => isAvailable(p, slot)).length;
    const courts = activeCourts(settings, slot).length;
    const capacity = courts * 4;
    return { ...slot, available, courts, capacity, minimumResting: Math.max(0, available - capacity) };
  });
  const affected = rounds.filter(r => r.minimumResting > 0);
  const peak = affected.reduce((best, r) => !best || r.minimumResting > best.minimumResting ? r : best, null);
  return { rounds, affected, peak, roster: players.length, maximum: settings.courts.length * 4 };
}
