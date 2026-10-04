import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
const sources = [
  { id:'iphone', name:'iPhone 18 Pro / Pro Max', family:'iPhone', finish:'Burgundy · paired model', route:'iphone-18-pro' },
  { id:'iphone-duo', name:'iPhone Duo', family:'iPhone', finish:'Star white', route:'iphone-duo' },
  { id:'iphone-air', name:'iPhone Air', family:'iPhone', finish:'Apple default finish', route:'iphone-air' },
  { id:'iphone-17', name:'iPhone 17', family:'iPhone', finish:'Apple default finish', route:'iphone-17' },
  { id:'iphone-17e', name:'iPhone 17e', family:'iPhone', finish:'Soft pink', route:'iphone-17e' },
  { id:'ipad', name:'iPad Pro', family:'iPad', finish:'Space black · with accessories', route:'ipad-pro' },
  { id:'ipad-air', name:'iPad Air', family:'iPad', finish:'Blue · with accessories', route:'ipad-air' },
  { id:'ipad-mini', name:'iPad mini', family:'iPad', finish:'Purple', route:'ipad-mini' },
  { id:'ipad-11', name:'iPad', family:'iPad', finish:'Pink', route:'ipad-11' },
  { id:'macbook', name:'MacBook Air 13″', family:'Mac', finish:'Sky blue', route:'macbook-air', match:'13in-sky-blue' },
  { id:'macbook-air-15', name:'MacBook Air 15″', family:'Mac', finish:'Sky blue', route:'macbook-air', match:'15in-sky-blue' },
  { id:'macbook-pro', name:'MacBook Pro 14″', family:'Mac', finish:'Space black', route:'macbook-pro' },
  { id:'macbook-neo', name:'MacBook Neo', family:'Mac', finish:'Apple default finish', route:'macbook-neo' },
  { id:'imac', name:'iMac', family:'Mac', finish:'Blue · with accessories', route:'imac', icon:'desktop' },
  { id:'mac-mini', name:'Mac mini', family:'Mac', finish:'Silver', route:'mac-mini', match:'mac-mini-silver', icon:'desktop' },
  { id:'mac-studio', name:'Mac Studio', family:'Mac', finish:'Silver', route:'mac-studio', match:'mac-studio-studio.usdz', icon:'desktop' },
  { id:'studio-display', name:'Studio Display', family:'Mac', finish:'Apple default finish', route:'studio-display', icon:'display' },
  { id:'studio-display-xdr', name:'Studio Display XDR', family:'Mac', finish:'Apple default finish', route:'studio-display-xdr', icon:'display' },
  { id:'mac-pro-2019', name:'Mac Pro (2019)', family:'Legacy', finish:'Silver · tower', route:'mac-pro', icon:'tower', model:'https://www.apple.com/105/media/us/mac-pro/2019/36178e80-30fd-441c-9a5b-349c6365bb36/quick-look/modern/case-on.usdz' },
  { id:'mac-pro-2019-open', name:'Mac Pro (2019) · case off', family:'Legacy', finish:'Internal components', route:'mac-pro', icon:'tower', model:'https://www.apple.com/105/media/us/mac-pro/2019/36178e80-30fd-441c-9a5b-349c6365bb36/quick-look/case-off.usdz' },
  { id:'pro-display-xdr-2019', name:'Pro Display XDR (2019)', family:'Legacy', finish:'Silver · Pro Stand', route:'pro-display-xdr', icon:'display', model:'https://www.apple.com/105/media/us/pro-display-xdr/2019/1e439996-d014-462a-94d6-f67407717b60/quick-look/modern/display.usdz' },
];
await mkdir('.model-refresh', { recursive:true });
let previous = {devices:[]};
try { previous = JSON.parse(await readFile('public/catalog.json','utf8')); } catch(e) { if(e.code !== 'ENOENT') throw e; }
const catalog = [];
const pages = new Map();
for (const {route, match, model:retainedModel, ...entry} of sources) {
  const page = `https://www.apple.com/${route}/`;
  if (!retainedModel && !pages.has(page)) {
    const response = await fetch(page, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Apple page returned ${response.status}: ${page}`);
    pages.set(page, await response.text());
  }
  const paths = retainedModel ? [retainedModel] : [...new Set(pages.get(page).match(/\/105\/media\/[^\s"'<>]+\.usdz/g) || [])];
  const path = paths.find(p => p.includes(match || `/${route}/`));
  if (!path) throw new Error(`No official model found for ${entry.name}`);
  const source = new URL(path,page);
  if (source.hostname !== 'www.apple.com') throw new Error('Unexpected model host');
  const cached = previous.devices.find(d => d.id === entry.id && d.source === source.href && d.url.endsWith('.zip'));
  if (cached) {
    await access('public' + cached.url);
    catalog.push({...cached,...entry,page}); console.log(`Reused ${entry.name}`); continue;
  }
  const model = await fetch(source,{signal:AbortSignal.timeout(60000)});
  if (!model.ok) throw new Error(`Model returned ${model.status}: ${source.href}`);
  const bytes = new Uint8Array(await model.arrayBuffer());
  if (bytes.length > 24*1024*1024 || bytes[0] !== 80 || bytes[1] !== 75) throw new Error(`Invalid or oversized USDZ: ${entry.name}`);
  await writeFile(`.model-refresh/${entry.id}.usdz`,bytes);
  catalog.push({...entry,page,source:source.href,url:`/models/${entry.id}.usdz`,bytes:bytes.length});
  console.log(`${entry.name}: ${(bytes.length/1048576).toFixed(1)} MB`);
}
await writeFile('.model-refresh/catalog.json',JSON.stringify({refreshed:new Date().toISOString(),devices:catalog},null,2));
console.log('Downloads complete. Run prepare-models.py to activate the catalog.');
