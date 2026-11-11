# Mithila Express

Drive a small auto-rickshaw from Bangalore to Madhubani: 2100 km of stylized, procedurally
generated road through five regions, from a Karnataka morning to a lamp-lit Mithila night.

A 3D browser game built with three.js. It is a plain static site: `index.html` plus ES
modules, no build step, no image or model files. Every mesh is made of primitives and every
texture is drawn at start-up.

## Play

```bash
npm start            # serves the folder on http://localhost:4173
```

Any static file server works too, for example `python3 -m http.server`. The page must be
served over http(s); ES modules do not load from `file://`.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | `←` `→` or `A` `D` | hold ◀ ▶ |
| Boost | `Space` | hold BOOST |
| Faster / brake | `↑` `↓` or `W` `S` | |
| Pause, sound, horn | `P`, `M`, `H` | on-screen buttons |

Chai is your fuel. It drains as you drive (faster while boosting), every cup you collect
refills it, and every cow, truck or pothole you hit spills some. Run dry and the trip ends;
you can retry from the start of the region you reached. Arrive in Madhubani and a
Madhubani-style painting of the journey is drawn for you, different on every run.

## The journey

| Region | Time of day | Look |
| --- | --- | --- |
| Karnataka Plains | morning | red earth, coconut palms, Bangalore towers behind you |
| Deccan Plateau | hard noon | ochre hills, mesas, acacias, a winding road |
| Ganga Plains | golden hour to sunset | green banks and the long bridge over the river |
| Bihar Farmland | dusk | mustard and paddy fields, haystacks, street lamps, fireflies |
| Madhubani Village | night | painted huts, diyas, lantern strings, the village gate |

Lighting is the point of the game: one sun/moon light with soft shadows that follows the
rickshaw, distance fog matched to the sky, a sunset with a stylized slatted sun, a headlight
that casts its own shadows at night, and street lamps that throw real pools of light.

## Tests

```bash
npm install
npx playwright install chromium   # first time only
npm test
```

The Playwright suite (`tests/game.spec.js`) loads the real page in headless Chromium, drives
it with real keyboard and touch events, and fails on any console error, page error or failed
request. It covers steering, boost, the HUD, chai pickups, each hazard, game over and retry,
pause, the day-to-night cycle, the win screen and its painting, phone touch controls, a
draw-call budget, and one run where an autopilot drives the whole journey.

Headless Chromium renders WebGL in software, so frame rate in the tests means nothing. To
measure it on your own GPU:

```bash
npm start            # in one terminal
npm run fps          # in another: opens a window and samples each region
```

Measured on an Apple M1 at 1280×720 with a device pixel ratio of 2: 60 fps (the display's
refresh rate) in all five regions at full quality, about 90 draw calls and 120k triangles
per frame. If a device cannot hold 50 fps, the game steps its pixel ratio and shadow
resolution down by itself.

Useful URL switches: `?auto=1` lets the autopilot drive, `?speed=5` runs the simulation five
times faster, `?q=0`..`?q=4` pins the quality level (0 is best).

## How it is put together

```
index.html          page shell, HUD and overlays
css/style.css
js/main.js          game state, fixed-step simulation, camera, quality governor
js/config.js        tunables and the five regions
js/road.js          the road curve and terrain height as pure functions
js/world.js         pooled terrain chunks, instanced scenery, river, gate
js/entities.js      chai, cows, potholes, trucks: spawning and collisions
js/sky.js           sky dome shader, sun and moon, fog, day-to-night keyframes
js/rickshaw.js      the player model and its headlight
js/geo.js           every model, built from primitives and merged
js/textures.js      canvas-drawn textures
js/madhubani.js     Madhubani motifs and the win-screen painting
js/particles.js     sparks, fireflies, fireworks
js/input.js, audio.js, hud.js
vendor/             three.js r170 (MIT), loaded through an import map
tools/              static server, fps probe, screenshot helper
```

The road is a function of distance, so everything on it lives in `(distance, lateral)`
coordinates and collisions are simple box tests. Ten terrain chunks are recycled as you
drive, and each kind of prop is one `InstancedMesh`, so nothing is allocated after start-up.
`notes.md` has the plan and the design decisions.

## Deploy to GitHub Pages

The repository already contains a workflow, `.github/workflows/pages.yml`, that runs the
tests and then publishes the site.

1. Create a repository on GitHub and push:
   ```bash
   git remote add origin git@github.com:<you>/mithila-express.git
   git push -u origin main
   ```
2. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The push starts the workflow. When it finishes, the game is live at
   `https://<you>.github.io/mithila-express/`. Every later push to `main` redeploys.

No Actions? Set **Source** to **Deploy from a branch**, pick `main` and `/ (root)`. That
works as is, because all paths are relative and `.nojekyll` is included.

## Licence

Game code: MIT. three.js is © its authors under the MIT licence (`vendor/THREE-LICENSE`).
