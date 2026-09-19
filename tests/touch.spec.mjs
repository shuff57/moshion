// Scenario: touch input. The engine listened for mouse events only, so on a
// phone every sketch was dead — mouse.x/y stayed at their initial (0, 0) and
// mouse.presses() never fired, no matter where you tapped. A single touch now
// drives the same counters as the left mouse button. Exercises the REAL
// surface (browser runner, real touchscreen events) against the engine. Pass
// condition: every check prints PASS; exit code 0 only if all pass.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// Instrumented sketch: counts the edge-triggered readers a real game uses, and
// records where the cursor was ON the frame the press was seen — that ordering
// is the whole difference between a tap that aims and a tap that does not.
const SKETCH = `
let presses, releases, pressingFrames, xAtPress, yAtPress, seenActive, lastX, lastY;

function setup() {
  new Canvas(300, 200);
  world.gravity.y = 0;
  presses = 0;
  releases = 0;
  pressingFrames = 0;
  xAtPress = -1;
  yAtPress = -1;
  seenActive = false;
  lastX = -1;
  lastY = -1;
}

function update() {
  if (mouse.presses()) { presses++; xAtPress = mouse.x; yAtPress = mouse.y; }
  if (mouse.released()) releases++;
  if (mouse.pressing()) pressingFrames++;
  if (mouse.isActive) seenActive = true;
  lastX = mouse.x;
  lastY = mouse.y;
}

function draw() { background("#111"); }
`;

// Synthetic TouchEvent dispatch, for the gestures Playwright's touchscreen
// cannot express (hold, drag, cancel, a second finger). T1 below uses the real
// touchscreen instead, so the genuine browser event path is covered too.
const TOUCH_FN = `(type, points) => {
  const canvas = document.querySelector('canvas');
  const r = canvas.getBoundingClientRect();
  const sx = r.width / canvas.width, sy = r.height / canvas.height;
  const mk = (p) => new Touch({
    identifier: p.id, target: canvas,
    clientX: r.left + p.x * sx, clientY: r.top + p.y * sy,
  });
  const touches = (points.remaining || []).map(mk);
  const changed = (points.changed || []).map(mk);
  canvas.dispatchEvent(new TouchEvent(type, {
    touches, targetTouches: touches, changedTouches: changed,
    bubbles: true, cancelable: true,
  }));
}`;

// points: { changed: [{id, x, y}], remaining: [...] } in sketch coordinates.
const touch = (frame, type, points) =>
  frame.evaluate(([fn, t, p]) => eval(fn)(t, p), [TOUCH_FN, type, points]);

const state = (frame) => frame.evaluate(() => ({
  presses, releases, pressingFrames, seenActive,
  xAtPress: +xAtPress.toFixed(1), yAtPress: +yAtPress.toFixed(1),
  x: +lastX.toFixed(1), y: +lastY.toFixed(1),
}));

const srv = await serve(8188);
const browser = await launch();

// ---------------------------------------------------------------------------
// T1: a real touchscreen tap presses exactly once, and aims where it landed.
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, SKETCH);
  await waitFrames(frame, 20);

  const before = await state(frame);
  check('T1a an untouched sketch has seen no pointer at all',
    before.seenActive === false && before.presses === 0, JSON.stringify(before));

  // Translate a sketch coordinate into a page coordinate for the real
  // touchscreen: iframe offset + the canvas's own offset inside it, through
  // whatever scale the canvas is being displayed at.
  const el = await frame.frameElement();
  const box = await el.boundingBox();
  const inner = await frame.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, sx: r.width / c.width, sy: r.height / c.height };
  });
  const target = { x: 210, y: 140 };
  await page.touchscreen.tap(
    box.x + inner.left + target.x * inner.sx,
    box.y + inner.top + target.y * inner.sy,
  );
  await waitFrames(frame, 20);
  const tapped = await state(frame);

  check('T1b a tap fires mouse.presses() exactly once', tapped.presses === 1,
    JSON.stringify({ presses: tapped.presses, releases: tapped.releases }));
  // On a real device the browser replays an unhandled touch as synthetic
  // mousedown/mouseup ~300ms later, pressing everything twice, and scrolls the
  // page under the sketch. preventDefault() in the touchstart handler is what
  // stops both. Playwright's touchscreen never emits that replay, so the
  // downstream behaviour is not reproducible here — assert the MECHANISM
  // instead: dispatchEvent() returns false exactly when a handler cancelled
  // the event. (Verified by mutation: deleting the preventDefault() calls
  // turns this red, while a presses()-counting check stayed green.)
  const cancelled = await frame.evaluate(([fn]) => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const mk = (type) => {
      const t = new Touch({ identifier: 9, target: canvas, clientX: r.left + 5, clientY: r.top + 5 });
      return !canvas.dispatchEvent(new TouchEvent(type, {
        touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    const out = { touchstart: mk('touchstart'), touchmove: mk('touchmove') };
    window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [], bubbles: true }));
    return out;
  }, [TOUCH_FN]);
  check('T1c touchstart and touchmove are default-prevented (no scroll, no mouse replay)',
    cancelled.touchstart === true && cancelled.touchmove === true, JSON.stringify(cancelled));
  check('T1d the tap marks the pointer active', tapped.seenActive === true,
    String(tapped.seenActive));
  // The ordering requirement: position is set inside touchstart BEFORE the
  // press counter, so a sketch that aims on presses() reads the tap, not (0,0).
  check('T1e mouse.x/y are the tap point ON the frame the press is seen',
    Math.abs(tapped.xAtPress - target.x) < 3 && Math.abs(tapped.yAtPress - target.y) < 3,
    JSON.stringify({ tappedAt: target, readAtPress: { x: tapped.xAtPress, y: tapped.yAtPress } }));

  check('T1f zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/touch-verified.png', fullPage: true });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// T2: hold, drag, release — the web-swinger gesture.
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, SKETCH);
  await waitFrames(frame, 20);

  await touch(frame, 'touchstart', { changed: [{ id: 1, x: 60, y: 40 }], remaining: [{ id: 1, x: 60, y: 40 }] });
  await waitFrames(frame, 12);
  const held = await state(frame);
  check('T2a a held finger keeps mouse.pressing() true across frames',
    held.pressingFrames >= 5, 'pressingFrames=' + held.pressingFrames);
  check('T2b the press is reported at the touch point',
    Math.abs(held.xAtPress - 60) < 2 && Math.abs(held.yAtPress - 40) < 2,
    JSON.stringify({ x: held.xAtPress, y: held.yAtPress }));

  await touch(frame, 'touchmove', { changed: [{ id: 1, x: 240, y: 160 }], remaining: [{ id: 1, x: 240, y: 160 }] });
  await waitFrames(frame, 6);
  const moved = await state(frame);
  check('T2c dragging the finger moves mouse.x/y',
    Math.abs(moved.x - 240) < 2 && Math.abs(moved.y - 160) < 2,
    JSON.stringify({ x: moved.x, y: moved.y }));

  await touch(frame, 'touchend', { changed: [{ id: 1, x: 240, y: 160 }], remaining: [] });
  await waitFrames(frame, 6);
  const let_go = await state(frame);
  check('T2d lifting fires mouse.released() once', let_go.releases === 1,
    'releases=' + let_go.releases);
  const settled = await state(frame);
  check('T2e the press does not stick after release',
    settled.pressingFrames === let_go.pressingFrames,
    JSON.stringify({ atRelease: let_go.pressingFrames, after: settled.pressingFrames }));

  check('T2f zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// T3: the two ways a gesture ends badly — the OS taking it away, and a second
// finger lifting while the first is still down.
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, hasTouch: true });
  const page = await ctx.newPage();
  const frame = await runSketch(page, srv.base, SKETCH);
  await waitFrames(frame, 20);

  // touchcancel: a call comes in, or the gesture becomes a system swipe.
  await touch(frame, 'touchstart', { changed: [{ id: 1, x: 100, y: 100 }], remaining: [{ id: 1, x: 100, y: 100 }] });
  await waitFrames(frame, 6);
  await touch(frame, 'touchcancel', { changed: [{ id: 1, x: 100, y: 100 }], remaining: [] });
  await waitFrames(frame, 8);
  const cancelled = await state(frame);
  const afterCancel = await state(frame);
  check('T3a touchcancel ends the press instead of leaving it stuck down',
    cancelled.releases === 1 && afterCancel.pressingFrames === cancelled.pressingFrames,
    JSON.stringify({ releases: cancelled.releases, frozen: afterCancel.pressingFrames === cancelled.pressingFrames }));

  // Two fingers down, one lifts: the gesture is still going.
  await touch(frame, 'touchstart', { changed: [{ id: 1, x: 80, y: 80 }], remaining: [{ id: 1, x: 80, y: 80 }] });
  await touch(frame, 'touchstart', { changed: [{ id: 2, x: 200, y: 120 }], remaining: [{ id: 1, x: 80, y: 80 }, { id: 2, x: 200, y: 120 }] });
  await waitFrames(frame, 6);
  const twoDown = await state(frame);
  await touch(frame, 'touchend', { changed: [{ id: 2, x: 200, y: 120 }], remaining: [{ id: 1, x: 80, y: 80 }] });
  await waitFrames(frame, 8);
  const oneLeft = await state(frame);
  check('T3b one finger lifting while another is down does not end the press',
    oneLeft.releases === twoDown.releases && oneLeft.pressingFrames > twoDown.pressingFrames,
    JSON.stringify({ releasesBefore: twoDown.releases, releasesAfter: oneLeft.releases,
      stillPressing: oneLeft.pressingFrames > twoDown.pressingFrames }));

  await touch(frame, 'touchend', { changed: [{ id: 1, x: 80, y: 80 }], remaining: [] });
  await waitFrames(frame, 8);
  const allUp = await state(frame);
  check('T3c lifting the last finger does end the press',
    allUp.releases === twoDown.releases + 1, JSON.stringify({ releases: allUp.releases }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// T4: a scaled canvas. runner.html shrinks a sketch to fit a narrow frame, and
// a phone is exactly where that happens — so touch has to divide by the
// displayed scale the same way the mouse does, or every tap lands short.
{
  const small = 'function setup(){ new Canvas(300,200); tx=-1; ty=-1; }'
    + ' function update(){ if (mouse.presses()) { tx = mouse.x; ty = mouse.y; } }'
    + ' function draw(){ background("#111"); }';
  const code = Buffer.from(small, 'utf8').toString('base64url');
  const ctx = await browser.newContext({ viewport: { width: 500, height: 500 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(srv.base + '/runner.html', { waitUntil: 'load' });
  await page.setContent(
    `<!doctype html><iframe id="f" style="width:150px;height:100px;border:0"
       sandbox="allow-scripts allow-downloads" src="${srv.base}/runner.html?code=${code}"></iframe>`,
    { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  const f = page.frames().find((fr) => fr !== page.mainFrame() && fr.url().includes('runner.html'));

  const scale = f && await f.evaluate(() => {
    const c = document.querySelector('canvas');
    return +(c.getBoundingClientRect().width / c.width).toFixed(3);
  });
  const aim = { x: 240, y: 150 };
  if (f) {
    await f.evaluate(([fn, t, p]) => eval(fn)(t, p), [TOUCH_FN, 'touchstart', { changed: [{ id: 1, ...aim }], remaining: [{ id: 1, ...aim }] }]);
    await page.waitForTimeout(250);
  }
  const read = f && await f.evaluate(() => ({ x: +tx.toFixed(1), y: +ty.toFixed(1) }));
  check('T4a the canvas really is scaled down in a 150px frame', !!scale && scale < 0.6,
    'scale ' + scale);
  check('T4b a tap on the scaled canvas maps back to sketch coordinates',
    !!read && Math.abs(read.x - aim.x) < 3 && Math.abs(read.y - aim.y) < 3,
    JSON.stringify({ tappedAt: aim, sketchRead: read, scale }));
  await ctx.close();
}

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
