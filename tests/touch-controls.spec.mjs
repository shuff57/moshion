// Scenario: the games' own on-screen touch controls. The engine maps a single
// touch to the left mouse button (tests/touch.spec.mjs), which is enough for
// runner and web-swinger — but portal needs a right-click (no touch
// equivalent), and asteroids/platformer/ray-siege read the keyboard for
// movement, which a phone has none of. Each of those four games draws its own
// on-screen controls, gated on navigator.maxTouchPoints so a desktop
// mouse/keyboard never sees them. Exercises the REAL surface (browser runner,
// real touch events) against games/*.js. Pass condition: every check prints
// PASS; exit code 0 only if all pass.
import { readFileSync } from 'node:fs';
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// Synthetic TouchEvent dispatch, same pattern as touch.spec.mjs — a real
// touchscreen context (hasTouch:true) plus hand-built events for the gestures
// (hold, precise coordinates) Playwright's own touchscreen API can't express.
const TOUCH_FN = `(type, points) => {
  const canvas = document.querySelector('canvas');
  const r = canvas.getBoundingClientRect();
  const sx = r.width / canvas.width, sy = r.height / canvas.height;
  const mk = (p) => new Touch({ identifier: p.id, target: canvas,
    clientX: r.left + p.x * sx, clientY: r.top + p.y * sy });
  const touches = (points.remaining || []).map(mk);
  const changed = (points.changed || []).map(mk);
  canvas.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches,
    changedTouches: changed, bubbles: true, cancelable: true }));
}`;
function dispatch(frame, type, x, y) {
  return frame.evaluate(([fn, tp, xx, yy]) => eval(fn)(tp, {
    changed: [{ id: 1, x: xx, y: yy }],
    remaining: tp === 'touchend' ? [] : [{ id: 1, x: xx, y: yy }],
  }), [TOUCH_FN, type, x, y]);
}
const tap = async (frame, x, y, holdFrames = 4) => {
  await dispatch(frame, 'touchstart', x, y);
  await waitFrames(frame, holdFrames);
  await dispatch(frame, 'touchend', x, y);
};
const hold = (frame, x, y) => dispatch(frame, 'touchstart', x, y);
const release = (frame, x, y) => dispatch(frame, 'touchend', x, y);

const srv = await serve(8190);
const browser = await launch();

async function boot(name, hasTouch) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, hasTouch });
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, readFileSync(new URL(`../games/${name}.js`, import.meta.url), 'utf8'));
  await waitFrames(frame, 20);
  return { ctx, page, frame, errors };
}

// ---------------------------------------------------------------------------
// C1: the controls are gated on touch capability — a desktop mouse/keyboard
// context must never see TOUCH flip on, or the buttons would sit drawn over a
// desktop player's own view for no reason.
for (const g of ['portal', 'asteroids', 'platformer', 'ray-siege']) {
  const { ctx, page, frame, errors } = await boot(g, false);
  const touch = await frame.evaluate(() => window.TOUCH);
  check('C1 (' + g + ') TOUCH is false on a desktop context', touch === false, String(touch));
  check('C1 (' + g + ') zero errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C2: portal — the color toggle is the only way to reach blue on touch (no
// right-click). Tapping it flips which color the next tap places.
{
  const { ctx, page, frame, errors } = await boot('portal', true);
  const before = await frame.evaluate(() => window.placeColor);
  check('C2a placeColor starts orange (matches left-click default)', before === 'orange', String(before));

  await tap(frame, 382 + 35, 8 + 12); // the toggle pill, top-right
  await waitFrames(frame, 4);
  const after = await frame.evaluate(() => window.placeColor);
  check('C2b tapping the toggle flips placeColor', after !== before, before + ' -> ' + after);

  const p0 = await frame.evaluate(() => ({ y: player.y }));
  await tap(frame, 10, p0.y); // the left wall, dead ahead
  await waitFrames(frame, 6);
  const placed = await frame.evaluate(() => ({ orange: !!portals.orange, blue: !!portals.blue }));
  check('C2c the toggled color is what actually gets placed',
    after === 'blue' ? placed.blue && !placed.orange : placed.orange && !placed.blue,
    JSON.stringify({ selected: after, placed }));

  check('C2d zero errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C3: asteroids — held rotate/thrust buttons, a tapped fire button, and the
// game-over screen still restarts on any tap (unchanged behaviour).
{
  const { ctx, page, frame, errors } = await boot('asteroids', true);
  await frame.evaluate(() => {
    asteroids.slice().forEach((a) => a.delete());
    bullets.slice().forEach((b) => b.delete());
    ship.x = 100; ship.y = 150; ship.rotation = 0; ship.vel.x = 0; ship.vel.y = 0;
    const a = new asteroids.Sprite(220, 150, 26); a.vel.x = 0; a.vel.y = 0;
    score = 0;
  });
  await waitFrames(frame, 5);
  await tap(frame, 400 + 26, 250 + 21); // fire button, centre
  await waitFrames(frame, 50);
  const shot = await frame.evaluate(() => ({ score: score, rocks: asteroids.length }));
  check('C3a the fire button destroys the rock ahead and scores', shot.score === 1, JSON.stringify(shot));

  const r0 = await frame.evaluate(() => ship.rotation);
  await hold(frame, 54 + 21, 250 + 21); // rotate-right button
  await waitFrames(frame, 15);
  const r1 = await frame.evaluate(() => ship.rotation);
  await release(frame, 54 + 21, 250 + 21);
  check('C3b holding the rotate button turns the ship', r1 !== r0, JSON.stringify({ before: r0, after: r1 }));

  await frame.evaluate(() => { lives = 0; alive = false; score = 5; });
  await waitFrames(frame, 5);
  await tap(frame, 230, 150); // anywhere — the existing "any tap restarts" behaviour
  await waitFrames(frame, 10);
  const restarted = await frame.evaluate(() => ({ alive: alive, score: score }));
  check('C3c the game-over screen still restarts on any tap',
    restarted.alive === true && restarted.score === 0, JSON.stringify(restarted));

  check('C3d zero errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C4: platformer — held move button, tapped jump button (gated on `grounded`,
// same as the keyboard path).
{
  const { ctx, page, frame, errors } = await boot('platformer', true);
  const x0 = await frame.evaluate(() => player.x);
  await hold(frame, 76 + 30, 254 + 19); // move-right button
  await waitFrames(frame, 20);
  const x1 = await frame.evaluate(() => player.x);
  await release(frame, 76 + 30, 254 + 19);
  check('C4a holding the move-right button moves the player right', x1 > x0,
    JSON.stringify({ before: +x0.toFixed(1), after: +x1.toFixed(1) }));

  await frame.evaluate(() => { player.x = 230; player.y = 260; player.vel.x = 0; player.vel.y = 0; });
  await waitFrames(frame, 20); // let it settle on the ground first
  await frame.evaluate(() => {
    window.__minVy = 0;
    (function watch() { if (player.vel.y < window.__minVy) window.__minVy = player.vel.y; requestAnimationFrame(watch); })();
  });
  await tap(frame, 392 + 30, 254 + 19, 2); // jump button
  await waitFrames(frame, 4);
  const minVy = await frame.evaluate(() => window.__minVy);
  check('C4b tapping the jump button gives upward velocity (grounded gate honoured)',
    minVy < -3, 'min vel.y = ' + minVy);

  check('C4c zero errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C5: ray-siege — weapon buttons, a held move button, and the one subtlety
// unique to this game: a tap that lands on ANY button must not also fire —
// the world and the buttons share one input (mouse.presses), so a weapon
// swap would otherwise take a shot at the button's screen position too.
{
  const { ctx, page, frame, errors } = await boot('ray-siege', true);
  await tap(frame, 386 + 16, 8 + 13); // weapon-2 button
  await waitFrames(frame, 3);
  const w = await frame.evaluate(() => weapon);
  check('C5a tapping a weapon button switches weapons', w === 2, String(w));

  // fire() sets fireCooldown to 12 the instant it runs, whether or not the
  // shot hits anything -- an aim-independent signal that it ran at all. A
  // delayed poll would miss it: fireCooldown decays back to 0 within 12
  // frames regardless, so an in-page probe tracks the PEAK seen instead.
  await frame.evaluate(() => {
    window.__peakFC = 0;
    (function watch() { window.__peakFC = Math.max(window.__peakFC, fireCooldown); requestAnimationFrame(watch); })();
  });
  await tap(frame, 422 + 16, 8 + 13); // weapon-3 button
  await waitFrames(frame, 6);
  const peakFC = await frame.evaluate(() => window.__peakFC);
  check('C5b a tap on a button does not also fire a shot', peakFC === 0, 'peak fireCooldown = ' + peakFC);

  const x0 = await frame.evaluate(() => player.x);
  await hold(frame, 54 + 21, 272 + 13); // move-right button (ground-strip y)
  await waitFrames(frame, 15);
  const x1 = await frame.evaluate(() => player.x);
  await release(frame, 54 + 21, 272 + 13);
  check('C5c holding the move-right button moves the player', x1 > x0,
    JSON.stringify({ before: +x0.toFixed(1), after: +x1.toFixed(1) }));

  const bricks0 = await frame.evaluate(() => bricks.length);
  await tap(frame, 360, 250); // a real tap on the world (the free-standing tower), not a button
  await waitFrames(frame, 10);
  const bricks1 = await frame.evaluate(() => bricks.length);
  check('C5d a tap on the world (not a button) still fires', bricks1 < bricks0,
    JSON.stringify({ before: bricks0, after: bricks1 }));

  check('C5e zero errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
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
