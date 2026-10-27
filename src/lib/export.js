import { clock, prettyDate, FORMAT_NAMES, KUNGEN_HELP } from './model.js';

export function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export const filename = title => title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,60).toLowerCase() || 'aura-match';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maps = snapshot => ({names:Object.fromEntries(snapshot.players.map(p=>[p.id,p.name])),courts:Object.fromEntries(snapshot.settings.courts.map(c=>[c.id,c.name]))});
/** Shared content for HTML, text and image exports; never hide a third player. */
function matchSections(match, names) {
  if (match.type === 'kungen') return [{ label: 'Rotation order', names: match.rotation.map((id, i) => `${i + 1}. ${names[id]}`) }];
  return match.teams.map((team, i) => ({ label: `${match.type === 'singles' ? 'Player' : 'Team'} ${i === 0 ? 'A' : 'B'}`, names: team.map(id => names[id]) }));
}
function allocationText(stats, settings) {
  return `${stats.games} assigned rounds, ${stats.games * settings.roundMinutes} allocated minutes, ${stats.kungen || 0} Kungen rounds, ${stats.eligible} eligible rounds with an open court`;
}
export function scheduleText(snapshot) {
  const {settings,schedule}=snapshot,{names,courts}=maps(snapshot);
  const lines=[`AURA MATCH | ${settings.title}`,`${prettyDate(settings.date)} | ${settings.venue}`,`${settings.start}-${clock(Number(settings.start.slice(0,2))*60+Number(settings.start.slice(3))+settings.duration)} | Europe/Stockholm`, 'All times are local to the venue. This is a fixed snapshot, not a live schedule.',''];
  for(const r of schedule.rounds){
    lines.push(`ROUND ${r.index+1} | ${clock(r.start)}-${clock(r.end)}`);
    for(const m of r.matches)lines.push(`${courts[m.courtId]} | ${FORMAT_NAMES[m.type]} | ${matchSections(m,names).map(section=>`${section.label}: ${section.names.join(m.type==='kungen'?'; ':' + ')}`).join(' | ')}${m.type==='kungen'?` | ${KUNGEN_HELP}`:''}`);
    for(const id of r.emptyCourts)lines.push(`${courts[id]}: no additional match scheduled.`);
    for(const id of r.closedCourts)lines.push(`${courts[id]}: court unavailable for this round.`);
    lines.push(`Resting: ${r.resting.map(id=>names[id]).join(', ') || 'Nobody'}.`,`Unavailable / opted out: ${r.unavailable.map(id=>names[id]).join(', ') || 'Nobody'}.`,'');
  }
  lines.push('ALLOCATED COURT TIME', 'Allocated minutes include internal Kungen rotations, not continuous active playing time.');
  for(const p of snapshot.players){const s=schedule.totals[p.id];lines.push(`${p.name}: ${allocationText(s,settings)}.`);}
  if(schedule.warnings.length)lines.push('','NOTES',...schedule.warnings);
  lines.push('','Independent community tool, inspired by BMK Aura. Not an official club service.');
  return lines.join('\n');
}
export function scheduleHTML(snapshot) {
  const {settings,schedule}=snapshot,{names,courts}=maps(snapshot),e=escapeHTML;
  const rounds=schedule.rounds.map(r=>`<section aria-labelledby="round-${r.index}"><h2 id="round-${r.index}">Round ${r.index+1} <span>${clock(r.start)}-${clock(r.end)}</span></h2>
    ${r.matches.map(m=>`<article><h3>${e(courts[m.courtId])} <span>${FORMAT_NAMES[m.type]}</span></h3>${matchSections(m,names).map(section=>`<p><strong>${section.label}:</strong> ${section.names.map(e).join(m.type==='kungen'?'; ':' + ')}</p>`).join('')}${m.type==='kungen'?`<p>${KUNGEN_HELP}</p>`:''}</article>`).join('')}
    ${r.emptyCourts.map(id=>`<p><strong>${e(courts[id])}:</strong> no additional match scheduled.</p>`).join('')}
    ${r.closedCourts.map(id=>`<p><strong>${e(courts[id])}:</strong> unavailable for this round.</p>`).join('')}
    <p><strong>Resting:</strong> ${r.resting.map(id=>e(names[id])).join(', ') || 'Nobody'}.</p>
    <p><strong>Unavailable / opted out:</strong> ${r.unavailable.map(id=>e(names[id])).join(', ') || 'Nobody'}.</p></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${e(settings.title)} - Aura Match schedule</title><style>
    *{box-sizing:border-box}body{font:1.05rem/1.6 system-ui,sans-serif;margin:0;color:#122d4b;background:#f4f6fa}main{max-width:58rem;margin:auto;padding:2rem 1.25rem}h1{line-height:1.15}h2{border-bottom:2px solid #174dc6;padding-bottom:.6rem}h2 span,h3 span{display:block;font-size:1rem;font-weight:400;color:#4a6078}section{background:white;padding:1.5rem;margin:1.5rem 0;border:1px solid #a5b1bf;border-radius:.75rem;break-inside:avoid}article{padding:.4rem 0;border-bottom:1px solid #c4ccd6}p{overflow-wrap:anywhere}a{color:#1648b8}a:focus-visible{outline:3px solid #1648b8;outline-offset:4px}li{margin:.4rem 0}@media print{body{background:white}main{padding:0}section{border-color:#68788a}nav{display:none}}
    </style></head><body><main><header><p>AURA MATCH / SESSION SNAPSHOT</p><h1>${e(settings.title)}</h1><p>${e(prettyDate(settings.date))} | ${e(settings.venue)}<br>${settings.start}-${clock(Number(settings.start.slice(0,2))*60+Number(settings.start.slice(3))+settings.duration)} | Europe/Stockholm</p><p>All times are local to the venue. This is a fixed snapshot, not a live schedule.</p></header><nav aria-label="Rounds"><p>Jump to: ${schedule.rounds.map(r=>`<a href="#round-${r.index}">Round ${r.index+1}</a>`).join(' &middot; ')}</p></nav>${rounds}<section><h2>Allocated court time</h2><p>Allocated minutes include internal Kungen rotations, not continuous active playing time.</p><ul>${snapshot.players.map(p=>`<li>${e(p.name)}: ${allocationText(schedule.totals[p.id],settings)}.</li>`).join('')}</ul></section>${schedule.warnings.length?`<section><h2>Schedule notes</h2><ul>${schedule.warnings.map(w=>`<li>${e(w)}</li>`).join('')}</ul></section>`:''}<footer><p>Independent community tool, inspired by BMK Aura. Not an official club service.</p></footer></main></body></html>`;
}
function wrap(ctx,text,maxWidth) {
  const lines=[];let line='';
  // Split long tokens as well as spaces; never crop long or non-Latin names.
  for(const word of String(text).split(' ')) {
    const next=line?`${line} ${word}`:word;
    if(ctx.measureText(next).width<=maxWidth){line=next;continue;}
    if(line){lines.push(line);line='';}
    for(const character of word){if(ctx.measureText(line+character).width>maxWidth && line){lines.push(line);line='';}line+=character;}
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}
// Bound bitmap memory independently of court count and wrapped player names.
export const MAX_IMAGE_PIXELS = 8_000_000;
export const MAX_IMAGE_DIMENSION = 8192;
export const MAX_PACK_IMAGE_BYTES = 32_000_000;
function cancelled() { return new DOMException('Export cancelled.', 'AbortError'); }
function checkCancelled(signal) { if (signal?.aborted) throw cancelled(); }
function withCancellation(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => { cleanup(); reject(cancelled()); };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort();
  });
}
/** Measured blocks keep every name; large layouts use a smaller bitmap scale. */
export async function roundJPEG(snapshot, index, { signal } = {}) {
  const r = snapshot.schedule.rounds[index];
  if (!r) throw new Error('Choose a round to export.');
  checkCancelled(signal);
  if (document.fonts?.ready) await withCancellation(document.fonts.ready, signal);
  checkCancelled(signal);
  const { names, courts } = maps(snapshot), s = snapshot.settings;
  const canvas = document.createElement('canvas');
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not create an image. Download the HTML schedule instead.');
    const width = 1400, pad = 64, gap = 28, cardW = (width - pad * 2 - gap) / 2;
    const navy = '#122d4b', muted = '#4a6078', blue = '#174dc6';
    function block(text, font, lineHeight, color = navy, after = 10, max = cardW - 48) {
      ctx.font = font;
      return { lines: wrap(ctx, text, max), font, lineHeight, color, after };
    }
    const blockHeight = b => b.lines.length * b.lineHeight + b.after;
    const cards = s.courts.map(c => {
      const m = r.matches.find(m => m.courtId === c.id);
      const blocks = [block(courts[c.id], '700 29px Arial, sans-serif', 36), block(m ? FORMAT_NAMES[m.type] : 'No match', '600 22px Arial, sans-serif', 29, blue, 20)];
      if (m) {
        for (const section of matchSections(m, names)) {
          blocks.push(block(section.label.toUpperCase(), '700 17px Arial, sans-serif', 24, muted, 8));
          section.names.forEach(name => blocks.push(block(name, '600 25px Arial, sans-serif', 34, navy, 6)));
          blocks.at(-1).after = 20;
        }
        if (m.type === 'kungen') {
          blocks.push(block('1 vs 2, then 2 vs 3, then 3 vs 1. Repeat.', '600 21px Arial, sans-serif', 29, navy, 10));
          blocks.push(block('Switch after each rally or short game as agreed. Two play; one rests within the rotation.', '21px Arial, sans-serif', 29, muted, 0));
        }
      } else blocks.push(block(r.closedCourts.includes(c.id) ? 'Court unavailable for this round.' : 'No additional match scheduled.', '24px Arial, sans-serif', 34));
      return { blocks, height: Math.max(220, 48 + blocks.reduce((n, b) => n + blockHeight(b), 0)) };
    });
    const rows = [];
    for (let i = 0; i < cards.length; i += 2) rows.push({ cards: cards.slice(i, i + 2), height: Math.max(...cards.slice(i, i + 2).map(c => c.height)) });
    const title = block(s.title, '700 42px Arial, sans-serif', 50, '#ffffff', 14, width - pad * 2);
    const detail = block(`${prettyDate(s.date)} | ${s.venue}`, '24px Arial, sans-serif', 32, '#ffffff', 16, width - pad * 2);
    const resting = block(`Resting (outside court groups): ${r.resting.map(id => names[id]).join(', ') || 'Nobody'}`, '24px Arial, sans-serif', 34, navy, 16, width - pad * 2 - 48);
    const unavailable = block(`Unavailable / opted out: ${r.unavailable.map(id => names[id]).join(', ') || 'Nobody'}`, '24px Arial, sans-serif', 34, navy, 0, width - pad * 2 - 48);
    const headerH = 164 + blockHeight(title) + blockHeight(detail);
    const bottomH = 48 + blockHeight(resting) + blockHeight(unavailable);
    const height = headerH + rows.reduce((n, row) => n + row.height + gap, 0) + bottomH + 96;
    const scale = Math.min(2, Math.sqrt(MAX_IMAGE_PIXELS / (width * height)), MAX_IMAGE_DIMENSION / Math.max(width, height));
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    ctx.scale(canvas.width / width, canvas.height / height);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f4f6fa'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = navy; ctx.fillRect(0, 0, width, headerH - 24);
    function draw(b, x, y) {
      ctx.font = b.font; ctx.fillStyle = b.color;
      b.lines.forEach((line, i) => ctx.fillText(line, x, y + i * b.lineHeight));
      return y + blockHeight(b);
    }
    ctx.fillStyle = '#ffffff'; ctx.font = '700 19px Arial, sans-serif'; ctx.fillText('AURA MATCH / ON COURT', pad, 30);
    let hy = draw(title, pad, 78); hy = draw(detail, pad, hy);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText(`ROUND ${index + 1} OF ${snapshot.schedule.rounds.length}  |  ${clock(r.start)}-${clock(r.end)}  |  Europe/Stockholm`, pad, hy + 6);
    let y = headerH;
    for (const row of rows) {
      row.cards.forEach((card, col) => {
        const x = pad + col * (cardW + gap);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, cardW, row.height);
        ctx.strokeStyle = '#8393a8'; ctx.lineWidth = 1; ctx.strokeRect(x, y, cardW, row.height);
        let cy = y + 24;
        for (const b of card.blocks) cy = draw(b, x + 24, cy);
      });
      y += row.height + gap;
    }
    ctx.fillStyle = '#e7edf6'; ctx.fillRect(pad, y, width - pad * 2, bottomH);
    let by = draw(resting, pad + 24, y + 24); draw(unavailable, pad + 24, by);
    ctx.fillStyle = muted; ctx.font = '20px Arial, sans-serif';
    ctx.fillText('Share the matching HTML or text schedule alongside this image for accessibility.', pad, height - 48);
    checkCancelled(signal);
    const blob = await withCancellation(new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.93)), signal);
    checkCancelled(signal);
    if (!blob) throw new Error('Image export failed. Try the HTML schedule instead.');
    return blob;
  } finally {
    canvas.width = 1; canvas.height = 1;
  }
}
// Pause the ZIP stream on abort rather than leaving a discarded packaging job running.
function packBlob(zip, signal) {
  checkCancelled(signal);
  const stream = zip.generateInternalStream({ type: 'uint8array', compression: 'STORE', streamFiles: true });
  return new Promise((resolve, reject) => {
    let chunks = [], finished = false;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const fail = error => {
      if (finished) return;
      finished = true; stream.pause(); chunks = []; cleanup(); reject(error);
    };
    const abort = () => fail(cancelled());
    signal?.addEventListener('abort', abort, { once: true });
    stream.on('data', chunk => { if (!finished) chunks.push(chunk); });
    stream.on('error', fail);
    stream.on('end', () => {
      if (finished) return;
      try {
        const blob = new Blob(chunks, { type: 'application/zip' });
        finished = true; cleanup(); chunks = []; resolve(blob);
      } catch (error) { fail(error); }
    });
    if (signal?.aborted) abort(); else stream.resume();
  });
}
export async function exportPack(snapshot, onProgress = () => {}, { roundIndices, signal } = {}) {
  checkCancelled(signal);
  const indices = roundIndices ?? snapshot.schedule.rounds.map((_, index) => index);
  if (!Array.isArray(indices) || !indices.length || new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= snapshot.schedule.rounds.length)) {
    throw new Error('Choose at least one valid round to include as an image.');
  }
  const { default: JSZip } = await withCancellation(import('jszip'), signal);
  checkCancelled(signal);
  const zip = new JSZip();
  try {
    zip.file('schedule.html', scheduleHTML(snapshot)); zip.file('schedule.txt', scheduleText(snapshot));
    zip.file('READ-ME.txt', 'The HTML and text contain the full schedule. JPEGs contain the rounds selected at export. Share schedule.html or schedule.txt together with the JPEG images. The HTML file works offline without JavaScript. A JPEG alone is not screen-reader accessible. Names and session details are included; private profile fields are omitted.');
    let imageBytes = 0;
    for (let position = 0; position < indices.length; position++) {
      checkCancelled(signal);
      const index = indices[position];
      onProgress(`Creating image ${position + 1} of ${indices.length} (round ${index + 1})...`);
      const blob = await roundJPEG(snapshot, index, { signal });
      imageBytes += blob.size;
      if (imageBytes > MAX_PACK_IMAGE_BYTES) throw new Error('These images are too large for one download. Choose fewer rounds or download the HTML schedule.');
      const bytes = await withCancellation(blob.arrayBuffer(), signal);
      checkCancelled(signal);
      zip.file(`round-${String(index + 1).padStart(2, '0')}.jpg`, bytes);
      await withCancellation(new Promise(resolve => setTimeout(resolve, 0)), signal);
    }
    checkCancelled(signal);
    onProgress('Packaging your schedule...');
    return await packBlob(zip, signal);
  } finally {
    // Drop references to image buffers after success, cancellation or failure.
    Object.keys(zip.files).forEach(name => zip.remove(name));
  }
}
