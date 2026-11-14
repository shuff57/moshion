// Scenario: one name for a texture (shCode, 2026-11-13).
//  - sprite.texture reads back the texture itself: .name, and for an animated
//    one the same object as sprite.ani (.frameDelay, .frame, .loop, .frameCount).
//  - ani.loop = false plays once and stays on the last frame; frame = 0 replays.
//  - setting the texture a sprite already shows does not restart it, so
//    `door.texture = 'openDoor'` inside update() keeps animating (it froze on
//    frame 0 before: seen in student code).
// Exercises the REAL surface (browser runner). Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const SKETCH = `
var d, every, other, still, none, seen, everySeen;
function setup() {
  new Canvas(300, 200);
  d = new Sprite(50, 100, 40, 40); d.collider = 'none'; d.texture = 'batFly';
  d.texture.frameDelay = 2;
  d.texture.loop = false;
  every = new Sprite(120, 100, 40, 40); every.collider = 'none';
  still = new Sprite(190, 100, 40, 40); still.collider = 'none'; still.texture = 'coin';
  none = new Sprite(260, 100, 40, 40); none.collider = 'none';
  seen = []; everySeen = [];
}
function update() { every.texture = 'batFly'; }
function draw() { background('black'); seen.push(d.texture.frame); everySeen.push(every.texture.frame); if (window.__trk) window.__trk.out.push(window.__trk.s.texture.frame); }
`;

const browser = await launch();
const srv = await serve(8193);
try {
  const page = await browser.newPage();
  const frame = await runSketch(page, srv.base, SKETCH);
  await waitFrames(frame, 40);
  const r = await frame.evaluate(() => ({
    same: d.texture === d.ani, name: d.texture.name, count: d.texture.frameCount, delay: d.ani.frameDelay,
    seen: seen.slice(), everyMax: Math.max.apply(null, everySeen),
    still: { name: still.texture.name, count: still.texture.frameCount, frame: still.texture.frame, ani: still.ani },
    printed: 'using ' + still.texture, none: none.texture,
  }));
  check('animated .texture is the same object as .ani', r.same === true, r);
  check('.texture.name and .frameCount read back', r.name === 'batFly' && r.count === 4, r);
  check('.texture.frameDelay sets the animation speed', r.delay === 2, r);
  const tail = r.seen.slice(-8);
  check('.texture.loop = false stops on the last frame', r.seen.includes(1) && tail.every((f) => f === 3), r.seen);
  check('setting the same texture every frame does not freeze it', r.everyMax === 3, r);
  check('a still texture reads back name, frameCount 1, no ani', r.still.name === 'coin' && r.still.count === 1 && r.still.frame === 0 && r.still.ani === null, r.still);
  check('a texture prints as its name', r.printed === 'using coin', r.printed);
  check('no texture reads back null', r.none === null, r);

  const replay = await frame.evaluate(() => { d.texture.frame = 0; return d.texture.frame; });
  await waitFrames(frame, 20);
  const after = await frame.evaluate(() => ({ f: d.texture.frame, copy: (() => { const e = new Sprite(0, 0, 10, 10); e.texture = still.texture; return e.texture.name; })(),
    swap: (() => { every.texture = 'coin'; return every.texture.name + '/' + (every.ani === null); })() }));
  check('frame = 0 replays a play-once animation to its end', replay === 0 && after.f === 3, { replay, after });
  check('a.texture = b.texture copies by name', after.copy === 'coin', after);
  check('a different name switches', after.swap === 'coin/true', after);

  // addAni() animations are read and switched through .texture too.
  const own = await frame.evaluate(() => {
    const g = new Sprite(150, 50, 30, 30); g.collider = 'none';
    g.addAni('idle', 'batFly'); g.addAni('fly', 'beeFly');
    const first = g.texture && g.texture.name, isAni = g.texture === g.ani;
    g.texture.frameDelay = 9; const delay = g.ani.frameDelay;
    g.texture = 'fly'; const switched = g.texture.name;
    g.texture = 'idle'; const back = g.texture.name + '/' + g.texture.frameDelay;
    g.texture = 'coin'; const cat = g.texture.name + '/' + (g.ani === null);
    g.texture = 'fly'; const ownAfterCat = g.texture.name;
    g.texture = null; const cleared = g.texture;
    return { first, isAni, delay, switched, back, cat, ownAfterCat, cleared };
  });
  check('after addAni, .texture is the active animation', own.first === 'idle' && own.isAni === true && own.delay === 9, own);
  check(".texture = 'fly' switches to the sprite's own animation", own.switched === 'fly' && own.back === 'idle/9', own);
  check('a catalog name still works next to own animations', own.cat === 'coin/true' && own.ownAfterCat === 'fly', own);
  check('.texture = null clears the animation showing', own.cleared === null, own);

  // loop = n plays n times, then stays on the last frame; frame = 0 starts the count over.
  // Frames are recorded once per game frame from draw(), so a busy machine cannot skip any.
  const passes = (a) => a.filter((f, i) => i > 0 && f < a[i - 1]).length;
  await frame.evaluate(() => {
    const s = new Sprite(250, 150, 30, 30); s.collider = 'none';
    s.texture = 'batFly'; s.texture.frameDelay = 2; s.texture.loop = 3;   // 4 frames x 2 = 8 game frames a pass
    window.__trk = { s, out: [] };
  });
  await frame.waitForFunction(() => window.__trk.out.length >= 60, null, { timeout: 30000 });
  const first = await frame.evaluate(() => { const r = { out: window.__trk.out.slice(), loopVal: window.__trk.s.texture.loop };
    window.__trk.out = []; window.__trk.s.texture.frame = 0; return r; });
  await frame.waitForFunction(() => window.__trk.out.length >= 60, null, { timeout: 30000 });
  const again = await frame.evaluate(() => window.__trk.out.slice());
  // loop = 3 written every frame (inside update) must still stop after three: same value = no reset.
  await frame.evaluate(() => {
    const s = new Sprite(300, 150, 30, 30); s.collider = 'none';
    s.texture = 'batFly'; s.texture.frameDelay = 2;
    window.__trk = { s, out: [] };
    const tick = () => { s.texture.loop = 3; if (window.__trk && window.__trk.s === s) requestAnimationFrame(tick); };
    tick();
  });
  await frame.waitForFunction(() => window.__trk.out.length >= 60, null, { timeout: 30000 });
  const everyFrame = await frame.evaluate(() => window.__trk.out.slice());
  check('loop = 3 set every frame still stops after three', passes(everyFrame) === 2 && everyFrame[everyFrame.length - 1] === 3, everyFrame);
  const odd = await frame.evaluate(() => { const a = new Sprite(0, 0, 5, 5); a.texture = 'batFly'; const out = [];
    for (const v of [0, -2, 0.5, 2.7, Infinity, true, false]) { a.texture.loop = v; out.push(a.texture.loop); } return out; });
  const counted = { wraps: passes(first.out), end: first.out[first.out.length - 1], loopVal: first.loopVal, againWraps: passes(again), againEnd: again[again.length - 1], odd };
  check('loop = 3 plays three times, then stays on the last frame', counted.wraps === 2 && counted.end === 3 && counted.loopVal === 3, counted);
  check('frame = 0 plays a counted animation again, all three times', again[0] <= 1 && counted.againWraps === 2 && counted.againEnd === 3, again);
  check('loop values: 0/negative/below 1 = once, n floored, Infinity = forever', JSON.stringify(counted.odd) === JSON.stringify([false, false, false, 2, true, true, false]), counted.odd);

  // pause() freezes the frame, play() carries on from it (shCode #117).
  await frame.evaluate(() => {
    const s = new Sprite(350, 150, 30, 30); s.collider = 'none';
    s.texture = 'batFly'; s.texture.frameDelay = 2;
    window.__trk = { s, out: [] };
  });
  await frame.waitForFunction(() => window.__trk.out.length >= 12, null, { timeout: 30000 });
  const pz = await frame.evaluate(() => { const t = window.__trk.s.texture; t.pause(); const at = t.frame;
    window.__trk.out = []; return { at, paused: t.paused }; });
  await frame.waitForFunction(() => window.__trk.out.length >= 40, null, { timeout: 30000 });
  const held = await frame.evaluate(() => { const t = window.__trk.s.texture; const o = window.__trk.out.slice();
    window.__trk.out = []; t.play(); return { o, paused: t.paused }; });
  await frame.waitForFunction(() => window.__trk.out.length >= 40, null, { timeout: 30000 });
  const moved = await frame.evaluate(() => new Set(window.__trk.out).size);
  const still = await frame.evaluate(() => { const a = new Sprite(0, 0, 5, 5); a.texture = 'coin'; a.texture.pause(); a.texture.play(); return a.texture.paused; });
  check('pause() freezes the animation on its frame and paused reads true', pz.paused === true && held.o.every((f) => f === pz.at) && held.paused === false, { pz, held: held.o.slice(0, 6) });
  check('play() carries on after a pause', moved === 4, moved);
  check('pause() and play() on a still texture do nothing and do not throw', still === false, still);
} finally {
  await browser.close();
  srv.close();
}

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
