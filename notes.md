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

- **Milestone 1, playable scaffold.** Road, chunks, props, sky cycle, rickshaw, hazards, HUD,
  touch controls and the win painting all landed together and loaded without errors.
  First tuning pass from screenshots: brighter daytime sun and hemisphere light, lighter
  asphalt, thinner clouds, less dark overlays.
- **Milestone 2, tests and performance.** 16 Playwright tests. Two failures on the way were
  bugs in the tests, not the game (a steering assertion measured from the road edge, and a
  progress-bar read that raced the next frame).
- **Hitches found with the profiler.** Frames of 200 to 300 ms showed up the first time the
  gate and other late objects were drawn. Cause: shaders and textures for frustum-culled
  objects were compiled on first sight. Fix: one warm-up frame at load with culling off.
  After it, the only frames over 34 ms are one at the moment Start is pressed (the DOM
  overlay swap, outside the game loop) and one when the win painting begins.
- **Blink without recompiles.** The invulnerability blink hides meshes only. Hiding the
  whole rickshaw group would hide its spot light, change the light count and recompile
  every lit shader.
- **Balance.** Tuned against the autopilot, which finishes with no retries and 15 to 20
  bumps. Chai was too plentiful at first (164 cups in a run); cup rows went from 62% to
  50% and a cup from 10 to 9 fuel.
- **Milestone 3, polish.** Arrival camera parks past the gate and looks back at the
  rickshaw under the fireworks; gate sign on both faces; truck tail lights glow at night;
  touch-specific instructions; portrait menu; reduced-motion support.

## Measurements

Apple M1, Chromium, 1280×720 at device pixel ratio 2, full quality (`npm run fps`):
60 fps in every region (capped by the display), 90 to 97 draw calls, about 121k triangles.
Worst CPU time per frame: simulation 2 ms, presentation under 1 ms, render submit under 10 ms.

## Known limits

- Frame rate was measured on one laptop. Phones were only checked for layout and touch
  input in emulation; the adaptive quality steps are the safety net there.
- No human has playtested a full run. Difficulty is tuned by autopilot results and by eye.
- Sound is a few synthesized tones, nothing more.
- The road never forks and there is no traffic AI: trucks hold their lane and speed.
