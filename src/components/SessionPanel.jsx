import React from 'react';
import {Icon} from './Icon.jsx';
import {CapacityNotice} from './CapacityNotice.jsx';
import {clock,minutes,slots} from '../lib/model.js';
export function SessionPanel({settings,onChange,onCourts,onGenerate,players,busy}){
  const rounds=slots(settings),end=clock(minutes(settings.start)+Number(settings.duration));
  return <aside className="session-panel panel" aria-labelledby="session-settings-heading">
    <div className="panel-title"><div className="mini-icon"><Icon name="calendar"/></div><div><h2 id="session-settings-heading">The session</h2><p>A little planning. A lot of play.</p></div></div>
    <div className="session-fields">
      <label className="field"><span>Session name</span><input value={settings.title} maxLength={70} required onChange={e=>onChange({title:e.target.value})}/></label>
      <label className="field"><span>Location</span><input value={settings.venue} maxLength={80} required onChange={e=>onChange({venue:e.target.value})}/></label>
      <label className="field"><span>Date</span><input type="date" value={settings.date} required onChange={e=>onChange({date:e.target.value})}/></label>
      <div className="field-row"><label className="field"><span>Starts at</span><input type="time" value={settings.start} required onChange={e=>onChange({start:e.target.value})}/></label><label className="field"><span>Duration <small>(hours)</small></span><input type="number" min="0.5" max="8" step="0.5" value={settings.duration/60 || ''} required onChange={e=>onChange({duration:Number(e.target.value)*60})}/></label></div>
      <p className="field-hint"><Icon name="clock" size={14}/>{settings.start} - {end} <span>Stockholm time</span></p>
      <div className="field-divider"/>
      <div className="field"><label htmlFor="court-count">Courts booked</label><div className="stepper"><button type="button" className="stepper-button" onClick={()=>onChange({courtCount:settings.courts.length-1})} disabled={settings.courts.length<=1} aria-label="Remove one court">-</button><input id="court-count" type="number" min="1" max="12" value={settings.courts.length} onChange={e=>onChange({courtCount:Number(e.target.value)})}/><button type="button" className="stepper-button" onClick={()=>onChange({courtCount:settings.courts.length+1})} disabled={settings.courts.length>=12} aria-label="Add one court">+</button></div></div>
      <p className="field-hint">Up to {settings.courts.length*4} players at once with doubles. Singles uses 2 places per court; Kungen includes 3 rotating players.</p>
      <CapacityNotice settings={settings} players={players} compact announce={false}/>
      <button type="button" className="text-button court-times" onClick={onCourts}><Icon name="edit" size={14}/>Set individual court times</button>
      <div className="field-row"><label className="field"><span>Round length</span><select value={settings.roundMinutes} onChange={e=>onChange({roundMinutes:Number(e.target.value)})}>{[10,15,20,25,30,40,45,60].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><label className="field"><span>Changeover</span><select value={settings.breakMinutes} onChange={e=>onChange({breakMinutes:Number(e.target.value)})}>{[0,2,3,5,10,15].map(n=><option key={n} value={n}>{n===0?'No break':`${n} minutes`}</option>)}</select></label></div>
      <div className="session-summary"><Icon name="spark" size={18}/><span><strong>{rounds.length} rounds</strong> to make a good match.</span></div>
      <button className="button primary generate-button" onClick={onGenerate} disabled={busy || players.length<2}><Icon name="shuffle"/>{busy?'Making your matches...':'Generate matches'}<Icon name="arrow" size={17}/></button>
      {players.length<2?<p className="field-hint">Add at least 2 players to generate matches.</p>:<p className="privacy-note"><Icon name="shield" size={14}/>Your setup stays in this browser.</p>}
    </div>
  </aside>;
}
