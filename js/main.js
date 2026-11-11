// Mithila Express: bootstrap, game state, fixed-step simulation and rendering.

import * as THREE from 'three';
import { TOTAL, REGION_LEN, REGIONS, ROAD_HALF, PLAYER, REAL_KM, CHUNK_LEN, N_CHUNKS } from './config.js';
import { clamp, lerp, smoothstep } from './util.js';
import { regionIndex, regionParam, roadX, roadY, roadHeading, roadCurvature } from './road.js';
import { makeGeos } from './geo.js';
import { Sky } from './sky.js';
import { World } from './world.js';
import { Entities } from './entities.js';
import { Rickshaw } from './rickshaw.js';
import { Particles } from './particles.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Hud, fmtTime } from './hud.js';
import { paintingSteps } from './madhubani.js';

const params = new URLSearchParams(location.search);
const AUTO = params.get('auto') === '1';
const TIME_SCALE = clamp(parseFloat(params.get('speed')) || 1, 1, 20);
const FORCE_Q = params.has('q') ? clamp(parseInt(params.get('q'), 10) || 0, 0, 5) : null;
const STEP = 1 / 60;
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const STOP_AFTER = 20;       // how far past the gate the rickshaw rolls before it parks
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2600);

const sky = new Sky(scene);
const geos = makeGeos();
const world = new World(scene, sky, geos);
const ents = new Entities(scene, world, geos);
const rick = new Rickshaw(scene);
const parts = new Particles(scene);
const input = new Input();
const sfx = new Sfx();
const hud = new Hud();
hud.muted(sfx.muted);

// Quality ladder for the adaptive governor: pixel ratio cap and sun shadow map size.
const QUALITY = [
  { pr: 2, sh: 2048 }, { pr: 1.5, sh: 2048 }, { pr: 1.25, sh: 1024 }, { pr: 1, sh: 1024 }, { pr: 0.75, sh: 1024 },
  { pr: 0.4, sh: 512 },     // only reachable with ?q=5, for automated tests
];

// ------------------------------------------------------------------ state
const G = {
  state: 'menu',            // menu | play | pause | over | arrive | win
  time: 0,
  region: 0, checkpoint: 0,
  arriveT: 0, fireworkT: 0,
  shake: 0,
  quality: FORCE_Q ?? 0,
  fps: 60, fpsFrames: 0, fpsTime: 0, fpsSkip: 2,
  camLat: -2.6, baseFov: 62, fov: 62,
  autopilot: AUTO,
  player: null,
};

function newPlayer() {
  return { dist: 0, lat: -2.6, speed: 0, steer: 0, fuel: 100, chai: 0, hits: 0, inv: 0, bump: 0, clock: 0, boost: false, braking: false, edge: false };
}
G.player = newPlayer();

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3(), focus = new THREE.Vector3();
const hitList = [], hazList = [];
const FESTIVE = [0xff4d4d, 0xffc233, 0x3ddc84, 0xff5fa8, 0x4db8ff, 0xff8a2a, 0xffffff];

// ------------------------------------------------------------------ flow
function show(id, on) { $(id).hidden = !on; }

function startGame() {
  sfx.init();
  G.player = newPlayer();
  G.region = 0; G.checkpoint = 0; G.arriveT = 0;
  ents.reset(0);
  world.rebuildAll(0);
  G.state = 'play';
  for (const id of ['menu', 'pause', 'over', 'win']) show(id, false);
  hud.show(true);
  hud.banner(REGIONS[0].name, REGIONS[0].tag);
}

function retry() {
  const p = G.player;
  p.dist = G.checkpoint + (G.checkpoint > 0 ? 12 : 0);
  p.lat = -2.6; p.speed = 0; p.steer = 0; p.fuel = 75; p.inv = 2.5; p.bump = 0;
  ents.reset(p.dist);
  world.rebuildAll(p.dist);
  G.state = 'play';
  show('over', false);
  hud.banner(REGIONS[G.region].name, 'Fresh chai. Try again.');
}

function gameOver() {
  G.state = 'over';
  G.player.speed = 0;
  input.clear();
  $('over-text').textContent = `The rickshaw sputters to a stop in ${REGIONS[G.region].name}, ${kmLeft()} km short of Madhubani.`;
  $('btn-retry').textContent = `Retry from ${REGIONS[G.region].name}`;
  show('over', true);
  sfx.over();
  $('btn-retry').focus({ preventScroll: true });
}

function setPaused(on) {
  if (on && G.state === 'play') { G.state = 'pause'; show('pause', true); input.clear(); }
  else if (!on && G.state === 'pause') { G.state = 'play'; show('pause', false); }
}

function arrive() {
  G.state = 'arrive';
  G.arriveT = 0; G.fireworkT = 0;
  input.clear();
  hud.banner('Madhubani!', 'You made it.');
  sfx.win();
}

function showWin() {
  G.state = 'win';
  const p = G.player;
  let best = null;
  try {
    best = parseFloat(localStorage.getItem('mithila.best')) || null;
    if (!best || p.clock < best) { best = p.clock; localStorage.setItem('mithila.best', String(p.clock)); }
  } catch { /* storage unavailable */ }
  $('win-stats').textContent =
    `Time ${fmtTime(p.clock)}  ·  ${p.chai} cups of chai  ·  ${p.hits} bumps` + (best ? `  ·  Best ${fmtTime(best)}` : '');
  show('win', true);
  hud.show(false);
  drawPainting(p.chai * 31 + p.hits * 7 + Math.floor(p.clock));
  $('btn-again').focus({ preventScroll: true });
}

let paintTimer = 0;
function drawPainting(seed) {
  const c = $('painting'), ctx = c.getContext('2d');
  const steps = paintingSteps(c.width, c.height, seed);
  c.dataset.done = '0';
  clearInterval(paintTimer);
  let i = 0;
  const next = () => {
    if (i < steps.length) steps[i++](ctx);
    if (i >= steps.length) { clearInterval(paintTimer); c.dataset.done = '1'; }
  };
  next(); next();
  paintTimer = setInterval(next, 85);
}

const kmLeft = () => Math.max(0, Math.round((1 - G.player.dist / TOTAL) * REAL_KM));

function onConfirm() {
  if (G.state === 'menu') startGame();
  else if (G.state === 'over') retry();
  else if (G.state === 'pause') setPaused(false);
}

input.onAction = (a) => {
  if (a === 'confirm') onConfirm();
  else if (a === 'pause') setPaused(G.state === 'play');
  else if (a === 'mute') toggleMute();
  else if (a === 'horn') sfx.horn();
};
function toggleMute() { sfx.init(); sfx.setMuted(!sfx.muted); hud.muted(sfx.muted); }

$('btn-start').addEventListener('click', startGame);
$('btn-retry').addEventListener('click', retry);
$('btn-restart').addEventListener('click', startGame);
$('btn-restart-p').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', () => setPaused(false));
$('btn-again').addEventListener('click', startGame);
$('btn-pause').addEventListener('click', () => setPaused(true));
$('btn-mute').addEventListener('click', toggleMute);
// Buttons should not keep keyboard focus, or Space would press them again while driving.
for (const b of document.querySelectorAll('button')) b.addEventListener('click', () => b.blur());
window.addEventListener('touchstart', () => document.body.classList.add('touch-on'), { passive: true, once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); G.fpsSkip = 2; });

// ------------------------------------------------------------------ autopilot
// Picks the lane with the best mix of "chai ahead" and "nothing solid ahead".
const AUTO_LANES = [-4.3, -3.2, -2.1, -1.0, 0.1, 1.2, 2.3, 3.4, 4.3];
function autopilot(p) {
  ents.hazards(p.dist, 75, hazList);
  let best = p.lat, bestScore = -1e9, here = 0;
  for (let i = 0; i <= AUTO_LANES.length; i++) {
    const c = i < AUTO_LANES.length ? AUTO_LANES[i] : p.lat;
    let s = -Math.abs(c - p.lat) * 0.35 - (c > 0 ? 0.7 : 0);
    for (const e of hazList) {
      const gap = e.d - p.dist, dl = Math.abs(e.lat - c);
      if (e.t === 'chai') {
        if (gap > 0 && gap < 60 && dl < 0.8) s += 3 * (1 - gap / 75);
      } else if (e.t === 'truck') {
        const tt = (gap - 5) / Math.max(1, p.speed - e.v);
        if (gap > -6 && tt < 2.8 && dl < 2.9) s -= 40;
      } else {
        const reach = p.speed * 1.4 + 12;
        if (gap > -2.5 && gap < reach && dl < e.hw + 1.4 + (e.amp || 0) * 0.5) s -= e.t === 'pot' ? 9 : 28;
      }
    }
    if (i === AUTO_LANES.length) here = s;
    else if (s > bestScore) { bestScore = s; best = c; }
  }
  return { steer: clamp((best - p.lat) * 1.7, -1, 1), boost: p.fuel > 72 && here > -1 && bestScore > -1 };
}

// ------------------------------------------------------------------ simulation
function simulate(h) {
  G.time += h;
  const p = G.player;

  if (G.state === 'play') {
    const prev = p.dist;
    let steerIn = input.steer, boost = input.boost, up = input.up, down = input.down;
    if (G.autopilot) { const a = autopilot(p); steerIn = a.steer; boost = a.boost; up = down = false; }

    p.steer += (steerIn - p.steer) * Math.min(1, h * 9);
    p.boost = boost && p.fuel > 0;
    p.braking = down;
    const target = p.boost ? PLAYER.boost : up ? PLAYER.fast : down ? PLAYER.slow : PLAYER.cruise;
    if (p.speed < target) p.speed = Math.min(target, p.speed + PLAYER.accel * (p.boost ? 1.7 : 1) * h);
    else p.speed = Math.max(target, p.speed - (down ? PLAYER.brake : 10) * h);

    p.dist += p.speed * h;
    // steering, plus a little centrifugal drift so curves have to be driven
    const curv = roadCurvature(p.dist) / 4;
    p.lat += p.steer * (6.5 + p.speed * 0.11) * h - curv * p.speed * p.speed * 0.5 * h;
    const lim = ROAD_HALF - 0.8;
    p.edge = Math.abs(p.lat) > lim;
    if (p.edge) { p.lat = Math.sign(p.lat) * lim; p.speed = Math.max(8, p.speed - 9 * h); }

    p.fuel -= (PLAYER.drain + (p.boost ? PLAYER.boostDrain : 0) + (up ? 0.4 : 0)) * h;
    p.inv = Math.max(0, p.inv - h);
    p.bump = Math.max(0, p.bump - h * 3.2);
    p.clock += h;

    ents.simulate(h, G.time, p);
    for (const e of ents.collide(p, prev, hitList)) onHit(e, p);
    world.update(p.dist);

    const ri = regionIndex(p.dist);
    if (ri > G.region) {
      G.region = ri; G.checkpoint = ri * REGION_LEN;
      hud.banner(REGIONS[ri].name, REGIONS[ri].tag);
      sfx.region();
    }
    if (p.dist >= TOTAL) arrive();
    else if (p.fuel <= 0) { p.fuel = 0; gameOver(); }
  } else if (G.state === 'arrive' || G.state === 'win') {
    const stop = TOTAL + STOP_AFTER;
    p.speed = Math.max(0, Math.min(p.speed, (stop - p.dist) * 1.4));
    if (p.speed < 0.25) p.speed = 0;
    p.dist += p.speed * h;
    p.lat += (0 - p.lat) * Math.min(1, h * 1.6);
    p.steer *= 1 - Math.min(1, h * 5);
    p.boost = false; p.braking = p.speed > 0.5;
    p.bump = Math.max(0, p.bump - h * 3.2);
    world.update(p.dist);
    ents.simulate(h, G.time, p);
    G.arriveT += h;
    G.fireworkT -= h;
    if (G.fireworkT <= 0) {
      G.fireworkT = 0.35 + Math.random() * 0.4;
      const x = roadX(TOTAL) + (Math.random() - 0.5) * 90, y = roadY(TOTAL) + 20 + Math.random() * 18, z = -TOTAL + 10 + Math.random() * 60;
      parts.burst(x, y, z, 70, FESTIVE[Math.floor(Math.random() * FESTIVE.length)], 11, 2.4, 1.7, 3.5);
      if (G.arriveT < 12) sfx.boom();
    }
    if (G.state === 'arrive' && G.arriveT > 4.2) showWin();
  }
}

function onHit(e, p) {
  const x = roadX(e.d) + e.lat, y = roadY(e.d), z = -e.d;
  if (e.t === 'chai') {
    p.fuel = Math.min(100, p.fuel + PLAYER.chaiFuel);
    p.chai++;
    parts.burst(x, y + 1.2, z, 14, 0xffd070, 4, 0.5, 0.6, 4, 2);
    sfx.chai(); hud.pulseFuel();
    return;
  }
  p.hits++;
  if (e.t === 'pot') {
    p.fuel -= 6; p.speed *= 0.72; p.bump = 1; p.inv = 0.35; G.shake = Math.max(G.shake, 0.4);
    parts.burst(x, y + 0.2, z, 10, 0x9a8a78, 3.5, 0.45, 0.5, 9, 2.5);
    sfx.bump(); hud.toast('Pothole!  −6 chai');
  } else if (e.t === 'cow') {
    p.fuel -= 14; p.speed *= 0.3; p.bump = 0.8; p.inv = 1.5; G.shake = Math.max(G.shake, 0.8);
    parts.burst(x, y + 1.2, z, 22, 0xfff2d0, 6, 0.55, 0.7, 8, 3);
    sfx.hit(); sfx.moo(); hud.toast('Holy cow!  −14 chai');
  } else {
    p.fuel -= 24; p.speed = 4; p.bump = 1; p.inv = 1.9; G.shake = 1;
    p.lat = clamp(p.lat + Math.sign(p.lat - e.lat || -1) * 1.3, -ROAD_HALF + 0.8, ROAD_HALF - 0.8);
    parts.burst(x, y + 1.4, z, 34, 0xffb060, 8, 0.6, 0.8, 8, 3);
    sfx.hit(); sfx.truckHorn(); hud.toast('Truck!  −24 chai');
  }
}

// ------------------------------------------------------------------ presentation
function present(dt) {
  const p = G.player, t = G.time;
  const px = roadX(p.dist) + p.lat, py = roadY(p.dist), pz = -p.dist;
  const heading = roadHeading(p.dist);
  const g = rick.group;
  g.position.set(px, py, pz);
  g.rotation.order = 'YXZ';
  g.rotation.y = -heading - p.steer * 0.13;
  g.rotation.x = Math.atan((roadY(p.dist + 1) - roadY(p.dist - 1)) / 2);

  const prog = clamp(p.dist / TOTAL, 0, 1);
  const night = sky.night;
  rick.present(dt, p.speed, p.steer, p.bump, night, p.braking, t, p.inv > 0 && G.state === 'play', G.state === 'play' ? 1 : 0.25);

  // ---- camera
  if (G.state === 'menu') {
    const a = t * 0.14 + 2.5;
    tmpPos.set(px + Math.sin(a) * 8.6, py + 2.7, pz + Math.cos(a) * 8.6);
    // aim to one side so the rickshaw sits beside the title card, not behind it
    const side = camera.aspect > 1.2 ? 4.8 : 0;
    tmpLook.set(px + Math.cos(a) * side, py + 1.1 - (side ? 0 : 2.2), pz - Math.sin(a) * side);
    camPos.copy(tmpPos); camLook.copy(tmpLook);
  } else if (G.state === 'arrive' || G.state === 'win') {
    // Park the camera beyond the stopping point, looking back at the rickshaw with the
    // gate and the fireworks behind it.
    const sd = TOTAL + STOP_AFTER, a = Math.sin(t * 0.1) * 0.35;
    tmpPos.set(roadX(sd) - 4.2 + a * 3, roadY(sd) + 1.9, -(sd + 9.5));
    tmpLook.set(px + 0.6, py + 2.4, pz + 3);
    const k = Math.min(1, dt * 2.2);
    camPos.lerp(tmpPos, k); camLook.lerp(tmpLook, k);
  } else {
    G.camLat += (p.lat * 0.72 - G.camLat) * Math.min(1, dt * 5);
    const cd = p.dist - 8.6, ld = p.dist + 16;
    camPos.set(roadX(cd) + G.camLat, Math.max(roadY(cd), py) + 3.9 + p.bump * 0.1, -cd);
    camLook.set(roadX(ld) + lerp(G.camLat, p.lat, 0.5), roadY(ld) + 1.0, -ld);
  }
  G.shake = Math.max(0, G.shake - dt * 2.4);
  const sh = REDUCED_MOTION ? 0 : G.shake * G.shake * 0.5;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z);
  camera.lookAt(camLook);
  const fovTarget = G.baseFov + (REDUCED_MOTION ? 0 : (p.boost ? 11 : 0) + smoothstep(30, 54, p.speed) * 3);
  G.fov += (fovTarget - G.fov) * Math.min(1, dt * 3.5);
  if (Math.abs(camera.fov - G.fov) > 0.01) { camera.fov = G.fov; camera.updateProjectionMatrix(); }

  // ---- light
  focus.set(roadX(p.dist + 26) + p.lat * 0.5, roadY(p.dist + 26), -(p.dist + 26));
  sky.update(prog, focus, camera.position, t, regionParam(clamp(p.dist, 0, TOTAL), 'ridge'));
  renderer.toneMappingExposure = sky.exposure;
  world.present(p.dist, sky.night, sky.day);
  ents.present(t, sky.night, camera);

  // ---- particles
  if (G.state === 'play' && dt > 0) {
    if (p.boost) {
      for (let i = 0; i < 2; i++) parts.emit(px + (Math.random() - 0.5) * 0.5, py + 0.35, pz + 1.4,
        (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), 5 + Math.random() * 4, 0xff9a3a, 0.45, 0.35, -1);
    }
    if (p.edge && Math.random() < 0.6) parts.emit(px, py + 0.2, pz + 1, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, 3, 0xb89a78, 0.5, 0.5, 3);
    if (sky.night > 0.35 && Math.random() < 0.3) {    // fireflies
      const d = p.dist + 12 + Math.random() * 80, side = Math.random() < 0.5 ? -1 : 1;
      parts.emit(roadX(d) + side * (7 + Math.random() * 22), roadY(d) + 0.5 + Math.random() * 3, -d,
        (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, 0xd8ff70, 0.32, 2.4, 0);
    }
  }
  parts.update(dt, renderer.domElement.height * 0.75);

  // ---- hud and sound
  hud.update(p.fuel, p.chai, p.speed * 1.8, p.clock, prog, kmLeft(), REGIONS[regionIndex(p.dist)].name);
  sfx.engine(p.speed, G.state === 'play' || G.state === 'arrive');
}

// ------------------------------------------------------------------ sizing and quality
function applyQuality() {
  const q = QUALITY[G.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  sky.setShadowSize(q.sh);
  resize();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  G.baseFov = w < h ? 80 : 62;
  camera.updateProjectionMatrix();
  G.fpsSkip = 2;
}
window.addEventListener('resize', resize);

// Measure real frame rate in 2-second windows and step quality down if it sags.
function trackFps(dt) {
  G.fpsFrames++; G.fpsTime += dt;
  if (G.fpsTime < 2) return;
  const fps = G.fpsFrames / G.fpsTime;
  G.fpsFrames = 0; G.fpsTime = 0;
  if (G.fpsSkip > 0) { G.fpsSkip--; return; }
  G.fps = fps;
  if (FORCE_Q === null && TIME_SCALE === 1 && fps < 50 && G.quality < QUALITY.length - 2 && !document.hidden) {
    G.quality++;
    applyQuality();
  }
}

// Draw one frame with culling off so every shader, texture and shadow pass is compiled
// and uploaded before the player starts, instead of hitching when first seen.
function warmUp() {
  const culled = [];
  scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  renderer.render(scene, camera);
  for (const o of culled) o.frustumCulled = true;
}

// ------------------------------------------------------------------ loop
let last = performance.now(), acc = 0;
const prof = { sim: 0, present: 0, render: 0, long: [], prev: null };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const t0 = performance.now();
  if (G.state !== 'pause') {
    acc += dt * TIME_SCALE;
    const maxSteps = 8 * TIME_SCALE;
    let n = 0;
    while (acc >= STEP && n < maxSteps) { simulate(STEP); acc -= STEP; n++; }
    if (n === maxSteps) acc = 0;
  }
  const t1 = performance.now();
  present(G.state === 'pause' ? 0 : dt);
  const t2 = performance.now();
  renderer.render(scene, camera);
  const t3 = performance.now();
  trackFps(dt);
  // Worst CPU cost per phase, and a log of slow frames, for tools/fps.mjs. A slow frame
  // shows up as a long dt on the frame after it, so log the previous frame's phases.
  prof.sim = Math.max(prof.sim, t1 - t0); prof.present = Math.max(prof.present, t2 - t1); prof.render = Math.max(prof.render, t3 - t2);
  if (dt > 0.034) prof.long.push({ ms: Math.round(dt * 1000), dist: Math.round(G.player.dist), state: G.state, ...prof.prev });
  prof.prev = { sim: +(t1 - t0).toFixed(1), present: +(t2 - t1).toFixed(1), render: +(t3 - t2).toFixed(1) };
  if (prof.long.length > 50) prof.long.shift();
}

world.update(0);
applyQuality();
present(0);
warmUp();
requestAnimationFrame(frame);

// ------------------------------------------------------------------ test and debug hooks
window.__mithila = {
  TOTAL, REGIONS: REGIONS.map((r) => r.name),
  get state() { return G.state; },
  get player() { return G.player; },
  get region() { return REGIONS[regionIndex(G.player.dist)].name; },
  get night() { return sky.night; },
  get headlight() { return rick.spot.intensity; },
  get fps() { return G.fps; },
  get quality() { return G.quality; },
  get prof() { return prof; },
  get drawCalls() { return renderer.info.render.calls; },
  get triangles() { return renderer.info.render.triangles; },
  start: startGame,
  setAutopilot(on) { G.autopilot = !!on; },
  setDist(d) {
    G.player.dist = d;
    G.region = regionIndex(d); G.checkpoint = G.region * REGION_LEN;
    ents.reset(d);
    world.rebuildAll(d);
  },
  setFuel(f) { G.player.fuel = f; },
  clearRoad() { ents.debugClear(); },
  spawn(type, ahead, lat) { return ents.debugSpawn(type, G.player.dist + ahead, lat); },
  chunkInfo() { return { CHUNK_LEN, N_CHUNKS, ks: world.chunks.map((c) => c.k) }; },
};
