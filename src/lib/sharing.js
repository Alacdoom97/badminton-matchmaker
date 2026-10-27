import { LIMITS, validateSettings, slots, FORMAT_NAMES, activeCourts } from './model.js';

export function makeSnapshot(setup, schedule) {
  return {
    kind: 'aura-match-snapshot', version: 1,
    settings: validateSettings(setup.settings),
    // Deliberately omit gender, mixed pairing group, skill and player preferences.
    players: setup.players.map(({ id, name }) => ({ id, name })),
    schedule,
  };
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function safeText(value, length) { return typeof value === 'string' && value.length > 0 && value.length <= length && !/[\u0000-\u001f\u007f]/.test(value); }
export function validateSnapshot(raw) {
  assert(raw?.kind === 'aura-match-snapshot' && raw.version === 1, 'This is not a supported Aura Match share link.');
  const settings = validateSettings(raw.settings);
  assert(Array.isArray(raw.players) && raw.players.length <= LIMITS.players, 'The shared player list is invalid.');
  const players = raw.players.map(p => {
    assert(safeText(p?.id,80) && safeText(p?.name,40), 'A shared player is invalid.');
    return { id:p.id,name:p.name };
  });
  const ids = new Set(players.map(p=>p.id));
  assert(ids.size === players.length, 'The share link has duplicate players.');
  const courtIds=new Set(settings.courts.map(c=>c.id));
  const expected=slots(settings);
  assert(Array.isArray(raw.schedule?.rounds) && raw.schedule.rounds.length === expected.length, 'The shared rounds do not match the session.');
  function idList(list, allowed) {
    assert(Array.isArray(list) && list.length <= allowed.size && list.every(id=>allowed.has(id)) && new Set(list).size===list.length, 'A shared schedule contains invalid or duplicate entries.');
    return [...list];
  }
  const totals=Object.fromEntries(players.map(p=>[p.id,{games:0,eligible:0,kungen:0}]));
  const rounds=raw.schedule.rounds.map((r,index)=> {
    const slot=expected[index];
    assert(r?.index===index && r.start===slot.start && r.end===slot.end,'A shared round has an invalid time.');
    assert(Array.isArray(r.matches) && r.matches.length<=settings.courts.length,'Too many matches in a shared round.');
    const occupied=[],playing=[];
    const matches=r.matches.map(m=> {
      assert(courtIds.has(m?.courtId) && Object.hasOwn(FORMAT_NAMES,m?.type),'A shared match is invalid.');
      occupied.push(m.courtId);
      if (m.type === 'kungen') {
        assert(!Object.hasOwn(m, 'teams'), 'Kungen must contain a rotation, not teams.');
        const rotation = idList(m.rotation, ids);
        assert(rotation.length === 3, 'Kungen requires three rotating singles players.');
        playing.push(...rotation);
        rotation.forEach(id => totals[id].kungen++);
        return { courtId: m.courtId, type: m.type, rotation };
      }
      assert(!Object.hasOwn(m, 'rotation'), 'Only Kungen may contain a rotation.');
      assert(Array.isArray(m.teams) && m.teams.length === 2, 'A shared match must contain two sides.');
      const size = m.type === 'singles' ? 1 : 2;
      const teams = m.teams.map(t => {
        const team = idList(t, ids);
        assert(team.length === size, m.type === 'singles' ? 'Singles requires one player per side.' : 'Doubles requires two players per team.');
        return team;
      });
      playing.push(...teams.flat());
      return { courtId: m.courtId, type: m.type, teams };
    });
    const resting=idList(r.resting,ids),unavailable=idList(r.unavailable,ids);
    const emptyCourts=idList(r.emptyCourts,courtIds),closedCourts=idList(r.closedCourts,courtIds);
    const roster=[...playing,...resting,...unavailable],courts=[...occupied,...emptyCourts,...closedCourts];
    assert(roster.length===ids.size && new Set(roster).size===ids.size,'A player appears twice or is missing from a shared round.');
    assert(courts.length===courtIds.size && new Set(courts).size===courtIds.size,'A court appears twice or is missing from a shared round.');
    const booked = new Set(activeCourts(settings, slot).map(c => c.id));
    assert([...occupied, ...emptyCourts].every(id => booked.has(id)) && closedCourts.every(id => !booked.has(id)), 'A shared court assignment contradicts its booking.');
    playing.forEach(id=> {totals[id].games++;totals[id].eligible++;});
    if(occupied.length+emptyCourts.length)resting.forEach(id=>totals[id].eligible++);
    return {...slot,matches,resting,unavailable,emptyCourts,closedCourts};
  });
  const warnings=raw.schedule.warnings;
  assert(Array.isArray(warnings) && warnings.length<=10 && warnings.every(w=>safeText(w,4000)),'Invalid notes in the share link.');
  return {kind:'aura-match-snapshot',version:1,settings,players,schedule:{rounds,warnings:[...warnings],totals}};
}
function toBase64(bytes) {
  let str='';
  for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromBase64(text) {
  if(!/^[A-Za-z0-9_-]+$/.test(text))throw new Error('The share link is malformed.');
  const str=atob(text.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(str,c=>c.charCodeAt(0));
}
async function boundedBytes(stream,max) {
  const reader=stream.getReader(),chunks=[];
  let length=0;
  try {
    while(true){ const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max)throw new Error('This shared session is too large.');chunks.push(value); }
  } finally { await reader.cancel().catch(()=>{}); }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}
export async function createShareLink(snapshot, base=window.location.href) {
  const bytes=new TextEncoder().encode(JSON.stringify(validateSnapshot(snapshot)));
  if(bytes.length>LIMITS.shareBytes)throw new Error('This session is too large for a link. Share the HTML or export pack instead.');
  let type='j',data=bytes;
  if(typeof CompressionStream!=='undefined') {
    data=await boundedBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),LIMITS.shareBytes);
    type='g';
  }
  const url=new URL(base);url.hash=`session=${type}.${toBase64(data)}`;
  if(url.href.length>LIMITS.shareCharacters)throw new Error('This link would be too long. Share the HTML or export pack instead.');
  return url.href;
}
export async function readShareLink(hash) {
  if(!hash.startsWith('#session='))return null;
  if(hash.length>LIMITS.shareCharacters)throw new Error('This share link exceeds the supported size.');
  const encoded=hash.slice(9),separator=encoded.indexOf('.');
  if(separator!==1)throw new Error('The share link is incomplete.');
  const type=encoded[0];let data=fromBase64(encoded.slice(2));
  if(type==='g'){
    if(typeof DecompressionStream==='undefined')throw new Error('Open this link in a recent browser, or ask the organiser for the HTML schedule.');
    data=await boundedBytes(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')),LIMITS.shareBytes);
  } else if(type!=='j')throw new Error('Unknown share-link format.');
  if(data.length>LIMITS.shareBytes)throw new Error('The shared session is too large.');
  return validateSnapshot(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)));
}

