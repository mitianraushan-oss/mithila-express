// Dev helper: load the game at a given distance and save a screenshot.
// Usage: node tools/shot.mjs <outDir> <dist> [dist...]   (expects the server on :4173)
import { chromium } from '@playwright/test';
const [outDir, ...dists] = process.argv.slice(2);
const gpu = process.env.GPU === '1';
const browser = await chromium.launch({ headless: !gpu, args: gpu ? ['--use-angle=metal'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const [vw, vh] = (process.env.VIEW || '1280x720').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh }, hasTouch: vw < 900, isMobile: vw < 900 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4173/?q=1');
await page.waitForFunction(() => window.__mithila);
if (dists[0] === 'menu') { await page.waitForTimeout(1500); await page.screenshot({ path: `${outDir}/menu.png` }); dists.shift(); }
await page.evaluate(() => window.__mithila.start());
for (const d of dists) {
  if (d === 'win') {
    await page.evaluate(() => { const m = window.__mithila; m.setDist(m.TOTAL - 40); m.setFuel(100); m.player.speed = 30; });
    await page.waitForTimeout(4500); await page.screenshot({ path: `${outDir}/arrive.png` });
    await page.waitForFunction(() => document.getElementById('painting').dataset.done === '1', null, { timeout: 60000 });
    await page.screenshot({ path: `${outDir}/win.png` });
    continue;
  }
  await page.evaluate((d) => { const m = window.__mithila; m.setDist(+d); m.setFuel(100); m.player.speed = 30; m.player.inv = 0; }, d);
  await page.waitForTimeout(Number(process.env.WAIT || 1800));
  await page.screenshot({ path: `${outDir}/d${d}.png` });
  console.log('shot', d, await page.evaluate(() => { const m = window.__mithila; return JSON.stringify({ state: m.state, dist: Math.round(m.player.dist), fps: Math.round(m.fps), calls: m.drawCalls, tris: m.triangles, q: m.quality }); }));
}
await browser.close();
