// Measures real frame rate on this machine's GPU by flying the autopilot through
// each region in a headed Chromium window. Expects the server on :4173.
// Usage: npm start (in another terminal), then npm run fps
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(process.env.DPR || 2) });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/?auto=1' + (process.env.Q ? '&q=' + process.env.Q : ''));
await page.waitForFunction(() => window.__mithila);
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('GPU:', gpu);
await page.evaluate(() => window.__mithila.start());

for (const d of [200, 1500, 2950, 3900, 5300]) {
  await page.evaluate((d) => { const m = window.__mithila; m.setDist(d); m.setFuel(100); }, d);
  await page.waitForTimeout(800);
  // sample frame times directly with requestAnimationFrame for 5 seconds
  const r = await page.evaluate(() => new Promise((resolve) => {
    const times = []; let last = performance.now(); const t0 = last;
    function tick(now) {
      times.push(now - last); last = now;
      if (now - t0 < 5000) requestAnimationFrame(tick);
      else {
        times.shift(); times.sort((a, b) => a - b);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const m = window.__mithila;
        m.setFuel(100);
        resolve({ region: m.region, fps: +(1000 / avg).toFixed(1), p99ms: +times[Math.floor(times.length * 0.99)].toFixed(1), worstMs: +times[times.length - 1].toFixed(1), quality: m.quality, calls: m.drawCalls, tris: m.triangles });
      }
    }
    requestAnimationFrame(tick);
  }));
  console.log(JSON.stringify(r));
}
const prof = await page.evaluate(() => window.__mithila.prof);
console.log(`worst CPU ms per frame: simulate ${prof.sim.toFixed(1)}, present ${prof.present.toFixed(1)}, render ${prof.render.toFixed(1)}`);
console.log('frames over 34 ms:', prof.long.length ? JSON.stringify(prof.long) : 'none');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
