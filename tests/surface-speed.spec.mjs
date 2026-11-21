// Scenario: sprite.surfaceSpeed (a conveyor belt). A belt with a positive surfaceSpeed carries what stands on
// it to the RIGHT, a negative one to the left, whichever sprite was made first and in either world.origin.
// Before the fix the direction depended on creation order: planck's contact orders the pair by creation, and
// its tangent speed is measured along the contact's own tangent, which flips with that order.
// Exercises the REAL surface (browser runner). Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

function sketch({ beltFirst, speed, origin }) {
  // In math origin y counts up from the bottom, so the same picture has y measured from the other edge.
  const y = (screenY) => (origin === 'math' ? 300 - screenY : screenY);
  const belt = `belt = new Sprite(200, ${y(272)}, 300, 16, 'static');
  belt.surfaceSpeed = ${speed};
  belt.friction = 1;`;
  const crate = `crate = new Sprite(200, ${y(220)}, 30, 30);
  crate.friction = 1;
  crate.rotationLock = true;`;
  return `
var belt, crate, startX;
function setup() {
  new Canvas(400, 300);
  ${origin === 'math' ? "world.origin = 'math';" : ''}
  world.gravity.y = ${origin === 'math' ? -10 : 10};
  ${beltFirst ? belt + '\n  ' + crate : crate + '\n  ' + belt}
  startX = crate.x;
}
function draw() { background('black'); }
`;
}

const browser = await launch();
const srv = await serve(8193);

const CASES = [];
for (const origin of ['screen', 'math']) {
  for (const speed of [2, -2]) {
    for (const beltFirst of [true, false]) CASES.push({ origin, speed, beltFirst });
  }
}

for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, sketch(c));
  await waitFrames(frame, 30);
  await frame.evaluate(() => { startX = crate.x; });
  await waitFrames(frame, 40);
  const r = await frame.evaluate(() => ({ dx: crate.x - startX, vx: crate.vel.x, y: crate.y }));
  const want = Math.sign(c.speed);
  const label = `${c.origin} origin, surfaceSpeed ${c.speed}, ${c.beltFirst ? 'belt made first' : 'crate made first'}`;
  check(`${label}: the crate is carried ${want > 0 ? 'right' : 'left'}`, Math.sign(r.dx) === want && Math.abs(r.dx) > 20, r);
  check(`${label}: it moves at about the belt's speed`, Math.abs(r.vx - c.speed) < 0.5, r);
  const errs = [...errors, ...(await frameErrors(page))];
  check(`${label}: no errors`, errs.length === 0, errs);
  await page.close();
}

await browser.close();
srv.close();

let failed = 0;
for (const [name, pass, detail] of results) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`);
  if (!pass) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
