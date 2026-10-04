import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const catalog=JSON.parse(await readFile('public/catalog.json','utf8'));
const selectedIds=process.argv.slice(2);
assert.equal(new Set(catalog.devices.map(d=>d.id)).size,catalog.devices.length);
// Isolate each large asset so software-rendered tests do not accumulate browser memory.
for (const device of catalog.devices.filter(d=>!selectedIds.length || selectedIds.includes(d.id))) {
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {const xr=new EventTarget();xr.isSessionSupported=async()=>true;xr.requestSession=async()=>{throw new Error('User denied session');};Object.defineProperty(navigator,'xr',{value:xr});window.registeredTools={};Object.defineProperty(document,'modelContext',{value:{registerTool:tool=>{window.registeredTools[tool.name]=tool;}}});});
  await page.route('**/catalog.json',route=>route.fulfill({json:{...catalog,devices:[device,...catalog.devices.filter(d=>d.id!==device.id)]}}));
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.viewerState?.ready,null,{timeout:90000});
  const state=await page.evaluate(()=>window.viewerState);
  assert.equal(state.id,device.id);assert(state.meshes>0);assert(state.textureMaps>0,`${device.id}: no texture maps`);assert.equal(state.decodedTextureMaps,state.textureMaps,`${device.id}: texture image failed to decode`);assert(state.dimensions.every(Number.isFinite));
  if(device.family==='Legacy') assert(Math.max(...state.dimensions)<2,`${device.id}: unit scale is incorrect`);
  assert.equal(await page.locator(`#families [data-family="${device.family}"]`).getAttribute('aria-pressed'),'true');
  for (const other of catalog.devices.filter(d=>d.family!==device.family)) assert.equal(await page.locator(`[data-id="${other.id}"]`).isVisible(),false);
  console.log(JSON.stringify(state));
  if(['macbook','macbook-air-15','iphone-17e','studio-display','studio-display-xdr'].includes(device.id)) await page.screenshot({path:`/tmp/apple-fixed-${device.id}.png`});
  if(device.id==='mac-studio') await page.screenshot({path:'/tmp/apple-expanded-mac.png'});
  if(device.family==='Legacy') await page.screenshot({path:`/tmp/apple-legacy-${device.id}.png`});
  if(device.id==='iphone') {
   await page.waitForFunction(()=>!!window.registeredTools.select_apple_device);
   assert(await page.evaluate(async()=>{try{await window.registeredTools.select_apple_device.execute({id:'invalid'});return false;}catch{return true;}}));
   const result=await page.evaluate(()=>window.registeredTools.select_apple_device.execute({id:'ipad-mini'}));assert.equal(result.id,'ipad-mini');
   assert.equal(await page.locator('#families [data-family="iPad"]').getAttribute('aria-pressed'),'true');
   await page.locator('#families [data-family="Mac"]').click();await page.waitForFunction(()=>window.viewerState?.ready && window.viewerState.id==='macbook',null,{timeout:90000});
   await page.locator('#scale').fill('3');assert.equal(await page.locator('#scale-value').textContent(),'3×');await page.locator('#reset').click();
   assert.equal(await page.locator('#vr').isDisabled(),false);await page.locator('#vr').click();assert.match(await page.locator('#vr-help').textContent(),/User denied session/);
   await page.locator('#families [data-family="Legacy"]').click();await page.waitForFunction(()=>window.viewerState?.ready && window.viewerState.id==='mac-pro-2019',null,{timeout:90000});
   await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/apple-expanded-mobile.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
}
console.log(selectedIds.length ? 'PASS: selected models render with decoded textures and correct family selection.' : `PASS: ${catalog.devices.length} official models render; family selection, model tools, size/reset, VR denial handling, and mobile layout work.`);
