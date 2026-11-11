// The land: pooled terrain chunks, the road ribbon, instanced scenery, the Ganga and
// the village gate. Ten chunks are recycled as the player advances; nothing is
// allocated after start-up.

import * as THREE from 'three';
import { TOTAL, REGION_LEN, CHUNK_LEN, N_CHUNKS, ROAD_HALF, RIVER, REGIONS } from './config.js';
import { lerp, smoothstep, mulberry32, noise2 } from './util.js';
import { regionIndex, regionBlend, regionParam, riverF, roadX, roadY, roadHeading, terrainY } from './road.js';
import * as TX from './textures.js';

const NX = 44, NZ = 12;
const OFFS = new Float32Array(NX + 1);
for (let i = 0; i <= NX; i++) {
  const u = (i / NX) * 2 - 1;
  OFFS[i] = u * 22 + Math.sign(u) * Math.pow(Math.abs(u), 2.4) * 150;   // dense by the road, sparse far out
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const WHITE = new THREE.Color(1, 1, 1);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();
const mod = (a, n) => ((a % n) + n) % n;

// One InstancedMesh shared by all chunks. Each chunk owns a fixed range of instances.
export class Pool {
  constructor(scene, geo, mat, per, { cast = false, receive = false } = {}) {
    this.per = per;
    this.mesh = new THREE.InstancedMesh(geo, mat, per * N_CHUNKS);
    this.mesh.castShadow = cast;
    this.mesh.receiveShadow = receive;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < per * N_CHUNKS; i++) { this.mesh.setMatrixAt(i, ZERO); this.mesh.setColorAt(i, WHITE); }
    this.i = 0; this.end = 0;
    scene.add(this.mesh);
  }
  begin(slot) { this.i = slot * this.per; this.end = this.i + this.per; }
  add(m, color) {
    if (this.i >= this.end) return -1;
    this.mesh.setMatrixAt(this.i, m);
    this.mesh.setColorAt(this.i, color || WHITE);
    return this.i++;
  }
  finish() {
    while (this.i < this.end) this.mesh.setMatrixAt(this.i++, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

const FIELD_GLSL = /* glsl */`
varying float vField;
varying vec3 vWPos;
float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 fieldColor(vec3 base) {
  if (vField < 0.01) return base;
  vec2 g = vec2(vWPos.x / 17.0, vWPos.z / 23.0);
  vec2 id = floor(g), f = fract(g);
  float h = fHash(id);
  vec3 c = h < 0.34 ? vec3(0.70, 0.50, 0.03)        // mustard in flower
         : h < 0.62 ? vec3(0.11, 0.42, 0.06)        // paddy
         : h < 0.82 ? vec3(0.25, 0.14, 0.06)        // tilled earth
         : vec3(0.33, 0.55, 0.11);                  // young wheat
  c *= 0.9 + 0.1 * sin((h > 0.5 ? vWPos.x : vWPos.z) * 2.6);
  float edge = smoothstep(0.0, 0.035, f.x) * smoothstep(1.0, 0.965, f.x) * smoothstep(0.0, 0.03, f.y) * smoothstep(1.0, 0.97, f.y);
  c = mix(vec3(0.16, 0.2, 0.07), c, edge);
  return mix(base, c, vField);
}`;

const WATER_VERT = /* glsl */`
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WATER_FRAG = /* glsl */`
uniform vec3 uTop, uHorizon, uSunDir, uSunColor, uFogColor;
uniform float uTime, uSunVis, uFogNear, uFogFar, uDay;
varying vec3 vW;
void main() {
  vec3 toCam = cameraPosition - vW;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 p = vW.xz * 0.09;
  float t = uTime;
  vec3 n = normalize(vec3(
    sin(p.x * 3.1 + t * 1.3) + sin(p.y * 4.7 - t * 1.1) + 0.5 * sin((p.x + p.y) * 7.3 + t * 1.7),
    11.0,
    cos(p.x * 2.7 - t) + cos(p.y * 5.3 + t * 1.4) + 0.5 * cos((p.x - p.y) * 6.1 - t * 1.9)));
  vec3 R = reflect(-V, n);
  float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0);
  vec3 sky = mix(uHorizon, uTop, pow(max(R.y, 0.0), 0.55));
  vec3 deep = vec3(0.03, 0.14, 0.17) * uDay;
  vec3 col = mix(deep, sky, 0.3 + 0.7 * fres);
  float s = max(dot(R, uSunDir), 0.0);
  col += uSunColor * (pow(s, 220.0) * 3.0 + pow(s, 24.0) * 0.4) * uSunVis;
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PER = {   // instances reserved per chunk for each prop type
  palm: 9, boulder: 10, bush: 8, acacia: 6, mesa: 4, tree: 11, temple: 1, hut: 6, haystack: 4,
  building: 6, lamp: 2, bulb: 2, pool: 2, milestone: 1, lanterns: 1, diya: 20, rail: 26, pier: 2, mural: 6,
};

export class World {
  constructor(scene, sky, geos) {
    this.scene = scene;
    this.sky = sky;
    this.onBuild = null;        // (chunk, k) => void, set by Entities
    this.night = 0;

    // ---- materials
    this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.groundMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aField;\nvarying float vField;\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvField = aField;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FIELD_GLSL)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = fieldColor(diffuseColor.rgb);');
    };
    this.roadMat = new THREE.MeshStandardMaterial({ map: TX.roadTexture(), vertexColors: true, roughness: 0.8, metalness: 0 });
    this.propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.festiveMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.poolMat = new THREE.MeshBasicMaterial({
      map: TX.radialTexture(), color: 0xffb96a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.muralMat = new THREE.MeshLambertMaterial({ map: TX.muralTexture() });

    // ---- prop pools
    const P = (name, geo, mat, o) => new Pool(scene, geo, mat, PER[name], o);
    const CR = { cast: true, receive: true };
    const poolGeo = new THREE.PlaneGeometry(17, 17).rotateX(-Math.PI / 2);
    const muralGeo = new THREE.PlaneGeometry(2.3, 1.55);
    this.pools = {
      palm: P('palm', geos.palm, this.propMat, CR), boulder: P('boulder', geos.boulder, this.propMat, CR),
      bush: P('bush', geos.bush, this.propMat, CR), acacia: P('acacia', geos.acacia, this.propMat, CR),
      mesa: P('mesa', geos.mesa, this.propMat, CR), tree: P('tree', geos.tree, this.propMat, CR),
      temple: P('temple', geos.temple, this.propMat, CR), hut: P('hut', geos.hut, this.propMat, CR),
      haystack: P('haystack', geos.haystack, this.propMat, CR), building: P('building', geos.building, this.propMat, CR),
      lamp: P('lamp', geos.lamp, this.propMat, { cast: true }), bulb: P('bulb', geos.bulb, this.glowMat),
      pool: P('pool', poolGeo, this.poolMat), milestone: P('milestone', geos.milestone, this.propMat, CR),
      lanterns: P('lanterns', geos.lanterns, this.festiveMat), diya: P('diya', geos.diya, this.festiveMat),
      rail: P('rail', geos.rail, this.propMat, CR), pier: P('pier', geos.pier, this.propMat, { receive: true }),
      mural: P('mural', muralGeo, this.muralMat),
    };
    this.pools.pool.mesh.renderOrder = 2;
    this.poolList = Object.values(this.pools);

    // ---- region colours in linear space
    this.cols = REGIONS.map((r) => ({
      a: new THREE.Color(r.groundA), b: new THREE.Color(r.groundB),
      sh: new THREE.Color(r.shoulder), road: new THREE.Color(r.road),
    }));
    this.sand = new THREE.Color(0xc9b98a);
    this.concrete = new THREE.Color(0xd8d4cc);

    // ---- chunks
    const nv = (NX + 1) * (NZ + 1);
    const gIndex = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      gIndex.push(a, b, c, b, d, c);
    }
    const rIndex = [];
    for (let j = 0; j < NZ; j++) { const a = j * 2; rIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }

    this.chunks = [];
    for (let s = 0; s < N_CHUNKS; s++) {
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
      gg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
      gg.setAttribute('aField', new THREE.BufferAttribute(new Float32Array(nv), 1));
      const up = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) up[i * 3 + 1] = 1;
      gg.setAttribute('normal', new THREE.BufferAttribute(up, 3));
      gg.setIndex(gIndex);
      const ground = new THREE.Mesh(gg, this.groundMat);
      ground.receiveShadow = true;

      const rv = (NZ + 1) * 2;
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
      rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
      rg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rv * 2), 2));
      const rup = new Float32Array(rv * 3); for (let i = 0; i < rv; i++) rup[i * 3 + 1] = 1;
      rg.setAttribute('normal', new THREE.BufferAttribute(rup, 3));
      rg.setIndex(rIndex);
      const road = new THREE.Mesh(rg, this.roadMat);
      road.receiveShadow = true;

      scene.add(ground, road);
      this.chunks.push({ k: null, ground, road, lamps: [], ents: [] });
    }

    // ---- the Ganga
    this.waterU = {
      uTop: sky.uniforms.uTop, uHorizon: sky.uniforms.uHorizon, uSunDir: sky.uniforms.uSunDir,
      uSunColor: sky.uniforms.uSunColor, uSunVis: sky.uniforms.uSunVis, uTime: sky.uniforms.uTime,
      uFogColor: sky.fogU.color, uFogNear: sky.fogU.near, uFogFar: sky.fogU.far, uDay: { value: 1 },
    };
    const mid = (RIVER.start + RIVER.end) / 2;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, RIVER.end - RIVER.start + 70).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: this.waterU, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG }),
    );
    this.water.position.set(roadX(mid), -3.2, -mid);
    scene.add(this.water);

    // ---- pooled lamp lights: three real lights hop between the nearest street lamps
    this.lampLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffc27a, 0, 46, 1.5);
      scene.add(l);
      this.lampLights.push(l);
    }
    this._near = [];

    this.buildGate();
    this.buildStartSign();
  }

  buildGate() {
    const g = new THREE.Group();
    const pillarMat = new THREE.MeshLambertMaterial({ map: TX.pillarTexture() });
    const signMat = new THREE.MeshBasicMaterial({ map: TX.gateTexture() });
    this.signMat = signMat;
    const stone = new THREE.MeshLambertMaterial({ color: 0xb04a2e });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 7.4, 1.5), pillarMat);
      p.position.set(s * 7.6, 3.7, 0);
      p.castShadow = true; p.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.5, 4), stone);
      cap.position.set(s * 7.6, 10.55, 0); cap.rotation.y = Math.PI / 4; cap.castShadow = true;
      g.add(p, cap);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(17, 2.4, 1.1), stone);
    beam.position.set(0, 8.6, 0); beam.castShadow = true;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(15.4, 2.4), signMat);
    sign.position.set(0, 8.6, 0.57);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.0, 4), stone);
    top.position.set(0, 10.8, 0); top.rotation.y = Math.PI / 4;
    g.add(beam, sign, top);
    this.gateLight = new THREE.PointLight(0xffb060, 0, 60, 1.4);
    this.gateLight.position.set(0, 6.2, 5);
    g.add(this.gateLight);
    g.position.set(roadX(TOTAL), roadY(TOTAL), -TOTAL);
    this.scene.add(g);
    this.gate = g;
  }

  buildStartSign() {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshLambertMaterial({ map: TX.startSignTexture() }));
    board.position.y = 5.2; board.castShadow = true;
    const pm = new THREE.MeshLambertMaterial({ color: 0x70747a });
    for (const x of [-3, 3]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 6), pm);
      p.position.set(x, 2.6, -0.06); p.castShadow = true;
      g.add(p);
    }
    g.add(board);
    g.position.set(roadX(90) - 10.5, roadY(90), -90);
    this.scene.add(g);
  }

  // Make sure the ten chunks around the player are the right ones.
  update(dist) {
    const pk = Math.floor(dist / CHUNK_LEN);
    for (let k = pk - 1; k <= pk + N_CHUNKS - 2; k++) {
      const slot = mod(k, N_CHUNKS);
      if (this.chunks[slot].k !== k) this.build(slot, k);
    }
  }

  rebuildAll(dist) {
    for (const c of this.chunks) c.k = null;
    this.update(dist);
  }

  build(slot, k) {
    const ch = this.chunks[slot];
    ch.k = k;
    const d0 = k * CHUNK_LEN;

    // ---- ground
    const gp = ch.ground.geometry.attributes.position.array;
    const gc = ch.ground.geometry.attributes.color.array;
    const gf = ch.ground.geometry.attributes.aField.array;
    const rp = ch.road.geometry.attributes.position.array;
    const rc = ch.road.geometry.attributes.color.array;
    const ruv = ch.road.geometry.attributes.uv.array;
    let v = 0;
    for (let j = 0; j <= NZ; j++) {
      const d = d0 + (j / NZ) * CHUNK_LEN;
      const bl = regionBlend(d), A = this.cols[bl.a], B = this.cols[bl.b], t = bl.t;
      const rf = riverF(d), rx = roadX(d), ry = roadY(d);
      const field = lerp(REGIONS[bl.a].field, REGIONS[bl.b].field, t);
      for (let i = 0; i <= NX; i++, v++) {
        const off = OFFS[i], ao = Math.abs(off), wx = rx + off;
        gp[v * 3] = wx; gp[v * 3 + 1] = terrainY(off, d); gp[v * 3 + 2] = -d;
        const n = noise2(wx * 0.045, d * 0.045), n2 = noise2(wx * 0.31, d * 0.31);
        _c.lerpColors(A.a, A.b, n);
        if (t > 0) { _c2.lerpColors(B.a, B.b, n); _c.lerp(_c2, t); }
        _c2.lerpColors(A.sh, B.sh, t);
        _c.lerp(_c2, (1 - smoothstep(6, 12, ao)) * 0.85);
        if (rf > 0) _c.lerp(this.sand, smoothstep(0.05, 0.5, rf));
        const br = 0.9 + 0.2 * n2;
        gc[v * 3] = _c.r * br; gc[v * 3 + 1] = _c.g * br; gc[v * 3 + 2] = _c.b * br;
        gf[v] = field * smoothstep(10, 16, ao) * (1 - smoothstep(110, 150, ao)) * (1 - Math.min(1, rf * 3));
      }
      // road ribbon row
      _c.lerpColors(A.road, B.road, t);
      if (rf > 0) _c.lerp(this.concrete, rf);
      for (let s = 0; s < 2; s++) {
        const o = (j * 2 + s);
        rp[o * 3] = rx + (s ? ROAD_HALF : -ROAD_HALF); rp[o * 3 + 1] = ry + 0.02; rp[o * 3 + 2] = -d;
        rc[o * 3] = _c.r; rc[o * 3 + 1] = _c.g; rc[o * 3 + 2] = _c.b;
        ruv[o * 2] = s; ruv[o * 2 + 1] = d / 16;
      }
    }
    for (const g of [ch.ground.geometry, ch.road.geometry]) {
      for (const key in g.attributes) g.attributes[key].needsUpdate = true;
      g.computeBoundingSphere();
    }

    this.buildProps(slot, k, ch);
    if (this.onBuild) this.onBuild(ch, k, slot);
  }

  place(pool, x, y, z, rotY, sx, sy, sz, tint) {
    _e.set(0, rotY, 0); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    return pool.add(_m, tint);
  }

  buildProps(slot, k, ch) {
    const rng = mulberry32((k + 1000) * 7919);
    const P = this.pools;
    for (const p of this.poolList) p.begin(slot);
    ch.lamps.length = 0;
    const d0 = k * CHUNK_LEN, dm = d0 + CHUNK_LEN / 2;
    const ri = regionIndex(dm);
    const specs = REGIONS[ri].props.slice();
    if (dm < 320) specs.push({ type: 'building', n: 5, min: 26, max: 120, s: [9, 17], bias: 1 });

    for (const sp of specs) {
      const n = Math.floor(sp.n) + (rng() < sp.n % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const d = d0 + rng() * CHUNK_LEN;
        const side = rng() < 0.5 ? -1 : 1;
        const off = side * lerp(sp.min, sp.max, Math.pow(rng(), sp.bias || 1.5));
        const s = lerp(sp.s[0], sp.s[1], rng());
        const rot = rng() * Math.PI * 2, shade = 0.82 + rng() * 0.3, r2 = rng();
        if (riverF(d) > 0.01) continue;
        const x = roadX(d) + off, y = terrainY(off, d) - 0.12, z = -d;
        if (sp.tint) _c.set(sp.tint).multiplyScalar(shade * 1.6); else _c.setScalar(shade);
        const face = -roadHeading(d) + (side < 0 ? Math.PI / 2 : -Math.PI / 2);
        switch (sp.type) {
          case 'mesa': this.place(P.mesa, x, y - 1, z, rot, s, s * lerp(0.45, 0.95, r2), s, _c); break;
          case 'building': this.place(P.building, x, y - 0.5, z, 0, s, lerp(14, 46, r2), s * lerp(0.7, 1.2, shade - 0.82), _c); break;
          case 'temple': this.place(P.temple, x, y, z, face, s, s, s, _c); break;
          case 'hut': {
            if (this.place(P.hut, x, y, z, face, s, s, s, _c) >= 0) {
              _m2.makeTranslation(0.75, 1.5, 1.53);
              _m.multiply(_m2);
              P.mural.add(_m, WHITE);
            }
            break;
          }
          default: this.place(P[sp.type], x, y, z, rot, s, s * lerp(0.85, 1.15, r2), s, _c);
        }
      }
    }

    // street lamps: on the bridge, and from Bihar onward
    for (const [dd, side] of [[15, -1], [45, 1]]) {
      const d = d0 + dd, bridge = riverF(d) > 0.6;
      if (!(bridge || (d > 3 * REGION_LEN + 40 && d < TOTAL + 240))) continue;
      const off = side * (bridge ? 6.25 : 7.4);
      const x = roadX(d) + off, y = bridge ? roadY(d) : terrainY(off, d) - 0.1, rotY = -roadHeading(d) + (side > 0 ? Math.PI : 0);
      this.place(P.lamp, x, y, -d, rotY, 1, 1, 1);
      P.bulb.add(_m, WHITE);
      const b = _p.set(1.5, 4.92, 0).applyMatrix4(_m);
      ch.lamps.push({ x: b.x, y: b.y - 0.3, z: b.z, d });
      this.place(P.pool, b.x, roadY(d) + 0.07, b.z, 0, 1, 1, 1);
    }

    // bridge railings and piers
    for (let dd = 0; dd < CHUNK_LEN; dd += 5) {
      const d = d0 + dd + 2.5;
      if (riverF(d) < 0.6) continue;
      const h = -roadHeading(d);
      for (const s of [-1, 1]) this.place(P.rail, roadX(d) + s * 6.05, roadY(d), -d, h, 1, 1, 1);
    }
    for (const dd of [15, 45]) {
      const d = d0 + dd;
      if (riverF(d) > 0.6) this.place(P.pier, roadX(d), roadY(d), -d, -roadHeading(d), 1, 1, 1);
    }

    // milestones
    if (d0 > 0 && d0 < TOTAL) this.place(P.milestone, roadX(d0 + 5) - 6.8, terrainY(-6.8, d0 + 5) - 0.02, -(d0 + 5), -roadHeading(d0 + 5), 1, 1, 1);

    // the village: lantern strings over the road and rows of diyas along it
    const village = 4 * REGION_LEN;
    if (d0 + 30 > village + 100 && Math.abs(d0 + 30 - TOTAL) > 25) {
      const d = d0 + 30;
      this.place(P.lanterns, roadX(d), roadY(d), -d, -roadHeading(d), 1, 1, 1);
    }
    if (d0 > village + 40) {
      for (let i = 0; i < 10; i++) {
        const d = d0 + 3 + i * 6;
        for (const s of [-1, 1]) this.place(P.diya, roadX(d) + s * 6.15, terrainY(s * 6.15, d) + 0.02, -d, i, 1.5, 1.5, 1.5);
      }
    }

    for (const p of this.poolList) p.finish();
  }

  // Per-frame: night-driven glow and the three roaming lamp lights.
  present(playerDist, night, day) {
    this.night = night;
    this.waterU.uDay.value = day;
    this.glowMat.color.setScalar(lerp(0.3, 2.4, night));
    this.festiveMat.color.setScalar(lerp(0.55, 1.9, night));
    this.poolMat.opacity = night * 0.5;
    this.signMat.color.setScalar(lerp(0.75, 1.5, night));
    this.gateLight.intensity = night * 260;

    const near = this._near;
    near.length = 0;
    for (const ch of this.chunks) for (const l of ch.lamps) if (l.d > playerDist - 16) near.push(l);
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.lampLights.length; i++) {
      const L = this.lampLights[i], l = near[i];
      if (l && night > 0.02) {
        L.position.set(l.x, l.y, l.z);
        L.intensity = night * 150 * (1 - smoothstep(110, 170, l.d - playerDist));
      } else L.intensity = 0;
    }
  }
}
