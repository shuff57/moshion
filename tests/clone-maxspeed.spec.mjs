// Scenario: sprite.clone() (shCode issue #87) and world.maxSpeed (shCode issue #84).
// clone() copies looks and physics, starts still, and joins the same groups.
// world.maxSpeed is the per-step speed cap: 60 px/frame by default (unchanged),
// raised only when a sketch opts in, with one console warning naming the knob
// when a speed is set past it. Exercises the REAL surface (browser runner).
// Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const CLONE = `
var pipes, pipe, copy, mover, moverCopy, ball, ballCopy, hitCopy;
function setup() {
  new Canvas(400, 300);
  world.gravity.y = 0;
  pipes = new Group();
  pipe = new pipes.Sprite(100, 100, 30, 120);
  pipe.color = 'green'; pipe.stroke = 'white'; pipe.strokeWeight = 3;
  pipe.collider = 'static'; pipe.rotation = 30; pipe.layer = 2; pipe.text = 'P';
  copy = pipe.clone();
  copy.x = 300;
  mover = new Sprite(50, 250, 20, 20);
  mover.vel.x = 3;
  moverCopy = mover.clone();
  moverCopy.y = 150; // move it off the original before the next frame, or the two push apart
  ball = new Sprite(200, 50, 24);
  ball.bounciness = 0.8; ball.friction = 0.3; ball.density = 2; ball.drag = 0.5; ball.rotationLock = true;
  ballCopy = ball.clone();
  hitCopy = false;
}
function draw() {
  background('black');
  if (mover.colliding(pipes)) hitCopy = true;
}
`;

const SPEED = `
var a, b, warns;
function setup() {
  new Canvas(800, 200);
  world.gravity.y = 0;
}
function draw() { background('black'); }
`;

const browser = await launch();
const srv = await serve(8182);

{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, CLONE);
  await waitFrames(frame, 5);
  const r = await frame.evaluate(() => ({
    w: copy.w, h: copy.h, shape: copy.shape, color: copy.color, stroke: copy.stroke, sw: copy.strokeWeight,
    collider: copy.collider, rot: Math.round(copy.rotation), layer: copy.layer, text: copy.text, y: Math.round(copy.y),
    inGroup: pipes.includes(copy), groupLen: pipes.length, groupsHas: copy.groups.includes(pipes),
    origX: Math.round(pipe.x),
  }));
  check('C1 a clone copies size, shape, colour, outline, rotation, layer, text and collider',
    r.w === 30 && r.h === 120 && r.shape === 'rect' && r.color === 'green' && r.stroke === 'white' && r.sw === 3
      && r.collider === 'static' && r.rot === 30 && r.layer === 2 && r.text === 'P' && r.y === 100, r);
  check('C2 a clone joins the same groups', r.inGroup && r.groupLen === 2 && r.groupsHas, r);
  check('C3 moving the clone leaves the original where it was', r.origX === 100, r);

  const m = await frame.evaluate(() => ({ orig: mover.vel.x, copy: moverCopy.vel.x, ccol: moverCopy.collider }));
  check('C4 a clone starts still', Math.abs(m.copy) < 1e-9 && m.orig > 0, m);

  const b = await frame.evaluate(() => ({
    shape: ballCopy.shape, d: ballCopy.diameter, bnc: ballCopy.bounciness, fr: ballCopy.friction,
    den: ballCopy.density, drag: ballCopy.drag, lock: ballCopy.rotationLock,
  }));
  check('C5 a clone copies bounciness, friction, density, drag and rotation lock',
    b.shape === 'circle' && b.d === 24 && b.bnc === 0.8 && b.fr === 0.3 && b.den === 2 && b.drag === 0.5 && b.lock === true, b);

  const ind = await frame.evaluate(() => {
    copy.color = 'red';
    const sameColor = pipe.color === 'green';
    copy.delete();
    return { sameColor, len: pipes.length, pipeStill: pipes.includes(pipe) };
  });
  check('C6 the clone is its own sprite: recolouring or deleting it leaves the original alone',
    ind.sameColor && ind.len === 1 && ind.pipeStill, ind);
  const errs = [...errors, ...(await frameErrors(page))];
  check('C7 no errors', errs.length === 0, errs);
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, SPEED);
  await waitFrames(frame, 3);
  const def = await frame.evaluate(() => world.maxSpeed);
  check('M1 the default speed cap is still 60', def === 60, String(def));

  await frame.evaluate(() => { a = new Sprite(20, 50, 10, 10); a.vel.x = 150; });
  await waitFrames(frame, 3);
  const capped = await frame.evaluate(() => { const x0 = a.x; return new Promise((res) => setTimeout(() => res({ x0, x1: a.x, v: a.vel.x }), 200)); });
  check('M2 with no opt-in a speed of 150 settles to 60', Math.abs(capped.v - 60) < 0.5, capped);
  const capWarns = warns.filter((w) => w.includes('world.maxSpeed'));
  check('M3 setting a speed past the cap warns, naming world.maxSpeed', capWarns.length === 1, warns);

  await frame.evaluate(() => { a.vel.x = 200; a.vel.x = 300; });
  await waitFrames(frame, 2);
  check('M4 it warns only once per run', warns.filter((w) => w.includes('world.maxSpeed')).length === 1, warns);

  await frame.evaluate(() => { world.maxSpeed = 200; b = new Sprite(20, 150, 10, 10); b.vel.x = 150; });
  await waitFrames(frame, 3);
  const fast = await frame.evaluate(() => ({ v: b.vel.x, cap: world.maxSpeed }));
  check('M5 world.maxSpeed = 200 lets a sprite keep a speed of 150', Math.abs(fast.v - 150) < 0.5 && fast.cap === 200, fast);

  const bad = await frame.evaluate(() => {
    const out = [];
    for (const v of [0, -5, '100', NaN]) { try { world.maxSpeed = v; out.push('accepted ' + v); } catch (e) { out.push(e.name); } }
    return { out, cap: world.maxSpeed };
  });
  check('M6 a speed cap that is not a number above 0 is refused, and the cap is unchanged',
    bad.out.every((x) => x === 'TypeError') && bad.cap === 200, bad);

  // A fast dynamic body still meets a static wall at the raised cap (planck's
  // time-of-impact pass); the documented risk is for kinematic and 'none' bodies.
  const wall = await frame.evaluate(() => new Promise((res) => {
    world.maxSpeed = 300;
    const w = new Sprite(500, 100, 4, 200, 'static');
    const s = new Sprite(100, 100, 10, 10);
    s.vel.x = 250;
    setTimeout(() => res({ x: s.x, wallX: w.x }), 600);
  }));
  check('M7 a dynamic sprite at 250 px/frame still stops at a thin static wall', wall.x < wall.wallX, wall);
  const errs = [...errors, ...(await frameErrors(page))];
  check('M8 no errors', errs.length === 0, errs);
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
