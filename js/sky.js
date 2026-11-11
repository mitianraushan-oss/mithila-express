// Sky dome, sun and moon, fog and the day-to-night cycle.
// Time of day is a function of journey progress p in [0, 1], not of the clock.

import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './util.js';

const C = (h) => new THREE.Color(h);
const DEG = Math.PI / 180;

// el/az place the sun disc. az is measured from "straight ahead" toward the right.
const KEYS = [
  { p: 0.00, el: 20, az: 115, sun: C(0xffe2b0), sunI: 3.4, top: C(0x4a94e6), hor: C(0xf3d2a2), hSky: C(0xbcd6ff), hGnd: C(0xa0744e), hI: 1.25, fn: 90, ff: 460, stars: 0, sunset: 0.25, cloud: C(0xfff4e6), exp: 1.0 },
  { p: 0.14, el: 42, az: 100, sun: C(0xfff1d6), sunI: 3.4, top: C(0x3f8fe0), hor: C(0xcfe3f2), hSky: C(0xc4dcff), hGnd: C(0xa98058), hI: 1.25, fn: 110, ff: 480, stars: 0, sunset: 0, cloud: C(0xffffff), exp: 1.0 },
  { p: 0.30, el: 66, az: 60, sun: C(0xfffaf0), sunI: 3.6, top: C(0x2f7fdc), hor: C(0xe3dcc6), hSky: C(0xcfe2ff), hGnd: C(0xb79a70), hI: 1.3, fn: 100, ff: 470, stars: 0, sunset: 0, cloud: C(0xffffff), exp: 1.0 },
  { p: 0.42, el: 30, az: 5, sun: C(0xffe0a8), sunI: 3.2, top: C(0x4a83d0), hor: C(0xf2d6a0), hSky: C(0xc8d4f0), hGnd: C(0x8f8a58), hI: 1.15, fn: 100, ff: 470, stars: 0, sunset: 0.3, cloud: C(0xfff0d8), exp: 1.0 },
  { p: 0.50, el: 11, az: -22, sun: C(0xffab5e), sunI: 3.0, top: C(0x5560b0), hor: C(0xff9d52), hSky: C(0xc9a0c0), hGnd: C(0x7a5a48), hI: 0.9, fn: 80, ff: 440, stars: 0, sunset: 0.85, cloud: C(0xffb078), exp: 1.0 },
  { p: 0.565, el: 1.5, az: -27, sun: C(0xff5a2a), sunI: 1.4, top: C(0x3a2c6e), hor: C(0xff5f3c), hSky: C(0x8a6aa8), hGnd: C(0x5a4048), hI: 0.85, fn: 70, ff: 400, stars: 0.05, sunset: 1, cloud: C(0xd0527a), exp: 1.05 },
  { p: 0.62, el: -7, az: -30, sun: C(0x8090c0), sunI: 0.2, top: C(0x161a48), hor: C(0x6a3a62), hSky: C(0x46508c), hGnd: C(0x2a2a38), hI: 0.8, fn: 60, ff: 360, stars: 0.4, sunset: 0.5, cloud: C(0x4a3560), exp: 1.1 },
  { p: 0.70, el: -20, az: -30, sun: C(0x9db4ff), sunI: 0.75, top: C(0x060a1e), hor: C(0x142244), hSky: C(0x34447e), hGnd: C(0x161b26), hI: 0.85, fn: 50, ff: 330, stars: 1, sunset: 0, cloud: C(0x1a2444), exp: 1.15 },
  { p: 1.00, el: -30, az: -30, sun: C(0xa8bcff), sunI: 0.8, top: C(0x050816), hor: C(0x16254a), hSky: C(0x34447e), hGnd: C(0x161b26), hI: 0.85, fn: 50, ff: 320, stars: 1, sunset: 0, cloud: C(0x1a2444), exp: 1.15 },
];

const MOON_SWITCH = 0.6;

function dirFrom(el, az, out) {
  const e = el * DEG, a = az * DEG;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uTop, uHorizon, uSunDir, uSunColor, uMoonDir, uCloud;
uniform float uStars, uSunset, uTime, uRidge, uSunVis;
varying vec3 vDir;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));

  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.2 + pow(sd, 48.0) * 0.35) * uSunVis;
  col = mix(col, uSunColor, uSunset * 0.4 * pow(sd, 2.0) * exp(-abs(h) * 7.0) * uSunVis);

  // stars
  if (uStars > 0.01 && h > 0.0) {
    vec2 sp = d.xz / (h + 0.25) * 46.0;
    vec2 id = floor(sp), f = fract(sp) - 0.5;
    float r = hash(id);
    vec2 o = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
    float star = step(0.9, r) * smoothstep(0.04 + (r - 0.9) * 1.1, 0.0, length(f - o));
    float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r * 5.0) + r * 60.0);
    col += vec3(0.9, 0.95, 1.0) * star * tw * uStars * smoothstep(0.0, 0.2, h) * 1.4;
  }

  // crescent moon
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99905, 0.99935, md);
  float cut = smoothstep(0.9990, 0.9994, dot(d, normalize(uMoonDir + vec3(0.016, 0.009, 0.0))));
  col += vec3(0.95, 0.97, 1.0) * 1.5 * moon * (1.0 - cut * 0.93) * uStars;
  col += vec3(0.45, 0.55, 1.0) * pow(max(md, 0.0), 260.0) * 0.22 * uStars;

  // stylized sun: grows and gains horizontal slats as it sets
  float size = mix(0.04, 0.095, uSunset);
  float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
  float disc = smoothstep(size, size * 0.94, ang);
  float rel = (uSunDir.y - d.y) / size;
  float slats = rel > 0.0 ? step(rel * 0.5, fract(rel * 5.0 + 0.5)) : 1.0;
  slats = mix(1.0, slats, smoothstep(0.45, 0.85, uSunset));
  col = mix(col, uSunColor * mix(2.6, 1.7, uSunset), disc * slats * uSunVis);

  // clouds
  if (h > 0.01) {
    vec2 cp = d.xz / (h + 0.18) * 1.3 + vec2(uTime * 0.006, 0.0);
    float m = smoothstep(0.56, 0.82, fbm(cp * 1.6)) * smoothstep(0.01, 0.2, h);
    vec3 cc = uCloud + uSunColor * pow(sd, 3.0) * 0.45 * uSunVis;
    col = mix(col, cc, m * 0.85);
  }

  // two layers of far hills, taller in hill country
  float az = atan(d.z, d.x);
  float r1 = uRidge * (0.035 + 0.022 * sin(az * 5.0 + 1.0) + 0.014 * sin(az * 13.0 + 2.0) + 0.007 * sin(az * 31.0));
  float r2 = uRidge * (0.02 + 0.012 * sin(az * 9.0 + 4.0) + 0.008 * sin(az * 23.0 + 1.0));
  col = mix(col, mix(uHorizon, uTop * 0.35, 0.3), smoothstep(r1 + 0.003, r1, h));
  col = mix(col, mix(uHorizon, uTop * 0.3, 0.14), smoothstep(r2 + 0.003, r2, h));
  col = mix(col, uHorizon, smoothstep(0.01, -0.012, h));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene) {
    this.uniforms = {
      uTop: { value: C(0) }, uHorizon: { value: C(0) }, uSunColor: { value: C(0) }, uCloud: { value: C(0) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 0 }, uSunset: { value: 0 }, uTime: { value: 0 }, uRidge: { value: 0.5 }, uSunVis: { value: 1 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1200, 40, 20),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
        side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      }),
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(2048, 2048);
    this.extent = 62;
    sh.camera.left = -this.extent; sh.camera.right = this.extent;
    sh.camera.top = this.extent; sh.camera.bottom = -this.extent;
    sh.camera.near = 1; sh.camera.far = 420;
    sh.bias = -0.0006; sh.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);

    scene.fog = new THREE.Fog(0xffffff, 90, 460);
    this.fog = scene.fog;
    this.fogU = { color: { value: this.fog.color }, near: { value: 90 }, far: { value: 460 } };

    this.night = 0;       // 0 day, 1 night: drives lamps and headlights
    this.day = 1;         // overall daylight, for water and unlit materials
    this.exposure = 1;
    this.lightDir = new THREE.Vector3();
    this._m = new THREE.Matrix4(); this._mi = new THREE.Matrix4();
    this._v = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0); this._z = new THREE.Vector3();
  }

  setShadowSize(n) {
    const sh = this.sun.shadow;
    if (sh.mapSize.x === n) return;
    sh.mapSize.set(n, n);
    if (sh.map) { sh.map.dispose(); sh.map = null; }
  }

  update(p, focus, camPos, time, ridge) {
    p = clamp(p, 0, 1);
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((p - a.p) / (b.p - a.p), 0, 1);
    const u = this.uniforms;

    u.uTop.value.lerpColors(a.top, b.top, t);
    u.uHorizon.value.lerpColors(a.hor, b.hor, t);
    u.uSunColor.value.lerpColors(a.sun, b.sun, t);
    u.uCloud.value.lerpColors(a.cloud, b.cloud, t);
    u.uStars.value = lerp(a.stars, b.stars, t);
    u.uSunset.value = lerp(a.sunset, b.sunset, t);
    u.uTime.value = time;
    u.uRidge.value = ridge;

    const el = lerp(a.el, b.el, t), az = lerp(a.az, b.az, t);
    dirFrom(el, az, u.uSunDir.value);
    u.uSunVis.value = smoothstep(-9, -3, el);
    dirFrom(lerp(44, 58, smoothstep(MOON_SWITCH, 1, p)), lerp(34, 22, smoothstep(MOON_SWITCH, 1, p)), u.uMoonDir.value);

    this.night = smoothstep(0.5, 0.66, p);
    this.exposure = lerp(a.exp, b.exp, t);

    // light: the sun until it is nearly gone, then the moon
    if (p < MOON_SWITCH) dirFrom(Math.max(el, 7), az, this.lightDir);
    else this.lightDir.copy(u.uMoonDir.value);
    this.sun.color.copy(u.uSunColor.value);
    this.sun.intensity = lerp(a.sunI, b.sunI, t);

    this.hemi.color.lerpColors(a.hSky, b.hSky, t);
    this.hemi.groundColor.lerpColors(a.hGnd, b.hGnd, t);
    this.hemi.intensity = lerp(a.hI, b.hI, t);
    this.day = clamp((this.sun.intensity * (p < MOON_SWITCH ? 1 : 0.25) + this.hemi.intensity) / 3.5, 0.12, 1);

    this.fog.color.copy(u.uHorizon.value);
    this.fog.near = this.fogU.near.value = lerp(a.fn, b.fn, t);
    this.fog.far = this.fogU.far.value = lerp(a.ff, b.ff, t);

    // Shadow camera follows the action and snaps to whole texels so edges do not crawl.
    const sh = this.sun.shadow;
    const texel = (this.extent * 2) / sh.mapSize.x;
    this._m.lookAt(this.lightDir, this._z, this._up);
    this._mi.copy(this._m).invert();
    this._v.copy(focus).applyMatrix4(this._mi);
    this._v.x = Math.round(this._v.x / texel) * texel;
    this._v.y = Math.round(this._v.y / texel) * texel;
    this._v.applyMatrix4(this._m);
    this.sun.target.position.copy(this._v);
    this.sun.position.copy(this._v).addScaledVector(this.lightDir, 200);

    this.dome.position.copy(camPos);
  }
}
