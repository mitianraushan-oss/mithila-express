// Things on the road: chai cups to collect, and cows, potholes and trucks to avoid.
// Everything lives in road coordinates (dist, lat) and is drawn with instancing.

import * as THREE from 'three';
import { TOTAL, CHUNK_LEN, N_CHUNKS, REGIONS, PLAYER } from './config.js';
import { mulberry32, lerp, clamp } from './util.js';
import { regionIndex, riverF, roadX, roadY, roadHeading } from './road.js';
import { Pool } from './world.js';
import * as TX from './textures.js';

const LANES = [-3.9, -1.3, 1.3, 3.9];
const MAX_TRUCKS = 6;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const COW_TINTS = [0xffffff, 0xe8d5b5, 0xb98a62, 0x8a6a55, 0xd9d9d9];
const TRUCK_TINTS = [0xffffff, 0xffd0d0, 0xd0ffd8, 0xfff0c0];

export class Entities {
  constructor(scene, world, geos) {
    this.world = world;
    const mat = world.propMat;
    this.cows = new Pool(scene, geos.cow, mat, 3, { cast: true, receive: true });
    this.potholes = new Pool(scene, geos.pothole,
      new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 4, { receive: true });
    this.chais = new Pool(scene, geos.chai, mat, 9, { cast: true });
    this.haloMat = new THREE.MeshBasicMaterial({
      map: TX.radialTexture(), color: 0xffc860, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.halos = new Pool(scene, new THREE.PlaneGeometry(2.6, 2.6), this.haloMat, 9);
    this.halos.mesh.renderOrder = 3;

    this.truckMesh = new THREE.InstancedMesh(geos.truck, mat, MAX_TRUCKS);
    this.truckMesh.castShadow = true; this.truckMesh.receiveShadow = true; this.truckMesh.frustumCulled = false;
    this.signMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshLambertMaterial({ map: TX.truckSignTexture() }), MAX_TRUCKS);
    this.signMesh.frustumCulled = false;
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.glowMesh = new THREE.InstancedMesh(geos.truckGlow, this.glowMat, MAX_TRUCKS);
    this.glowMesh.frustumCulled = false;
    for (let i = 0; i < MAX_TRUCKS; i++) {
      this.truckMesh.setMatrixAt(i, ZERO); this.truckMesh.setColorAt(i, _c.set(0xffffff));
      this.signMesh.setMatrixAt(i, ZERO); this.glowMesh.setMatrixAt(i, ZERO);
    }
    scene.add(this.truckMesh, this.signMesh, this.glowMesh);

    this.trucks = [];
    for (let i = 0; i < MAX_TRUCKS; i++) this.trucks.push({ active: false, d: 0, lat: 0, v: 0, dir: 1 });
    this.truckRng = mulberry32(99);
    this.nextTruck = 260;
    this.billboard = new THREE.Quaternion();
    this.sandbox = false;

    world.onBuild = (ch, k, slot) => this.populate(ch, k, slot);
  }

  reset(dist) {
    for (const t of this.trucks) t.active = false;
    this.nextTruck = this.sandbox ? Infinity : dist + 200;
  }

  // Fill a freshly built chunk. Seeded by chunk index, so a retry sees the same road.
  populate(ch, k, slot) {
    const rng = mulberry32((k + 500) * 2654435761);
    ch.ents.length = 0;
    const base = { cow: slot * 3, pot: slot * 4, chai: slot * 9 };
    let nc = 0, np = 0, nch = 0;

    for (let row = 0; row < 3 && !this.sandbox; row++) {
      const d0 = k * CHUNK_LEN + row * 20 + 10 + (rng() - 0.5) * 6;
      const order = LANES.slice().sort(() => rng() - 0.5);
      const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng(), r6 = rng();
      if (d0 < 150 || d0 > TOTAL - 90) continue;
      const hz = REGIONS[regionIndex(d0)].hz;
      const diff = 0.75 + 0.5 * (d0 / TOTAL);
      const bridge = riverF(d0) > 0.3;
      let li = 0;

      if (r1 < 0.5) {
        const lat = order[li++];
        const n = r2 < 0.3 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          ch.ents.push({ t: 'chai', d: d0 + (i - (n - 1) / 2) * 6, lat, hw: 1.0, hl: 1.0, alive: true, ph: r3 * 6 + i, idx: base.chai + nch++ });
        }
      }
      let leftUsed = false;
      const hazardLane = () => {
        let lat = order[li++];
        if (lat < 0 && leftUsed) lat = -lat;        // never block both left lanes at once
        if (lat < 0) leftUsed = true;
        return lat;
      };
      if (r4 < hz.pot * diff) {
        const s = 0.8 + r5 * 0.5;
        const e = { t: 'pot', d: d0 + (r6 - 0.5) * 8, lat: hazardLane() + (r5 - 0.5) * 0.8, hw: 0.75 * s, hl: 0.75 * s, hit: false, idx: base.pot + np++ };
        ch.ents.push(e);
        _e.set(0, r6 * 6.28, 0); _q.setFromEuler(_e);
        _m.compose(_p.set(roadX(e.d) + e.lat, roadY(e.d) + 0.02, -e.d), _q, _s.set(s, 1, s));
        this.potholes.mesh.setMatrixAt(e.idx, _m);
      }
      if (!bridge && r6 < hz.cow * diff) {
        const walker = r5 < 0.5;
        ch.ents.push({
          t: 'cow', d: d0 + (r3 - 0.5) * 6, lat0: 0, lat: 0, hw: 0.95, hl: 1.15, hit: false,
          amp: walker ? 0.9 + r2 * 1.5 : 0, w: 0.3 + r1 * 0.4, ph: r4 * 6.28, rot: r2 * 6.28, idx: base.cow + nc++,
        });
        const cow = ch.ents[ch.ents.length - 1];
        cow.lat0 = cow.lat = hazardLane();
        this.cows.mesh.setColorAt(base.cow + nc - 1, _c.set(COW_TINTS[Math.floor(r1 * 4.99)]));
      }
    }
    // clear the unused instances of this chunk
    for (let i = np; i < 4; i++) this.potholes.mesh.setMatrixAt(base.pot + i, ZERO);
    for (let i = nc; i < 3; i++) this.cows.mesh.setMatrixAt(base.cow + i, ZERO);
    for (let i = nch; i < 9; i++) { this.chais.mesh.setMatrixAt(base.chai + i, ZERO); this.halos.mesh.setMatrixAt(base.chai + i, ZERO); }
    this.potholes.mesh.instanceMatrix.needsUpdate = true;
    this.cows.mesh.instanceColor.needsUpdate = true;
  }

  // ---- test helpers: an empty road, and hand-placed things on it
  debugClear() {
    this.sandbox = true;
    for (const ch of this.world.chunks) {
      for (const e of ch.ents) {
        const mesh = e.t === 'chai' ? this.chais.mesh : e.t === 'cow' ? this.cows.mesh : this.potholes.mesh;
        mesh.setMatrixAt(e.idx, ZERO);
        if (e.t === 'chai') this.halos.mesh.setMatrixAt(e.idx, ZERO);
      }
      ch.ents.length = 0;
    }
    this.potholes.mesh.instanceMatrix.needsUpdate = true;
    for (const t of this.trucks) t.active = false;
    this.nextTruck = Infinity;
  }

  debugSpawn(type, d, lat) {
    if (type === 'truck') {
      const t = this.trucks.find((x) => !x.active);
      if (!t) return false;
      t.active = true; t.d = d; t.lat = lat; t.v = 0; t.dir = 1;
      return true;
    }
    const k = Math.floor(d / CHUNK_LEN), slot = ((k % N_CHUNKS) + N_CHUNKS) % N_CHUNKS, ch = this.world.chunks[slot];
    const per = { chai: 9, cow: 3, pot: 4 }[type];
    const n = ch.ents.filter((e) => e.t === type).length;
    if (ch.k !== k || !per || n >= per) return false;
    const idx = slot * per + n;
    if (type === 'chai') ch.ents.push({ t: 'chai', d, lat, hw: 1.0, hl: 1.0, alive: true, ph: 0, idx });
    else if (type === 'cow') ch.ents.push({ t: 'cow', d, lat0: lat, lat, hw: 0.95, hl: 1.15, hit: false, amp: 0, w: 0, ph: 0, rot: 0, idx });
    else {
      ch.ents.push({ t: 'pot', d, lat, hw: 0.75, hl: 0.75, hit: false, idx });
      _m.compose(_p.set(roadX(d) + lat, roadY(d) + 0.02, -d), _q.identity(), _s.set(1, 1, 1));
      this.potholes.mesh.setMatrixAt(idx, _m);
      this.potholes.mesh.instanceMatrix.needsUpdate = true;
    }
    return true;
  }

  spawnTruck(playerDist, forceDir) {
    const t = this.trucks.find((x) => !x.active);
    if (!t) return null;
    const r = this.truckRng;
    t.dir = forceDir ?? (r() < 0.65 ? -1 : 1);
    t.d = playerDist + (t.dir < 0 ? 430 : 330);
    if (t.d > TOTAL - 160) return null;
    t.lat = t.dir < 0 ? 2.7 + (r() - 0.5) * 0.6 : -2.7 + (r() - 0.5) * 0.6;
    t.v = t.dir < 0 ? -(14 + r() * 5) : 11 + r() * 4;
    t.active = true;
    this.truckMesh.setColorAt(this.trucks.indexOf(t), _c.set(TRUCK_TINTS[Math.floor(r() * 3.99)]));
    this.truckMesh.instanceColor.needsUpdate = true;
    return t;
  }

  // Fixed-step simulation.
  simulate(h, time, player) {
    // trucks
    if (player.dist >= this.nextTruck) {
      const hz = REGIONS[regionIndex(player.dist)].hz;
      this.spawnTruck(player.dist);
      this.nextTruck = player.dist + lerp(170, 95, player.dist / TOTAL) * (0.7 + this.truckRng() * 0.8) / hz.truck;
    }
    for (const t of this.trucks) {
      if (!t.active) continue;
      t.d += t.v * h;
      if (t.d < player.dist - 45 || t.d > TOTAL - 70 || t.d > player.dist + 520) t.active = false;
    }
    // walking cows
    for (const ch of this.world.chunks) for (const e of ch.ents) {
      if (e.t === 'cow') e.lat = clamp(e.lat0 + e.amp * Math.sin(time * e.w + e.ph), -4.6, 4.6);
    }
  }

  // Sweep the player from prevDist to its current position. Returns what it touched.
  collide(player, prevDist, out) {
    out.length = 0;
    const lo = prevDist - PLAYER.halfL, hi = player.dist + PLAYER.halfL;
    const pk = Math.floor(player.dist / CHUNK_LEN);
    for (const ch of this.world.chunks) {
      if (ch.k === null || Math.abs(ch.k - pk) > 1) continue;
      for (const e of ch.ents) {
        if (e.d + e.hl < lo || e.d - e.hl > hi) continue;
        if (Math.abs(e.lat - player.lat) > e.hw + PLAYER.halfW) continue;
        if (e.t === 'chai') { if (e.alive) { e.alive = false; out.push(e); } }
        else if (!e.hit && player.inv <= 0) { e.hit = true; out.push(e); }
      }
    }
    if (player.inv <= 0) {
      for (const t of this.trucks) {
        if (!t.active) continue;
        if (t.d + 3.5 < lo || t.d - 3.5 > hi) continue;
        if (Math.abs(t.lat - player.lat) > 1.25 + PLAYER.halfW) continue;
        out.push({ t: 'truck', truck: t, d: t.d, lat: t.lat });
      }
    }
    return out;
  }

  // Everything dangerous between `from` and `from + range`, for the autopilot.
  hazards(from, range, out) {
    out.length = 0;
    for (const ch of this.world.chunks) for (const e of ch.ents) {
      if (e.d < from - 2 || e.d > from + range) continue;
      if (e.t === 'chai' ? e.alive : !e.hit) out.push(e);
    }
    for (const t of this.trucks) if (t.active && t.d > from - 6 && t.d < from + range + 200) out.push({ t: 'truck', d: t.d, lat: t.lat, hw: 1.25, hl: 3.5, v: t.v });
    return out;
  }

  // Per-frame: write instance matrices for everything that moves.
  present(time, night, camera) {
    this.billboard.copy(camera.quaternion);
    const pulse = 1 + 0.12 * Math.sin(time * 5);
    for (const ch of this.world.chunks) for (const e of ch.ents) {
      if (e.t === 'chai') {
        if (!e.alive) { this.chais.mesh.setMatrixAt(e.idx, ZERO); this.halos.mesh.setMatrixAt(e.idx, ZERO); continue; }
        const y = roadY(e.d) + 1.15 + Math.sin(time * 2.2 + e.ph) * 0.16;
        _p.set(roadX(e.d) + e.lat, y, -e.d);
        _e.set(0.25, time * 2 + e.ph, 0); _q.setFromEuler(_e);
        _m.compose(_p, _q, _s.set(1.25, 1.25, 1.25));
        this.chais.mesh.setMatrixAt(e.idx, _m);
        _m.compose(_p, this.billboard, _s.set(pulse, pulse, pulse));
        this.halos.mesh.setMatrixAt(e.idx, _m);
      } else if (e.t === 'cow') {
        const moving = e.amp > 0, dirX = Math.cos(time * e.w + e.ph);
        const rot = moving ? (dirX > 0 ? -Math.PI / 2 : Math.PI / 2) : e.rot;
        const bob = moving ? Math.abs(Math.sin(time * 5 + e.ph)) * 0.05 : 0;
        _e.set(0, rot - roadHeading(e.d), 0); _q.setFromEuler(_e);
        _m.compose(_p.set(roadX(e.d) + e.lat, roadY(e.d) + bob, -e.d), _q, _s.set(1.15, 1.15, 1.15));
        this.cows.mesh.setMatrixAt(e.idx, _m);
      }
    }
    this.chais.mesh.instanceMatrix.needsUpdate = true;
    this.halos.mesh.instanceMatrix.needsUpdate = true;
    this.cows.mesh.instanceMatrix.needsUpdate = true;
    this.haloMat.opacity = lerp(0.38, 0.75, night);

    for (let i = 0; i < MAX_TRUCKS; i++) {
      const t = this.trucks[i];
      if (!t.active) {
        this.truckMesh.setMatrixAt(i, ZERO); this.signMesh.setMatrixAt(i, ZERO); this.glowMesh.setMatrixAt(i, ZERO);
        continue;
      }
      const rot = t.dir < 0 ? Math.PI - roadHeading(t.d) : -roadHeading(t.d);
      _e.set(0, rot, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(roadX(t.d) + t.lat, roadY(t.d) + Math.sin(time * 9 + i) * 0.015, -t.d), _q, _s.set(1, 1, 1));
      this.truckMesh.setMatrixAt(i, _m);
      this.glowMesh.setMatrixAt(i, _m);
      _m2.makeTranslation(0, 2.0, 3.37);
      this.signMesh.setMatrixAt(i, _m.multiply(_m2));
    }
    this.truckMesh.instanceMatrix.needsUpdate = true;
    this.signMesh.instanceMatrix.needsUpdate = true;
    this.glowMesh.instanceMatrix.needsUpdate = true;
    this.glowMat.color.setScalar(lerp(0.9, 3.0, night));
  }
}
