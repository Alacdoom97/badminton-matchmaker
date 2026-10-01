import React,{useState} from 'react';
import {Icon} from './Icon.jsx';
import {Modal} from './Modal.jsx';
import {CapacityNotice} from './CapacityNotice.jsx';
import {GENDERS,PREFERENCES,LEVELS,minutes,clock,slots,uid,validatePlayer} from '../lib/model.js';
export function Avatar({name,index=0,small=false}){const initials=name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('');return <span aria-hidden="true" className={`avatar avatar-${index%5} ${small?'avatar-small':''}`}>{initials}</span>;}
export function PlayerList({players,settings,onAdd,onEdit,onRemove,isDemo,onBlank}){
  const [search,setSearch]=useState('');
  const filtered=players.filter(p=>p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const end=minutes(settings.start)+settings.duration;
  return <section className="panel roster-panel" aria-labelledby="roster-heading">
    <div className="roster-heading"><div><div className="title-inline"><h2 id="roster-heading">Your line-up</h2><span className="count-badge">{players.length}</span></div><p>Different players. One great evening.</p></div><button className="button primary" onClick={onAdd} disabled={players.length>=64}><Icon name="plus" size={18}/>Add player</button></div>
    {isDemo&&<div className="demo-note"><Icon name="spark" size={16}/><span>A sample line-up to get you started.</span><button className="text-button" onClick={onBlank}>Start fresh</button></div>}
    <div className="roster-tools"><label className="search-field"><Icon name="users" size={17}/><span className="sr-only">Search players</span><input type="search" placeholder="Find a player..." value={search} onChange={e=>setSearch(e.target.value)}/></label><span className="small-muted">Preferences are flexible</span></div>
    <div className="player-list" role="list" aria-label="Players">
      <div className="player-list-labels" aria-hidden="true"><span>PLAYER</span><span>PREFERENCE</span><span>AVAILABILITY</span><span/></div>
      {filtered.map((p,i)=>{
        const early=minutes(p.departure)<end,late=minutes(p.arrival)>minutes(settings.start);
        return <article role="listitem" className="player-row" key={p.id}>
          <div className="player-identity"><Avatar name={p.name} index={players.indexOf(p)}/><div><h3>{p.name}</h3><p>{LEVELS[p.level]} <span aria-hidden="true">/</span> {GENDERS[p.gender]}</p></div></div>
          <div className="player-preference"><span className={`pill ${p.preference==='mixed'?'pill-blue':p.preference==='doubles'?'pill-neutral':'pill-teal'}`}>{PREFERENCES[p.preference]}</span></div>
          <div className="player-availability"><span>{p.arrival} - {p.departure}</span>{early?<small className="early-label">Leaving early</small>:late?<small className="late-label">Arriving later</small>:<small className="muted">Full session</small>}{p.skipRounds.length>0&&<small className="muted">{p.skipRounds.length} round opt-out{p.skipRounds.length===1?'':'s'}</small>}</div>
          <div className="row-actions"><button className="icon-button" onClick={()=>onEdit(p)} aria-label={`Edit ${p.name}`}><Icon name="edit" size={17}/></button><button className="icon-button danger-icon" onClick={()=>onRemove(p)} aria-label={`Remove ${p.name}`}><Icon name="trash" size={17}/></button></div>
        </article>;
      })}
      {filtered.length===0&&<div className="empty-state"><Icon name="users" size={34}/><h3>{players.length?'No players found':'Your court crew starts here'}</h3><p>{players.length?'Try a different name.':'Add two or more players, then let the matches begin.'}</p>{!players.length&&<button className="button primary" onClick={onAdd}><Icon name="plus"/>Add your first player</button>}</div>}
    </div>
    <div className="roster-footer"><Icon name="shield" size={16}/><span>Gender and playing preferences stay out of shared schedules.</span></div>
  </section>;
}
export function PlayerDialog({player,settings,players,onSave,onClose}){
  const [draft,setDraft]=useState(()=>player || {id:uid(),name:'',gender:'undisclosed',mixedGroup:'none',preference:'doubles',level:3,arrival:settings.start,departure:clock(minutes(settings.start)+settings.duration),skipRounds:[]});
  const [error,setError]=useState('');
  const patch=values=>{setDraft(d=>({...d,...values}));setError('');};
  function submit(e){
    e.preventDefault();
    try{
      const p=validatePlayer(draft);
      if(players.some(other=>other.id!==p.id && other.name.toLocaleLowerCase()===p.name.toLocaleLowerCase()))throw new Error('That name is already in your line-up. Add a surname or initial to distinguish them.');
      onSave(p);
    }catch(err){setError(err.message);}
  }
  return <Modal title={player?'Edit player':'Add a player'} onClose={onClose}><form onSubmit={submit} className="dialog-form">
    <p className="modal-intro">A few details help us find their kind of game.</p>
    <label className="field"><span>Player name <span className="required-note">(required)</span></span><input autoFocus value={draft.name} required maxLength={40} placeholder="e.g. Emma Lind" onChange={e=>patch({name:e.target.value})}/></label>
    <div className="field-row"><label className="field"><span>Gender <small>(optional)</small></span><select value={draft.gender} onChange={e=>patch({gender:e.target.value})}>{Object.entries(GENDERS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Playing level</span><select value={draft.level} onChange={e=>patch({level:Number(e.target.value)})}>{Object.entries(LEVELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
    <fieldset className="preference-field"><legend>What would they like to play?</legend><div className="preference-options">{Object.entries(PREFERENCES).map(([value,label])=><label key={value} className={`radio-card ${draft.preference===value?'selected':''}`}><input type="radio" name="preference" value={value} checked={draft.preference===value} onChange={()=>patch({preference:value})}/><span>{label}</span></label>)}</div><p className="field-hint">We try their preferred format first, then use another format so they can play. Singles may become Kungen (a three-player singles rotation) for an odd group. Doubles has no gender restrictions.</p></fieldset>
    <label className="field"><span>Mixed pairing group</span><select value={draft.mixedGroup} onChange={e=>patch({mixedGroup:e.target.value})} aria-describedby="mixed-help"><option value="none">Not taking part in mixed</option><option value="woman">Women's group</option><option value="man">Men's group</option></select><small id="mixed-help">Choose with the player's agreement, independently of gender. Mixed uses one player from each group per team. No group means singles, doubles or Kungen instead of mixed. Mixed preference can still be saved; another format will be used when mixed is unavailable.</small></label>
    <div className="field-divider"/>
    <div className="field-row"><label className="field"><span>Available from</span><input type="time" value={draft.arrival} required onChange={e=>patch({arrival:e.target.value})}/></label><label className="field"><span>Leaving at</span><input type="time" value={draft.departure} required onChange={e=>patch({departure:e.target.value})}/></label></div>
    <p className="field-hint">They will only play rounds that fit entirely inside these times. All times are in Europe/Stockholm.</p>
    <details className="round-opt-outs"><summary>Sit out specific rounds <span className="muted">({draft.skipRounds.length} selected)</span></summary><div className="round-checkboxes">{slots(settings).map(r=><label key={r.index}><input type="checkbox" checked={draft.skipRounds.includes(r.index)} onChange={e=>patch({skipRounds:e.target.checked?[...draft.skipRounds,r.index]:draft.skipRounds.filter(i=>i!==r.index)})}/><span>Round {r.index+1}<small>{clock(r.start)} - {clock(r.end)}</small></span></label>)}</div></details>
    <CapacityNotice settings={settings} players={players.some(p=>p.id===draft.id)?players.map(p=>p.id===draft.id?draft:p):[...players,draft]} compact preview/>
    {error&&<p className="error-box" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary"><Icon name="check" size={18}/>{player?'Save player':'Add player'}</button></div>
  </form></Modal>;
}
export function CourtsDialog({settings,players,onSave,onClose}){
  const [courts,setCourts]=useState(settings.courts.map(c=>({...c}))),[error,setError]=useState('');
  const patch=(id,key,value)=>setCourts(cs=>cs.map(c=>c.id===id?{...c,[key]:value}:c));
  function submit(e){e.preventDefault();try{onSave(courts);}catch(err){setError(err.message);}}
  return <Modal title="Court availability" onClose={onClose}><form className="dialog-form" onSubmit={submit}><p className="modal-intro">Court booking times can differ. A court is used only when the whole round fits its booking.</p>{courts.map((c,i)=><fieldset className="court-editor" key={c.id}><legend>Court {i+1}</legend><label className="field"><span>Court name</span><input required maxLength={30} value={c.name} onChange={e=>patch(c.id,'name',e.target.value)}/></label><div className="field-row"><label className="field"><span>Available from</span><input type="time" required value={c.from} onChange={e=>patch(c.id,'from',e.target.value)}/></label><label className="field"><span>Available until</span><input type="time" required value={c.until} onChange={e=>patch(c.id,'until',e.target.value)}/></label></div></fieldset>)}<CapacityNotice settings={{...settings,courts}} players={players} compact preview/>{error&&<p className="error-box" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save court times</button></div></form></Modal>;
}
