import { generateSchedule } from './scheduler.js';
self.onmessage = event => {
  try { self.postMessage({ ok: true, schedule: generateSchedule(event.data) }); }
  catch (error) { self.postMessage({ ok: false, message: error instanceof Error ? error.message : 'Could not generate the schedule.' }); }
};
