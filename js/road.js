// Pure functions describing the road and the land around it.
// "dist" is distance along the journey; world z is -dist.

import { TOTAL, REGION_LEN, REGIONS, RIVER } from './config.js';
import { clamp, lerp, smoothstep, noise2 } from './util.js';

const BLEND = 90; // half-width of the cross-fade between two regions
const _b = { a: 0, b: 0, t: 0 };

export function regionIndex(dist) {
  return clamp(Math.floor(dist / REGION_LEN), 0, REGIONS.length - 1);
}

// Which two regions influence this distance, and how much of the second.
export function regionBlend(dist) {
  const i = regionIndex(dist);
  const local = dist - i * REGION_LEN;
  _b.a = i; _b.b = i; _b.t = 0;
  if (local < BLEND && i > 0) {
    _b.b = i - 1;
    _b.t = 0.5 * (1 - smoothstep(0, BLEND, local));
  } else if (local > REGION_LEN - BLEND && i < REGIONS.length - 1) {
    _b.b = i + 1;
    _b.t = 0.5 * smoothstep(REGION_LEN - BLEND, REGION_LEN, local);
  }
  return _b;
}

export function regionParam(dist, key) {
  const b = regionBlend(dist);
  return lerp(REGIONS[b.a][key], REGIONS[b.b][key], b.t);
}

// 0 on land, 1 over the river.
export function riverF(dist) {
  return smoothstep(RIVER.start - 30, RIVER.start, dist) *
    (1 - smoothstep(RIVER.end, RIVER.end + 30, dist));
}

function curveAmp(dist) {
  return smoothstep(40, 300, dist) * (1 - smoothstep(TOTAL - 260, TOTAL - 60, dist));
}

export function roadX(dist) {
  return curveAmp(dist) * (
    34 * Math.sin(dist * 0.0041 + 0.6) +
    13 * Math.sin(dist * 0.0107 + 2.1) +
    4 * Math.sin(dist * 0.019)
  );
}

export function roadY(dist) {
  const roll = regionParam(dist, 'roll');
  return roll * (2.2 * Math.sin(dist * 0.0063 + 1) + 1.1 * Math.sin(dist * 0.0151)) *
    (1 - riverF(dist));
}

// Slope of the centre line in x per unit of distance, and its heading angle.
export function roadSlope(dist) {
  return (roadX(dist + 0.5) - roadX(dist - 0.5));
}
export function roadHeading(dist) {
  return Math.atan(roadSlope(dist));
}
export function roadCurvature(dist) {
  return roadX(dist + 2) - 2 * roadX(dist) + roadX(dist - 2);  // per 4 units^2
}

// Height of the land at a lateral offset from the road centre.
export function terrainY(off, dist) {
  const ry = roadY(dist);
  const ao = Math.abs(off);
  const wx = roadX(dist) + off;
  const hill = regionParam(dist, 'hill');
  const a = smoothstep(8, 46, ao);
  let h = (noise2(wx * 0.018, dist * 0.018) - 0.35) * hill * 1.6 +
    (noise2(wx * 0.06 + 7, dist * 0.06) - 0.5) * hill * 0.35 +
    smoothstep(60, 150, ao) * hill * 0.6;
  let y = ry + a * h;
  y -= 0.35 * smoothstep(6, 8.5, ao) * (1 - smoothstep(9, 15, ao));  // roadside ditch
  y -= 0.15 * (1 - smoothstep(5.5, 7, ao));                           // sit under the road
  const rf = riverF(dist);
  if (rf > 0) y = lerp(y, -9 + noise2(wx * 0.05, dist * 0.05) * 1.5, rf);
  return y;
}
