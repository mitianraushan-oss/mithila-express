# Mithila Express — build notes

## Plan

1. **Scaffold** — static site, vendored three.js (no build step), git, Playwright.
2. **World** — road curve, pooled terrain chunks, five region palettes, instanced props.
3. **Light** — sky dome shader, day-to-night keyframes, soft shadows, fog, headlights, lamps.
4. **Game** — rickshaw, steering/boost, chai fuel, cows/trucks/potholes, HUD, touch controls.
5. **Ending** — Madhubani gate, fireworks, win screen with a procedurally drawn painting.
6. **Test, fix, polish** — Playwright suite, autopilot run of the full journey, fps check.
7. **Ship** — README, GitHub Pages workflow.

## Decisions

- **three.js r170, vendored** in `vendor/` and loaded through an import map. No CDN, so the
  game works offline and tests are hermetic.
- **Road coordinates.** Everything on the road lives in `(dist, lat)`: distance along the
  journey and lateral offset from the centre line. World position is
  `(roadX(dist) + lat, roadY(dist), -dist)`. Collisions are simple boxes in that space.
- **Journey length 6000 units**, five regions of 1200. Cruise speed 30 u/s, so a run takes
  about three minutes.
- **Chai is both fuel and health.** It drains with time, faster while boosting, and every
  collision spills some. Empty cup = game over, with a retry from the start of the region.
- **Drive on the left**, as in India. Oncoming trucks use the right lane, slow trucks the left.
- **Time of day is tied to distance, not the clock**: morning in Bangalore, hard noon on the
  Deccan, sunset over the Ganga bridge, dusk in Bihar, lamp-lit night in Madhubani.
- **One shadow-casting directional light** (sun, then moon) with a 2048 PCF-soft map that
  follows the player and snaps to texels. The headlight is a spot light with its own
  shadow map at night. Three pooled point lights hop between the nearest street lamps.
- **Chunk pool.** Ten 60-unit terrain chunks are recycled; each prop type is one
  `InstancedMesh` in which every chunk owns a fixed slot range. Nothing is allocated
  after start-up.
- **Textures are drawn at runtime** on 2D canvases (road surface, truck sign, hut murals,
  village gate). No image or model files exist in the repo.
- **Adaptive quality**: if the frame rate sags, the pixel ratio and then the shadow map
  size step down.
- **Test hooks**: `window.__mithila` exposes state and a few setters; `?auto=1` turns on an
  autopilot, `?speed=N` runs N simulation steps per frame.

## Log
