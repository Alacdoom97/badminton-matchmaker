import test from 'node:test';
import assert from 'node:assert/strict';
import {demoSetup,validateSetup} from '../src/lib/model.js';
import {generateSchedule} from '../src/lib/scheduler.js';
import {importWorkspaceSetup,readWorkspace,validateStoredSchedule,workspaceContent} from '../src/lib/workspace.js';

test('completed schedules restore exact assignments without a generation request',()=>{
  const setup=validateSetup(demoSetup()),schedule=generateSchedule(setup);
  const saved=JSON.stringify({...JSON.parse(workspaceContent({setup,schedule,demo:false})),revision:'completed-1'});
  const restored=readWorkspace(saved);
  assert.deepEqual(restored.schedule,schedule);
  assert.equal(restored.needsRestore,false);
  assert.equal(restored.raw,saved);
});

test('old generated v1 envelopes request asynchronous restoration and keep the saved seed',()=>{
  const setup=demoSetup();setup.seed=82;
  const restored=readWorkspace(JSON.stringify({setup,generated:true,demo:false}));
  assert.equal(restored.schedule,null);
  assert.equal(restored.needsRestore,true);
  assert.equal(restored.setup.seed,82);
  assert.equal(JSON.parse(restored.content).generated,true);
});

test('setup backups and recovery envelopes both import the same validated setup',()=>{
  const setup=demoSetup(),expected=validateSetup(setup);
  assert.deepEqual(importWorkspaceSetup(setup),expected);
  assert.deepEqual(importWorkspaceSetup({setup,generated:true,demo:false,revision:'old-revision'}),expected);
  assert.throws(()=>importWorkspaceSetup({setup:{version:99}}),/version/);
});

test('stored schedules reject forged availability even when the public snapshot is structurally valid',()=>{
  const setup=validateSetup(demoSetup()),schedule=generateSchedule(setup);
  const playing=schedule.rounds[0].matches.flatMap(match=>match.rotation??match.teams.flat())[0];
  setup.players.find(player=>player.id===playing).skipRounds=[0];
  assert.throws(()=>validateStoredSchedule(setup,schedule),/availability/);
});

test('stored schedules reject mixed teams that contradict private pairing groups',()=>{
  const setup=validateSetup(demoSetup()),schedule=generateSchedule(setup);
  const mixed=schedule.rounds.flatMap(round=>round.matches).find(match=>match.type==='mixed');
  assert.ok(mixed);
  setup.players.find(player=>player.id===mixed.teams[0][0]).mixedGroup='none';
  assert.throws(()=>validateStoredSchedule(setup,schedule),/pairing groups/);
});

test('invalid saved assignments never trigger silent regeneration or acceptance',()=>{
  const setup=demoSetup(),schedule=generateSchedule(setup);
  schedule.rounds[0].matches[0].courtId='missing';
  assert.throws(()=>readWorkspace(JSON.stringify({setup,schedule,generated:true})),/invalid/);
});
