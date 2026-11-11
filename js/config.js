// Tunables and the five regions of the journey.

export const TOTAL = 6000;          // journey length in world units
export const REGION_LEN = 1200;
export const CHUNK_LEN = 60;
export const N_CHUNKS = 10;         // 1 behind the player, 9 ahead
export const ROAD_HALF = 5.5;
export const RIVER = { start: 2930, end: 3190 };   // the Ganga bridge
export const REAL_KM = 2100;        // what the HUD pretends the trip is

export const PLAYER = {
  cruise: 30, fast: 38, slow: 12, boost: 54,
  accel: 14, brake: 26,
  drain: 1.45, boostDrain: 3.2,
  chaiFuel: 10,
  halfW: 0.7, halfL: 1.3,
};

// props: n = average count per chunk, min/max = distance from the road centre,
// s = scale range.
export const REGIONS = [
  {
    name: 'Karnataka Plains', tag: 'Red earth and coconut palms',
    groundA: 0xb5613a, groundB: 0x6f8f3a, shoulder: 0xa8623f, road: 0xffffff,
    hill: 5, roll: 1.0, field: 0.0, ridge: 0.55,
    props: [
      { type: 'palm', n: 7, min: 9, max: 75, s: [0.8, 1.35] },
      { type: 'boulder', n: 4, min: 10, max: 95, s: [0.8, 3.0] },
      { type: 'bush', n: 6, min: 8, max: 55, s: [0.7, 1.5] },
      { type: 'tree', n: 2, min: 14, max: 90, s: [0.8, 1.3] },
    ],
    hz: { cow: 0.10, pot: 0.14, truck: 1.0 },
  },
  {
    name: 'Deccan Plateau', tag: 'Basalt mesas under a hard noon sun',
    groundA: 0xc9a26a, groundB: 0xa07c4c, shoulder: 0xb08a5a, road: 0xf2ece4,
    hill: 16, roll: 2.0, field: 0.0, ridge: 1.0,
    props: [
      { type: 'mesa', n: 2.2, min: 60, max: 150, s: [11, 26], bias: 1 },
      { type: 'boulder', n: 8, min: 9, max: 105, s: [0.8, 4.5] },
      { type: 'acacia', n: 4.5, min: 10, max: 85, s: [0.8, 1.5] },
      { type: 'bush', n: 3, min: 8, max: 50, s: [0.6, 1.1], tint: 0xc9b070 },
    ],
    hz: { cow: 0.12, pot: 0.2, truck: 1.25 },
  },
  {
    name: 'Ganga Plains', tag: 'Sunset over the great river',
    groundA: 0x5e9a3f, groundB: 0x86b04a, shoulder: 0x9a8a5a, road: 0xf0e8dc,
    hill: 1.5, roll: 0.25, field: 0.35, ridge: 0.15,
    props: [
      { type: 'tree', n: 9, min: 10, max: 115, s: [0.8, 1.6] },
      { type: 'bush', n: 5, min: 8, max: 60, s: [0.7, 1.4] },
      { type: 'temple', n: 0.4, min: 18, max: 42, s: [1.0, 1.5] },
      { type: 'palm', n: 1.5, min: 10, max: 70, s: [0.8, 1.2] },
    ],
    hz: { cow: 0.2, pot: 0.18, truck: 1.0 },
  },
  {
    name: 'Bihar Farmland', tag: 'Mustard fields at dusk',
    groundA: 0x7fa046, groundB: 0xa39a4a, shoulder: 0x8f7a55, road: 0xe6d8c6,
    hill: 1.2, roll: 0.2, field: 1.0, ridge: 0.08,
    props: [
      { type: 'haystack', n: 2.5, min: 12, max: 55, s: [0.8, 1.4] },
      { type: 'hut', n: 1.2, min: 15, max: 42, s: [0.9, 1.15] },
      { type: 'palm', n: 2.5, min: 10, max: 80, s: [0.9, 1.4] },
      { type: 'tree', n: 3, min: 12, max: 100, s: [0.8, 1.4] },
      { type: 'bush', n: 2, min: 8, max: 40, s: [0.6, 1.2] },
    ],
    hz: { cow: 0.24, pot: 0.3, truck: 0.8 },
  },
  {
    name: 'Madhubani Village', tag: 'Painted walls and lamplight',
    groundA: 0x6b7d45, groundB: 0x7a6a48, shoulder: 0x8a6f52, road: 0xc9a585,
    hill: 1.0, roll: 0.15, field: 0.45, ridge: 0.05,
    props: [
      { type: 'hut', n: 4, min: 13, max: 46, s: [0.9, 1.25] },
      { type: 'tree', n: 4, min: 12, max: 90, s: [0.8, 1.5] },
      { type: 'palm', n: 2, min: 10, max: 70, s: [0.9, 1.3] },
      { type: 'haystack', n: 1, min: 12, max: 50, s: [0.8, 1.2] },
      { type: 'bush', n: 2, min: 8, max: 40, s: [0.6, 1.2] },
    ],
    hz: { cow: 0.26, pot: 0.24, truck: 0.45 },
  },
];
