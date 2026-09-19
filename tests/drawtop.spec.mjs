// Scenario: drawTop() — the HUD lifecycle hook. render() paints sprites AFTER
// the sketch's draw(), so a HUD built out of primitives in draw() is buried by
// the world (portal's wall ate the first two letters of its timer). drawTop()
// runs after the world is on the canvas, in screen space. Exercises the REAL
// surface (browser runner) against the engine. Pass condition: every check
// prints PASS; exit code 0 only if all pass.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// A sprite big enough to cover the whole canvas, so "is the HUD on top?" is a
// single pixel read rather than a question about layer ordering.
// GREEN is drawn in draw() (expected buried), RED in drawTop() (expected on
// top), both over the same blue block.
const SKETCH = `
function setup() {
  new Canvas(200, 200);
  world.gravity.y = 0;
  block = new Sprite(100, 100, 200, 200, "static");
  block.color = "#0000ff";
  drawCalls = 0;
  topCalls = 0;
  camActiveInTop = null;
  camActiveAfterTop = null;
}
function draw() {
  background("#000000");
  drawCalls++;
  noStroke();
  fill("#00ff00");
  rect(20, 20, 40, 40);
  camActiveAfterTop = camera.isActive;
}
function drawTop() {
  topCalls++;
  camActiveInTop = camera.isActive;
  noStroke();
  fill("#ff0000");
  rect(120, 20, 40, 40);
}
`;

// Same sketch with the camera scrolled far away: a screen-space HUD must
// ignore that, a world-space one would be dragged off-canvas with it.
const SCROLLED = `
function setup() {
  new Canvas(200, 200);
  world.gravity.y = 0;
  camera.x = 5000;
  camera.y = 5000;
  topCalls = 0;
}
function draw() {
  background("#000000");
}
function drawTop() {
  topCalls++;
  noStroke();
  fill("#ff0000");
  rect(10, 10, 30, 30);
}
`;

// No drawTop at all — the hook is optional and its absence must be a no-op.
const NO_HOOK = `
function setup() {
  new Canvas(200, 200);
  ball = new Sprite(100, 60, 30);
  ball.color = "#5baafd";
  frames = 0;
}
function draw() {
  background("#1e1f29");
  frames++;
}
`;

// A sketch that leaves the camera off on purpose: drawTop must hand it back
// exactly as it found it, not force it on.
const CAMERA_OFF = `
function setup() {
  new Canvas(200, 200);
  camera.off();
  seenInTop = null;
}
function draw() {
  background("#000000");
  seenInTop = camera.isActive;
}
function drawTop() {}
`;

// Reads one pixel out of the runner's canvas. rgb only — alpha is always 255
// on an opaque 2d context and just adds noise to the failure message.
function pixel(frame, x, y) {
  return frame.evaluate(([px, py]) => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(px, py, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }, [x, y]);
}

const near = (p, r, g, b) => p && Math.abs(p.r - r) < 30 && Math.abs(p.g - g) < 30 && Math.abs(p.b - b) < 30;

const srv = await serve(8187);
const browser = await launch();

// ---------------------------------------------------------------------------
// D1: the hook runs, and what it draws lands ON TOP of the world.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, SKETCH);
  await waitFrames(frame, 30);

  const calls = await frame.evaluate(() => ({ draw: drawCalls, top: topCalls }));
  check('D1a drawTop() is called once per frame, same as draw()',
    calls.top > 10 && Math.abs(calls.top - calls.draw) <= 1, JSON.stringify(calls));

  const hud = await pixel(frame, 140, 40);   // inside the drawTop rect
  const buried = await pixel(frame, 40, 40); // inside the draw() rect
  check('D1b what drawTop() draws is ON TOP of the sprite (pixel is red)',
    near(hud, 255, 0, 0), JSON.stringify(hud));
  // The other half of the same frame: this is the bug drawTop exists to fix,
  // pinned so the ordering can't quietly flip back.
  check('D1c what draw() draws is still UNDER the sprite (pixel is blue)',
    near(buried, 0, 0, 255), JSON.stringify(buried));

  check('D1d the camera is off inside drawTop()',
    (await frame.evaluate(() => camActiveInTop)) === false,
    String(await frame.evaluate(() => camActiveInTop)));
  check('D1e the camera is back on for the next draw()',
    (await frame.evaluate(() => camActiveAfterTop)) === true,
    String(await frame.evaluate(() => camActiveAfterTop)));

  check('D1f zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/drawtop-verified.png', fullPage: true });
  await page.close();
}

// ---------------------------------------------------------------------------
// D2: screen space — a scrolled camera does not move the HUD.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const frame = await runSketch(page, srv.base, SCROLLED);
  await waitFrames(frame, 20);

  const at = await pixel(frame, 25, 25);
  const ran = await frame.evaluate(() => topCalls);
  check('D2 a HUD at (10,10) lands at (10,10) with the camera 5000px away',
    ran > 5 && near(at, 255, 0, 0), JSON.stringify({ topCalls: ran, pixel: at }));
  await page.close();
}

// ---------------------------------------------------------------------------
// D3: the hook is optional, and it does not seize the camera from a sketch
// that turned it off itself.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, NO_HOOK);
  await waitFrames(frame, 30);
  const frames = await frame.evaluate(() => frames);
  check('D3a a sketch with no drawTop() runs normally',
    frames > 10 && errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ frames, page: errors, runner: await frameErrors(page) }));
  await page.close();

  const page2 = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const frame2 = await runSketch(page2, srv.base, CAMERA_OFF);
  await waitFrames(frame2, 20);
  check('D3b a sketch that called camera.off() still sees it off after drawTop()',
    (await frame2.evaluate(() => seenInTop)) === false,
    String(await frame2.evaluate(() => seenInTop)));
  await page2.close();
}

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
