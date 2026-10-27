import {test,expect} from '@playwright/test';
import {blankSetup,STORAGE_KEY} from '../../src/lib/model.js';
import {generateSchedule} from '../../src/lib/scheduler.js';
import {createShareLink,makeSnapshot} from '../../src/lib/sharing.js';

function fixture(){
  const setup=blankSetup();
  setup.settings.courts[1].name='Late court';setup.settings.courts[1].from='19:00';
  setup.players=Array.from({length:8},(_,i)=>({id:`p${i}`,name:`Player ${i}`,gender:'undisclosed',mixedGroup:'none',preference:'doubles',level:3,arrival:'18:00',departure:'20:00',skipRounds:i===0?[1]:[]}));
  return setup;
}
async function seed(page,setup=fixture(),schedule=null){
  await page.goto('/');
  await expect(page.getByLabel('Session name',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key)!==null,STORAGE_KEY)).toBe(true);
  await page.evaluate(({key,setup,schedule})=>localStorage.setItem(key,JSON.stringify({setup,schedule,generated:Boolean(schedule),demo:false})),{key:STORAGE_KEY,setup,schedule});
  await page.reload();
  await expect(page.getByLabel('Session name',{exact:true})).toBeVisible();
}
async function saved(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);}

test('timing drafts preserve opt-outs until a valid changed value is committed',async({page})=>{
  await seed(page);
  const start=page.getByLabel('Starts at',{exact:true});
  await start.fill('');
  expect((await saved(page)).setup.players[0].skipRounds).toEqual([1]);
  await start.fill('18:00');await start.blur();
  expect((await saved(page)).setup.players[0].skipRounds).toEqual([1]);
  await start.fill('23:30');await start.blur();
  await expect(page.getByRole('alert')).toContainText('same day');
  expect((await saved(page)).setup.settings.start).toBe('18:00');
  await start.fill('');await start.fill('18:30');await start.press('Enter');
  await expect.poll(async()=>(await saved(page)).setup.settings.start).toBe('18:30');
  const result=await saved(page);
  expect(result.setup.players[0]).toMatchObject({arrival:'18:30',departure:'20:30',skipRounds:[]});
  expect(result.setup.settings.courts[0]).toMatchObject({from:'18:30',until:'20:30'});
  expect(result.setup.settings.courts[1]).toMatchObject({name:'Late court',from:'19:00',until:'20:30'});
});

test('clearing a court-count draft preserves custom bookings',async({page})=>{
  await seed(page);
  const original=(await saved(page)).setup.settings.courts;
  const count=page.getByLabel('Courts booked',{exact:true});
  await count.fill('');
  expect((await saved(page)).setup.settings.courts).toEqual(original);
  await count.fill('3');await count.press('Tab');
  expect((await saved(page)).setup.settings.courts).toEqual(original);
  await count.fill('4');await count.press('Enter');
  await expect.poll(async()=>(await saved(page)).setup.settings.courts.length).toBe(4);
  expect((await saved(page)).setup.settings.courts.slice(0,3)).toEqual(original);
});

test('a failed reshuffle keeps the saved seed and exact assignments, including after reload',async({page})=>{
  const setup=fixture(),schedule=generateSchedule(setup);await seed(page,setup,schedule);
  await page.locator('.workspace-tabs button').last().click();
  const before=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await page.evaluate(()=>{window.Worker=class{postMessage(){setTimeout(()=>this.onerror?.(new Event('error')),0);}terminate(){}};});
  await page.getByRole('button',{name:'Reshuffle',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('worker could not load');
  await expect(page.getByRole('button',{name:'Generate matches',exact:true})).toBeEnabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(before);
  await page.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('Unexpected regeneration on reload');}};});
  await page.reload();await page.locator('.workspace-tabs button').last().click();
  await expect(page.getByRole('heading',{name:'Your match schedule',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await saved(page)).schedule.rounds).toEqual(schedule.rounds);
});

test('synchronous worker construction failure leaves generation usable',async({page})=>{
  await seed(page);
  await page.evaluate(()=>{window.Worker=class{constructor(){throw new Error('Worker creation blocked');}};});
  await page.getByRole('button',{name:'Generate matches',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Worker creation blocked');
  await expect(page.getByRole('button',{name:'Generate matches',exact:true})).toBeEnabled();
  expect((await saved(page)).setup.seed).toBe(1);
});

test('legacy saved schedules restore asynchronously after local-view selection',async({page})=>{
  await seed(page);
  const setup=fixture();
  await page.evaluate(({key,setup})=>localStorage.setItem(key,JSON.stringify({setup,generated:true,demo:false})),{key:STORAGE_KEY,setup});
  await page.reload();
  await expect(page.getByRole('heading',{name:'Your match schedule',exact:true})).toBeVisible();
  await expect.poll(async()=>Boolean((await saved(page)).schedule)).toBe(true);
});

test('shared views skip legacy local generation and brand navigation preserves their URL',async({page})=>{
  await seed(page);
  const setup=fixture(),url=await createShareLink(makeSnapshot(setup,generateSchedule(setup)),'https://example.test/');
  await page.evaluate(({key,setup})=>localStorage.setItem(key,JSON.stringify({setup,generated:true,demo:false})),{key:STORAGE_KEY,setup});
  await page.addInitScript(()=>{window.__workerStarts=0;window.Worker=class{constructor(){window.__workerStarts++;throw new Error('Local generation should not run');}};});
  await page.goto('/?shared-test=1'+new URL(url).hash);
  await expect(page.getByText("You're viewing a shared snapshot.",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.__workerStarts)).toBe(0);
  const sharedURL=page.url();
  await page.getByRole('link',{name:'Aura Match home',exact:true}).click();
  expect(page.url()).toBe(sharedURL);
  await page.reload();
  await expect(page.getByText("You're viewing a shared snapshot.",{exact:true})).toBeVisible();
});

test('recovery envelopes can be imported directly',async({page})=>{
  await seed(page);
  const setup=fixture();setup.settings.title='Recovered club night';
  await page.getByLabel('Import a setup file').setInputFiles({name:'aura-match-recovery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({setup,generated:true,demo:false}))});
  await page.getByRole('button',{name:'Import setup',exact:true}).click();
  await expect(page.getByLabel('Session name',{exact:true})).toHaveValue('Recovered club night');
});

test('two tabs pause conflicting saves and can explicitly load or keep a version',async({page,context})=>{
  await seed(page);
  const other=await context.newPage();await other.goto('/');
  await expect(other.getByLabel('Session name',{exact:true})).toBeVisible();
  await page.getByLabel('Session name',{exact:true}).fill('First tab session');
  await expect(other.getByRole('region',{name:'Changes in another tab'})).toBeVisible();
  await other.getByLabel('Session name',{exact:true}).fill('Second tab draft');
  expect((await saved(page)).setup.settings.title).toBe('First tab session');
  await other.getByRole('button',{name:"Load other tab's version",exact:true}).click();
  await expect(other.getByLabel('Session name',{exact:true})).toHaveValue('First tab session');
  await page.getByLabel('Session name',{exact:true}).fill('First tab updated');
  await expect(other.getByRole('region',{name:'Changes in another tab'})).toBeVisible();
  await other.getByLabel('Session name',{exact:true}).fill('Explicitly kept session');
  await other.getByRole('button',{name:"Keep this tab's version",exact:true}).click();
  await expect.poll(async()=>(await saved(page)).setup.settings.title).toBe('Explicitly kept session');
  await expect(page.getByRole('region',{name:'Changes in another tab'})).toBeVisible();
});

test('deleting saved data in another tab pauses saving until explicitly resolved',async({page,context})=>{
  await seed(page);
  const other=await context.newPage();await other.goto('/');
  await expect(other.getByLabel('Session name',{exact:true})).toBeVisible();
  await other.evaluate(key=>localStorage.removeItem(key),STORAGE_KEY);
  await expect(page.getByRole('region',{name:'Changes in another tab'})).toBeVisible();
  await page.getByLabel('Session name',{exact:true}).fill('Kept after deletion');
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBeNull();
  await page.getByRole('button',{name:"Keep this tab's version",exact:true}).click();
  await expect.poll(async()=>(await saved(page))?.setup.settings.title).toBe('Kept after deletion');
});
