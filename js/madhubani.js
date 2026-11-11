// Madhubani (Mithila) painting motifs drawn with the 2D canvas API.
// The style: flat natural colours, bold double outlines, big almond eyes, fish, lotus,
// peacock and sun, and no empty space left unfilled.
// Used for the win screen and for the textures painted on huts and the village gate.

import { mulberry32, lerp } from './util.js';

export const PAL = {
  paper: '#f4e7c5', ink: '#1c1410', red: '#c8262c', verm: '#e2552a', yellow: '#f0b323',
  green: '#2f7d4f', blue: '#1f4e8c', pink: '#d4477c', white: '#fff8e8', skin: '#c98b5a',
};

const TAU = Math.PI * 2;

function ink(ctx, p, w = 3) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = w;
  p ? ctx.stroke(p) : ctx.stroke();
}

// The signature double line: a heavy ink stroke with a pale thread down its middle.
function doubleLine(ctx, p, w = 5) {
  ink(ctx, p, w);
  ctx.strokeStyle = PAL.paper; ctx.lineWidth = Math.max(1, w * 0.26);
  ctx.stroke(p);
}

function hatch(ctx, p, cx, cy, r, color, gap = 5, angle = Math.PI / 4, lw = 1) {
  ctx.save();
  ctx.clip(p);
  ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  for (let x = -r; x <= r; x += gap) { ctx.moveTo(x, -r); ctx.lineTo(x, r); }
  ctx.stroke();
  ctx.restore();
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function almondEye(ctx, x, y, w, h, look = 0) {
  const p = new Path2D();
  p.moveTo(x - w / 2, y);
  p.quadraticCurveTo(x, y - h, x + w / 2, y);
  p.quadraticCurveTo(x, y + h, x - w / 2, y);
  ctx.fillStyle = PAL.white; ctx.fill(p);
  ink(ctx, p, Math.max(1.5, w * 0.07));
  dot(ctx, x + look * w * 0.12, y, h * 0.55, PAL.ink);
}

export function fish(ctx, x, y, len, ang, body = PAL.verm, head = PAL.yellow) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const L = len / 2, Hh = len * 0.3;
  const tail = new Path2D();
  tail.moveTo(L * 0.86, 0); tail.lineTo(L * 1.5, -Hh * 0.75); tail.lineTo(L * 1.32, 0);
  tail.lineTo(L * 1.5, Hh * 0.75); tail.closePath();
  ctx.fillStyle = head; ctx.fill(tail);
  hatch(ctx, tail, L * 1.2, 0, len, PAL.ink, 4, 0, 0.8);
  doubleLine(ctx, tail, 4);

  for (const s of [-1, 1]) {
    const fin = new Path2D();
    fin.moveTo(-L * 0.1, s * Hh * 0.55); fin.lineTo(L * 0.2, s * Hh * 1.15); fin.lineTo(L * 0.4, s * Hh * 0.45);
    fin.closePath();
    ctx.fillStyle = PAL.green; ctx.fill(fin); ink(ctx, fin, 2);
  }

  const b = new Path2D();
  b.moveTo(-L, 0);
  b.quadraticCurveTo(0, -Hh * 1.35, L, 0);
  b.quadraticCurveTo(0, Hh * 1.35, -L, 0);
  ctx.fillStyle = body; ctx.fill(b);
  ctx.save();
  ctx.clip(b);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1;
  const s = len * 0.085;
  for (let cx = -L * 0.45; cx < L; cx += s) {
    for (let cy = -Hh; cy <= Hh; cy += s) {
      ctx.beginPath(); ctx.arc(cx + ((Math.round(cy / s) & 1) ? s / 2 : 0), cy, s * 0.55, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
  }
  ctx.fillStyle = head; ctx.fillRect(-L, -Hh, L * 0.5, Hh * 2);
  ctx.beginPath(); ctx.moveTo(-L * 0.5, -Hh); ctx.quadraticCurveTo(-L * 0.36, 0, -L * 0.5, Hh); ink(ctx, null, 2);
  ctx.restore();
  doubleLine(ctx, b, 4.5);
  almondEye(ctx, -L * 0.7, -Hh * 0.08, len * 0.13, len * 0.05);
  ctx.restore();
}

export function lotus(ctx, x, y, r, n = 8, c1 = PAL.pink, c2 = PAL.red) {
  ctx.save();
  ctx.translate(x, y);
  [[1, c1, 0], [0.62, c2, Math.PI / n]].forEach(([L, col, off]) => {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate(off + (i / n) * TAU);
      const p = new Path2D();
      p.moveTo(0, 0);
      p.quadraticCurveTo(r * 0.3 * L, -r * 0.55 * L, 0, -r * L);
      p.quadraticCurveTo(-r * 0.3 * L, -r * 0.55 * L, 0, 0);
      ctx.fillStyle = col; ctx.fill(p); ink(ctx, p, Math.max(1.2, r * 0.045));
      ctx.beginPath(); ctx.moveTo(0, -r * 0.2 * L); ctx.lineTo(0, -r * 0.8 * L); ink(ctx, null, 1);
      ctx.restore();
    }
  });
  const c = new Path2D(); c.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fillStyle = PAL.yellow; ctx.fill(c); ink(ctx, c, Math.max(1.2, r * 0.05));
  for (let i = 0; i < 6; i++) dot(ctx, Math.cos(i * TAU / 6) * r * 0.1, Math.sin(i * TAU / 6) * r * 0.1, Math.max(0.8, r * 0.025), PAL.ink);
  ctx.restore();
}

export function sunFace(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  const n = 18;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * TAU);
    const p = new Path2D();
    p.moveTo(-r * 0.19, -r * 1.02); p.lineTo(0, -r * 1.58); p.lineTo(r * 0.19, -r * 1.02); p.closePath();
    ctx.fillStyle = i % 2 ? PAL.red : PAL.verm; ctx.fill(p); ink(ctx, p, 2);
    ctx.beginPath(); ctx.moveTo(0, -r * 1.08); ctx.lineTo(0, -r * 1.42); ink(ctx, null, 1);
    ctx.restore();
  }
  const ring = new Path2D(); ring.arc(0, 0, r * 1.04, 0, TAU);
  ctx.fillStyle = PAL.red; ctx.fill(ring); doubleLine(ctx, ring, 5);
  const face = new Path2D(); face.arc(0, 0, r * 0.88, 0, TAU);
  ctx.fillStyle = PAL.yellow; ctx.fill(face); ink(ctx, face, 2.5);
  for (const s of [-1, 1]) {
    dot(ctx, s * r * 0.52, r * 0.26, r * 0.13, PAL.pink);
    almondEye(ctx, s * r * 0.36, -r * 0.14, r * 0.46, r * 0.14);
    ctx.beginPath(); ctx.arc(s * r * 0.36, -r * 0.1, r * 0.34, Math.PI * 1.2, Math.PI * 1.8); ink(ctx, null, 2.2);
  }
  ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.quadraticCurveTo(-r * 0.04, r * 0.18, r * 0.1, r * 0.22); ink(ctx, null, 2);
  ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.44); ctx.quadraticCurveTo(0, r * 0.6, r * 0.2, r * 0.44);
  ctx.strokeStyle = PAL.red; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
  dot(ctx, 0, -r * 0.5, r * 0.07, PAL.red);
  ctx.restore();
}

export function peacock(ctx, x, y, s, flip = false) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
  // tail fan
  for (let i = 0; i < 7; i++) {
    const a = lerp(-1.45, 0.2, i / 6), L = 128 - Math.abs(i - 3) * 6;
    ctx.save();
    ctx.translate(18, 8); ctx.rotate(a);
    const f = new Path2D();
    f.moveTo(0, 0); f.quadraticCurveTo(L * 0.55, -17, L, 0); f.quadraticCurveTo(L * 0.55, 17, 0, 0);
    ctx.fillStyle = i % 2 ? PAL.green : '#3f9a63'; ctx.fill(f);
    hatch(ctx, f, L / 2, 0, L, PAL.ink, 5, Math.PI / 3, 0.7);
    ink(ctx, f, 2.2);
    dot(ctx, L * 0.76, 0, 9.5, PAL.ink); dot(ctx, L * 0.76, 0, 8, PAL.blue);
    dot(ctx, L * 0.76, 0, 4.6, PAL.yellow); dot(ctx, L * 0.76, 0, 1.8, PAL.ink);
    ctx.restore();
  }
  // legs
  for (const lx of [-6, 9]) {
    ctx.beginPath(); ctx.moveTo(lx, 26); ctx.lineTo(lx - 2, 52);
    ctx.moveTo(lx - 9, 55); ctx.lineTo(lx - 2, 52); ctx.lineTo(lx + 6, 55); ink(ctx, null, 2.5);
  }
  const body = new Path2D(); body.ellipse(0, 10, 36, 23, -0.3, 0, TAU);
  ctx.fillStyle = PAL.blue; ctx.fill(body);
  hatch(ctx, body, 0, 10, 40, PAL.paper, 6, -0.6, 0.9);
  doubleLine(ctx, body, 4.5);
  const neck = new Path2D();
  neck.moveTo(-30, 6); neck.quadraticCurveTo(-56, -20, -46, -58); neck.lineTo(-34, -55);
  neck.quadraticCurveTo(-40, -22, -12, -6); neck.closePath();
  ctx.fillStyle = PAL.blue; ctx.fill(neck); ink(ctx, neck, 3);
  const beak = new Path2D(); beak.moveTo(-49, -67); beak.lineTo(-66, -61); beak.lineTo(-49, -57); beak.closePath();
  ctx.fillStyle = PAL.yellow; ctx.fill(beak); ink(ctx, beak, 2);
  const head = new Path2D(); head.arc(-40, -62, 11, 0, TAU);
  ctx.fillStyle = PAL.blue; ctx.fill(head); ink(ctx, head, 3);
  almondEye(ctx, -42, -63, 11, 4);
  for (const [dx, dy] of [[-8, -22], [0, -25], [8, -21]]) {
    ctx.beginPath(); ctx.moveTo(-39, -72); ctx.lineTo(-39 + dx, -72 + dy); ink(ctx, null, 1.8);
    dot(ctx, -39 + dx, -72 + dy, 3.2, PAL.pink);
  }
  ctx.restore();
}

function wheel(ctx, x, y, r) {
  const o = new Path2D(); o.arc(x, y, r, 0, TAU);
  ctx.fillStyle = PAL.ink; ctx.fill(o);
  const i = new Path2D(); i.arc(x, y, r * 0.68, 0, TAU);
  ctx.fillStyle = PAL.paper; ctx.fill(i);
  for (let k = 0; k < 8; k++) {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(k * TAU / 8) * r * 0.68, y + Math.sin(k * TAU / 8) * r * 0.68); ink(ctx, null, 1.4);
  }
  dot(ctx, x, y, r * 0.22, PAL.red);
}

// The auto-rickshaw, side view, driving left.
export function rickshaw2D(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const body = new Path2D();
  body.moveTo(-96, 46); body.lineTo(-90, 12); body.lineTo(-56, 0); body.lineTo(-47, -46);
  body.quadraticCurveTo(12, -74, 96, -48); body.lineTo(99, 46); body.closePath();
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = PAL.yellow; ctx.fillRect(-110, -90, 230, 88);
  ctx.fillStyle = PAL.green; ctx.fillRect(-110, -2, 230, 60);
  ctx.restore();
  hatch(ctx, (() => { const p = new Path2D(); p.rect(-98, 2, 200, 46); return p; })(), 0, 24, 120, PAL.ink, 7, Math.PI / 4, 0.8);
  ctx.beginPath(); ctx.moveTo(-58, -1); ctx.lineTo(98, -1); ink(ctx, null, 3);
  // open side
  const door = new Path2D();
  door.moveTo(-40, -40); door.quadraticCurveTo(-5, -52, 30, -44); door.lineTo(30, 30); door.lineTo(-44, 30); door.closePath();
  ctx.fillStyle = PAL.paper; ctx.fill(door); ink(ctx, door, 2.5);
  // driver
  const torso = new Path2D();
  torso.moveTo(-26, -10); torso.lineTo(0, -10); torso.lineTo(6, 30); torso.lineTo(-30, 30); torso.closePath();
  ctx.fillStyle = PAL.red; ctx.fill(torso); ink(ctx, torso, 2);
  ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(-50, 4); ink(ctx, null, 4);
  const head = new Path2D(); head.arc(-14, -24, 12, 0, TAU);
  ctx.fillStyle = PAL.skin; ctx.fill(head); ink(ctx, head, 2);
  const hair = new Path2D(); hair.arc(-14, -24, 12, Math.PI * 1.05, Math.PI * 1.95); hair.closePath();
  ctx.fillStyle = PAL.ink; ctx.fill(hair);
  almondEye(ctx, -19, -23, 11, 4, -1);
  // passenger-side decoration
  lotus(ctx, 64, 22, 15, 8, PAL.pink, PAL.red);
  doubleLine(ctx, body, 5);
  // headlight
  dot(ctx, -93, 24, 7, PAL.ink); dot(ctx, -93, 24, 5, PAL.yellow);
  for (const a of [-0.35, 0, 0.35]) {
    ctx.beginPath(); ctx.moveTo(-102, 24 + a * 14); ctx.lineTo(-120, 24 + a * 46); ink(ctx, null, 1.6);
  }
  wheel(ctx, -70, 58, 21); wheel(ctx, 62, 58, 23);
  ctx.restore();
}

function leafVine(ctx, x0, y0, x1, y1, amp, n, color = PAL.green) {
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = lerp(x0, x1, t), y = lerp(y0, y1, t) + Math.sin(t * Math.PI * 3) * amp;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ink(ctx, null, 2.5);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t) + Math.sin(t * Math.PI * 3) * amp;
    const a = Math.atan2(y1 - y0, x1 - x0) + (i % 2 ? -1 : 1) * 1.0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(9, -7, 20, 0); p.quadraticCurveTo(9, 7, 0, 0);
    ctx.fillStyle = color; ctx.fill(p); ink(ctx, p, 1.4);
    ctx.restore();
  }
}

function rosette(ctx, x, y, r, color) {
  for (let i = 0; i < 5; i++) dot(ctx, x + Math.cos(i * TAU / 5) * r, y + Math.sin(i * TAU / 5) * r, r * 0.55, color);
  dot(ctx, x, y, r * 0.5, PAL.ink);
}

// Zigzag border band plus a chain of dots, the way a Mithila painting is framed.
export function border(ctx, W, H, m = 14, band = 26) {
  const cols = [PAL.red, PAL.green, PAL.yellow, PAL.blue];
  const tri = (ax, ay, bx, by, cx, cy, c) => {
    const p = new Path2D(); p.moveTo(ax, ay); p.lineTo(bx, by); p.lineTo(cx, cy); p.closePath();
    ctx.fillStyle = c; ctx.fill(p); ink(ctx, p, 1.5);
  };
  ctx.fillStyle = PAL.white;
  ctx.fillRect(m, m, W - 2 * m, band); ctx.fillRect(m, H - m - band, W - 2 * m, band);
  ctx.fillRect(m, m, band, H - 2 * m); ctx.fillRect(W - m - band, m, band, H - 2 * m);
  const nx = Math.round((W - 2 * m) / band), sx = (W - 2 * m) / nx;
  for (let i = 0; i < nx; i++) {
    const x = m + i * sx;
    tri(x, m + band, x + sx / 2, m, x + sx, m + band, cols[i % 4]);
    tri(x, H - m - band, x + sx / 2, H - m, x + sx, H - m - band, cols[(i + 2) % 4]);
  }
  const ny = Math.round((H - 2 * m - 2 * band) / band), sy = (H - 2 * m - 2 * band) / ny;
  for (let i = 0; i < ny; i++) {
    const y = m + band + i * sy;
    tri(m + band, y, m, y + sy / 2, m + band, y + sy, cols[(i + 1) % 4]);
    tri(W - m - band, y, W - m, y + sy / 2, W - m - band, y + sy, cols[(i + 3) % 4]);
  }
  const outer = new Path2D(); outer.rect(m, m, W - 2 * m, H - 2 * m);
  const inner = new Path2D(); inner.rect(m + band, m + band, W - 2 * (m + band), H - 2 * (m + band));
  doubleLine(ctx, outer, 6); doubleLine(ctx, inner, 5);
  const g = m + band + 11;
  const cx = Math.round((W - 2 * g) / 16), cy = Math.round((H - 2 * g) / 16);
  for (let i = 0; i <= cx; i++) {
    dot(ctx, g + i * (W - 2 * g) / cx, g, 3, i % 2 ? PAL.red : PAL.ink);
    dot(ctx, g + i * (W - 2 * g) / cx, H - g, 3, i % 2 ? PAL.red : PAL.ink);
  }
  for (let i = 1; i < cy; i++) {
    dot(ctx, g, g + i * (H - 2 * g) / cy, 3, i % 2 ? PAL.red : PAL.ink);
    dot(ctx, W - g, g + i * (H - 2 * g) / cy, 3, i % 2 ? PAL.red : PAL.ink);
  }
}

export function paper(ctx, W, H, rnd, color = PAL.paper) {
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120, 90, 40, 0.07)'; ctx.lineWidth = 1;
  for (let i = 0; i < W * H / 2600; i++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * TAU, l = 4 + rnd() * 12;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
}

// Returns the win-screen painting as an ordered list of drawing steps, so the caller can
// reveal it stroke by stroke. Different seeds give different colourings.
export function paintingSteps(W, H, seed = 1) {
  const rnd = mulberry32(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const fishCols = [[PAL.verm, PAL.yellow], [PAL.blue, PAL.pink], [PAL.green, PAL.yellow], [PAL.pink, PAL.white], [PAL.red, PAL.yellow]];
  const steps = [];
  const waterTop = H - 178, cx = W / 2;

  steps.push((c) => paper(c, W, H, mulberry32(seed + 9)));
  steps.push((c) => border(c, W, H));
  // water
  steps.push((c) => {
    c.fillStyle = 'rgba(31, 78, 140, 0.13)';
    c.fillRect(54, waterTop, W - 108, H - 54 - waterTop);
    for (let k = 0; k < 7; k++) {
      c.beginPath();
      for (let x = 54; x <= W - 54; x += 6) {
        const y = waterTop + k * 19 + Math.sin(x * 0.045 + k * 1.7) * 4;
        x === 54 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.strokeStyle = PAL.blue; c.lineWidth = k ? 1.3 : 3; c.stroke();
    }
  });
  const nFish = 5;
  for (let i = 0; i < nFish; i++) {
    const fx = 150 + i * (W - 300) / (nFish - 1), fy = waterTop + 58 + (i % 2) * 34;
    const col = fishCols[(i + Math.floor(rnd() * 5)) % 5], dir = i % 2 ? Math.PI : 0;
    steps.push((c) => fish(c, fx, fy, 112, dir + (rnd() - 0.5) * 0.24, col[0], col[1]));
  }
  // sky
  steps.push((c) => sunFace(c, cx, 158, 54));
  steps.push((c) => { leafVine(c, cx - 110, 150, 150, 96, 12, 9); leafVine(c, cx + 110, 150, W - 150, 96, 12, 9); });
  const lc = [pick([PAL.pink, PAL.verm]), pick([PAL.red, PAL.blue])];
  steps.push((c) => { lotus(c, 104, 104, 34, 8, lc[0], lc[1]); lotus(c, W - 104, 104, 34, 8, lc[0], lc[1]); });
  // ground line and the travellers
  steps.push((c) => {
    c.beginPath();
    for (let x = 54; x <= W - 54; x += 8) { const y = waterTop - 16 + Math.sin(x * 0.09) * 2.5; x === 54 ? c.moveTo(x, y) : c.lineTo(x, y); }
    ink(c, null, 4);
    for (let x = 70; x < W - 60; x += 22) rosette(c, x, waterTop - 6, 3, x % 44 < 22 ? PAL.red : PAL.yellow);
  });
  steps.push((c) => peacock(c, 208, waterTop - 72, 1.12, true));
  steps.push((c) => peacock(c, W - 208, waterTop - 72, 1.12, false));
  steps.push((c) => rickshaw2D(c, cx + 6, waterTop - 98, 1.22));
  // fill what is left
  const taken = [
    [cx, 158, 104], [208, waterTop - 110, 150], [W - 208, waterTop - 110, 150], [cx, waterTop - 90, 150],
    [104, 104, 50], [W - 104, 104, 50], [cx - 240, 118, 46], [cx + 240, 118, 46], [cx - 160, 140, 40], [cx + 160, 140, 40],
  ];
  const pts = [];
  for (let y = 84; y < waterTop - 30; y += 36) {
    for (let x = 84; x < W - 70; x += 38) {
      const px = x + (rnd() - 0.5) * 16, py = y + (rnd() - 0.5) * 14;
      if (taken.every(([tx, ty, tr]) => Math.hypot(px - tx, py - ty) > tr)) pts.push([px, py, pick([PAL.red, PAL.blue, PAL.green, PAL.pink, PAL.verm])]);
    }
  }
  for (let i = 0; i < pts.length; i += 10) {
    const group = pts.slice(i, i + 10);
    steps.push((c) => group.forEach(([x, y, col]) => rosette(c, x, y, 4.2, col)));
  }
  return steps;
}
