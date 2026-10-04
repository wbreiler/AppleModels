import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'three/addons/libs/fflate.module.js';
import {USDAParser} from 'three/addons/loaders/usd/USDAParser.js';
const catalog=JSON.parse(await readFile('public/catalog.json','utf8'));
for (const device of catalog.devices) {
 const files=unzipSync(await readFile('public'+device.url));
 const {specsByPath:specs}=new USDAParser().parseData(new TextDecoder().decode(files['model.usda']));
 let bindings=0,textures=0;
 for (const [path,spec] of Object.entries(specs)) {
  // Apple legacy files contain dangling MaterialX links. Three uses USD Preview Surface.
  const shaderId=specs[path.split('.')[0]+'.info:id']?.fields.default;
  const unusedMaterialX=typeof shaderId==='string' && shaderId.startsWith('ND_');
  for (const target of [...(spec.fields.targetPaths||[]),...(spec.fields.connectionPaths||[])]) {
   if(unusedMaterialX || path.endsWith('.outputs:mtlx:surface')) continue;
   assert(specs[target.split('.')[0]],`${device.id}: ${path} references missing material/shader ${target}`);
   if(path.endsWith('.material:binding')) bindings++;
  }
  if (path.endsWith('.inputs:file')) {
   const asset=spec.fields.default;
   assert(files[asset]?.length,`${device.id}: missing texture ${asset}`);textures++;
  }
 }
 assert(bindings>0,`${device.id}: no material bindings`);
 assert(textures>0,`${device.id}: no texture assets`);
 console.log(`${device.id}: ${bindings} material bindings, ${textures} texture references resolve`);
}
