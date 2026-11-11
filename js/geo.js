// Geometry helpers: build every model from primitives and bake the parts into one
// vertex-coloured BufferGeometry, so each prop type costs a single draw call.

import * as THREE from 'three';

const _c = new THREE.Color();

// Compose a matrix from a readable list of operations, applied left to right.
export function M(...ops) {
  const m = new THREE.Matrix4(), t = new THREE.Matrix4();
  for (const o of ops) {
    switch (o[0]) {
      case 't': t.makeTranslation(o[1], o[2], o[3]); break;
      case 'rx': t.makeRotationX(o[1]); break;
      case 'ry': t.makeRotationY(o[1]); break;
      case 'rz': t.makeRotationZ(o[1]); break;
      case 's': t.makeScale(o[1], o[2] ?? o[1], o[3] ?? o[1]); break;
    }
    m.multiply(t);
  }
  return m;
}

export function part(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function merge(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o);
    nor.set(p.attributes.normal.array, o);
    col.set(p.attributes.color.array, o);
    o += p.attributes.position.count * 3;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const HP = Math.PI / 2;

// ---------------------------------------------------------------- scenery

function palm() {
  const ps = [
    part(cyl(0.15, 0.2, 3.2, 6), 0x7a5a3a, M(['t', 0.1, 1.6, 0], ['rz', -0.06])),
    part(cyl(0.12, 0.15, 3.2, 6), 0x866443, M(['t', 0.32, 4.7, 0], ['rz', -0.1])),
  ];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ps.push(part(cone(0.55, 3.3, 4), i % 2 ? 0x4c9a3a : 0x62b04a,
      M(['t', 0.48, 6.25, 0], ['ry', a], ['rz', -(HP + 0.38 + (i % 3) * 0.12)], ['t', 0, 1.6, 0], ['s', 1, 1, 0.22])));
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    ps.push(part(ico(0.2), 0x5a3d22, M(['t', 0.48 + Math.cos(a) * 0.25, 6.0, Math.sin(a) * 0.25])));
  }
  return merge(ps);
}

function boulder() {
  return merge([
    part(ico(1, 0), 0x8c7b6b, M(['t', 0, 0.45, 0], ['s', 1.3, 0.8, 1.0])),
    part(ico(0.55, 0), 0x7d6d5f, M(['t', 1.0, 0.25, 0.5], ['ry', 0.7], ['s', 1, 0.8, 1.2])),
  ]);
}

function bush() {
  return merge([
    part(ico(0.9, 0), 0x4c8a3a, M(['t', 0, 0.6, 0], ['s', 1.1, 0.8, 1])),
    part(ico(0.65, 0), 0x3f7a33, M(['t', 0.8, 0.45, 0.3], ['ry', 1])),
    part(ico(0.55, 0), 0x5a9944, M(['t', -0.6, 0.4, -0.4], ['ry', 2])),
  ]);
}

function acacia() {
  return merge([
    part(cyl(0.12, 0.22, 2.8, 6), 0x5c4630, M(['t', 0, 1.4, 0], ['rz', 0.08])),
    part(cyl(2.5, 1.5, 0.7, 7), 0x6b8a3a, M(['t', -0.1, 3.1, 0])),
    part(cyl(1.5, 1.9, 0.45, 7), 0x7c9a44, M(['t', 0.3, 3.6, 0.2], ['ry', 0.4])),
  ]);
}

function mesa() {
  return merge([
    part(cyl(1.0, 1.4, 0.28, 7), 0xa57f55, M(['t', 0, 0.14, 0])),
    part(cyl(0.66, 1.0, 0.72, 7), 0xb98a5a, M(['t', 0, 0.6, 0], ['ry', 0.2])),
    part(cyl(0.6, 0.66, 0.1, 7), 0x8a6a48, M(['t', 0, 1.0, 0], ['ry', 0.2])),
  ]);
}

function tree() {
  return merge([
    part(cyl(0.25, 0.38, 2.6, 6), 0x5d4532, M(['t', 0, 1.3, 0])),
    part(ico(1.7, 1), 0x2e6b34, M(['t', 0, 3.7, 0])),
    part(ico(1.25, 0), 0x3b7d3c, M(['t', 1.2, 3.1, 0.35])),
    part(ico(1.3, 0), 0x28602f, M(['t', -1.05, 3.25, -0.4], ['ry', 1])),
  ]);
}

function temple() {
  const ps = [
    part(box(3.6, 0.4, 3.6), 0xcbbba0, M(['t', 0, 0.2, 0])),
    part(box(3, 2.1, 3), 0xe9dcc3, M(['t', 0, 1.45, 0])),
    part(box(0.9, 1.4, 0.1), 0x4a2f20, M(['t', 0, 1.1, 1.5])),
  ];
  const tiers = [2.5, 2.0, 1.5, 1.05, 0.65];
  let y = 2.5;
  tiers.forEach((w, i) => {
    ps.push(part(box(w, 0.85, w), i % 2 ? 0xd98f45 : 0xe6a85c, M(['t', 0, y + 0.42, 0])));
    y += 0.85;
  });
  ps.push(part(sph(0.3, 8, 6), 0xf2c230, M(['t', 0, y + 0.25, 0])));
  ps.push(part(cyl(0.03, 0.03, 1.2, 4), 0x6b5a3a, M(['t', 0, y + 1.0, 0])));
  ps.push(part(cone(0.35, 0.7, 3), 0xd43a2a, M(['t', 0.3, y + 1.35, 0], ['rz', -HP], ['s', 1, 1, 0.1])));
  return merge(ps);
}

function hut() {
  return merge([
    part(box(4.8, 0.3, 3.4), 0x8a6444, M(['t', 0, 0.15, 0])),
    part(box(4.4, 2.2, 3.0), 0xc79a6c, M(['t', 0, 1.4, 0])),
    part(cone(3.5, 1.9, 4), 0xc9a24e, M(['t', 0, 3.4, 0], ['s', 1, 1, 0.74], ['ry', Math.PI / 4])),
    part(box(0.85, 1.55, 0.08), 0x3a2a1c, M(['t', -1.35, 1.08, 1.5])),
    part(box(4.44, 0.14, 3.04), 0xa33a2a, M(['t', 0, 0.42, 0])),   // red band at the base
  ]);
}

function haystack() {
  return merge([
    part(sph(1.3, 7, 5), 0xd8b24a, M(['t', 0, 1.0, 0], ['s', 1, 1.25, 1])),
    part(cyl(0.05, 0.05, 1.0, 4), 0x6b5030, M(['t', 0, 2.9, 0])),
  ]);
}

function lamp() {
  return merge([
    part(cyl(0.07, 0.11, 5.2, 6), 0x4a4d52, M(['t', 0, 2.6, 0])),
    part(box(1.7, 0.08, 0.08), 0x4a4d52, M(['t', 0.8, 5.15, 0])),
    part(box(0.5, 0.12, 0.3), 0x33363a, M(['t', 1.5, 5.08, 0])),
  ]);
}

function bulb() {
  return merge([part(sph(0.2, 8, 6), 0xffd89a, M(['t', 1.5, 4.92, 0]))]);
}

function building() {
  const ps = [];
  for (let i = 0; i < 7; i++) {
    ps.push(part(box(1, 1 / 7, 1), i % 2 ? 0x5d87a6 : 0xa9cadd, M(['t', 0, (i + 0.5) / 7, 0])));
  }
  ps.push(part(box(0.5, 0.06, 0.5), 0x8a8f96, M(['t', 0.1, 1.03, -0.1])));
  return merge(ps);
}

function milestone() {
  return merge([
    part(box(0.5, 0.5, 0.22), 0xf2f0e6, M(['t', 0, 0.25, 0])),
    part(cyl(0.25, 0.25, 0.22, 10), 0xf2c230, M(['t', 0, 0.5, 0], ['rx', HP])),
  ]);
}

const FESTIVE = [0xff4d4d, 0xffc233, 0x3ddc84, 0xff5fa8, 0x4db8ff, 0xff8a2a];

function lanterns() {
  const ps = [
    part(cyl(0.09, 0.11, 6.2, 5), 0x6b4a30, M(['t', -7.2, 3.1, 0])),
    part(cyl(0.09, 0.11, 6.2, 5), 0x6b4a30, M(['t', 7.2, 3.1, 0])),
  ];
  for (let i = 0; i < 11; i++) {
    const u = i / 10, x = -7 + u * 14;
    const sag = 6.0 - Math.sin(u * Math.PI) * 0.9;
    ps.push(part(i % 2 ? sph(0.24, 6, 5) : box(0.34, 0.42, 0.34), FESTIVE[i % FESTIVE.length], M(['t', x, sag, 0])));
  }
  return merge(ps);
}

function diya() {
  return merge([
    part(cyl(0.16, 0.08, 0.1, 6), 0x7a3b1c, M(['t', 0, 0.05, 0])),
    part(cone(0.07, 0.22, 5), 0xffb347, M(['t', 0, 0.2, 0])),
  ]);
}

function rail() {
  return merge([
    part(box(0.26, 1.15, 0.26), 0xd9d2c0, M(['t', 0, 0.57, 0])),
    part(box(0.12, 0.12, 5.2), 0xd9d2c0, M(['t', 0, 1.05, 0])),
    part(box(0.1, 0.1, 5.2), 0xc7bfac, M(['t', 0, 0.55, 0])),
  ]);
}

function pier() {
  return merge([
    part(box(13.2, 0.6, 30.6), 0x9c978c, M(['t', 0, -0.34, 0])),
    part(box(10, 12, 2.4), 0x8d887e, M(['t', 0, -6.6, 0])),
  ]);
}

// ---------------------------------------------------------------- road users

function cow() {
  const W = 0xf4efe6, D = 0x3a2e28;
  const ps = [
    part(box(0.85, 0.85, 1.8), W, M(['t', 0, 1.15, 0])),
    part(sph(0.36, 6, 5), W, M(['t', 0, 1.68, -0.5], ['s', 1, 0.9, 1.2])),        // zebu hump
    part(box(0.5, 0.52, 0.7), W, M(['t', 0, 1.42, -1.15], ['rx', 0.25])),
    part(box(0.36, 0.26, 0.3), 0xd9a9a0, M(['t', 0, 1.25, -1.52])),
    part(cone(0.07, 0.42, 5), D, M(['t', 0.22, 1.82, -1.05], ['rz', -0.5])),
    part(cone(0.07, 0.42, 5), D, M(['t', -0.22, 1.82, -1.05], ['rz', 0.5])),
    part(box(0.07, 0.75, 0.07), W, M(['t', 0, 1.1, 0.95], ['rx', 0.18])),
    part(box(0.12, 0.12, 0.05), D, M(['t', 0.18, 1.52, -1.5])),
    part(box(0.12, 0.12, 0.05), D, M(['t', -0.18, 1.52, -1.5])),
  ];
  for (const [x, z] of [[0.3, -0.65], [-0.3, -0.65], [0.3, 0.65], [-0.3, 0.65]]) {
    ps.push(part(box(0.2, 0.78, 0.2), W, M(['t', x, 0.39, z])));
    ps.push(part(box(0.22, 0.12, 0.22), D, M(['t', x, 0.06, z])));
  }
  return merge(ps);
}

function truck() {
  const ps = [
    part(box(2.3, 0.4, 6.8), 0x2a2a2e, M(['t', 0, 0.8, 0])),
    part(box(2.4, 1.9, 1.7), 0xe8642a, M(['t', 0, 1.95, -2.55])),
    part(box(2.1, 0.8, 0.06), 0x1b2a3a, M(['t', 0, 2.35, -3.4])),
    part(box(2.44, 0.5, 0.4), 0xf2c230, M(['t', 0, 3.1, -3.15])),
    part(box(2.5, 2.2, 4.6), 0x1f7a8c, M(['t', 0, 2.15, 1.05])),
    part(box(2.54, 0.26, 4.64), 0xf2c230, M(['t', 0, 1.3, 1.05])),
    part(box(2.54, 0.14, 4.64), 0xd43a2a, M(['t', 0, 2.9, 1.05])),
    part(box(2.4, 0.3, 4.4), 0x8a5a3a, M(['t', 0, 3.38, 1.05])),
    part(box(2.5, 0.26, 0.2), 0xdddddd, M(['t', 0, 0.68, -3.45])),
    part(box(0.34, 0.26, 0.08), 0xfff3b0, M(['t', 0.85, 1.12, -3.42])),
    part(box(0.34, 0.26, 0.08), 0xfff3b0, M(['t', -0.85, 1.12, -3.42])),
    part(box(0.3, 0.22, 0.08), 0xd01818, M(['t', 0.95, 0.85, 3.4])),
    part(box(0.3, 0.22, 0.08), 0xd01818, M(['t', -0.95, 0.85, 3.4])),
  ];
  for (const z of [-2.5, 1.3, 2.6]) for (const x of [-1.05, 1.05]) {
    ps.push(part(cyl(0.52, 0.52, 0.36, 10), 0x18181a, M(['t', x, 0.52, z], ['rz', HP])));
  }
  return merge(ps);
}

function truckGlow() {
  return merge([
    part(sph(0.34, 8, 6), 0xfff0c0, M(['t', 0.85, 1.12, -3.5])),
    part(sph(0.34, 8, 6), 0xfff0c0, M(['t', -0.85, 1.12, -3.5])),
  ]);
}

function chai() {
  return merge([
    part(cyl(0.36, 0.24, 0.52, 10), 0xc46a3a, M(['t', 0, 0, 0])),
    part(cyl(0.39, 0.37, 0.07, 10), 0xd98050, M(['t', 0, 0.27, 0])),
    part(cyl(0.3, 0.3, 0.03, 10), 0xe8c79a, M(['t', 0, 0.3, 0])),
  ]);
}

function pothole() {
  return merge([
    part(new THREE.CircleGeometry(1.0, 10), 0x6a6258, M(['t', 0, 0.035, 0], ['rx', -HP], ['s', 1.12, 1.0, 1])),
    part(new THREE.CircleGeometry(0.86, 9), 0x141210, M(['t', 0.03, 0.05, 0.02], ['rx', -HP])),
    part(new THREE.CircleGeometry(0.5, 7), 0x050505, M(['t', -0.08, 0.06, 0.05], ['rx', -HP])),
  ]);
}

export function makeGeos() {
  return {
    palm: palm(), boulder: boulder(), bush: bush(), acacia: acacia(), mesa: mesa(),
    tree: tree(), temple: temple(), hut: hut(), haystack: haystack(), lamp: lamp(),
    bulb: bulb(), building: building(), milestone: milestone(), lanterns: lanterns(),
    diya: diya(), rail: rail(), pier: pier(),
    cow: cow(), truck: truck(), truckGlow: truckGlow(), chai: chai(), pothole: pothole(),
  };
}
