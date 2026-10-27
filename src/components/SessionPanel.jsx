import React,{useEffect,useState} from 'react';
import {Icon} from './Icon.jsx';
import {CapacityNotice} from './CapacityNotice.jsx';
import {clock,minutes,slots,validateSettings} from '../lib/model.js';
export function SessionPanel({settings,onChange,onCourts,onGenerate,onDraftValidityChange,players,busy}){
  const rounds=slots(settings),end=clock(minutes(settings.start)+Number(settings.duration));
  const [draft,setDraft]=useState({start:settings.start,duration:String(settings.duration/60),courtCount:String(settings.courts.length)});
  const [inputErrors,setInputErrors]=useState({});
  useEffect(()=>{setDraft(current=>({...current,start:settings.start}));setInputErrors(current=>({...current,start:''}));},[settings.start]);
  useEffect(()=>{setDraft(current=>({...current,duration:String(settings.duration/60)}));setInputErrors(current=>({...current,duration:''}));},[settings.duration]);
  useEffect(()=>{setDraft(current=>({...current,courtCount:String(settings.courts.length)}));setInputErrors(current=>({...current,courtCount:''}));},[settings.courts.length]);
  const edit=(field,value)=>{setDraft(current=>({...current,[field]:value}));setInputErrors(current=>({...current,[field]:''}));};
  const inputError=Object.values(inputErrors).find(Boolean) || '';
  let invalidDraft=false;
  try{
    if(!draft.start || !draft.duration || !draft.courtCount)throw new Error('Complete the draft.');
    const count=Number(draft.courtCount);
    if(!Number.isInteger(count)||count<1||count>12)throw new Error('Invalid court count.');
    validateSettings({...settings,start:draft.start,duration:Number(draft.duration)*60});
  }catch{invalidDraft=true;}
  useEffect(()=>{onDraftValidityChange?.(!invalidDraft && !inputError);},[invalidDraft,inputError,onDraftValidityChange]);
  function commit(field){
    try{
      const value=draft[field];
      if(value==='')throw new Error('Complete the session setting before saving it.');
      const patch=field==='start'?{start:value}:field==='duration'?{duration:Number(value)*60}:{courtCount:Number(value)};
      if(field==='courtCount'){
        if(!Number.isInteger(patch.courtCount)||patch.courtCount<1||patch.courtCount>12)throw new Error('Choose a whole number from 1 to 12 courts.');
      }else validateSettings({...settings,...patch});
      const previous=field==='courtCount'?settings.courts.length:settings[field];
      if(patch[field]!==previous){const failure=onChange(patch);if(typeof failure==='string')throw new Error(failure);}
      setInputErrors(current=>({...current,[field]:''}));
    }catch(err){setInputErrors(current=>({...current,[field]:err.message}));}
  }
  const enter=e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}};
  return <aside className="session-panel panel" aria-labelledby="session-settings-heading">
    <div className="panel-title"><div className="mini-icon"><Icon name="calendar"/></div><div><h2 id="session-settings-heading">The session</h2><p>A little planning. A lot of play.</p></div></div>
    <div className="session-fields">
      <label className="field"><span>Session name</span><input value={settings.title} maxLength={70} required onChange={e=>onChange({title:e.target.value})}/></label>
      <label className="field"><span>Location</span><input value={settings.venue} maxLength={80} required onChange={e=>onChange({venue:e.target.value})}/></label>
      <label className="field"><span>Date</span><input type="date" value={settings.date} required onChange={e=>onChange({date:e.target.value})}/></label>
      <div className="field-row"><label className="field"><span>Starts at</span><input type="time" value={draft.start} required onChange={e=>edit('start',e.target.value)} onBlur={()=>commit('start')} onKeyDown={enter}/></label><label className="field"><span>Duration <small>(hours)</small></span><input type="number" min="0.5" max="8" step="0.5" value={draft.duration} required onChange={e=>edit('duration',e.target.value)} onBlur={()=>commit('duration')} onKeyDown={enter}/></label></div>
      <p className="field-hint"><Icon name="clock" size={14}/>{settings.start} - {end} <span>Stockholm time</span></p>
      <div className="field-divider"/>
      <div className="field"><label htmlFor="court-count">Courts booked</label><div className="stepper"><button type="button" className="stepper-button" onClick={()=>onChange({courtCount:settings.courts.length-1})} disabled={settings.courts.length<=1} aria-label="Remove one court">-</button><input id="court-count" type="number" min="1" max="12" value={draft.courtCount} onChange={e=>edit('courtCount',e.target.value)} onBlur={()=>commit('courtCount')} onKeyDown={enter}/><button type="button" className="stepper-button" onClick={()=>onChange({courtCount:settings.courts.length+1})} disabled={settings.courts.length>=12} aria-label="Add one court">+</button></div></div>
      <p className="field-hint">Up to {settings.courts.length*4} players at once with doubles. Singles uses 2 places per court; Kungen includes 3 rotating players.</p>
      <CapacityNotice settings={settings} players={players} compact announce={false}/>
      <button type="button" className="text-button court-times" onClick={onCourts}><Icon name="edit" size={14}/>Set individual court times</button>
      <div className="field-row"><label className="field"><span>Round length</span><select value={settings.roundMinutes} onChange={e=>onChange({roundMinutes:Number(e.target.value)})}>{[10,15,20,25,30,40,45,60].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><label className="field"><span>Changeover</span><select value={settings.breakMinutes} onChange={e=>onChange({breakMinutes:Number(e.target.value)})}>{[0,2,3,5,10,15].map(n=><option key={n} value={n}>{n===0?'No break':`${n} minutes`}</option>)}</select></label></div>
      <label className="field"><span>Rotation priority</span><select value={settings.rotationPriority || 'preferences'} onChange={e=>onChange({rotationPriority:e.target.value})}><option value="preferences">Preferred formats</option><option value="playingTime">Estimated playing time</option></select><small>Estimated playing time rotates Kungen rests more evenly, treating a Kungen round as two-thirds active time. It may use more fallback formats.</small></label>
      {inputError&&<p className="error-box" role="alert">{inputError}</p>}
      <div className="session-summary"><Icon name="spark" size={18}/><span><strong>{rounds.length} rounds</strong> to make a good match.</span></div>
      <button className="button primary generate-button" onClick={onGenerate} disabled={busy || players.length<2 || Boolean(inputError) || invalidDraft}><Icon name="shuffle"/>{busy?'Making your matches...':'Generate matches'}<Icon name="arrow" size={17}/></button>
      {players.length<2?<p className="field-hint">Add at least 2 players to generate matches.</p>:<p className="privacy-note"><Icon name="shield" size={14}/>Your setup stays in this browser.</p>}
    </div>
  </aside>;
}

