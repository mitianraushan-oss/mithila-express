// End-to-end tests. Each one loads the real page in headless Chromium (software WebGL),
// drives it with real input events, and fails on any console error or page error.
import { test, expect } from '@playwright/test';

const Q = '?q=5';   // test-only minimum quality: the software rasteriser is slow

async function open(page, query = Q) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
  await page.goto('/' + query);
  await page.waitForFunction(() => window.__mithila && window.__mithila.state === 'menu');
  return errors;
}

const game = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => page.evaluate(() => window.__mithila.state);
const player = (page) => page.evaluate(() => ({ ...window.__mithila.player }));

async function start(page) {
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page)).toBe('play');
}

// An empty stretch of road, so a test only meets what it places there.
async function sandbox(page, dist = 400) {
  await game(page, (d) => { const m = window.__mithila; m.clearRoad(); m.setDist(d); m.setFuel(60); m.player.lat = -2.6; m.player.inv = 0; }, dist);
}

test('loads cleanly and shows the title screen', async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveTitle('Mithila Express');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Mithila Express');
  await expect(page.locator('#hud')).toBeHidden();
  const box = await page.locator('#game').boundingBox();
  expect(box.width).toBe(1280);
  expect(await game(page, () => window.__mithila.drawCalls)).toBeGreaterThan(10);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('Enter starts the run; arrow keys and WASD steer', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  await sandbox(page);

  const lat0 = (await player(page)).lat;
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await player(page)).lat).toBeGreaterThan(lat0 + 1.5);
  await page.keyboard.up('ArrowRight');

  const lat1 = (await player(page)).lat;
  await page.keyboard.down('KeyA');
  await expect.poll(async () => (await player(page)).lat).toBeLessThan(lat1 - 1.5);
  await page.keyboard.up('KeyA');

  const lat2 = (await player(page)).lat;
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await player(page)).lat).toBeGreaterThan(lat2 + 1);
  await page.keyboard.up('KeyD');
  const lat3 = (await player(page)).lat;
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await player(page)).lat).toBeLessThan(lat3 - 0.8);
  await page.keyboard.up('ArrowLeft');

  // the rickshaw is moving forward on its own
  const d0 = (await player(page)).dist;
  await expect.poll(async () => (await player(page)).dist).toBeGreaterThan(d0 + 20);
  expect(errors).toEqual([]);
});

test('Space boosts; up and down change speed', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await sandbox(page);
  await expect.poll(async () => (await player(page)).speed).toBeGreaterThan(29);
  await page.keyboard.down('Space');
  await expect.poll(async () => (await player(page)).speed).toBeGreaterThan(48);
  expect((await player(page)).boost).toBe(true);
  await page.keyboard.up('Space');
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await player(page)).speed).toBeLessThan(16);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await player(page)).speed).toBeGreaterThan(36);
  await page.keyboard.up('KeyW');
  expect(errors).toEqual([]);
});

test('progress bar and region name follow the journey', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await game(page, () => window.__mithila.clearRoad());
  const names = ['Karnataka Plains', 'Deccan Plateau', 'Ganga Plains', 'Bihar Farmland', 'Madhubani Village'];
  for (let i = 0; i < names.length; i++) {
    await game(page, (d) => { window.__mithila.setDist(d); window.__mithila.setFuel(100); }, i * 1200 + 300);
    await expect(page.locator('#region-name')).toHaveText(names[i]);
    const now = async () => Number(await page.locator('#progress').getAttribute('aria-valuenow'));
    await expect.poll(now).toBeGreaterThanOrEqual(Math.floor((i * 1200 + 300) / 60));
    expect(await now()).toBeLessThan((i + 1) * 20 + 1);
    await expect(page.locator('#km-left')).toContainText('km to go');
  }
  // crossing a border announces the new region
  await game(page, () => { window.__mithila.setDist(1180); window.__mithila.player.speed = 30; });
  await expect(page.locator('#banner h2')).toHaveText('Deccan Plateau');
  await expect(page.locator('#banner')).toHaveClass(/show/);
  expect(errors).toEqual([]);
});

test('chai cups refill the meter', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await sandbox(page);
  expect(await game(page, () => window.__mithila.spawn('chai', 30, -2.6))).toBe(true);
  await expect.poll(async () => (await player(page)).chai).toBe(1);
  expect((await player(page)).fuel).toBeGreaterThan(62);
  await expect(page.locator('#chai-count')).toHaveText('1');
  expect(errors).toEqual([]);
});

for (const [type, cost] of [['cow', 14], ['pot', 6], ['truck', 24]]) {
  test(`hitting a ${type} spills chai`, async ({ page }) => {
    const errors = await open(page);
    await start(page);
    await sandbox(page);
    expect(await game(page, (t) => window.__mithila.spawn(t, 35, -2.6), type)).toBe(true);
    await expect.poll(async () => (await player(page)).hits).toBe(1);
    const p = await player(page);
    expect(p.fuel).toBeLessThan(60 - cost + 0.5);
    expect(p.fuel).toBeGreaterThan(60 - cost - 6);
    await expect(page.locator('#toast')).toContainText('chai');
    expect(errors).toEqual([]);
  });
}

test('steering around a cow avoids it', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await sandbox(page);
  await game(page, () => window.__mithila.spawn('cow', 45, -2.6));
  const d0 = (await player(page)).dist;
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await player(page)).lat).toBeGreaterThan(0.5);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await player(page)).dist).toBeGreaterThan(d0 + 70);
  expect((await player(page)).hits).toBe(0);
  expect(errors).toEqual([]);
});

test('an empty cup ends the run, and retry resumes from the region start', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await sandbox(page, 2600);
  await game(page, () => window.__mithila.setFuel(0.3));
  await expect.poll(() => state(page)).toBe('over');
  await expect(page.locator('#over')).toBeVisible();
  await expect(page.locator('#btn-retry')).toHaveText('Retry from Ganga Plains');
  await page.locator('#btn-retry').click();
  await expect.poll(() => state(page)).toBe('play');
  await expect(page.locator('#over')).toBeHidden();
  const p = await player(page);
  expect(p.dist).toBeGreaterThanOrEqual(2400);
  expect(p.dist).toBeLessThan(2600);
  expect(p.fuel).toBeGreaterThan(60);
  expect(errors).toEqual([]);
});

test('P pauses and resumes', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await sandbox(page);
  await page.keyboard.press('KeyP');
  await expect.poll(() => state(page)).toBe('pause');
  await expect(page.locator('#pause')).toBeVisible();
  const d0 = (await player(page)).dist;
  await page.waitForTimeout(600);
  expect((await player(page)).dist).toBe(d0);
  await page.keyboard.press('KeyP');
  await expect.poll(() => state(page)).toBe('play');
  await expect.poll(async () => (await player(page)).dist).toBeGreaterThan(d0);
  expect(errors).toEqual([]);
});

test('day turns to night and the headlight comes on', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await game(page, () => window.__mithila.clearRoad());
  await page.waitForTimeout(300);
  expect(await game(page, () => window.__mithila.night)).toBe(0);
  expect(await game(page, () => window.__mithila.headlight)).toBe(0);
  await game(page, () => { window.__mithila.setDist(3300); window.__mithila.setFuel(100); });
  await expect.poll(() => game(page, () => window.__mithila.night)).toBeGreaterThan(0.1);
  await game(page, () => { window.__mithila.setDist(5200); window.__mithila.setFuel(100); });
  await expect.poll(() => game(page, () => window.__mithila.night)).toBe(1);
  expect(await game(page, () => window.__mithila.headlight)).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('reaching Madhubani shows the win screen and paints the picture', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  await game(page, () => { const m = window.__mithila; m.clearRoad(); m.setDist(m.TOTAL - 60); m.setFuel(100); m.player.speed = 30; });
  await expect.poll(() => state(page)).toBe('win');
  await expect(page.locator('#win')).toBeVisible();
  await expect(page.locator('#win h2')).toHaveText('You reached Madhubani!');
  await expect(page.locator('#win-stats')).toContainText('cups of chai');
  await expect(page.locator('#painting')).toHaveAttribute('data-done', '1');
  // the canvas really was painted: many distinct colours, not a blank sheet
  const colours = await page.evaluate(() => {
    const c = document.getElementById('painting'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
    return seen.size;
  });
  expect(colours).toBeGreaterThan(40);
  // and the game can be played again
  await page.locator('#btn-again').click();
  await expect.poll(() => state(page)).toBe('play');
  expect((await player(page)).dist).toBeLessThan(100);
  expect(errors).toEqual([]);
});

test('the scene stays within its draw-call and triangle budget', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  for (const d of [300, 1800, 3050, 4200, 5600]) {
    await game(page, (d) => { window.__mithila.setDist(d); window.__mithila.setFuel(100); }, d);
    await page.waitForTimeout(700);
    const info = await game(page, () => ({ calls: window.__mithila.drawCalls, tris: window.__mithila.triangles }));
    expect(info.calls, `draw calls at ${d}`).toBeLessThan(140);
    expect(info.tris, `triangles at ${d}`).toBeLessThan(200_000);
  }
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('touch buttons start, steer and boost', async ({ page, context }) => {
    const errors = await open(page);
    await page.locator('#btn-start').tap();
    await expect.poll(() => state(page)).toBe('play');
    await expect(page.locator('#touch')).toBeVisible();
    await sandbox(page);

    const cdp = await context.newCDPSession(page);
    const hold = async (selector, until) => {
      const b = await page.locator(selector).boundingBox();
      const pt = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
      await until();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };

    const lat0 = (await player(page)).lat;
    await hold('[data-touch=right]', () => expect.poll(async () => (await player(page)).lat).toBeGreaterThan(lat0 + 1.5));
    const lat1 = (await player(page)).lat;
    await hold('[data-touch=left]', () => expect.poll(async () => (await player(page)).lat).toBeLessThan(lat1 - 1.5));
    await hold('[data-touch=boost]', () => expect.poll(async () => (await player(page)).speed).toBeGreaterThan(44));
    // releasing the button really releases it
    await expect.poll(async () => (await player(page)).boost).toBe(false);
    expect(errors).toEqual([]);
  });
});

test('autopilot drives the whole journey from Bangalore to Madhubani', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await open(page, '?auto=1&speed=10&q=5');
  await start(page);
  const seen = new Set();
  let retries = 0;
  await expect.poll(async () => {
    seen.add(await game(page, () => window.__mithila.region));
    const s = await state(page);
    if (s === 'over') { retries++; await page.locator('#btn-retry').click(); }
    return s;
  }, { timeout: 570_000, intervals: [500] }).toBe('win');
  expect([...seen].sort()).toEqual(['Bihar Farmland', 'Deccan Plateau', 'Ganga Plains', 'Karnataka Plains', 'Madhubani Village']);
  const p = await player(page);
  console.log(`autopilot: time ${Math.round(p.clock)}s, ${p.chai} chai, ${p.hits} hits, ${retries} retries`);
  expect(retries).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
