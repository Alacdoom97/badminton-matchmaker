import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { blankSetup } from '../src/lib/model.js';
import { generateSchedule } from '../src/lib/scheduler.js';
import { makeSnapshot } from '../src/lib/sharing.js';
import { MAX_IMAGE_PIXELS, MAX_IMAGE_DIMENSION, MAX_PACK_IMAGE_BYTES, roundJPEG, exportPack } from '../src/lib/export.js';

function fixture(players = 8, courts = 2, rounds = 3, longNames = false) {
  const setup = blankSetup();
  setup.settings.start = '08:00'; setup.settings.duration = Math.max(30, rounds * 10); setup.settings.roundMinutes = 10;
  setup.settings.courts = Array.from({ length: courts }, (_, i) => ({ id: `c${i}`, name: `Court ${i}`, from: '08:00', until: '16:00' }));
  setup.players = Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: longNames ? `${i}`.padStart(2, '0') + '長'.repeat(38) : `Player ${i}`, gender: 'undisclosed', mixedGroup: 'none', preference: 'doubles', level: 3, arrival: '08:00', departure: '16:00', skipRounds: [] }));
  return makeSnapshot(setup, generateSchedule(setup));
}
function canvasDocument(t, options = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvases = [], encoded = [];
  const noop = () => {};
  globalThis.document = {
    fonts: { ready: options.fontsReady ?? Promise.resolve() },
    createElement() {
      const ctx = {
        font: '', scale: noop, fillRect: noop, strokeRect: noop, fillText: noop,
        measureText(text) {
          if (options.drawError) throw new Error('Drawing failed');
          const fontSize = Number(this.font.match(/(\d+)px/)?.[1] ?? 24);
          return { width: Array.from(text).length * fontSize * 0.65 };
        },
      };
      const canvas = { width: 300, height: 150, getContext: () => options.noContext ? null : ctx,
        toBlob(callback) {
          encoded.push({ width: canvas.width, height: canvas.height });
          if (options.toBlobError) throw new Error('Encoding failed');
          if (options.encodePending) { options.encodePending(callback); return; }
          callback(options.emptyBlob ? null : options.blob ?? new Blob(['test jpeg'], { type: 'image/jpeg' }));
        },
      };
      canvases.push(canvas); return canvas;
    },
  };
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else delete globalThis.document; });
  return { canvases, encoded };
}
function released(canvases) { assert.ok(canvases.every(c => c.width === 1 && c.height === 1)); }

test('maximum session with long names stays within bitmap pixel and dimension limits', async t => {
  const { canvases, encoded } = canvasDocument(t);
  const snapshot = fixture(64, 12, 48, true);
  const blob = await roundJPEG(snapshot, 0);
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(encoded.length, 1);
  const { width, height } = encoded[0];
  assert.ok(width * height <= MAX_IMAGE_PIXELS);
  assert.ok(width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION);
  assert.ok(width < 2800, 'large layouts must reduce their original 2x scale');
  released(canvases);
});

test('small exports keep their crisp 2x resolution', async t => {
  const { encoded, canvases } = canvasDocument(t);
  await roundJPEG(fixture(4, 1), 0);
  assert.equal(encoded[0].width, 2800);
  released(canvases);
});

for (const [name, options, message] of [
  ['missing canvas context', { noContext: true }, /could not create/],
  ['layout failure', { drawError: true }, /Drawing failed/],
  ['encoding exception', { toBlobError: true }, /Encoding failed/],
  ['empty encoded image', { emptyBlob: true }, /Image export failed/],
]) test(`canvas memory is released after ${name}`, async t => {
  const { canvases } = canvasDocument(t, options);
  await assert.rejects(roundJPEG(fixture(), 0), message);
  released(canvases);
});

test('cancelled JPEG export releases its bitmap while encoding is pending', async t => {
  const controller = new AbortController();
  const { canvases } = canvasDocument(t, { encodePending: () => controller.abort() });
  await assert.rejects(roundJPEG(fixture(), 0, { signal: controller.signal }), { name: 'AbortError' });
  released(canvases);
});

test('cancellation interrupts font loading before allocating a canvas', async t => {
  const controller = new AbortController();
  const { canvases } = canvasDocument(t, { fontsReady: new Promise(() => {}) });
  const result = roundJPEG(fixture(), 0, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(canvases.length, 0);
});

test('ZIP contains exactly selected images with original round numbers and the full accessible schedule', async t => {
  const { canvases } = canvasDocument(t);
  const snapshot = fixture();
  const blob = await exportPack(snapshot, () => {}, { roundIndices: [0, 2] });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files).sort(), ['READ-ME.txt', 'round-01.jpg', 'round-03.jpg', 'schedule.html', 'schedule.txt']);
  assert.match(await zip.file('schedule.txt').async('string'), /ROUND 2/);
  assert.equal(canvases.length, 2);
  released(canvases);
});

test('empty, duplicate and out-of-range round selections are rejected before rendering', async t => {
  const { canvases } = canvasDocument(t);
  for (const roundIndices of [[], [0, 0], [-1], [3], [0.5]]) {
    await assert.rejects(exportPack(fixture(), () => {}, { roundIndices }), /Choose at least one valid round/);
  }
  assert.equal(canvases.length, 0);
});

test('cancelled ZIP export stops before rendering any further rounds', async t => {
  const controller = new AbortController();
  const { canvases } = canvasDocument(t);
  await assert.rejects(exportPack(fixture(), message => {
    if (message.startsWith('Creating image 2')) controller.abort();
  }, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(canvases.length, 1);
  released(canvases);
});

test('cancellation during ZIP packaging pauses the stream and releases image references', async t => {
  const controller = new AbortController();
  const { canvases } = canvasDocument(t);
  const original = JSZip.prototype.generateInternalStream;
  let paused = false, archive;
  t.mock.method(JSZip.prototype, 'generateInternalStream', function (...args) {
    archive = this;
    const stream = original.apply(this, args), pause = stream.pause;
    stream.pause = function () { paused = true; return pause.call(this); };
    stream.on('data', () => controller.abort());
    return stream;
  });
  await assert.rejects(exportPack(fixture(), () => {}, { signal: controller.signal }), { name: 'AbortError' });
  assert.ok(paused, 'cancel must stop the underlying ZIP stream');
  assert.deepEqual(Object.keys(archive.files), []);
  released(canvases);
});

test('archive byte budget stops oversized images before copying their buffers', async t => {
  let copied = false;
  const { canvases } = canvasDocument(t, { blob: { size: MAX_PACK_IMAGE_BYTES + 1, arrayBuffer() { copied = true; throw new Error('Must not copy'); } } });
  await assert.rejects(exportPack(fixture()), /Choose fewer rounds/);
  assert.equal(copied, false);
  released(canvases);
});
