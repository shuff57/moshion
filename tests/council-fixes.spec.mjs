// Scenario: the review council's engine fixes (2026-11-20).
//   C1 group.newSprite() goes through the group's own factory, so it gets
//      every group default, exactly like `new group.Sprite()`.
//   C2 kb.pressed() / mouse.pressed() still fire on the way UP (the reference
//      API's alias of released()), and say so ONCE per run in the console.
//   C3 group.remove(sprite) still only takes it out of the group, and says
//      ONCE per run that the sprite is still there; not for a removed sprite.
//   C4 sprite.text = 0 draws "0"; null, undefined and '' draw nothing.
//   C5 sprite.vel = createVector(3, 0) (and pos =, [x, y], world.gravity =)
//      copies into the live vector, so physics still drives it; anything
//      without two numbers is refused in plain words.
//   C6 rgba() and randomColor() are engine globals (moved from shCode).
//   C7 loadJSON outside preload(): `await` settles with the data, and a
//      missing file says so in the console.
// Exercises the REAL surface (sandbox.html -> runner iframe).
// Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames, keyDown, keyUp, mouseDown, mouseUp, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const near = (a, b) => Math.abs(a - b) < 1e-6;

const browser = await launch();
const srv = await serve(8198);

async function open(code) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, code);
  return { page, frame, warns, errors };
}

// ---- C1: newSprite = the factory
{
  const { page, frame } = await open(`
    var coins, a, b;
    function setup() {
      new Canvas(400, 300);
      coins = new Group();
      coins.color = 'gold';
      coins.collider = 'static';
      coins.hp = 3;
      a = coins.newSprite(100, 100, 20, 20);
      b = new coins.Sprite(200, 100, 20, 20);
    }
    function draw() { background('black'); }
  `);
  await waitFrames(frame, 5);
  const r = await frame.evaluate(() => ({
    a: [a.color, a.collider, a.hp, coins.includes(a), a.w],
    b: [b.color, b.collider, b.hp, coins.includes(b), b.w],
    count: coins.length,
  }));
  check('C1 coins.newSprite() gets the group defaults (colour, collider, made-up hp) like new coins.Sprite()',
    JSON.stringify(r.a) === JSON.stringify(r.b) && r.a[0] === 'gold' && r.a[1] === 'static' && r.a[2] === 3 && r.a[3] && r.count === 2, r);
  await page.close();
}

// ---- C2: pressed() is still the up edge, and warns once
{
  const { page, frame, warns } = await open(`
    var downFrames = [], upFrames = [], mUp = [];
    function setup() { new Canvas(400, 300); }
    function update() {
      if (kb.presses('space')) downFrames.push(frameCount);
      if (kb.pressed('space')) upFrames.push(frameCount);
      if (mouse.pressed()) mUp.push(frameCount);
    }
    function draw() { background('black'); }
  `);
  await waitFrames(frame, 5);
  await keyDown(frame, ' ');
  await waitFrames(frame, 6);
  await keyUp(frame, ' ');
  await waitFrames(frame, 6);
  await keyDown(frame, ' ');
  await waitFrames(frame, 3);
  await keyUp(frame, ' ');
  await waitFrames(frame, 3);
  await mouseDown(frame, 100, 100);
  await waitFrames(frame, 4);
  await mouseUp(frame, 100, 100);
  await waitFrames(frame, 4);
  const r = await frame.evaluate(() => ({ downFrames, upFrames, mUp }));
  check('C2a kb.pressed() still fires once per press, on a later frame than kb.presses() (the key coming UP)',
    r.downFrames.length === 2 && r.upFrames.length === 2 && r.upFrames[0] > r.downFrames[0], r);
  const kbW = warns.filter((w) => w.includes('kb.pressed()'));
  check('C2b kb.pressed() warns ONCE although it ran every frame, naming kb.presses()',
    kbW.length === 1 && /comes back UP/.test(kbW[0]) && /kb\.presses\(\)/.test(kbW[0]), kbW);
  const mW = warns.filter((w) => w.includes('mouse.pressed()'));
  check('C2c mouse.pressed() still fires on release and warns ONCE, naming mouse.presses()',
    r.mUp.length === 1 && mW.length === 1 && /mouse\.presses\(\)/.test(mW[0]), { mUp: r.mUp, mW });
  await page.close();
}

// ---- C3: group.remove(sprite) only unparents, and warns once
{
  const { page, frame, warns } = await open(`
    var coins, c, d, out;
    function setup() {
      new Canvas(400, 300);
      coins = new Group();
      c = new coins.Sprite(100, 100, 20, 20);
      d = new coins.Sprite(200, 100, 20, 20);
      coins.remove(c);
      coins.remove(d);
      out = { len: coins.length, cAlive: allSprites.includes(c), dIn: coins.includes(d) };
    }
    function draw() { background('black'); }
  `);
  await waitFrames(frame, 5);
  const out = await frame.evaluate(() => out);
  const w = warns.filter((x) => x.includes('group.remove('));
  check('C3a group.remove(sprite) still only takes it out of the group (it stays in allSprites)',
    out.len === 0 && out.cAlive && !out.dIn, out);
  check('C3b ...and says ONCE that it is still on screen, naming sprite.remove()',
    w.length === 1 && /still on screen/.test(w[0]) && /sprite\.remove\(\)/.test(w[0]), w);
  await page.close();
}
{
  const { page, frame, warns } = await open(`
    var coins, c;
    function setup() {
      new Canvas(400, 300);
      coins = new Group();
      c = new coins.Sprite(100, 100, 20, 20);
      c.remove();
      coins.remove(c);
      coins.remove();
      // Taken out, then destroyed in the same frame: nothing to warn about.
      var e = new coins.Sprite(150, 100, 20, 20);
      coins.remove(e);
      e.remove();
    }
    function draw() { background('black'); }
  `);
  await waitFrames(frame, 5);
  const w = warns.filter((x) => x.includes('group.remove('));
  check('C3c no note for a sprite already removed, removed straight after, or remove() with nothing', w.length === 0, w);
  await page.close();
}

// ---- C4: text = 0 draws "0"
{
  const { page, frame } = await open(`
    var zero, nul, empty, undef, seen = [];
    function setup() {
      new Canvas(400, 300);
      zero = new Sprite(50, 50, 20, 20); zero.text = 0;
      nul = new Sprite(100, 50, 20, 20); nul.text = null;
      empty = new Sprite(150, 50, 20, 20); empty.text = '';
      undef = new Sprite(200, 50, 20, 20); undef.text = undefined;
      var ctx = document.querySelector('canvas').getContext('2d');
      var real = ctx.fillText;
      ctx.fillText = function (t) { seen.push(String(t)); return real.apply(this, arguments); };
    }
    function draw() { background('black'); }
  `);
  await waitFrames(frame, 5);
  const seen = await frame.evaluate(() => [...new Set(seen)]);
  check('C4 sprite.text = 0 draws "0"; null, undefined and \'\' draw nothing',
    seen.includes('0') && !seen.includes('') && !seen.includes('null') && !seen.includes('undefined'), seen);
  await page.close();
}

// ---- C5: assigning a whole vector copies into the live one
{
  const { page, frame, errors } = await open(`
    var player, box, x0, out = {};
    function setup() {
      new Canvas(400, 300);
      player = new Sprite(100, 100, 20, 20);
      box = new Sprite(300, 200, 20, 20);
      player.vel = createVector(3, 0);
      x0 = player.x;
      box.pos = [250, 150];
      out.boxPos = [box.x, box.y];
      box.position = { x: 260, y: 160 };
      out.boxPosition = [box.x, box.y];
      box.velocity = [0, 2];
      world.gravity = [0, 0];
      world.gravity = createVector(0, 0);
      out.gravity = [world.gravity.x, world.gravity.y];
      out.liveAfter = player.vel !== null && typeof Object.getOwnPropertyDescriptor(player.vel, 'x').get === 'function';
      var bad = function (fn) { try { fn(); return null; } catch (e) { return e.message; } };
      out.badNum = bad(function () { player.vel = 5; });
      out.badStr = bad(function () { player.pos = 'top'; });
      out.badObj = bad(function () { player.vel = { x: 3 }; });
      out.badGrav = bad(function () { world.gravity = 'down'; });
    }
    function draw() { background('black'); }
  `);
  await waitFrames(frame, 30);
  const r = await frame.evaluate(() => ({ dx: player.x - x0, vx: player.vel.x, boxVy: box.vel.y, boxY: box.y, ...out }));
  check('C5a player.vel = createVector(3, 0) moves the sprite (the vector stays live)',
    r.dx > 30 && Math.abs(r.vx - 3) < 0.01 && r.liveAfter, r);
  check('C5b sprite.pos = [x, y] and sprite.position = {x, y} move it; velocity = [0, 2] drives it',
    near(r.boxPos[0], 250) && near(r.boxPos[1], 150) && near(r.boxPosition[0], 260) && near(r.boxPosition[1], 160) &&
    Math.abs(r.boxVy - 2) < 0.01 && r.boxY > 170, r);
  check('C5c world.gravity = [x, y] or createVector() still sets gravity',
    r.gravity[0] === 0 && r.gravity[1] === 0, r.gravity);
  const plain = (m) => typeof m === 'string' && /must be a point with x and y, like createVector\(3, 0\)/.test(m);
  check('C5d a number, a string, an object missing y and a word for gravity are refused in plain words',
    plain(r.badNum) && plain(r.badStr) && plain(r.badObj) && plain(r.badGrav) &&
    /^sprite\.vel/.test(r.badNum) && /^sprite\.pos/.test(r.badStr) && /^world\.gravity/.test(r.badGrav),
    { badNum: r.badNum, badStr: r.badStr, badObj: r.badObj, badGrav: r.badGrav });
  // The Vector methods work on the live vector too (lesson 6.5.4 calls
  // player.vel.set(0, 0) after player.vel = createVector(0, 0)).
  const m = await frame.evaluate(() => {
    const s = new Sprite(50, 50, 10, 10);
    s.vel.set(2, 1); const a = [s.vel.x, s.vel.y];
    s.vel.add(1, 1); const b = [s.vel.x, s.vel.y];
    s.vel.mult(2); const c = [s.vel.x, s.vel.y];
    s.vel.set({ x: 3, y: 4 }); const mag = s.vel.mag();
    s.vel.normalize(); const unit = s.vel.mag();
    const copy = s.vel.copy(); copy.x = 99;
    s.pos.set(10, 20); const p = [s.x, s.y];
    const chain = s.vel.set(0, 0) === s.vel;
    s.vel.set(1, 1); s.vel.add(2); const addX = [s.vel.x, s.vel.y];
    const err = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
    const badAdd = err(() => s.vel.add('a'));
    const badDiv = err(() => s.vel.div(0));
    const after = [s.vel.x, s.vel.y];
    const plain = createVector(1, 1).add(2); const plainXY = [plain.x, plain.y];
    const half = createVector(5, 5).set({ x: 1 }); const halfXY = [half.x, half.y];
    const plainBad = [err(() => createVector(1, 1).add('a')), err(() => createVector(1, 1).div(0)), err(() => createVector(1, 1).dist())];
    s.vel.set(3, 1);
    const axisBad = [err(() => { s.vel.x = undefined; }), err(() => { s.pos.y = NaN; }), err(() => { s.x = 'left'; })];
    const axisAfter = [s.vel.x, s.vel.y, Number.isFinite(s.x), Number.isFinite(s.y)];
    const nanVel = err(() => { s.vel = { x: NaN, y: 0 }; });
    const nanPos = err(() => { s.pos = [Infinity, 0]; });
    return { a, b, c, mag, unit, copyIsolated: s.vel.x !== 99, p, chain, keys: Object.keys(s.vel), addX, badAdd, badDiv, after, plainXY, nanVel, nanPos, vAfter: [s.vel.x, s.vel.y], halfXY, plainBad, axisBad, axisAfter };
  });
  check('C5g vel.add(2) adds to x only (a missing y is 0); vel.add("a") and vel.div(0) are refused in words and change nothing',
    m.addX[0] === 3 && m.addX[1] === 1 && /needs numbers/.test(m.badAdd || '') && /needs numbers/.test(m.badDiv || '') &&
    m.after[0] === 3 && m.after[1] === 1, m);
  check('C5i one axis at a time is guarded too: vel.x = undefined, pos.y = NaN and sprite.x = a word are refused in words, nothing changes',
    m.axisBad.every((e) => /must be a number/.test(e || '')) && /^sprite\.vel\.x/.test(m.axisBad[0]) && /^sprite\.pos\.y/.test(m.axisBad[1]) &&
    m.axisAfter[0] === 3 && m.axisAfter[1] === 1 && m.axisAfter[2] && m.axisAfter[3], m);
  check('C5j a plain vector: set({x: 1}) makes y 0; add("a"), div(0) and dist() with nothing are refused in words',
    m.halfXY[0] === 1 && m.halfXY[1] === 0 && /needs numbers/.test(m.plainBad[0] || '') && /divided by 0/.test(m.plainBad[1] || '') &&
    /needs another point/.test(m.plainBad[2] || ''), m);
  check('C5h createVector(1, 1).add(2) is (3, 1); a NaN or Infinity assigned to vel or pos is refused in words and changes nothing',
    m.plainXY[0] === 3 && m.plainXY[1] === 1 && /must be a point/.test(m.nanVel || '') && /must be a point/.test(m.nanPos || '') &&
    m.vAfter[0] === 3 && m.vAfter[1] === 1, m);
  check('C5f set/add/mult/mag/normalize/copy work on sprite.vel and sprite.pos, and stay live',
    m.a[0] === 2 && m.a[1] === 1 && m.b[0] === 3 && m.b[1] === 2 && m.c[0] === 6 && m.c[1] === 4 &&
    near(m.mag, 5) && near(m.unit, 1) && m.copyIsolated && near(m.p[0], 10) && near(m.p[1], 20) && m.chain &&
    m.keys.join() === 'x,y', m);
  const errs = [...errors, ...(await frameErrors(page))];
  check('C5e no runtime errors', errs.length === 0, errs);
  await page.close();
}

// ---- C6: rgba() and randomColor() are engine globals
{
  const { page, frame } = await open(`
    var out = {};
    function setup() {
      new Canvas(200, 200);
      out.has = typeof rgba === 'function' && typeof randomColor === 'function';
      if (!out.has) return;
      out.basic = rgba(255, 99, 71, 0.5);
      out.noAlpha = rgba(10, 20, 30);
      out.clamp = rgba(300, -5, 12.6, 2);
      out.arr = rgba([1, 2, 3], 0.25);
      out.arr4 = rgba([1, 2, 3, 0.75]);
      out.bad = rgba('x', NaN, 7, 'y');
      randomSeed(7); out.r1 = randomColor();
      randomSeed(7); out.r2 = randomColor();
      out.fixed = randomColor(0.3);
      out.ranged = [];
      for (var i = 0; i < 20; i++) out.ranged.push(randomColor(0.8, 0.2));
    }
    function draw() { background('black'); }
  `);
  await waitFrames(frame, 3);
  const o = await frame.evaluate(() => out);
  const alphaOf = (s) => Number(/, ([\d.]+)\)$/.exec(s)?.[1]);
  const shape = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, [\d.]+\)$/;
  check('C6a rgba(): "rgba(r, g, b, a)", alpha defaults to 1, channels rounded and clamped, the array forms',
    o.has && o.basic === 'rgba(255, 99, 71, 0.5)' && o.noAlpha === 'rgba(10, 20, 30, 1)' &&
    o.clamp === 'rgba(255, 0, 13, 1)' && o.arr === 'rgba(1, 2, 3, 0.25)' && o.arr4 === 'rgba(1, 2, 3, 0.75)' &&
    o.bad === 'rgba(0, 0, 7, 1)', o);
  check('C6b randomColor(): an rgba string, repeatable with randomSeed, fixed alpha, a range in either order',
    o.has && shape.test(o.r1) && o.r1 === o.r2 && alphaOf(o.r1) === 1 && alphaOf(o.fixed) === 0.3 &&
    o.ranged.every((s) => shape.test(s) && alphaOf(s) >= 0.2 && alphaOf(s) <= 0.8) &&
    new Set(o.ranged).size > 10, { r1: o.r1, fixed: o.fixed, sample: o.ranged && o.ranged.slice(0, 3) });
  await page.close();
}

// ---- C7: loadJSON outside preload()
{
  const { page, frame, warns } = await open(`
    var got = null, missing = null;
    async function setup() {
      new Canvas(200, 200);
      var data = await loadJSON('${srv.base}/textures/textures.json');
      got = data && typeof data === 'object' ? Object.keys(data).length : -1;
      var none = await loadJSON('${srv.base}/nope/levels.json');
      missing = none && typeof none === 'object' ? 'object' : String(none);
    }
    function draw() { background('black'); }
  `);
  for (let i = 0; i < 20; i++) {
    if (await frame.evaluate(() => missing !== null)) break;
    await waitFrames(frame, 10);
  }
  const r = await frame.evaluate(() => ({ got, missing }));
  const w = warns.filter((x) => x.includes('levels.json'));
  check('C7a `await loadJSON(url)` in setup() settles with the file\'s data', r.got > 0, r);
  check('C7b a missing file still settles, and the console names it once', r.missing === 'object' && w.length === 1 && /could not load/.test(w[0]), { r, w });
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
