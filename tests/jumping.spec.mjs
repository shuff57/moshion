// Scenario: a sprite's jumping (shCode, 2026-11-16): player.jump(ground),
// maxJumps, jumpPower, jumpsLeft, onGround. A double jump goes twice and not a
// third time; landing gives the jumps back; only the ground given to jump()
// refills them (a crate does not); the space bar drives it through kb.presses;
// a clone keeps the settings; a sketch's own onGround field still works; a
// wrong argument says what to pass. Exercises the REAL surface (browser runner).
// Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames, keyDown, keyUp, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const LEVEL = `
var player, platforms, crate, answers;
function setup() {
  new Canvas(640, 400);
  world.gravity.y = 30;
  platforms = new Group();
  platforms.collider = 'static';
  new platforms.Sprite(160, 390, 320, 20);
  crate = new Sprite(500, 380, 120, 40, 'static');
  player = new Sprite(100, 340, 24, 32);
  player.rotationLock = true;
  player.maxJumps = 2;
  answers = [];
}
function update() {
  if (kb.presses(' ')) {
    answers.push(player.jump(platforms));
  }
}
function draw() { background('black'); }
`;

const browser = await launch();
const srv = await serve(8189);

async function landed(frame) {
  for (let i = 0; i < 40; i++) {
    if (await frame.evaluate(() => player.onGround)) return true;
    await waitFrames(frame, 6);
  }
  return false;
}

{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, LEVEL);
  await waitFrames(frame, 30);
  const start = await frame.evaluate(() => ({ on: player.onGround, left: player.jumpsLeft, max: player.maxJumps, pow: player.jumpPower }));
  check('J1 standing on the platforms: onGround, every jump left, jumpPower 8 by default',
    start.on === true && start.left === 2 && start.max === 2 && start.pow === 8, start);

  const air = await frame.evaluate(() => {
    const a = player.jump(platforms);
    const v = player.vel.y;
    return { a, v };
  });
  check('J2 jump() goes and sets vel.y to -jumpPower', air.a === true && Math.abs(air.v + 8) < 1e-9, air);
  await waitFrames(frame, 4);
  const more = await frame.evaluate(() => ({ second: player.jump(platforms), third: player.jump(platforms), left: player.jumpsLeft }));
  check('J3 maxJumps 2: a second jump in mid-air, then none', more.second === true && more.third === false && more.left === 0, more);

  check('J4 landing on the platforms gives every jump back',
    (await landed(frame)) && (await frame.evaluate(() => player.jumpsLeft)) === 2);

  await keyDown(frame, ' ');
  await waitFrames(frame, 2);
  await keyUp(frame, ' ');
  await waitFrames(frame, 2);
  const key = await frame.evaluate(() => ({ answers: answers.slice(), left: player.jumpsLeft }));
  check('J5 the space bar through kb.presses jumps once per press', key.answers.length === 1 && key.answers[0] === true && key.left === 1, key);

  // The crate is solid but not a platform: landing on it gives nothing back.
  await landed(frame);
  const onCrate = await frame.evaluate(() => new Promise((res) => {
    player.x = 500; player.y = 300; player.vel.y = 0;
    setTimeout(() => {
      const a = player.jump(platforms), b = player.jump(platforms);
      setTimeout(() => res({ a, b, left: player.jumpsLeft, on: player.onGround, y: Math.round(player.y) }), 1500);
    }, 500);
  }));
  check('J6 landing on a crate that is not the ground leaves no jumps (and onGround false)',
    onCrate.a === true && onCrate.b === false && onCrate.left === 0 && onCrate.on === false && onCrate.y < 360, onCrate);

  const given = await frame.evaluate(() => { player.jumpsLeft = player.maxJumps; return player.jumpsLeft; });
  check('J7 jumpsLeft = maxJumps gives every jump back, even off the ground', given === 2, String(given));

  const copy = await frame.evaluate(() => {
    player.jumpPower = 11; player.maxJumps = 3;
    const c = player.clone();
    return { max: c.maxJumps, pow: c.jumpPower };
  });
  check('J8 a clone keeps maxJumps and jumpPower', copy.max === 3 && copy.pow === 11, copy);

  const errs = [...errors, ...(await frameErrors(page))];
  check('J9 no errors', errs.length === 0, errs);
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const frame = await runSketch(page, srv.base, `
    var out;
    function setup() {
      new Canvas(300, 200);
      out = {};
      const p = new Sprite(100, 100, 20, 20);
      try { p.jump('ground'); out.str = 'accepted'; } catch (e) { out.str = e.message; }
      try { p.maxJumps = -1; out.neg = 'accepted'; } catch (e) { out.neg = e.message; }
      const q = new Sprite(200, 100, 20, 20);
      q.onGround = 'my flag';
      out.flag = q.onGround;
    }
    function draw() {}
  `);
  await waitFrames(frame, 3);
  const out = await frame.evaluate(() => out);
  check("J10 jump('ground') says to pass the sprite or group", /sprite or group it jumps off/.test(out.str), out);
  check('J11 a negative maxJumps is refused', /maxJumps must be a number/.test(out.neg), out);
  check("J12 a sketch's own sprite.onGround field reads back what it stored", out.flag === 'my flag', out);
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
