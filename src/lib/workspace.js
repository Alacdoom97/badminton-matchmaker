import {blankSetup,demoSetup,isAvailable,LIMITS,validateSetup} from './model.js';
import {makeSnapshot,validateSnapshot} from './sharing.js';

/** Restore a completed schedule without rerunning the matching algorithm. */
export function validateStoredSchedule(setup,raw) {
  const schedule=validateSnapshot(makeSnapshot(setup,raw)).schedule;
  const byId=new Map(setup.players.map(p=>[p.id,p]));
  for(const round of schedule.rounds) {
    const unavailable=new Set(round.unavailable);
    for(const player of setup.players) if(unavailable.has(player.id)===isAvailable(player,round))throw new Error('Saved schedule contradicts player availability.');
    for(const match of round.matches) if(match.type==='mixed')for(const team of match.teams) {
      const groups=team.map(id=>byId.get(id).mixedGroup).sort();
      if(groups.join(',')!=='man,woman')throw new Error('Saved mixed teams contradict pairing groups.');
    }
  }
  return schedule;
}

export function importWorkspaceSetup(raw) {
  // Recovery files contain the original local-storage envelope.
  return validateSetup(raw?.setup ?? raw);
}

export function workspaceContent({setup,schedule,demo,needsRestore=false}) {
  return JSON.stringify({setup,schedule:schedule??null,generated:Boolean(schedule)||needsRestore,demo:demo===true});
}

export function readWorkspace(raw) {
  if(!raw) {
    const result={setup:demoSetup(),schedule:null,demo:true,needsRestore:false,enabled:true,notice:'',raw:null};
    return {...result,content:workspaceContent(result)};
  }
  // Stored schedules can be larger than the setup-only import limit.
  if(raw.length>LIMITS.importBytes+LIMITS.shareBytes)throw new Error('Saved setup is too large.');
  const saved=JSON.parse(raw),setup=validateSetup(saved.setup);
  const schedule=saved.schedule?validateStoredSchedule(setup,saved.schedule):null;
  const result={setup,schedule,demo:saved.demo===true,needsRestore:!schedule&&saved.generated===true,enabled:true,notice:'',raw};
  return {...result,content:workspaceContent(result)};
}

export function unavailableWorkspace() {
  const result={setup:blankSetup(),schedule:null,demo:false,needsRestore:false,enabled:false,raw:null,notice:'Saved data could not be loaded, or browser storage is blocked. Existing data has not been overwritten. Download a recovery copy or start a new session to enable saving.'};
  return {...result,content:workspaceContent(result)};
}

export function workspaceChanged(expectedRaw,currentRaw) {return expectedRaw!==currentRaw;}
