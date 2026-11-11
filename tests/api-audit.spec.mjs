// Scenario: the API audit fixes (2026-11-12). Each check is one thing that
// used to be wrong or inconsistent:
//   A  resizing a sprite (or a group default size) resizes its collider
//   B  group properties reach existing members, not only new ones
//   C  constructor forms, and plain errors for a bad collider/shape/joint
//   D  mouse.drag() is callable; mouse verbs take a button
//   E  sensors have the full overlap verb set
//   F  getSpriteAt shares getSpritesAt's point test; rayCast with no callback
//   G  GrabberJoint.target moves; joint.remove()
//   H  angleMode(DEGREES)
//   I  the game runs 60 frames a second on a fast (144 Hz) screen
//   J  runner.html seeds random() fresh each run
// Exercises the REAL surface (browser runner). Exit 0 only if every check PASSes.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors, mouseDown, mouseMove } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}
// The physics width of a sprite's own collider, in pixels. Box2D pads a
// bounding box by a pixel or so each side, hence the <= 3 slack below.
const COLLIDER_W = `function colliderW(s) {
  const b = s._fixture.getAABB(0);
  return Math.round((b.upperBound.x - b.lowerBound.x) * 30);
}`;

const SKETCH = `
${COLLIDER_W}
var ball, g, m1, m2, circ, sensorHost, feet, crate, hud, back, front;
function setup() {
  new Canvas(400, 300);
  ball = new Sprite(60, 60, 20, 20);
  ball.w = 120;
  g = new Group();
  g.color = 'red';
  m1 = new g.Sprite(300, 60, 10, 10);
  g.w = 80;                       // after m1 exists: m1 must change too
  m2 = new g.Sprite(300, 120, 10, 10);
  g.color = 'blue';
  circ = new Sprite(200, 200, 30);
  circ.h = 50;                    // a circle has one size
  // a sensor under a box resting on a floor
  floor = new Sprite(200, 290, 400, 20, 'static');
  crate = new Sprite(100, 260, 30, 30);
  feet = crate.addSensor(0, 16, 26, 4);
  world.gravity.y = 10;
  // hit-testing: two sprites at the same spot and layer; the later is on top
  back = new Sprite(350, 250, 20, 20, 'static');
  front = new Sprite(350, 250, 20, 20, 'static');
  hud = new Sprite(30, 30, 40, 40, 'static');
  hud.screenSpace = true;
  hud.collider = 'none';
}
function draw() { background('#000'); }
`;

const browser = await launch();
const srv = await serve(8193);

{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, SKETCH);
  await waitFrames(frame, 20);

  const a = await frame.evaluate(() => ({
    ball: [ball.w, colliderW(ball)],
    m1: [m1.w, colliderW(m1), m1.color],
    m2: [m2.w, colliderW(m2), m2.color],
    circ: [circ.w, circ.h, colliderW(circ)],
    groupColor: g.color,
  }));
  check('A1 sprite.w = 120 resizes the collider', a.ball[0] === 120 && Math.abs(a.ball[1] - 120) <= 3, a.ball);
  check('A2 a group default size resizes new members\' colliders', a.m2[0] === 80 && Math.abs(a.m2[1] - 80) <= 3, a.m2);
  check('A3 on a circle, setting h sets w and the collider', a.circ[0] === 50 && a.circ[1] === 50 && Math.abs(a.circ[2] - 50) <= 3, a.circ);
  check('B1 group.w set after a member exists reaches it', a.m1[0] === 80 && Math.abs(a.m1[1] - 80) <= 3, a.m1);
  check('B2 group.color set after members exist reaches them all', a.m1[2] === 'blue' && a.m2[2] === 'blue' && a.groupColor === 'blue', a);

  const c = await frame.evaluate(() => {
    const out = {};
    const t = (f) => { try { f(); return 'ok'; } catch (e) { return e.constructor.name + ': ' + e.message; } };
    const s1 = new Sprite(100, 100, 30, 'static');
    out.circleStatic = [s1.shape, s1.w, s1.h, s1.collider];
    const s2 = new Sprite();
    out.noArgs = [s2.x, s2.y, s2.w];
    const s3 = new Sprite(10, 10, 10, 10, 'none');
    out.noneCtor = [s3.collider, s3.gravityScale];
    const s4 = new Sprite(10, 10, 10, 10);
    s4.collider = 'Static';
    out.caseCollider = s4.collider;
    s4.collider = 'none'; s4.body = 'kinematic';
    out.bodyAlias = [s4.collider, s4.body, s4.physicsType];
    out.typo = t(() => { s4.collider = 'statik'; });
    out.shape = t(() => { s4.shape = 'triangle'; });
    s4.shape = 'box';
    out.box = s4.shape;
    out.strX = t(() => new Sprite('100', 50));
    out.joint = t(() => new HingeJoint(null, s4));
    out.jointSame = t(() => new HingeJoint(s4, s4));
    out.vis = (() => { s4.visualOnly = true; const a = [s4.visualOnly, s4.physicsEnabled]; s4.physicsEnabled = true; return a.concat([s4.visualOnly]); })();
    for (const s of [s1, s2, s3, s4]) s.delete();
    return out;
  });
  check('C1 new Sprite(x, y, d, "static") is a static circle', c.circleStatic.join() === 'circle,30,30,static', c.circleStatic);
  check('C2 new Sprite() is a 50x50 square at the canvas centre', c.noArgs.join() === '200,150,50', c.noArgs);
  check('C3 new Sprite(..., "none") is a none collider without gravity', c.noneCtor.join() === 'none,0', c.noneCtor);
  check('C4 collider accepts any case', c.caseCollider === 'static', c.caseCollider);
  check('C5 body and physicsType are collider under other names', c.bodyAlias.join() === 'kinematic,kinematic,kinematic', c.bodyAlias);
  check('C6 a misspelt collider throws, naming the four', /TypeError.*'dynamic', 'static', 'kinematic' or 'none'/.test(c.typo), c.typo);
  check('C7 a bad shape throws; "box" means rect', /TypeError/.test(c.shape) && c.box === 'rect', [c.shape, c.box]);
  check('C8 a string position throws a TypeError', /TypeError.*x must be a number/.test(c.strX), c.strX);
  check('C9 a joint on null or on one sprite twice throws plainly', /TypeError.*must be a Sprite/.test(c.joint) && /two different sprites/.test(c.jointSame), [c.joint, c.jointSame]);
  check('C10 visualOnly and physicsEnabled are one flag', c.vis.join() === 'true,false,false', c.vis);

  // D: mouse
  await mouseMove(frame, 200, 100);
  await mouseDown(frame, 200, 100, 'right');
  await waitFrames(frame, 1);
  const d1 = await frame.evaluate(() => ({
    any: mouse.pressing(), right: mouse.pressing('right'), left: mouse.pressing('left'),
    dragFn: typeof mouse.drag, dragCall: mouse.drag('right'), dragProp: mouse.drag.left,
  }));
  // Released and read in one go: the release state lasts a single frame.
  const d2 = await frame.evaluate(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));
    return { rel: mouse.released('right'), relLeft: mouse.released('left') };
  });
  const bad = await frame.evaluate(() => { try { mouse.presses('top'); return 'no throw'; } catch (e) { return e.constructor.name; } });
  check('D1 mouse.pressing("right") vs ("left") vs any', d1.any && d1.right && !d1.left, d1);
  check('D2 mouse.drag() is callable and mouse.drag.left still reads', d1.dragFn === 'function' && typeof d1.dragCall === 'number' && typeof d1.dragProp === 'number', d1);
  check('D3 mouse.released("right") and not ("left")', d2.rel && !d2.relLeft, d2);
  check('D4 an unknown button name throws', bad === 'TypeError', bad);
  // A mouseup with no press on the canvas is not a click.
  await waitFrames(frame, 3); // let D3's one-frame release decay first
  await frame.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  const ghost = await frame.evaluate(() => [mouse.presses(), mouse.released()]);
  check('D5 a stray mouseup with no press is not a press or a release', ghost.join() === 'false,false', ghost);

  // E: sensors
  const e1 = await frame.evaluate(() => {
    let cbCount = 0;
    const r = { overlaps: feet.overlaps(floor, () => cbCount++), overlapping: feet.overlapping(allSprites) };
    r.cb = cbCount;
    r.overlappedType = typeof feet.overlapped;
    return r;
  });
  check('E1 a sensor answers overlaps/overlapping with callbacks', e1.overlaps && e1.overlapping > 0 && e1.cb === 1, e1);
  const e2 = await frame.evaluate(() => new Promise((res) => {
    crate.y = 100; crate.vel.y = 0; // lift it off the floor
    let seen = false;
    const t = every(1, () => { if (feet.overlapped(floor)) seen = true; });
    setTimeout(() => { t.stop(); res({ seen, still: feet.overlaps(floor) }); }, 120);
  }));
  check('E2 sensor.overlapped() fires when contact ends', e2.seen === true, e2);

  // F: hit-testing and ray casts
  const f = await frame.evaluate(() => {
    const top = world.getSpriteAt(350, 250);
    const objForm = world.getSpriteAt({ x: 350, y: 250 });
    const all = world.getSpritesAt(350, 250);
    camera.x += 100; // the HUD sprite stays on screen at (30, 30)
    const p = { x: camera.x - 200 + 30, y: camera.y - 150 + 30 }; // the world point under it
    const hudHit = world.getSpriteAt(p.x, p.y);
    camera.x -= 100;
    const pickup = new Sprite(390, 240, 16, 16, 'none'); // a sensor in the ray's path
    const down = world.rayCast(390, 200, 390, 299);
    pickup.delete();
    const none = world.rayCast(10, 10, 10, 11);
    let threw = 'no';
    try { world.rayCast(0, 0, 1, 1, 'nope'); } catch (e) { threw = e.constructor.name; }
    return {
      topIsFront: top === front, objForm: objForm === front, allFirst: all[0] === front, allLen: all.length,
      hud: hudHit === hud, rayHitsFloor: !!down && down.sprite === floor, rayY: down && Math.round(down.point.y),
      none, threw,
    };
  });
  check('F1 getSpriteAt is the topmost (later-made on a tie), same as getSpritesAt()[0]', f.topIsFront && f.allFirst && f.allLen === 2, f);
  check('F2 getSpriteAt takes a point object', f.objForm, f);
  check('F3 getSpriteAt finds a HUD sprite where it is drawn after the camera moves', f.hud, f);
  check('F4 rayCast with no callback returns the closest solid hit (through the sensor)', f.rayHitsFloor && f.rayY === 280, f);
  check('F5 rayCast with no hit returns null; a non-function callback throws', f.none === null && f.threw === 'TypeError', f);

  // G: joints
  const g1 = await frame.evaluate(() => new Promise((res) => {
    world.gravity.y = 0;
    const anchor = new Sprite(50, 50, 4, 4, 'static');
    const box = new Sprite(100, 100, 20, 20);
    const grab = new GrabberJoint(anchor, box, { maxForce: 1000 });
    grab.target = { x: 300, y: 100 };
    const tgt = grab.target;
    setTimeout(() => {
      const r = { tgt, boxX: Math.round(box.x), joints: box.joints.length };
      grab.remove();
      grab.remove(); // twice is harmless
      r.after = box.joints.length;
      res(r);
    }, 800);
  }));
  check('G1 GrabberJoint.target moves the grabbed sprite', Math.round(g1.tgt.x) === 300 && g1.boxX > 250, g1);
  check('G2 joint.remove() detaches it, and twice is harmless', g1.joints === 1 && g1.after === 0, g1);

  // H: angleMode
  const h = await frame.evaluate(() => {
    const before = cos(Math.PI);
    angleMode(DEGREES);
    const r = { before, cos90: Math.round(cos(90) * 1e9) / 1e9, sin90: sin(90), atan2: atan2(1, 0), mode: angleMode() };
    angleMode(RADIANS);
    r.back = cos(Math.PI);
    return r;
  });
  check('H1 angleMode(DEGREES): cos(90)=0, sin(90)=1, atan2 returns degrees', h.cos90 === 0 && h.sin90 === 1 && h.atan2 === 90 && h.mode === 'degrees', h);
  check('H2 radians stay the default and come back', h.before === -1 && h.back === -1, h);

  const errs = [...errors, ...(await frameErrors(page))];
  check('Z1 no errors', errs.length === 0, errs);
  await page.close();
}

// I: a 144 Hz screen. The sketch swaps requestAnimationFrame for one that
// ticks every ~7 ms (the engine asks for the next tick after setup()), then
// counts game frames over one second.
{
  const FAST = `
var start = null, count = null;
function setup() {
  new Canvas(100, 100);
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1000 / 144);
}
function update() {
  if (start === null) start = { t: performance.now(), f: frameCount };
  else if (count === null && performance.now() - start.t >= 1000) count = frameCount - start.f;
}
function draw() {}
`;
  const page = await browser.newPage();
  const frame = await runSketch(page, srv.base, FAST);
  await frame.waitForTimeout(1600);
  const n = await frame.evaluate(() => count);
  check('I1 a 144 Hz screen still runs about 60 game frames a second', n !== null && n >= 50 && n <= 66, n);
  await page.close();
}

// J: random() differs between two runs of the same sketch.
{
  const RAND = 'var r; function setup() { new Canvas(50, 50); r = [random(), random()]; } function draw() {}';
  const page = await browser.newPage();
  const f1 = await runSketch(page, srv.base, RAND);
  await waitFrames(f1, 2);
  const r1 = await f1.evaluate(() => r);
  const f2 = await runSketch(page, srv.base, RAND);
  await waitFrames(f2, 2);
  const r2 = await f2.evaluate(() => r);
  const SEEDED = 'var r; function setup() { new Canvas(50, 50); randomSeed(7); r = [random(), random()]; } function draw() {}';
  const f3 = await runSketch(page, srv.base, SEEDED);
  await waitFrames(f3, 2);
  const r3 = await f3.evaluate(() => r);
  const f4 = await runSketch(page, srv.base, SEEDED);
  await waitFrames(f4, 2);
  const r4 = await f4.evaluate(() => r);
  check('J1 two runs roll different numbers', r1.join() !== r2.join(), [r1, r2]);
  check('J2 randomSeed(n) still makes a run repeatable', r3.join() === r4.join(), [r3, r4]);
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
