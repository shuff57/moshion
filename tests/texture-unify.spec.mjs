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
function draw() { background('black'); seen.push(d.texture.frame); everySeen.push(every.texture.frame); }
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
