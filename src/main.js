import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 30);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .9;
$('stage').prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Interactive Apple device model');
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentMap = pmrem.fromScene(environment);
scene.environment = environmentMap.texture;
environment.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff, 0x71859a, 1));
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(3, 5, 2); scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0xf1f5f8, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.visible = false; scene.add(floor);
const grid = new THREE.GridHelper(10, 40, 0xcbd6df, 0xe0e8ee);
grid.visible = false; grid.position.y = .001; scene.add(grid);
const root = new THREE.Group(); root.position.set(0, 1.3, -.7); scene.add(root);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = .08; controls.maxDistance = 20;
let devices = [], selected, model, requestId = 0, heldBy = null, ready = false;
let frameSize = .2;
const controllerFactory = new XRControllerModelFactory();
const controllers = [0,1].map(index => {
  const controller = renderer.xr.getController(index); scene.add(controller);
  const grip = renderer.xr.getControllerGrip(index); grip.add(controllerFactory.createControllerModel(grip)); scene.add(grip);
  controller.addEventListener('connected', e => { controller.userData.source = e.data; });
  controller.addEventListener('disconnected', () => { release(controller); delete controller.userData.source; });
  controller.addEventListener('squeezestart', () => {
    if (!ready || heldBy) return;
    controller.updateWorldMatrix(true, false);
    const position = root.getWorldPosition(new THREE.Vector3());
    const hand = controller.getWorldPosition(new THREE.Vector3());
    if (hand.distanceTo(position) > Math.max(.28, frameSize * root.scale.x)) return;
    heldBy = controller; controller.attach(root);
  });
  controller.addEventListener('squeezeend', () => release(controller));
  return controller;
});
function release(controller) { if (heldBy === controller) { scene.attach(root); heldBy = null; } }
function dispose(object) {
  const textures = new Set(), geometries = new Set(), materials = new Set();
  object.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const item of [...textures, ...materials, ...geometries]) item.dispose();
}
function setSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 1 || size > 6) throw new Error('Size must be between 1 and 6');
  root.scale.setScalar(size); $('scale').value = size; $('scale-value').value = `${size.toFixed(2).replace(/\.?0+$/, '')}×`;
}
function resetView() {
  if (heldBy) release(heldBy);
  root.position.set(0, 1.3, -.7); root.rotation.set(0, 0, 0);
  if (renderer.xr.isPresenting) {
    const xrCamera = renderer.xr.getCamera();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCamera.quaternion); forward.y = 0; forward.normalize();
    root.position.copy(xrCamera.position).addScaledVector(forward, .65);
    root.position.y = Math.max(.8, xrCamera.position.y - .2);
    return;
  }
  const distance = Math.max(frameSize * root.scale.x * 1.8, .25);
  controls.target.copy(root.position);
  camera.position.copy(root.position).add(new THREE.Vector3(distance * .7, distance * .35, distance));
  controls.update();
}
const observer = new ResizeObserver(() => {
  const width = $('stage').clientWidth, height = $('stage').clientHeight;
  camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
}); observer.observe($('stage'));
async function selectDevice(id) {
  const device = devices.find(item => item.id === id);
  if (!device) throw new Error('Unknown device');
  const token = ++requestId;
  showFamily(device.family);
  selected = device; ready = false; window.viewerState = { id, ready:false }; $('vr').disabled = true; $('reset').disabled = true;
  if (heldBy) release(heldBy);
  if (model) { root.remove(model); dispose(model); model = null; }
  $('status').hidden = false; $('retry').hidden = true; $('status').textContent = `Loading ${device.name}…`;
  $('model-name').textContent = device.name; $('family').textContent = device.family; $('finish').textContent = device.finish;
  for (const button of $('devices').children) button.setAttribute('aria-pressed', String(button.dataset.id === id));
  $('apple-source').href = device.source; $('apple-source').hidden = false;
  try {
    const loaded = await new USDLoader().loadAsync(device.url, event => {
      if (token === requestId && event.lengthComputable) $('status').textContent = `Loading ${device.name}… ${Math.round(event.loaded/event.total*100)}%`;
    });
    if (token !== requestId) { dispose(loaded); return { superseded: true }; }
    loaded.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(loaded);
    if (box.isEmpty()) { dispose(loaded); throw new Error('Model contains no visible geometry'); }
    const size = box.getSize(new THREE.Vector3());
    frameSize = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(frameSize) || frameSize <= 0) { dispose(loaded); throw new Error('Invalid model dimensions'); }
    loaded.position.sub(box.getCenter(new THREE.Vector3()));
    model = loaded; root.add(model); setSize(1); resetView();
    ready = true; $('reset').disabled = false; $('status').hidden = true;
    $('finish').textContent = `${device.finish} · ${(device.bytes/1048576).toFixed(1)} MB`;
    $('vr').disabled = !vrSupported;
    window.viewerState = { id, ready, meshes: 0, textureMaps:0, decodedTextureMaps:0, dimensions: size.toArray() };
    model.traverse(node => {
      if (!node.isMesh) return;
      window.viewerState.meshes++;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        for (const value of Object.values(material)) {
          if (!value?.isTexture) continue;
          window.viewerState.textureMaps++;
          if (value.image?.width > 0 && value.image?.height > 0) window.viewerState.decodedTextureMaps++;
        }
      }
    });
    return { id, ready: true };
  } catch (error) {
    if (token !== requestId) return { superseded: true };
    console.error(error); $('status').textContent = 'The model could not load. Select Try again to retry.';
    $('retry').hidden = false; window.viewerState = { id, ready: false, error: error.message };
    throw error;
  }
}
$('reset').onclick = resetView;
$('retry').onclick = () => selectDevice(selected.id).catch(() => {});
$('scale').oninput = e => {
  const previous = root.scale.x;
  setSize(e.target.value);
  if (!renderer.xr.isPresenting) camera.position.sub(controls.target).multiplyScalar(root.scale.x / previous).add(controls.target);
};
let vrSupported = false;
async function checkVR() {
  try { vrSupported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); }
  catch { vrSupported = false; }
  $('vr').textContent = vrSupported ? 'Enter Quest VR' : 'Open on Meta Quest';
  $('vr').disabled = !vrSupported || !ready;
  $('vr-help').textContent = vrSupported ? 'Enter VR, then hold a grip button near the model to pick it up.' : 'Open this HTTPS page in Meta Quest Browser to enter VR.';
}
$('vr').onclick = async () => {
  try {
    if (renderer.xr.isPresenting) { await renderer.xr.getSession().end(); return; }
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    try { await renderer.xr.setSession(session); } catch (error) { await session.end(); throw error; }
  } catch (error) { $('vr-help').textContent = `VR could not start: ${error.message}. Try again in Quest Browser.`; }
};
renderer.xr.addEventListener('sessionstart', () => { controls.enabled = false; floor.visible = grid.visible = true; $('vr').textContent = 'Exit VR'; resetView(); });
renderer.xr.addEventListener('sessionend', () => { if (heldBy) release(heldBy); controls.enabled = true; floor.visible = grid.visible = false; $('vr').textContent = 'Enter Quest VR'; resetView(); });
let previousTime = 0;
renderer.setAnimationLoop(time => {
  const dt = Math.min((time - previousTime) / 1000, .05); previousTime = time;
  if (renderer.xr.isPresenting && ready) {
    for (const controller of controllers) {
      const axes = controller.userData.source?.gamepad?.axes;
      if (!axes || axes.length < 2) continue;
      const x = axes[axes.length - 2], y = axes[axes.length - 1];
      if (Math.abs(x) > .2) root.rotateY(-x * dt * 1.5);
      if (Math.abs(y) > .2) setSize(Math.max(1, Math.min(6, root.scale.x - y * dt * 2)));
    }
  } else controls.update();
  renderer.render(scene, camera);
});
function showFamily(family) {
  for (const button of $('families').children) button.setAttribute('aria-pressed', String(button.dataset.family === family));
  for (const button of $('devices').children) button.hidden = button.dataset.family !== family;
}
const icons = {
  tower: '<rect x="12" y="5" width="22" height="31" rx="2"/><path d="M16 5V2h14v3M16 36v4m14-4v4M17 12h12m-12 6h12m-12 6h12m-12 6h12"/>',
  desktop: '<rect x="5" y="3" width="36" height="25" rx="2"/><path d="M23 28v8m-9 2h18"/>',
  display: '<rect x="3" y="3" width="40" height="25" rx="2"/><path d="M23 28v9m-10 1h20"/>',
  iPhone: '<rect x="13" y="3" width="20" height="35" rx="5"/><path d="M19 7h8m-7 26h6"/>',
  iPad: '<rect x="8" y="3" width="30" height="35" rx="3"/><circle cx="23" cy="6" r=".5"/>',
  Mac: '<path d="M8 6h30v23H8zM3 32h40l-4 4H7z"/>'
};
async function initialize() {
  await checkVR();
  const response = await fetch('/catalog.json'); if (!response.ok) throw new Error('Catalog unavailable');
  const catalog = await response.json(); devices = catalog.devices;
  if (!Array.isArray(devices) || !devices.length) throw new Error('Catalog is empty');
  $('updated').textContent = `Retrieved ${new Date(catalog.refreshed).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}`;
  for (const family of [...new Set(devices.map(device => device.family))]) {
    const button = document.createElement('button'); button.dataset.family = family; button.textContent = family;
    button.onclick = () => { showFamily(family); if (selected?.family !== family) selectDevice(devices.find(d => d.family === family).id).catch(() => {}); };
    $('families').append(button);
  }
  for (const device of devices) {
    const button = document.createElement('button'); button.className = 'device'; button.dataset.id = device.id; button.dataset.family = device.family;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox','0 0 46 42'); icon.setAttribute('aria-hidden','true'); icon.innerHTML = icons[device.icon || device.family] || '';
    const text = document.createElement('span'), name = document.createElement('strong'), finish = document.createElement('small');
    name.textContent = device.name; finish.textContent = device.finish; text.append(name,finish); button.append(icon,text);
    button.onclick = () => selectDevice(device.id).catch(() => {}); $('devices').append(button);
  }
  await selectDevice(devices[0].id);
  if (document.modelContext?.registerTool) {
    try {
      await document.modelContext.registerTool({ name:'select_apple_device', description:'Load an Apple device in the visible 3D viewer.', inputSchema:{ type:'object',properties:{id:{type:'string',enum:devices.map(d=>d.id)}},required:['id'],additionalProperties:false }, annotations:{readOnlyHint:false,untrustedContentHint:false}, execute:input=>selectDevice(input?.id) });
    } catch (error) { console.warn('Model context registration unavailable', error); }
  }
}
initialize().catch(error => { console.error(error); $('status').hidden = false; if (!selected) $('status').textContent = 'The viewer could not start. Reload this page to try again.'; });
