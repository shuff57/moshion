// Scenario: the 2026-10-31 gap fixes (shCode codehs-review/MOSHION-GAPS.md).
//   P  the overlap broadphase in _updateOverlaps() is EXACT: overlapping()
//      agrees with the live overlaps() query for every pair, on every path
//   C  off-screen culling in render() skips only sprites nothing of which
//      could be seen, and never a sketch's own draw() or an ani's clock
//   S  square() honours fill() / noFill()
//   T  new Tiles(map, x, y, w, h, legend)
//   W  new Walls(thickness)
//   F  every(frames, fn) / after(frames, fn)
//   N  sprite.addSensor(): a ground sensor that is false against walls
// Exercises the REAL surface (browser runner) against the engine. Pass
// condition: every check prints PASS; exit code 0 only if all pass.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

function pixel(frame, x, y) {
  return frame.evaluate(([px, py]) => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(px, py, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }, [x, y]);
}
const near = (p, r, g, b) => p && Math.abs(p.r - r) < 30 && Math.abs(p.g - g) < 30 && Math.abs(p.b - b) < 30;

const srv = await serve(8191);
const browser = await launch();

async function open(code, frames = 40) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, code);
  await waitFrames(frame, frames);
  return { ctx, page, frame, errors };
}
async function clean(page, errors) {
  const fe = await frameErrors(page);
  return { ok: errors.length === 0 && fe.length === 0, detail: JSON.stringify({ page: errors, runner: fe }) };
}

// ---------------------------------------------------------------------------
// P: every pair's ledger (overlapping) matches the live geometry (overlaps),
// checked in drawTop(), where nothing has moved since _updateOverlaps() ran.
// The scene is built to sit on the broadphase's edges: tiles that touch
// exactly (strict rect test says no), circles that touch exactly (circle test
// says yes), a negative width, a zero-size sprite, a huge one, rotation,
// sensors, and a pile of falling bodies so pairs start and stop overlapping.
const PAIRS = (extra) => `
function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  for (let i = 0; i < 12; i++) new Sprite(20 + i * 30, 280, 30, 30, 'static'); // touching edges
  new Sprite(100, 150, 30).collider = 'static';                              // circles exactly
  new Sprite(130, 150, 30).collider = 'static';                              // touching
  new Sprite(300, 60, 40, 40).collider = 'none';
  const neg = new Sprite(320, 70, 20, 20, 'static'); neg.w = -40;           // negative width
  new Sprite(50, 50, 0, 0, 'static');                                        // zero size
  new Sprite(200, 200, 700, 6, 'static').rotation = 20;                      // huge, rotated
  for (let i = 0; i < 70; i++) {
    const s = i % 3 ? new Sprite(30 + (i * 37) % 340, 10 + (i * 13) % 120, 8 + (i % 5) * 4)
                    : new Sprite(30 + (i * 53) % 340, 10 + (i * 17) % 120, 10 + (i % 4) * 5, 6 + (i % 3) * 5);
    if (i % 7 === 0) s.collider = 'none';
  }
  ${extra || ''}
  bad = []; checks = 0; framesChecked = 0;
}
function drawTop() {
  const live = allSprites.slice();
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const geo = live[i].overlaps(live[j]);
      const led = live[i].overlapping(live[j]) > 0;
      checks++;
      if (geo !== led && bad.length < 5) bad.push([i, j, geo, led, frameCount]);
    }
  }
  framesChecked++;
}
`;
{
  const { ctx, page, frame, errors } = await open(PAIRS(), 90);
  const r = await frame.evaluate(() => ({ bad, checks, framesChecked, n: allSprites.length }));
  check('P1 broadphase path: overlapping() agrees with overlaps() for every pair, every frame',
    r.bad.length === 0 && r.checks > 100000 && r.n > 32, r);
  const c = await clean(page, errors);
  check('P1b no errors', c.ok, c.detail);
  await ctx.close();
}
{
  // One sprite with an infinite width forces the old all-pairs path.
  const { ctx, page, frame, errors } = await open(PAIRS("const inf = new Sprite(200, 40, 10, 10, 'static'); inf.w = Infinity;"), 60);
  const r = await frame.evaluate(() => ({ bad, checks, n: allSprites.length }));
  check('P2 fallback path (an infinite width): still agrees for every pair', r.bad.length === 0 && r.checks > 50000, r);
  const c = await clean(page, errors);
  check('P2b no errors', c.ok, c.detail);
  await ctx.close();
}
{
  // A subclass that defines overlap its own way must be asked about EVERY
  // pair, so the broadphase steps aside for it. It is made first, so it is
  // the one asked (the double loop asks the earlier sprite of each pair).
  const { ctx, page, frame, errors } = await open(`
class Everywhere extends Sprite { _overlapsOne() { return true; } }
function setup() {
  new Canvas(400, 300);
  world.gravity.y = 0;
  far = new Everywhere(-900, -900, 4, 4, 'static');
  for (let i = 0; i < 40; i++) new Sprite(10 + i * 9, 150, 4, 4, 'static');
  last = allSprites[allSprites.length - 1];
}`, 20);
  const r = await frame.evaluate(() => ({ n: far.overlapping(last), count: allSprites.length }));
  check('P3 a sprite subclass with its own overlap rule is still asked about every pair', r.n > 0 && r.count > 32, r);
  const c = await clean(page, errors);
  check('P3b no errors', c.ok, c.detail);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C: culling. fillRect/fillText/arc calls are counted by the fill colour in
// force, so each test sprite is identified by a unique colour.
const CULL = `
const seen = {};
const P = CanvasRenderingContext2D.prototype;
for (const m of ['fillRect', 'fillText', 'arc', 'drawImage']) {
  const orig = P[m];
  P[m] = function (...a) { const k = String(this.fillStyle); seen[k] = (seen[k] || 0) + 1; return orig.apply(this, a); };
}
function mk(x, y, w, h, color) { const s = new Sprite(x, y, w, h, 'static'); s.color = color; return s; }
function setup() {
  new Canvas(400, 300);
  world.gravity.y = 0;
  mk(-500, 150, 20, 20, '#ff0001');                 // far off the left: culled
  mk(-60, 150, 200, 10, '#ff0002');                 // centre off screen, right end at x=40: drawn
  mk(-30, 60, 20, 20, '#ff0003').scale = 4;         // art 80 wide reaches x=10: drawn
  const t = mk(-40, 200, 10, 10, '#ff0004');        // a label wider than the sprite
  t.text = 'HELLO WORLD'; t.textColor = '#ff0005';  // ... reaches into view: drawn
  const r = mk(-80, 250, 60, 6, '#ff0006'); r.rotation = 90; // rotated, well off: culled
  mk(1000, 150, 20, 20, '#ff0007');                 // off right
  hud = mk(30, 30, 20, 20, '#ff0008'); hud.screenSpace = true;
  own = mk(-800, -800, 10, 10, '#ff0009');
  ownCalls = 0; own.draw = () => { ownCalls++; };   // its own draw: never culled
  spin = mk(-900, 150, 20, 20, '#ff000a');
  spin.addAni('a', 'assets/star.webp', 4);          // ani clock must run off screen
  frames = 0; moveNow = false;
}
function draw() { background('#000000'); frames++; if (moveNow) { camera.x = 1000; moveNow = false; } }
`;
{
  const { ctx, page, frame, errors } = await open(CULL, 30);
  const a = await frame.evaluate(() => { moveNow = true; return { seen: { ...seen }, frames, ownCalls, ani: spin.ani.frame + spin.ani._tick }; });
  await waitFrames(frame, 40); // the camera moved to x = 1000 on the next frame
  const b = await frame.evaluate(() => ({ seen: { ...seen }, frames, ownCalls }));
  const n = (s, k) => s.seen[k] || 0;
  check('C1 a sprite far off screen is not drawn', n(a, '#ff0001') === 0, a.seen);
  check('C2 a wide sprite whose centre is off screen but whose end is on it IS drawn', n(a, '#ff0002') > 10, a.seen);
  check('C3 a scaled-up sprite poking into view IS drawn', n(a, '#ff0003') > 10, a.seen);
  check('C4 an off-screen sprite whose text label reaches into view IS drawn', n(a, '#ff0005') > 10, a.seen);
  check('C5 a rotated sprite that stays off screen is not drawn', n(a, '#ff0006') === 0, a.seen);
  check('C6 screenSpace sprites draw whatever the camera does', n(b, '#ff0008') > n(a, '#ff0008') && n(a, '#ff0008') > 10, { a: a.seen, b: b.seen });
  check('C7 a sprite with its own draw() runs it every frame even off screen', a.ownCalls >= a.frames - 1 && b.ownCalls > a.ownCalls, { a, b });
  check('C8 an animation keeps its clock while its sprite is culled', a.ani > 0, a.ani);
  check('C9 after the camera moves to x=1000 the sprite there is drawn', n(b, '#ff0007') > 5 && n(a, '#ff0007') === 0, { a: a.seen, b: b.seen });
  check('C10 ...and the one that was on screen stops being drawn',
    n(b, '#ff0002') - n(a, '#ff0002') <= 2 && b.frames - a.frames > 20, { a: a.seen, b: b.seen });
  const c = await clean(page, errors);
  check('C11 no errors', c.ok, c.detail);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// S: square() uses the fill colour, like rect().
{
  const { ctx, page, frame, errors } = await open(`
function setup() { new Canvas(200, 100); }
function draw() {
  background('#000000');
  noStroke();
  fill('#ff0000'); square(10, 10, 40);
  fill('#0000ff'); square(110, 10, 40, 6);
  noFill(); stroke('#00ff00'); strokeWeight(4); square(60, 60, 30);
}`, 10);
  check('S1 square() fills with fill() (was always black)', near(await pixel(frame, 30, 30), 255, 0, 0), await pixel(frame, 30, 30));
  check('S2 square(x, y, s, r) takes a corner radius like rect()', near(await pixel(frame, 130, 30), 0, 0, 255), await pixel(frame, 130, 30));
  check('S3 noFill() leaves a square hollow and stroke() outlines it',
    near(await pixel(frame, 75, 75), 0, 0, 0) && near(await pixel(frame, 60, 75), 0, 255, 0),
    { inside: await pixel(frame, 75, 75), edge: await pixel(frame, 60, 75) });
  const c = await clean(page, errors);
  check('S4 no errors', c.ok, c.detail);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// T: Tiles.
{
  const { ctx, page, frame, errors } = await open(`
function setup() {
  new Canvas(400, 200);
  world.gravity.y = 10;
  walls = new Group(); walls.collider = 'static'; walls.color = 'gray';
  coins = new Group(); coins.collider = 'none'; coins.diameter = 14; coins.value = 5;
  gems = new Group(); gems.collider = 'none';
  level = new Tiles([
    '##########',
    '#  c  c  #',
    '#   💎    #',
    '##########',
  ], 20, 20, 40, 40, { '#': walls, 'c': coins, '💎': gems });
  ball = new Sprite(200, 70, 20);
  errs = [];
  for (const bad of [
    () => new Tiles('##', 0, 0, 10, 10, { '#': walls }),
    () => new Tiles(['##'], 0, 0, 0, 10, { '#': walls }),
    () => new Tiles(['##'], 0, 0, 10, 10),
    () => new Tiles(['##'], 0, 0, 10, 10, { '#': 'gray' }),
  ]) { try { bad(); errs.push(null); } catch (e) { errs.push(e.constructor.name + ': ' + e.message); } }
}`, 60);
  const r = await frame.evaluate(() => ({
    total: level.length, walls: walls.length, coins: coins.length, gems: gems.length,
    isGroup: level instanceof Group, firstPos: [level[0].x, level[0].y], firstSize: [level[0].w, level[0].h],
    coinShape: coins[0].shape, coinW: coins[0].w, coinValue: coins[0].value, coinPos: [coins[0].x, coins[0].y],
    gemPos: [gems[0].x, gems[0].y], wallCollider: walls[0].collider, ballY: ball.y,
    filtered: level.filter((s) => s.collider === 'static') instanceof Tiles, errs,
  }));
  check('T1 one sprite per legend character, nothing for spaces', r.total === 27 && r.walls === 24 && r.coins === 2 && r.gems === 1, r);
  check('T2 x, y is the centre of the top-left tile; tiles are w x h', JSON.stringify(r.firstPos) === '[20,20]' && JSON.stringify(r.firstSize) === '[40,40]', r);
  check('T3 group defaults apply (collider, diameter, custom fields) and win over the tile size',
    r.wallCollider === 'static' && r.coinShape === 'circle' && r.coinW === 14 && r.coinValue === 5, r);
  check('T4 cells land at x + col*w, y + row*h, an emoji counts as one cell',
    JSON.stringify(r.coinPos) === '[140,60]' && JSON.stringify(r.gemPos) === '[180,100]', r);
  check('T5 the Tiles object is a Group of every sprite it made; filter() hands back a plain Group', r.isGroup && r.filtered === false, r);
  check('T6 a ball dropped inside lands on the tile floor (static walls hold)', r.ballY > 100 && r.ballY < 141, r.ballY);
  check('T7 bad arguments throw a TypeError that names the argument',
    r.errs.every((e) => e && e.startsWith('TypeError: new Tiles(map, x, y, w, h, legend)')) &&
    /map must be/.test(r.errs[0]) && /w must be/.test(r.errs[1]) && /legend must be/.test(r.errs[2]) && /legend\['#'\]/.test(r.errs[3]), r.errs);
  const after = await frame.evaluate(() => { level.delete(); return { level: level.length, walls: walls.length, coins: coins.length }; });
  check('T8 level.delete() removes the whole level from its groups too', after.level === 0 && after.walls === 0 && after.coins === 0, after);
  const c = await clean(page, errors);
  check('T9 no errors', c.ok, c.detail);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// W: Walls.
{
  const { ctx, page, frame, errors } = await open(`
function setup() {
  try { new Walls(); } catch (e) { early = e.message; }
  new Canvas(300, 200);
  world.gravity.y = 10;
  walls = new Walls();
  balls = new Group(); balls.diameter = 16; balls.bounciness = 0.9;
  for (let i = 0; i < 8; i++) { const b = new balls.Sprite(40 + i * 30, 100); b.vel.x = (i % 2 ? 1 : -1) * 25; b.vel.y = -20; }
  escaped = 0; floorHits = 0;
}
function update() {
  for (const b of balls) if (b.x < 0 || b.x > 300 || b.y < 0 || b.y > 200) escaped++;
  if (balls[0].colliding(walls.bottom)) floorHits++;
}`, 150);
  const r = await frame.evaluate(() => ({
    early, n: walls.length, isGroup: walls instanceof Group,
    kinds: walls.map((s) => s.collider), named: [walls.top, walls.bottom, walls.left, walls.right].every((s) => walls.includes(s)),
    bottom: [walls.bottom.x, walls.bottom.y, walls.bottom.w, walls.bottom.h].map((v) => Math.round(v * 1000) / 1000),
    left: [walls.left.x, walls.left.y, walls.left.w, walls.left.h].map((v) => Math.round(v * 1000) / 1000),
    keys: Object.keys(walls).filter((k) => !/^\d+$/.test(k)), escaped, floorHits,
  }));
  check('W1 new Walls() before new Canvas() says so', /must come after new Canvas/.test(r.early || ''), r.early);
  check('W2 four static walls, a Group, also named top/bottom/left/right', r.n === 4 && r.isGroup && r.kinds.every((k) => k === 'static') && r.named, r);
  check('W3 the walls sit just outside the canvas (inner faces on the edges)',
    JSON.stringify(r.bottom) === '[150,225,400,50]' && JSON.stringify(r.left) === '[-25,100,50,200]', r);
  check('W4 the names are not enumerable (so new walls.Sprite() does not copy them)', r.keys.length === 0, r.keys);
  check('W5 fast bouncing balls stay inside the canvas', r.escaped === 0, r.escaped);
  check('W6 colliding(walls.bottom) works as a floor test', r.floorHits > 0, r.floorHits);
  const c = await clean(page, errors);
  check('W7 no errors', c.ok, c.detail);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// F: every / after.
{
  const { ctx, page, frame, errors } = await open(`
function setup() {
  new Canvas(100, 100);
  ticks = 0; once = 0; stopped = 0; wrong = []; spawned = 0;
  every(10, () => ticks++);
  after(30, () => once++);
  h = every(5, () => { stopped++; if (stopped === 4) h.stop(); });
  every(20, () => { after(1, () => spawned++); });   // a timer may start another
  errs = [];
  for (const bad of [() => every(0, () => {}), () => after('a', () => {}), () => every(5)]) {
    try { bad(); errs.push(null); } catch (e) { errs.push(e.message); }
  }
}
function drawTop() {
  if (ticks !== Math.floor(frameCount / 10)) wrong.push(['every', frameCount, ticks]);
  if (once !== (frameCount >= 30 ? 1 : 0)) wrong.push(['after', frameCount, once]);
}`, 70);
  const r = await frame.evaluate(() => ({ f: frameCount, ticks, once, stopped, active: h.active, wrong: wrong.slice(0, 5), spawned, errs }));
  check('F1 every(10, fn) fires on the frames frameCount % 10 === 0 would', r.wrong.filter((w) => w[0] === 'every').length === 0 && r.ticks >= 6, r);
  check('F2 after(30, fn) fires once, on frame 30', r.wrong.filter((w) => w[0] === 'after').length === 0 && r.once === 1, r);
  check('F3 stop() cancels a timer (stopped after its 4th call)', r.stopped === 4 && r.active === false, r);
  check('F4 a timer can start another timer', r.spawned >= Math.floor((r.f - 1) / 20) && r.spawned >= 2, r);
  check('F5 bad arguments throw a message naming the function',
    /^every\(frames, fn\): frames/.test(r.errs[0]) && /^after\(frames, fn\): frames/.test(r.errs[1]) && /^every\(frames, fn\): fn/.test(r.errs[2]), r.errs);
  const c = await clean(page, errors);
  check('F6 no errors', c.ok, c.detail);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// N: addSensor as a ground sensor.
{
  const { ctx, page, frame, errors } = await open(`
function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  ground = new Sprite(200, 290, 400, 20, 'static');
  wall = new Sprite(300, 150, 20, 300, 'static');
  ceiling = new Sprite(100, 60, 120, 20, 'static');
  player = new Sprite(150, 200, 30, 40);
  player.rotationLock = true;
  massBefore = player.mass;
  feet = player.addSensor(0, 21, 26, 4);
  massAfter = player.mass;
  log = { floor: null, wall: null, ceiling: null };
  phase = 'floor';
}
function update() {
  if (phase === 'wall') { player.vel.x = 4; }
}
function drawTop() {
  if (frameCount === 60) {
    log.floor = { feet: feet.overlaps(ground), body: player.colliding(ground) > 0, n: feet.overlapping(ground) };
    phase = 'wall'; player.y = 150; world.gravity.y = 0; player.vel.y = 0;
  }
  if (frameCount === 100) {
    log.wall = { feet: feet.overlaps(wall), body: player.colliding(wall) > 0 };
    phase = 'ceiling'; player.x = 100; player.y = 92; player.vel.x = 0; world.gravity.y = -10;
  }
  if (frameCount === 140) {
    log.ceiling = { feet: feet.overlaps(ceiling), body: player.colliding(ceiling) > 0, group: feet.overlaps(allSprites) };
  }
}`, 160);
  const r = await frame.evaluate(() => ({ log, massBefore, massAfter }));
  check('N1 on the floor: the feet sensor overlaps the ground', r.log.floor && r.log.floor.feet && r.log.floor.body && r.log.floor.n > 1, r.log.floor);
  check('N2 against a wall: colliding() is true but the feet sensor is false', r.log.wall && r.log.wall.body && !r.log.wall.feet, r.log.wall);
  check('N3 under a ceiling: colliding() is true but the feet sensor is false', r.log.ceiling && r.log.ceiling.body && !r.log.ceiling.feet && !r.log.ceiling.group, r.log.ceiling);
  check("N4 adding a sensor does not change the sprite's mass", Math.abs(r.massBefore - r.massAfter) < 1e-9, r);
  const c = await clean(page, errors);
  check('N5 no errors', c.ok, c.detail);
  await ctx.close();
}
{
  // A sensor pushes nothing, colliding() ignores it, and it goes when told to
  // or when its sprite does.
  const { ctx, page, frame, errors } = await open(`
function setup() {
  new Canvas(300, 200);
  world.gravity.y = 0;
  host = new Sprite(100, 100, 20, 20, 'static');
  zone = host.addSensor(60, 0, 60, 60);
  visitor = new Sprite(160, 100, 10, 10);
  bad = null; try { host.addSensor('a'); } catch (e) { bad = e.message; }
}`, 30);
  const r1 = await frame.evaluate(() => ({ seen: zone.overlaps(visitor), n: zone.overlapping(visitor), hostColl: host.colliding(visitor), vx: visitor.vel.x, vy: visitor.vel.y, x: visitor.x, bad }));
  check('N6 a sensor detects a dynamic sprite inside it', r1.seen && r1.n > 1, r1);
  check('N7 ...without pushing it or counting as colliding()', r1.hostColl === 0 && r1.vx === 0 && r1.vy === 0 && Math.abs(r1.x - 160) < 1e-6, r1);
  check('N8 a bad argument throws a message naming it', /addSensor\(offsetX, offsetY, w, h\): offsetX must be a number/.test(r1.bad || ''), r1.bad);
  await frame.evaluate(() => zone.remove());
  await waitFrames(frame, 5);
  const r2 = await frame.evaluate(() => ({ seen: zone.overlaps(visitor), fixtures: (() => { let n = 0; for (let f = host._body.getFixtureList(); f; f = f.getNext()) n++; return n; })() }));
  check('N9 sensor.remove() takes it off (one fixture left, nothing seen)', r2.seen === false && r2.fixtures === 1, r2);
  await frame.evaluate(() => { zone2 = visitor.addSensor(); visitor.delete(); });
  await waitFrames(frame, 5);
  const r3 = await frame.evaluate(() => ({ removed: zone2._removed }));
  check('N10 deleting the sprite takes its sensors with it', r3.removed === true, r3);
  const c = await clean(page, errors);
  check('N11 no errors', c.ok, c.detail);
  await ctx.close();
}

await browser.close();
srv.close();

let failed = 0;
for (const [name, pass, detail] of results) {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  -> ${detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
