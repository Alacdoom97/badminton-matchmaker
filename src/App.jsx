import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Icon,Shuttle} from './components/Icon.jsx';
import {SessionPanel} from './components/SessionPanel.jsx';
import {PlayerList,PlayerDialog,CourtsDialog} from './components/Players.jsx';
import {Schedule} from './components/Schedule.jsx';
import {CapacityNotice} from './components/CapacityNotice.jsx';
import {Modal} from './components/Modal.jsx';
import {ShareDialog,ExportDialog,HelpDialog} from './components/ShareExport.jsx';
import {demoSetup,blankSetup,validateSetup,validateSettings,STORAGE_KEY,LIMITS,minutes,clock,slots,uid,prettyDate} from './lib/model.js';
import {makeSnapshot,readShareLink} from './lib/sharing.js';
import {downloadBlob,filename} from './lib/export.js';
import {readWorkspace,unavailableWorkspace,workspaceContent,workspaceChanged,validateStoredSchedule,importWorkspaceSetup} from './lib/workspace.js';

function displayDate(date){try{return prettyDate(date);}catch{return 'Choose a date';}}
function loadWorkspace(){
  let raw=null;
  try{raw=localStorage.getItem(STORAGE_KEY);return readWorkspace(raw);}
  catch{return {...unavailableWorkspace(),raw};}
}
export default function App(){
  const [initial]=useState(loadWorkspace),[setup,setSetup]=useState(initial.setup),[demo,setDemo]=useState(initial.demo);
  const [schedule,setSchedule]=useState(initial.schedule),[restorePending,setRestorePending]=useState(initial.needsRestore);
  const [shared,setShared]=useState(undefined),[linkError,setLinkError]=useState('');
  const [tab,setTab]=useState('players'),[round,setRound]=useState(0),[dialog,setDialog]=useState(null);
  const [notice,setNotice]=useState(initial.notice),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [storageEnabled,setStorageEnabled]=useState(initial.enabled),[saveStatus,setSaveStatus]=useState('saved');
  const [conflict,setConflict]=useState(null),[saveAttempt,setSaveAttempt]=useState(0);
  const savedRawRef=useRef(initial.raw),savedContentRef=useRef(initial.enabled&&initial.raw?initial.content:null),restoreStartedRef=useRef(false);
  const uploadRef=useRef(null),workerRef=useRef(null),requestRef=useRef(0),focusRef=useRef(null);
  const readonly=Boolean(shared);
  useEffect(()=>{
    let current=0;
    const handle=async()=>{if(window.location.hash==='#main-content' && current>0)return;const id=++current;setShared(undefined);setLinkError('');try{const s=await readShareLink(window.location.hash);if(id===current){setShared(s);if(s){setTab('schedule');setRound(0);}}}catch(err){if(id===current){setShared(null);setLinkError(`This shared link could not be opened. ${err.message}`);}}};
    handle();window.addEventListener('hashchange',handle);return()=>{current++;window.removeEventListener('hashchange',handle);};
  },[]);
  useEffect(()=>{
    if(shared!==null || linkError || !restorePending || restoreStartedRef.current || conflict)return;
    restoreStartedRef.current=true;
    runGeneration(setup,false);
  },[shared,linkError,restorePending,conflict]);
  useEffect(()=>{
    if(!storageEnabled || readonly || shared===undefined || linkError || restorePending || busy || conflict)return;
    let active=true;
    const save=()=>{
      if(!active)return;
      try{
        const safe=validateSetup(setup),content=workspaceContent({setup:safe,schedule,demo});
        if(content===savedContentRef.current)return;
        const current=localStorage.getItem(STORAGE_KEY);
        if(workspaceChanged(savedRawRef.current,current)){setConflict({raw:current});setSaveStatus('conflict');return;}
        const raw=JSON.stringify({...JSON.parse(content),revision:uid()});
        localStorage.setItem(STORAGE_KEY,raw);savedRawRef.current=raw;savedContentRef.current=content;setSaveStatus('saved');
      }catch(err){setSaveStatus(err.name==='QuotaExceededError' || err.name==='SecurityError'?'failed':'invalid');}
    };
    // Serialize compare-and-write across tabs where the browser supports Web Locks.
    if(navigator.locks?.request)navigator.locks.request(STORAGE_KEY,{mode:'exclusive'},save).catch(()=>{if(active)setSaveStatus('failed');});
    else save();
    return()=>{active=false;};
  },[setup,schedule,demo,storageEnabled,readonly,shared,linkError,restorePending,busy,conflict,saveAttempt]);
  useEffect(()=>{
    const changed=event=>{
      if(event.key!==STORAGE_KEY && event.key!==null)return;
      let current=event.newValue;
      try{current=localStorage.getItem(STORAGE_KEY);}catch{}
      if(workspaceChanged(savedRawRef.current,current)){cancelGeneration();setConflict({raw:current});setSaveStatus('conflict');}
    };
    window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[]);
  useEffect(()=>()=>{requestRef.current++;workerRef.current?.terminate();},[]);
  const snapshot=useMemo(()=>shared || (schedule?makeSnapshot(setup,schedule):null),[shared,setup,schedule]);
  const shownSettings=shared?.settings || setup.settings,shownPlayers=shared?.players || setup.players;
  const rounds=slots(shownSettings),matchCount=(shared?.schedule || schedule)?.rounds.reduce((n,r)=>n+r.matches.length,0);
  function cancelGeneration(){requestRef.current++;workerRef.current?.terminate();workerRef.current=null;setBusy(false);}
  function changeSetup(next,message='Setup updated. Generate matches to use your changes.'){
    cancelGeneration();setRestorePending(false);setSetup(next);setSchedule(null);setError('');setNotice(message);setRound(0);
  }
  function changeSettings(patch){
    const old=setup.settings,next={...old,...patch};delete next.courtCount;
    if(Object.hasOwn(patch,'courtCount')){
      const count=Math.max(1,Math.min(LIMITS.courts,Math.round(patch.courtCount)||1));
      next.courts=old.courts.slice(0,count);
      for(let i=next.courts.length;i<count;i++)next.courts.push({id:uid(),name:`Court ${i+1}`,from:old.start,until:clock(minutes(old.start)+old.duration)});
    }
    const oldEnd=clock(minutes(old.start)+old.duration),newEnd=clock(minutes(next.start)+next.duration);
    const timing=['start','duration','roundMinutes','breakMinutes'].some(k=>Object.hasOwn(patch,k) && patch[k]!==old[k]);
    if(timing){try{validateSettings(next);}catch(err){setError(err.message);return err.message;}}
    const validTimes=Number.isFinite(minutes(next.start)) && Number.isFinite(minutes(newEnd));
    let players=setup.players;
    if(timing){
      players=players.map(p=>({...p,skipRounds:[],arrival:validTimes&&p.arrival===old.start?next.start:p.arrival,departure:validTimes&&p.departure===oldEnd?newEnd:p.departure}));
      if(validTimes)next.courts=next.courts.map(c=>({...c,from:c.from===old.start?next.start:c.from,until:c.until===oldEnd?newEnd:c.until}));
      try{validateSetup({...setup,settings:next,players});}catch(err){const message=`This timing change would make a player or court interval invalid. Update their availability first. ${err.message}`;setError(message);return message;}
    }
    changeSetup({...setup,settings:next,players},timing?'Session timing changed. Round opt-outs were cleared; full-session times follow the new booking. Generate a new schedule.':undefined);
  }
  function runGeneration(checked,reshuffle){
    cancelGeneration();const request=++requestRef.current;
    const next={...checked,seed:reshuffle?(checked.seed+1)%2147483647:checked.seed};
    setBusy(true);setError('');setNotice('Finding compatible teams and balancing the rotation...');
    const finish=result=>{
      if(request!==requestRef.current)return;
      workerRef.current?.terminate();workerRef.current=null;setBusy(false);
      if(result?.ok){
        try{
          const completed=validateStoredSchedule(next,result.schedule);
          // Persist the seed and the completed assignments together only on success.
          setSetup(next);setSchedule(completed);setRestorePending(false);setTab('schedule');setRound(0);setNotice(`Ready to play. ${completed.rounds.length} rounds generated. Review schedule notes for any unfilled courts.`);
        }catch(err){setError(`Could not restore the schedule: ${err.message}`);}
      }else setError(result?.message || 'Could not generate matches.');
    };
    try{
      if(typeof Worker!=='undefined'){
        const worker=new Worker(new URL('./lib/scheduler.worker.js',import.meta.url),{type:'module'});workerRef.current=worker;
        worker.onmessage=e=>finish(e.data);
        worker.onerror=()=>finish({ok:false,message:'The scheduling worker could not load. Reload the page and check that the site files were uploaded together.'});
        worker.postMessage(next);
      }else{
        setTimeout(async()=>{if(request!==requestRef.current)return;try{const {generateSchedule}=await import('./lib/scheduler.js');if(request===requestRef.current)finish({ok:true,schedule:generateSchedule(next)});}catch(err){finish({ok:false,message:err.message});}},10);
      }
    }catch(err){finish({ok:false,message:err.message});}
  }
  function startGeneration(){
    try{
      if(conflict)throw new Error("Resolve the other tab's changes before generating a schedule.");
      const checked=validateSetup(setup);
      if(checked.players.length<2)throw new Error('Add at least two players before generating matches.');
      runGeneration(checked,Boolean(schedule));
    }catch(err){setError(err.message);setNotice('');}
  }
  function loadOtherTab(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY),latest=readWorkspace(raw);
      cancelGeneration();savedRawRef.current=raw;savedContentRef.current=latest.content;restoreStartedRef.current=false;
      setSetup(latest.setup);setSchedule(latest.schedule);setDemo(latest.demo);setRestorePending(latest.needsRestore);setStorageEnabled(true);setConflict(null);setSaveStatus('saved');setError('');setRound(0);setNotice('Loaded the session saved by the other tab.');
    }catch(err){setError(`The other tab's saved session could not be loaded: ${err.message}`);}
  }
  function keepThisTab(){
    try{
      savedRawRef.current=localStorage.getItem(STORAGE_KEY);savedContentRef.current=null;restoreStartedRef.current=false;
      setConflict(null);setSaveAttempt(value=>value+1);setNotice("Keeping this tab's session. It will replace the other saved version.");
    }catch(err){setError(err.message);}
  }
  function savePlayer(player){
    const exists=setup.players.some(p=>p.id===player.id);
    changeSetup({...setup,players:exists?setup.players.map(p=>p.id===player.id?player:p):[...setup.players,player]},`${player.name} ${exists?'updated':'added'}. Generate matches when your line-up is ready.`);setDialog(null);
  }
  function reset(kind){
    cancelGeneration();changeSetup(kind==='demo'?demoSetup():blankSetup(),kind==='demo'?'Sample session loaded. These are fictional players.':'Fresh session ready. Add your first player.');setDemo(kind==='demo');setStorageEnabled(true);setTab('players');setDialog(null);
  }
  function exportSetup(){try{const safe=validateSetup(setup);downloadBlob(new Blob([JSON.stringify(safe,null,2)],{type:'application/json'}),`${filename(safe.settings.title)}-setup.json`);setNotice('Setup downloaded. This backup contains private player profile fields; only share it with trusted organisers.');}catch(err){setError(err.message);}}
  async function importSetup(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{if(file.size>LIMITS.importBytes)throw new Error('Setup files must be smaller than 1 MB.');const imported=importWorkspaceSetup(JSON.parse(await file.text()));setDialog({type:'import',setup:imported});}catch(err){setError(`Could not import this setup: ${err.message}`);}
  }
  function recover(){try{const text=localStorage.getItem(STORAGE_KEY);if(!text)throw new Error('No saved data is available.');downloadBlob(new Blob([text],{type:'application/json'}),'aura-match-recovery.json');}catch(err){setError(err.message);}}
  function localView(){history.replaceState(null,'',window.location.pathname+window.location.search);setShared(null);setLinkError('');setTab('players');}
  function navigate(next){setTab(next);if(window.innerWidth<900)focusRef.current?.scrollIntoView({block:'start'});}
  if(shared===undefined)return <main className="app-loading"><Shuttle size={52}/><h1>Aura Match</h1><p role="status">Opening your courtside workspace...</p></main>;
  if(linkError)return <main className="app-loading"><Icon name="help" size={48}/><h1>Let's get you back on court.</h1><p role="alert">{linkError}</p><button className="button primary" onClick={localView}>Open my local planner</button></main>;
  return <div className="app-shell">
    <a href="#main-content" className="skip-link" onClick={e=>{e.preventDefault();focusRef.current?.focus();focusRef.current?.scrollIntoView({block:'start'});}}>Skip to main content</a>
    <aside className="sidebar" aria-label="Application sidebar"><a className="brand" href="#main-content" aria-label="Aura Match home" onClick={e=>{e.preventDefault();focusRef.current?.focus();focusRef.current?.scrollIntoView({block:'start'});}}><span className="brand-mark"><Shuttle size={42}/></span><span>AURA<span className="brand-subtitle">MATCH CLUB</span></span></a><div className="sidebar-section-label">YOUR CLUBHOUSE</div><nav aria-label="Main navigation">{!readonly&&<button className={tab==='players'?'nav-item active':'nav-item'} onClick={()=>navigate('players')} aria-current={tab==='players'?'page':undefined}><Icon name="users"/>Session planner</button>}<button className={tab==='schedule'?'nav-item active':'nav-item'} onClick={()=>navigate('schedule')} aria-current={tab==='schedule'?'page':undefined}><Icon name="court"/>Match schedule{snapshot&&<span className="nav-count">{rounds.length}</span>}</button><button className="nav-item" onClick={()=>setDialog({type:'help'})}><Icon name="help"/>How it works</button></nav>
      <div className="sidebar-bottom"><div className="sidebar-court" aria-hidden="true"><div/><Shuttle size={46}/></div><h2>More play.<br/>Less planning.</h2><p>For the people who make<br/>every club night a good one.</p>{readonly?<button className="sidebar-new" onClick={localView}><Icon name="plus" size={17}/>My own planner</button>:<button className="sidebar-new" onClick={()=>setDialog({type:'reset'})}><Icon name="plus" size={17}/>New session</button>}<span className="club-credit">BMK Aura-inspired<br/>{'Malm\u00f6, Sweden'}</span></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><span>Clubhouse</span><Icon name="right" size={14}/><strong>{readonly?'Shared schedule':'Session planner'}</strong></div><div className="topbar-actions"><span className={`save-indicator ${saveStatus!=='saved'?'save-warning':''}`}><span aria-hidden="true"/>{readonly?'Read-only snapshot':!storageEnabled?'Local saving off':saveStatus==='saved'?'Saved on this device':saveStatus==='invalid'?'Check session settings':saveStatus==='conflict'?'Other tab has changes':'Storage unavailable'}</span><button className="icon-button" aria-label="Help and privacy information" onClick={()=>setDialog({type:'help'})}><Icon name="help"/></button></div></header>
      <main id="main-content" tabIndex="-1" ref={focusRef}>
        <section className="hero" aria-labelledby="page-heading"><div className="hero-content"><span className="eyebrow">THE SOCIAL SIDE OF BADMINTON</span><h1 id="page-heading">Good games.<br/>Great company<span>.</span></h1><p>{readonly?'Your next game is all lined up. See you on court.':'Bring your people. We will sort the court.'}</p><div className="hero-meta"><Icon name="location" size={15}/><span>{shownSettings.venue}</span><span className="hero-dot" aria-hidden="true"/><span>Navy. Blue. Together.</span></div></div><div className="hero-art" aria-hidden="true"><div className="hero-court"><span className="court-center"/><span className="court-left"/><span className="court-right"/><span className="court-service"/></div><div className="shuttle-orbit"><Shuttle size={130}/></div><span className="art-caption">MAKE EVERY<br/>RALLY COUNT.</span><span className="court-coordinates">COURTSIDE / CLUB NIGHTS</span></div></section>
        <div className="section-toolbar"><div><span className="eyebrow small-eyebrow">{readonly?'A SNAPSHOT FROM YOUR GROUP':'YOUR NEXT SESSION'}</span><h2 className="session-title">{shownSettings.title || 'Name your session'}</h2><p className="session-subtitle">{displayDate(shownSettings.date)} <span aria-hidden="true">/</span> {shownSettings.start} - {clock(minutes(shownSettings.start)+shownSettings.duration)} <span>Stockholm time</span></p></div><div className="toolbar-buttons">{readonly?<button className="button secondary" onClick={localView}><Icon name="plus" size={17}/>Plan your own</button>:<><input ref={uploadRef} type="file" accept=".json,application/json" className="sr-only" tabIndex="-1" aria-label="Import a setup file" onChange={importSetup}/><button className="button secondary import-button" onClick={()=>uploadRef.current.click()}><Icon name="upload" size={17}/>Import</button><button className="button secondary" onClick={exportSetup}><Icon name="download" size={17}/>Save setup</button></>}<button className="button primary" disabled={!snapshot || busy} onClick={()=>setDialog({type:'share'})}><Icon name="share" size={17}/>Share session</button></div></div>
        <div className="stats-strip" aria-label="Session overview">{[{icon:'users',value:shownPlayers.length,label:'players in the mix',detail:'A good crowd'},{icon:'court',value:String(shownSettings.courts.length).padStart(2,'0'),label:'courts booked',detail:'Room to rally'},{icon:'clock',value:shownSettings.duration,label:'minutes of badminton',detail:'Make them count'},{icon:'shuffle',value:rounds.length,label:'rounds to play',detail:matchCount!==undefined?`${matchCount} matches lined up`:'Fresh combinations'}].map(item=><div className="stat" key={item.label}><div className="stat-top"><span className="stat-value">{item.value}</span><span className="stat-icon"><Icon name={item.icon} size={23}/></span></div><span className="stat-label">{item.label}</span><span className="stat-detail">{item.detail}</span></div>)}</div>
        {readonly&&<div className="snapshot-notice"><Icon name="link" size={18}/><p><strong>You're viewing a shared snapshot.</strong> Changes made by the organiser will not appear automatically. Ask for a new link if the line-up changes.</p></div>}
        {error&&<div className="error-box" role="alert">{error}</div>}
        {!readonly&&<div className="workspace-message"><p role="status" aria-live="polite">{notice || 'Your next great game starts with a good line-up.'}</p>{!storageEnabled&&<button className="text-button" onClick={recover}>Download recovery copy</button>}{saveStatus==='failed'&&<p className="error-text">Browser storage could not save your changes. Use Save setup to keep a backup.</p>}</div>}
        {!readonly&&conflict&&<section className="error-box" aria-label="Changes in another tab"><p role="alert">Another tab changed this saved session. Saving is paused so neither version is silently overwritten. Load its saved version or keep this tab's version.</p><div className="toolbar-buttons"><button className="button secondary" onClick={loadOtherTab}>Load other tab's version</button><button className="button secondary" onClick={keepThisTab}>Keep this tab's version</button></div></section>}
        <div className={`dashboard-grid ${readonly?'shared-grid':''}`}>
          {!readonly&&<SessionPanel settings={setup.settings} players={setup.players} onChange={changeSettings} onCourts={()=>setDialog({type:'courts'})} onGenerate={startGeneration} busy={busy}/>}
          <div className="workspace"><div className="workspace-tabs" role="group" aria-label="Planner sections">{!readonly&&<button className={tab==='players'?'selected':''} aria-pressed={tab==='players'} onClick={()=>navigate('players')}><Icon name="users" size={17}/>Players <span>{shownPlayers.length}</span></button>}<button className={tab==='schedule'?'selected':''} aria-pressed={tab==='schedule'} onClick={()=>navigate('schedule')}><Icon name="court" size={17}/>Match schedule{snapshot&&<span className="ready-dot" aria-label="generated"/>}</button><span className="workspace-tabs-note">{readonly?'FIXED SNAPSHOT':'PLAY YOUR WAY'}</span></div>
            {!readonly&&<CapacityNotice settings={setup.settings} players={setup.players}/>}
            {tab==='players'&&!readonly?<PlayerList players={setup.players} settings={setup.settings} isDemo={demo} onBlank={()=>setDialog({type:'reset'})} onAdd={()=>setDialog({type:'player'})} onEdit={player=>setDialog({type:'player',player})} onRemove={player=>setDialog({type:'remove',player})}/>:<Schedule snapshot={snapshot} roundIndex={round} onRound={setRound} readonly={readonly} onGenerate={startGeneration} onExport={()=>setDialog({type:'export'})}/>}
            <div className="workspace-footnote"><Icon name="shield" size={16}/><p>Availability first. Flexible preferences. More people playing.<br/><span>Balanced rotation is a best-effort goal, not a guarantee.</span></p></div>
          </div>
        </div>
        <footer className="page-footer"><span><Shuttle size={22}/>AURA MATCH <span className="footer-separator">/</span> MADE FOR THE LOVE OF THE GAME</span><button className="text-button" onClick={()=>setDialog({type:'help'})}>Accessibility &amp; privacy<Icon name="arrow" size={14}/></button><p>An independent community tool. Not an official BMK Aura service.</p></footer>
      </main>
    </div>
    {dialog?.type==='player'&&<PlayerDialog player={dialog.player} settings={setup.settings} players={setup.players} onSave={savePlayer} onClose={()=>setDialog(null)}/>}
    {dialog?.type==='courts'&&<CourtsDialog settings={setup.settings} players={setup.players} onClose={()=>setDialog(null)} onSave={courts=>{const settings=validateSettings({...setup.settings,courts});changeSetup({...setup,settings},'Court availability updated. Generate a new schedule.');setDialog(null);}}/>}
    {dialog?.type==='share'&&snapshot&&<ShareDialog snapshot={snapshot} onClose={()=>setDialog(null)}/>}
    {dialog?.type==='export'&&snapshot&&<ExportDialog snapshot={snapshot} roundIndex={round} onClose={()=>setDialog(null)}/>}
    {dialog?.type==='help'&&<HelpDialog onClose={()=>setDialog(null)} onDemo={readonly?undefined:()=>setDialog({type:'demo'})}/>}
    {['reset','demo','remove','import'].includes(dialog?.type)&&<Modal title={dialog.type==='remove'?`Remove ${dialog.player.name}?`:dialog.type==='import'?'Import this session?':dialog.type==='demo'?'Load the sample session?':'Start a fresh session?'} onClose={()=>setDialog(null)}><div className="dialog-form"><p className="modal-intro">{dialog.type==='remove'?'This player will be removed. Your generated schedule will be cleared so no old assignments remain.':dialog.type==='import'?`This replaces your current setup with "${dialog.setup.settings.title}" and ${dialog.setup.players.length} players. Save a setup backup first to keep the current session.`:'This replaces your current local setup and clears the generated schedule. Save a setup backup first to keep it.'}</p><div className="modal-actions"><button className="button secondary" onClick={()=>setDialog(null)}>Cancel</button><button className="button primary" onClick={()=>{if(dialog.type==='remove'){changeSetup({...setup,players:setup.players.filter(p=>p.id!==dialog.player.id)},`${dialog.player.name} removed.`);setDialog(null);}else if(dialog.type==='import'){changeSetup(dialog.setup,'Setup imported. Generate matches to create a new schedule.');setDemo(false);setStorageEnabled(true);setTab('players');setDialog(null);}else reset(dialog.type);}}>{dialog.type==='remove'?'Remove player':dialog.type==='import'?'Import setup':dialog.type==='demo'?'Load sample':'Start fresh'}</button></div></div></Modal>}
  </div>;
}

