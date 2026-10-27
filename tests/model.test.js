import test from 'node:test';
import assert from 'node:assert/strict';
import { blankSetup, validateSettings } from '../src/lib/model.js';

function settings(date, start, duration = 30) {
  return { ...blankSetup().settings, date, start, duration };
}

test('legacy settings default to format preference and reject unknown rotation priorities', () => {
  const old = settings('2026-10-27', '18:00');
  assert.equal(validateSettings(old).rotationPriority, 'preferences');
  assert.equal(validateSettings({ ...old, rotationPriority: 'playingTime' }).rotationPriority, 'playingTime');
  assert.throws(() => validateSettings({ ...old, rotationPriority: 'unknown' }), /rotation priority/);
});

test('Stockholm skipped and repeated clock hours cannot define a session', () => {
  for (const date of ['2026-03-29', '2026-10-25']) {
    assert.throws(() => validateSettings(settings(date, '02:00')), /daylight-saving clock change/);
    assert.throws(() => validateSettings(settings(date, '02:30')), /daylight-saving clock change/);
    assert.throws(() => validateSettings(settings(date, '01:30', 120)), /daylight-saving clock change/);
    assert.throws(() => validateSettings(settings(date, '01:30', 30)), /daylight-saving clock change/);
  }
});

test('sessions outside a clock-change hour remain valid, including the first unique time after it', () => {
  for (const date of ['2026-03-29', '2026-10-25']) {
    assert.equal(validateSettings(settings(date, '00:30', 60)).start, '00:30');
    assert.equal(validateSettings(settings(date, '03:00', 120)).start, '03:00');
    assert.equal(validateSettings(settings(date, '18:00', 120)).start, '18:00');
  }
  assert.equal(validateSettings(settings('2026-02-01', '02:00')).start, '02:00');
});
