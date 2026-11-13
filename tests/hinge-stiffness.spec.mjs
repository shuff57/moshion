// Scenario: HingeJoint stiffness and limits (shCode issue #116, "I want tension in
// limbs"). A ragdoll built from plain hinges went floppy. `stiffness` (0..1)
// holds the starting pose; `lowerLimit`/`upperLimit` stop the turn, in degrees
// from the starting pose. A hinge with no options must stay exactly as floppy as
// before. Exercises the REAL surface (browser runner). Exit 0 only if every
// check prints PASS.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const ARMS = `
var floppy, stiff, stiffRod, limited, later, swung, laterSwung, defaults, bad;
function arm(x, opt) {
  const pin = new Sprite(x, 100, 10, 10, 'static');
  const rod = new Sprite(x + 50, 100, 100, 12);
  return [new HingeJoint(pin, rod, Object.assign({ anchor: { x, y: 100 } }, opt)), rod];
}
function setup() {
  new Canvas(700, 400);
  world.gravity.y = 10;
  [floppy] = arm(20);
  [stiff, stiffRod] = arm(150, { stiffness: 1 });
  [limited] = arm(280, { upperLimit: 30 });
  [later] = arm(410);
  later.stiffness = 1; later.stiffness = 0;
  defaults = [floppy.stiffness, floppy.lowerLimit, floppy.upperLimit];
  bad = null;
  try { floppy.lowerLimit = 'down'; } catch (e) { bad = e.message; }
  arm(540, { stiffness: 1 })[0].delete();
  swung = 0; laterSwung = 0;
}
function draw() {
  background('black');
  swung = Math.max(swung, floppy.angle);
  laterSwung = Math.max(laterSwung, later.angle);
}
`;

const browser = await launch();
const srv = await serve(8183);
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, ARMS);
  await waitFrames(frame, 180);
  const r = await frame.evaluate(() => ({
    defaults, bad, swung, laterSwung,
    stiff: stiff.angle, limited: limited.angle,
    stiffSpeed: Math.hypot(stiffRod.vel.x, stiffRod.vel.y),
  }));
  check('H1 a plain hinge starts at stiffness 0 with no limits', JSON.stringify(r.defaults) === '[0,null,null]', r.defaults);
  check('H2 a plain hinge still swings down freely', r.swung > 70, r.swung);
  check('H3 stiffness 1 holds a level arm level', Math.abs(r.stiff) < 5, r.stiff);
  check('H4 a stiff arm comes to rest', r.stiffSpeed < 0.05, r.stiffSpeed);
  check('H5 upperLimit 30 stops the arm at 30 degrees', r.limited <= 31 && r.limited > 25, r.limited);
  check('H6 stiffness back to 0 is floppy again', r.laterSwung > 70, r.laterSwung);
  check('H7 a limit that is not a number throws a plain error', /lowerLimit must be a number of degrees/.test(r.bad || ''), r.bad);
  const errs = [...errors, ...(await frameErrors(page))];
  check('H8 no errors', errs.length === 0, errs);
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
