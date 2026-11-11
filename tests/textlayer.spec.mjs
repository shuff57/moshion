// Scenario: textLayer(n) -- text() among the sprites (shCode #101). Text
// drawn in draw() used to sit under every sprite and drawTop() over all of
// them; textLayer(n) slots it in by layer. The sketch spies on its own
// canvas's fillText/fillRect, so the checks read the real paint ORDER of one
// frame (and the transform each text was painted with) instead of guessing
// from pixels under a glyph. Pass condition: every check prints PASS; exit
// code 0 only if all pass.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// Records every fillText / fillRect as [kind, fillStyle, transform e, f].
// `lastOps` is the previous frame's whole list, swapped at the top of draw().
const SPY = `
function spy() {
  const ctx = document.querySelector('canvas').getContext('2d');
  ops = []; lastOps = [];
  for (const name of ['fillText', 'fillRect']) {
    const real = ctx[name].bind(ctx);
    ctx[name] = (...a) => {
      const m = ctx.getTransform();
      ops.push([name === 'fillText' ? 'text:' + a[0] : 'rect', String(ctx.fillStyle), m.e, m.f]);
      return real(...a);
    };
  }
}
`;

const ORDER = SPY + `
function setup() {
  new Canvas(200, 200);
  world.gravity.y = 0;
  hi = new Sprite(100, 100, 50, 50, 'static'); hi.color = '#ff00ff'; hi.layer = 10;
  lo = new Sprite(100, 100, 80, 80, 'static'); lo.color = '#0000ff';
  spy();
}
function draw() {
  lastOps = ops; ops = [];
  background('#000000');
  fill('#ff0000'); text('a', 10, 20);
  textLayer(5);  fill('#00ff00'); text('b', 10, 40);
  textLayer(10); fill('#ffff00'); text('c', 10, 60);
  textLayer();   fill('#ffffff'); text('d', 10, 80);
}
function drawTop() {
  textLayer(-5); fill('#00ffff'); text('top', 10, 100);
  textLayer();
}
`;

// The camera is 5000 px away. A text written with camera.off() must be
// painted in screen space even though render() paints it later, with the
// camera back on.
const CAMERA = SPY + `
function setup() {
  new Canvas(200, 200);
  camera.x = 5000; camera.y = 5000;
  s = new Sprite(5000, 5000, 40, 40, 'static');
  spy();
}
function draw() {
  lastOps = ops; ops = [];
  background('#000000');
  textLayer(1);
  text('world', 5000, 5000);
  camera.off(); text('screen', 10, 20); camera.on();
}
`;

const BAD = `
function setup() {
  new Canvas(100, 100);
  try { textLayer('top'); badMessage = 'no error'; } catch (e) { badMessage = e.name + ': ' + e.message; }
  textLayer(3); textLayer(null); // null is allowed: back to the old way
}
function draw() { background('#000000'); text('ok', 10, 20); }
`;

const srv = await serve(8191);
const browser = await launch();

async function run(code, frames = 15) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, code);
  await waitFrames(frame, frames);
  return { page, frame, errors };
}

// ---------------------------------------------------------------------------
// L1: the order of one frame.
{
  const { page, frame, errors } = await run(ORDER);
  const ops = await frame.evaluate(() => lastOps.map((o) => o[0] + ' ' + o[1]));
  // background first, then the two texts written without a layer (at once),
  // then the world by layer with the queued texts slotted in, then drawTop.
  const want = [
    'rect #000000',
    'text:a #ff0000',
    'text:d #ffffff',
    'rect #0000ff',  // lo, layer 0
    'text:b #00ff00', // layer 5: over lo, under hi
    'rect #ff00ff',  // hi, layer 10
    'text:c #ffff00', // layer 10: a tie goes to the text
    'text:top #00ffff', // drawTop paints at once, whatever textLayer says
  ];
  check('L1a text without a layer is painted at once, under every sprite', ops.indexOf('text:a #ff0000') < ops.indexOf('rect #0000ff') && ops.indexOf('text:d #ffffff') < ops.indexOf('rect #0000ff'), ops);
  check('L1b textLayer(5) lands over a layer-0 sprite and under a layer-10 one', ops.indexOf('rect #0000ff') < ops.indexOf('text:b #00ff00') && ops.indexOf('text:b #00ff00') < ops.indexOf('rect #ff00ff'), ops);
  check('L1c textLayer(10) ties with a layer-10 sprite and goes over it', ops.indexOf('rect #ff00ff') < ops.indexOf('text:c #ffff00'), ops);
  check('L1d textLayer() in drawTop() still paints at once, over everything', ops[ops.length - 1] === 'text:top #00ffff', ops);
  check('L1e the whole frame, in order', JSON.stringify(ops) === JSON.stringify(want), ops);
  check('L1f the colour is the one set when text() was called, not when it was painted', ops.includes('text:b #00ff00') && ops.includes('text:c #ffff00'), ops);
  check('L1g zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0, JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.close();
}

// ---------------------------------------------------------------------------
// L2: camera on or off is remembered from the moment text() was called.
{
  const { page, frame } = await run(CAMERA);
  const ops = await frame.evaluate(() => lastOps);
  const world = ops.find((o) => o[0] === 'text:world');
  const screen = ops.find((o) => o[0] === 'text:screen');
  check('L2a a camera-on text is painted through the camera (shifted by it)', world && world[2] < -4000 && world[3] < -4000, world);
  check('L2b a camera.off() text is painted in screen space', screen && screen[2] === 0 && screen[3] === 0, screen);
  check('L2c both come after the sprite (layer 1 over layer 0)', ops.findIndex((o) => o[0] === 'rect' && o[1] !== '#000000') < ops.findIndex((o) => o[0] === 'text:world'), ops);
  await page.close();
}

// ---------------------------------------------------------------------------
// L3: a wrong value says so in plain words; null resets.
{
  const { page, frame, errors } = await run(BAD, 10);
  const msg = await frame.evaluate(() => badMessage);
  check('L3a textLayer(\'top\') throws a TypeError naming textLayer(n)', /^TypeError: textLayer\(n\): n must be a number/.test(msg), msg);
  check('L3b textLayer(null) is allowed and the sketch runs', errors.length === 0 && (await frameErrors(page)).length === 0, JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.close();
}

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
