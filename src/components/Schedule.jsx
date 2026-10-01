import React, { useState } from 'react';
import { Icon, Shuttle } from './Icon.jsx';
import { Avatar } from './Players.jsx';
import { clock, FORMAT_NAMES, KUNGEN_HELP, matchPlayerIds } from '../lib/model.js';

function MatchCard({ match, court, names, players, index, closed }) {
  const player = id => <div className="match-player"><Avatar name={names[id]} index={players.findIndex(p => p.id === id)} small/><span>{names[id]}</span></div>;
  return <article className={`match-card ${!match ? 'match-empty' : ''}`} aria-labelledby={`court-${court.id}-heading`}>
    <div className="match-card-heading"><h3 id={`court-${court.id}-heading`}><span className="court-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{court.name}</h3><span className={`pill ${match?.type === 'mixed' ? 'pill-blue' : match?.type === 'kungen' ? 'pill-teal' : 'pill-neutral'}`}>{match ? FORMAT_NAMES[match.type] : closed ? 'Not booked' : 'Open court'}</span></div>
    {!match ? <div className="empty-court"><Icon name="court" size={38}/><p>{closed ? 'This court is unavailable for this round.' : 'No additional match needed or not enough available players.'}</p></div>
      : match.type === 'kungen' ? <div className="court-surface kungen-surface">
        <span className="team-label">THREE-PLAYER SINGLES ROTATION</span>
        <ol className="kungen-players">{match.rotation.map(id => <li key={id}>{player(id)}</li>)}</ol>
        <p className="kungen-steps"><strong>1 vs 2, then 2 vs 3, then 3 vs 1.</strong><br/>Repeat; switch after each rally or short game as agreed.</p>
        <p className="kungen-description">All three join this court group. Two play while the third rests within the rotation.</p>
      </div> : <div className="court-surface">{match.teams.map((team, t) => <React.Fragment key={t}>
        {t === 1 && <div className="court-net" aria-hidden="true"><span>VS</span></div>}
        <div className="team"><span className="team-label">{match.type === 'singles' ? 'PLAYER' : 'TEAM'} {t === 0 ? 'A' : 'B'}</span><div className="team-players">{team.map(id => <React.Fragment key={id}>{player(id)}</React.Fragment>)}</div></div>
      </React.Fragment>)}</div>}
  </article>;
}

function MatchRow({ match, names, courts }) {
  return <tr><th scope="row">{courts[match.courtId]}</th><td>{FORMAT_NAMES[match.type]}</td>
    {match.type === 'kungen' ? <td colSpan="2" className="rotation-cell"><strong>Rotation:</strong> {match.rotation.map((id, i) => `${i + 1}. ${names[id]}`).join('; ')}<small>1 vs 2, then 2 vs 3, then 3 vs 1. Repeat; two play while one rests.</small></td>
      : match.teams.map((team, i) => <td key={i}>{team.map(id => names[id]).join(' + ')}</td>)}
  </tr>;
}

export function Schedule({ snapshot, roundIndex, onRound, onGenerate, onExport, readonly = false }) {
  const [view, setView] = useState('courts');
  if (!snapshot) return <section className="panel empty-schedule" aria-labelledby="schedule-empty-heading"><Shuttle size={74}/><p className="eyebrow">READY WHEN YOU ARE</p><h2 id="schedule-empty-heading">Let's find your next match.</h2><p>Add your players and set the session details.<br/>We will take care of teams, courts and the rotation.</p><button className="button primary" onClick={onGenerate}><Icon name="shuffle"/>Generate matches</button><p className="small-muted">At least two players needed. Preferences are flexible so more people can play.</p></section>;
  const { settings, players, schedule } = snapshot;
  const names = Object.fromEntries(players.map(p => [p.id, p.name])), courts = Object.fromEntries(settings.courts.map(c => [c.id, c.name]));
  const r = schedule.rounds[Math.min(roundIndex, schedule.rounds.length - 1)];
  const total = schedule.rounds.reduce((n, r) => n + r.matches.length, 0);
  const participants = r.matches.flatMap(matchPlayerIds).length;
  const kungenCount = r.matches.filter(m => m.type === 'kungen').length;
  const hasKungen = schedule.rounds.some(r => r.matches.some(m => m.type === 'kungen'));
  return <section className="schedule-section" aria-labelledby="schedule-heading">
    <div className="schedule-heading"><div><div className="title-inline"><h2 id="schedule-heading">Your match schedule</h2><span className="pill pill-teal"><Icon name="check" size={13}/>Ready to play</span></div><p>{total} matches. Flexible formats. More time on court.</p></div><div className="schedule-actions">{!readonly && <button className="button secondary compact" onClick={onGenerate}><Icon name="shuffle" size={17}/>Reshuffle</button>}<button className="button secondary compact" onClick={onExport}><Icon name="download" size={17}/>Export</button></div></div>
    <div className="schedule-controls"><div className="view-toggle" role="group" aria-label="Schedule view"><button aria-pressed={view === 'courts'} className={view === 'courts' ? 'active' : ''} onClick={() => setView('courts')}><Icon name="court" size={16}/>Court view</button><button aria-pressed={view === 'all'} className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}><Icon name="list" size={16}/>All rounds</button></div><span className="small-muted">All times: Europe/Stockholm</span></div>
    {view === 'courts' ? <>
      <nav className="round-navigation" aria-label="Choose a round"><button className="icon-button" aria-label="Previous round" disabled={roundIndex === 0} onClick={() => onRound(roundIndex - 1)}><Icon name="left"/></button><div className="round-buttons">{schedule.rounds.map(slot => <button key={slot.index} className={`round-button ${roundIndex === slot.index ? 'selected' : ''}`} aria-current={roundIndex === slot.index ? 'step' : undefined} onClick={() => onRound(slot.index)}><span>Round {slot.index + 1}</span><small>{clock(slot.start)}</small></button>)}</div><button className="icon-button" aria-label="Next round" disabled={roundIndex >= schedule.rounds.length - 1} onClick={() => onRound(roundIndex + 1)}><Icon name="right"/></button></nav>
      <div className="round-summary"><h3>Round {r.index + 1}<span>{clock(r.start)} - {clock(r.end)}</span></h3><span className="small-muted">{participants} {kungenCount ? 'in court groups' : 'playing'} <span aria-hidden="true">/</span> {r.resting.length} resting</span></div>
      {kungenCount > 0 && <p className="field-hint">Kungen includes three participants, with two playing at a time. Its rotating rest is separate from the resting list below.</p>}
      <div className="courts-grid">{settings.courts.map((c, i) => <MatchCard key={c.id} court={c} match={r.matches.find(m => m.courtId === c.id)} closed={r.closedCourts.includes(c.id)} index={i} names={names} players={players}/>)}</div>
      <section className="resting-card" aria-labelledby="resting-heading"><div><Icon name="coffee" size={23}/><div><h3 id="resting-heading">Taking a breather</h3><p>{r.resting.length ? 'Resting this round. Turns rotate when later rounds allow.' : kungenCount ? 'Everyone available has a court group, including the Kungen rotation.' : 'Everyone available is on court this round.'}</p></div></div>{r.resting.length > 0 && <ul className="resting-players">{r.resting.map(id => <li key={id}><Avatar name={names[id]} index={players.findIndex(p => p.id === id)} small/>{names[id]}</li>)}</ul>}</section>
      {r.unavailable.length > 0 && <details className="unavailable-details"><summary>{r.unavailable.length} unavailable or opted out this round</summary><p>{r.unavailable.map(id => names[id]).join(', ')}.</p></details>}
    </> : <div className="all-rounds">{schedule.rounds.map(slot => <section className="panel round-table-panel" key={slot.index} aria-labelledby={`table-round-${slot.index}`}>
      <h3 id={`table-round-${slot.index}`}>Round {slot.index + 1} <span>{clock(slot.start)} - {clock(slot.end)}</span></h3>
      <div className="table-scroll" tabIndex="0" role="region" aria-label={`Round ${slot.index + 1} matches`}><table><caption className="sr-only">Round {slot.index + 1}, {clock(slot.start)} to {clock(slot.end)}</caption><thead><tr><th scope="col">Court</th><th scope="col">Format</th><th scope="col">Team / player A</th><th scope="col">Team / player B</th></tr></thead><tbody>{slot.matches.map(m => <MatchRow key={m.courtId} match={m} names={names} courts={courts}/>)}{!slot.matches.length && <tr><td colSpan="4">No matches could be scheduled.</td></tr>}</tbody></table></div>
      <p><strong>Resting:</strong> {slot.resting.map(id => names[id]).join(', ') || 'Nobody'}.</p>
      {slot.unavailable.length > 0 && <p><strong>Unavailable / opted out:</strong> {slot.unavailable.map(id => names[id]).join(', ')}.</p>}
      {slot.emptyCourts.length > 0 && <p><strong>Unfilled:</strong> {slot.emptyCourts.map(id => courts[id]).join(', ')}.</p>}
      {slot.closedCourts.length > 0 && <p><strong>Not booked:</strong> {slot.closedCourts.map(id => courts[id]).join(', ')}.</p>}
    </section>)}</div>}
    <details className="panel rotation-details"><summary><span><Icon name="users" size={19}/>Player rotation &amp; playing time</span><Icon name="down" size={18}/></summary><p className="small-muted">Resting turns and playing time are balanced where possible. Different availability and limited courts can result in different totals.</p>
      <div className="table-scroll" tabIndex="0" role="region" aria-label="Player rotation"><table><caption className="sr-only">Court-group assignments per player across the full session</caption><thead><tr><th scope="col">Player</th><th scope="col">Rounds</th><th scope="col">Allocated minutes</th>{hasKungen && <th scope="col">Kungen rounds</th>}<th scope="col">Eligible rounds</th></tr></thead><tbody>{players.map(p => <tr key={p.id}><th scope="row">{p.name}</th><td>{schedule.totals[p.id].games}</td><td>{schedule.totals[p.id].games * settings.roundMinutes}</td>{hasKungen && <td>{schedule.totals[p.id].kungen || 0}</td>}<td>{schedule.totals[p.id].eligible}</td></tr>)}</tbody></table></div>
      <p className="field-hint">Allocated minutes are time assigned to a court group, not measured active playing time. Kungen includes an internal three-person rotation; each player rests for part of that round. An eligible round fits the player's availability and has a booked court.</p>
      {hasKungen && <p className="field-hint">{KUNGEN_HELP}</p>}
    </details>
    {schedule.warnings.length > 0 && <div className="schedule-notes"><h3><Icon name="help" size={18}/>A note on this line-up</h3>{schedule.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>}
  </section>;
}
