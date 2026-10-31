// Benchmark, not a spec: how much engine work a frame costs with N static
// tiles on screen (a tile map) plus ten dynamic balls landing on them.
//
// It is not part of the PASS/FAIL suite because the numbers depend on the
// machine. Run it before and after touching _updateOverlaps() or render():
//
//   bun tests/tiles-perf.bench.mjs            # 300 600 1200 2400
//   bun tests/tiles-perf.bench.mjs 600 1200   # just these sizes
//
// "work ms" is measured inside the sketch, from the start of update() to the
// end of drawTop(): the user hooks, the physics step, contact and overlap
// tracking, and render(). It is what a slow machine feels as dropped frames.
// "fps" is what headless Chromium delivered (capped near 60 by rAF).
import { launch, serve, runSketch } from './harness.mjs';

const sizes = process.argv.slice(2).map(Number).filter((n) => n > 0);
const SIZES = sizes.length ? sizes : [300, 600, 1200, 2400];

const sketch = (n) => `
let t0 = 0, acc = 0, worst = 0, n = 0, f0 = 0, s0 = 0;
function setup() {
  new Canvas(800, 600);
  world.gravity.y = 10;
  for (let i = 0; i < ${n}; i++) {
    // 40 columns of 20px tiles; past 1200 the rows run on below the canvas.
    const t = new Sprite(10 + (i % 40) * 20, 110 + Math.floor(i / 40) * 20, 20, 20, 'static');
    t.color = i % 2 ? '#445' : '#556';
  }
  for (let i = 0; i < 10; i++) {
    const b = new Sprite(60 + i * 70, 20, 16);
    b.bounciness = 0.4;
  }
}
function update() { t0 = performance.now(); }
function drawTop() {
  if (frameCount === 30) { f0 = frameCount; s0 = performance.now(); }
  if (frameCount > 30) {
    const d = performance.now() - t0;
    acc += d; n++; if (d > worst) worst = d;
  }
}
`;

const srv = await serve(8193);
const browser = await launch();
console.log('sprites  work-ms/frame  worst-ms  fps');
for (const n of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const frame = await runSketch(page, srv.base, sketch(n));
  await frame.waitForTimeout(5000);
  const r = await frame.evaluate(() => ({
    avg: n ? acc / n : NaN, worst, frames: n,
    fps: n ? (frameCount - f0) / ((performance.now() - s0) / 1000) : 0,
  }));
  console.log(
    String(n + 10).padEnd(9),
    (r.frames ? r.avg.toFixed(2) : 'n/a').padEnd(15),
    (r.frames ? r.worst.toFixed(1) : 'n/a').padEnd(9),
    r.frames ? r.fps.toFixed(1) : '0 (never got past frame 30)',
  );
  await ctx.close();
}
await browser.close();
srv.close();
