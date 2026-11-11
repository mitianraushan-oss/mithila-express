// Every texture in the game is drawn here at start-up on a 2D canvas.

import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { PAL, fish, lotus, border, paper, sunFace, peacock } from './madhubani.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Asphalt with a dashed centre line and solid edge lines. Tiles along v.
export function roadTexture() {
  const [c, x] = canvas(256, 256);
  const rnd = mulberry32(7);
  x.fillStyle = '#5a5a60'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const g = 60 + rnd() * 60;
    x.fillStyle = `rgba(${g},${g},${g + 4},${0.25 + rnd() * 0.35})`;
    x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // worn wheel tracks
  for (const u of [0.25, 0.75]) {
    const g = x.createLinearGradient(u * 256 - 26, 0, u * 256 + 26, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(u * 256 - 26, 0, 52, 256);
  }
  x.fillStyle = '#e9e4d4';
  x.fillRect(7, 0, 5, 256); x.fillRect(244, 0, 5, 256);
  x.fillStyle = '#e8b93a';
  x.fillRect(125, 0, 6, 128);
  return tex(c, true);
}

// Soft round blob: light pools under lamps and the glow around chai cups.
export function radialTexture() {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = tex(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function truckSignTexture() {
  const [c, x] = canvas(256, 128);
  x.fillStyle = '#f2c230'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#c8262c'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 118);
  x.strokeStyle = '#1f4e8c'; x.lineWidth = 3; x.strokeRect(14, 14, 228, 100);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 34px Georgia, serif';
  x.fillStyle = '#1f4e8c'; x.fillText('HORN', 74, 46);
  x.fillStyle = '#c8262c'; x.fillText('OK', 128, 82);
  x.fillStyle = '#1f4e8c'; x.fillText('PLEASE', 172, 46);
  lotus(x, 44, 88, 17, 8, PAL.pink, PAL.red); lotus(x, 212, 88, 17, 8, PAL.pink, PAL.red);
  return tex(c);
}

// The painted wall panel on every hut.
export function muralTexture() {
  const [c, x] = canvas(512, 384);
  paper(x, 512, 384, mulberry32(3), '#f6ecd2');
  border(x, 512, 384, 8, 20);
  fish(x, 180, 150, 150, 0.12, PAL.verm, PAL.yellow);
  fish(x, 330, 250, 150, Math.PI + 0.12, PAL.blue, PAL.pink);
  lotus(x, 400, 110, 46, 8, PAL.pink, PAL.red);
  lotus(x, 110, 280, 40, 8, PAL.yellow, PAL.verm);
  return tex(c);
}

// The arch that marks the end of the journey.
export function gateTexture() {
  const [c, x] = canvas(1024, 160);
  paper(x, 1024, 160, mulberry32(5), '#f6ecd2');
  border(x, 1024, 160, 6, 16);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = PAL.red;
  x.font = 'bold 70px "Kohinoor Devanagari", "Noto Sans Devanagari", "Devanagari Sangam MN", Georgia, serif';
  x.fillText('मधुबनी', 330, 84);
  x.fillStyle = PAL.blue;
  x.font = 'bold 58px Georgia, serif';
  x.fillText('MADHUBANI', 660, 84);
  fish(x, 110, 80, 96, 0, PAL.verm, PAL.yellow);
  fish(x, 914, 80, 96, Math.PI, PAL.green, PAL.yellow);
  lotus(x, 492, 80, 26, 8, PAL.pink, PAL.red);
  return tex(c);
}

export function pillarTexture() {
  const [c, x] = canvas(128, 512);
  paper(x, 128, 512, mulberry32(11), '#f6ecd2');
  border(x, 128, 512, 5, 14);
  sunFace(x, 64, 96, 24);
  lotus(x, 64, 220, 30, 8, PAL.pink, PAL.red);
  fish(x, 64, 330, 84, Math.PI / 2, PAL.blue, PAL.yellow);
  peacock(x, 78, 440, 0.42);
  return tex(c);
}

// Highway sign at the start of the trip.
export function startSignTexture() {
  const [c, x] = canvas(512, 192);
  x.fillStyle = '#17683f'; x.fillRect(0, 0, 512, 192);
  x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.strokeRect(8, 8, 496, 176);
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 44px Helvetica, Arial, sans-serif';
  x.fillText('MADHUBANI  ↑', 256, 66);
  x.font = 'bold 34px Helvetica, Arial, sans-serif';
  x.fillText('2100 km', 256, 130);
  return tex(c);
}
