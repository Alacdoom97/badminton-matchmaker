import React from 'react';
import { capacityReport, clock } from '../lib/model.js';
import { Icon } from './Icon.jsx';

/** Kept mounted so changes are announced, not conveyed by colour alone. */
export function CapacityNotice({ settings, players, compact = false, preview = false, announce = true }) {
  const report = capacityReport(settings, players), peak = report.peak;
  const rosterOnly = !peak && report.roster > report.maximum;
  const allSame = peak && report.affected.length === report.rounds.length
    && report.affected.every(r => r.available === peak.available && r.courts === peak.courts);
  return <div role={announce ? 'status' : undefined} aria-live={announce ? 'polite' : undefined} aria-atomic={announce ? 'true' : undefined}>
    {(peak || rosterOnly) && <section className={`capacity-notice ${compact ? 'capacity-compact' : ''}`} aria-label="Court capacity warning">
      <div className="capacity-heading"><Icon name="help" size={19}/><strong>{preview ? 'Capacity after saving' : 'Court capacity warning'}</strong></div>
      {peak ? <>
        <p><strong>{peak.available} available players, {peak.courts} court{peak.courts === 1 ? '' : 's'}: room for {peak.capacity}.</strong> At least <strong>{peak.minimumResting} player{peak.minimumResting === 1 ? '' : 's'} must sit out {allSame ? 'each round' : `round ${peak.index + 1} (${clock(peak.start)} - ${clock(peak.end)})`}</strong>.</p>
        <p>{compact ? 'Resting turns rotate. Add courts to reduce waiting.' : 'This is a per-round limit, not exclusion from the session. Resting turns rotate; more courts or more rounds give players more opportunities.'}</p>
        {!compact && !allSame && <details><summary>View affected rounds ({report.affected.length})</summary><ul>{report.affected.map(r => <li key={r.index}>Round {r.index + 1}, {clock(r.start)} - {clock(r.end)}: {r.available} available, {r.courts} courts, at least {r.minimumResting} resting.</li>)}</ul></details>}
      </> : <p>{report.roster} registered players exceed the {report.maximum} simultaneous places. Current arrival and departure times keep each round within capacity; everyone cannot play at once if all attend together.</p>}
    </section>}
  </div>;
}
