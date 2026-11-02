// Scenario: world.origin = 'math' — the opt-in coordinate mode with (0, 0) at
// the canvas CENTRE, y growing UP and angles counter-clockwise. The default
// ('screen': top-left, y down) must not move by a pixel, so the last block
// runs the same sketch with the origin never set and with 'screen' set by
// hand and demands identical output. Exercises the REAL surface (browser
// runner). Pass condition: every check prints PASS; exit code 0 only if all
// pass.
import { launch, serve, runSketch, waitFrames, mouseMove, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// Reads one pixel out of the runner's canvas (rgb only).
function pixel(frame, x, y) {
  return frame.evaluate(([px, py]) => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(px, py, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }, [x, y]);
}
// Counts near-white pixels in a rectangle of the canvas (for "where is the ink").
function inkCount(frame, x, y, w, h) {
  return frame.evaluate(([px, py, pw, ph]) => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(px, py, pw, ph).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 160 && d[i + 1] > 160 && d[i + 2] > 160) n++;
    return n;
  }, [x, y, w, h]);
}
const near = (p, r, g, b) => p && Math.abs(p.r - r) < 40 && Math.abs(p.g - g) < 40 && Math.abs(p.b - b) < 40;

// A 400x300 canvas: the centre is pixel (200, 150). World (100, 50) in math
// mode is therefore pixel (300, 100): right of and ABOVE the centre.
const PLACEMENT = `
function setup() {
  new Canvas(400, 300);
  world.origin = 'math';
  s = new Sprite(100, 50, 20, 20, 'static');
  s.color = '#ff0000';
  // A bar turned 30 degrees: counter-clockwise means its right end rises.
  bar = new Sprite(100, -80, 120, 10, 'static');
  bar.color = '#00ff00';
  bar.rotation = 30;
  // Two rows of static tiles: the first string is the TOP row.
  g = new Group(); g.collider = 'static'; g.color = '#0000ff';
  tiles = new Tiles(['a', 'a'], 150, 100, 20, 20, { a: g });
  // A picture whose top half is magenta and bottom half cyan.
  const c = document.createElement('canvas'); c.width = 2; c.height = 2;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ff00ff'; cx.fillRect(0, 0, 2, 1);
  cx.fillStyle = '#00ffff'; cx.fillRect(0, 1, 2, 1);
  pic = new Sprite(-150, 100, 40, 40, 'static');
  pic.image = c;
  // A label on a sprite the colour of the background: only the 'T' shows.
  lab = new Sprite(0, -100, 10, 10, 'static');
  lab.color = '#000000';
  lab.text = 'T'; lab.textSize = 40;
  walls = new Walls();
}
function draw() {
  background('#000000');
  noStroke();
  fill('#ffffff');
  text('TEXT', -100, 0, 40);
}
`;

// Camera follows a sprite far from the origin: it draws at the centre pixel.
const FOLLOW = `
function setup() {
  new Canvas(400, 300);
  world.origin = 'math';
  player = new Sprite(300, 200, 30, 30, 'static');
  player.color = '#ff0000';
}
function draw() {
  camera.x = player.x;
  camera.y = player.y;
  background('#000000');
}
`;

// Motion without gravity: vel.y = 5 goes UP the screen, direction 90 is up,
// a positive rotationSpeed turns counter-clockwise.
const MOTION = `
function setup() {
  new Canvas(400, 300);
  world.origin = 'math';
  mover = new Sprite(0, 0, 20, 20); mover.color = '#ff0000'; mover.vel.y = 5;
  dir = new Sprite(100, -100, 20, 20); dir.color = '#00ff00'; dir.speed = 3; dir.direction = 90;
  spinner = new Sprite(-100, 0, 60, 10); spinner.rotationSpeed = 2;
  startDir = dir.vel.y;
}
// Frozen at frame 20 so the numbers are exact: 5 px/frame for 20 frames is 100.
function draw() { background('#000000'); if (frameCount === 20) noLoop(); }
`;

// Gravity: a falling world in math mode is gravity.y = -10, and the sprite
// lands on a floor at y = -150 (floor top at -140, sprite's half height 10).
const GRAVITY = `
function setup() {
  new Canvas(400, 300);
  world.origin = 'math';
  world.gravity.y = -10;
  faller = new Sprite(-100, 100, 20, 20); faller.color = '#ff0000';
  floor = new Sprite(0, -150, 400, 20, 'static'); floor.color = '#444444';
}
function draw() { background('#000000'); }
`;

// showGrid(): the labels are read back by patching fillText in the frame to
// record where each string landed in canvas pixels. The y-axis labels sit
// 4px right of the axis line.
const GRID = (origin) => `
window.__labels = [];
const _ft = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function (t, x, y) {
  const p = this.getTransform().transformPoint(new DOMPoint(x, y));
  window.__labels.push({ t: String(t), x: p.x, y: p.y });
  return _ft.apply(this, arguments);
};
function setup() {
  new Canvas(400, 300);
  ${origin ? "world.origin = '" + origin + "';" : ''}
  still = new Sprite(${origin === 'math' ? '60, 60' : '260, 90'}, 20, 20);
  before = allSprites.length;
}
function draw() {
  __labels.length = 0;
  background('#000000');
  showGrid(50);
  showMouse();
}
`;

const BAD = `
function setup() {
  new Canvas(400, 300);
  errs = {};
  try { world.origin = 'polar'; } catch (e) { errs.invalid = e.message; }
  try { world.origin = 42; } catch (e) { errs.number = e.message; }
  world.origin = 'math';
  world.origin = 'math'; // same value again is fine
  s = new Sprite(0, 0, 20, 20);
  try { world.origin = 'screen'; } catch (e) { errs.late = e.message; }
  stillMath = world.origin;
}
function draw() { background('#000000'); }
`;

// The same sketch twice: origin never mentioned, and 'screen' set by hand.
// Both must draw the sprite at pixel (100, 50), move vel.y = 5 DOWN (onto the
// floor, which it reaches by frame 36), fall under gravity.y = 10 onto the same
// floor at y = 250, and produce the same canvas.
const SCREEN = (explicit) => `
function setup() {
  new Canvas(400, 300);
  ${explicit ? "world.origin = 'screen';" : ''}
  world.gravity.y = 10;
  s = new Sprite(100, 50, 20, 20, 'static'); s.color = '#ff0000';
  mover = new Sprite(300, 50, 20, 20); mover.gravityScale = 0; mover.color = '#00ff00'; mover.vel.y = 5;
  faller = new Sprite(200, 100, 20, 20); faller.color = '#0000ff';
  floor = new Sprite(200, 250, 400, 20, 'static');
  frozen = null;
}
function draw() {
  background('#000000');
  fill('#ffffff');
  text('HUD', 10, 20, 16);
  if (frameCount === 90) {
    frozen = { s: [s.x, s.y], mover: [mover.x, mover.y], faller: [faller.x, faller.y], cam: [camera.x, camera.y] };
    noLoop();
  }
}
`;

const srv = await serve(8192);
const browser = await launch();

// ---------------------------------------------------------------------------
// M1: placement, pictures, text, tiles, walls, the mouse.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, PLACEMENT);
  await waitFrames(frame, 20);

  check('M1a a sprite at (100, 50) draws right of and ABOVE the centre (pixel 300,100 is red)',
    near(await pixel(frame, 300, 100), 255, 0, 0), JSON.stringify(await pixel(frame, 300, 100)));
  check('M1b ...and not where screen mode would put it (pixel 100,50 is black)',
    near(await pixel(frame, 100, 50), 0, 0, 0), JSON.stringify(await pixel(frame, 100, 50)));

  // bar centre is pixel (300, 230); 50px along a 30-degree CCW bar is (+43, -25).
  const tip = await pixel(frame, 343, 205);
  const wrongWay = await pixel(frame, 343, 255);
  check('M1c rotation = 30 turns counter-clockwise (the bar\'s right end is above its centre)',
    near(tip, 0, 255, 0) && !near(wrongWay, 0, 255, 0), JSON.stringify({ tip, wrongWay }));

  const rows = await frame.evaluate(() => ({ row0: tiles[0].y, row1: tiles[1].y }));
  check('M1d Tiles puts row 0 at the top: its y is LARGER than row 1\'s',
    rows.row0 === 100 && rows.row1 === 80, JSON.stringify(rows));
  check('M1e ...and both tiles are drawn where those numbers say (pixels 350,50 and 350,70 are blue)',
    near(await pixel(frame, 350, 50), 0, 0, 255) && near(await pixel(frame, 350, 70), 0, 0, 255),
    JSON.stringify([await pixel(frame, 350, 50), await pixel(frame, 350, 70)]));

  const picTop = await pixel(frame, 50, 38), picBottom = await pixel(frame, 50, 62);
  check('M1f a picture on a sprite is not upside down (top half magenta, bottom half cyan)',
    near(picTop, 255, 0, 255) && near(picBottom, 0, 255, 255), JSON.stringify({ picTop, picBottom }));

  // text('TEXT', -100, 0): baseline on the x axis (pixel row 150), letters rise above it.
  const above = await inkCount(frame, 100, 108, 100, 40);
  const below = await inkCount(frame, 100, 152, 100, 40);
  check('M1g text() is not mirrored: the letters sit ABOVE their baseline, none below',
    above > 100 && below === 0, JSON.stringify({ above, below }));
  // sprite.text 'T' centred on pixel (200, 250): the crossbar is in the top half.
  const labTop = await inkCount(frame, 170, 228, 60, 20);
  const labBottom = await inkCount(frame, 170, 252, 60, 20);
  check('M1h a sprite label is not mirrored: the T\'s crossbar is in the top half',
    labTop > labBottom * 1.5 && labTop > 20, JSON.stringify({ labTop, labBottom }));

  const w = await frame.evaluate(() => ({ top: walls.top.y, bottom: walls.bottom.y, left: walls.left.x, right: walls.right.x }));
  check('M1i Walls: top is the larger y, bottom the smaller, left negative, right positive',
    w.top > 150 && w.bottom < -150 && w.left < -200 && w.right > 200, JSON.stringify(w));

  // Pixel (300, 100) is right of and above the centre: both coordinates positive.
  await mouseMove(frame, 300, 100);
  await waitFrames(frame, 2);
  const m = await frame.evaluate(() => ({ x: mouse.x, y: mouse.y, mx: mouseX, my: mouseY, cp: mouse.canvasPos, hit: world.getSpriteAt(mouse.x, mouse.y) === s }));
  check('M1j the mouse right of and above the centre reads positive x and positive y (100, 50)',
    Math.abs(m.x - 100) < 1.5 && Math.abs(m.y - 50) < 1.5 && m.mx === m.x && m.my === m.y, JSON.stringify(m));
  check('M1k ...and world.getSpriteAt(mouse.x, mouse.y) finds the sprite drawn there',
    m.hit === true && Math.abs(m.cp.x - 100) < 1.5 && Math.abs(m.cp.y - 50) < 1.5, JSON.stringify(m));

  check('M1l zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/math-origin-verified.png', fullPage: true });
  await page.close();
}

// ---------------------------------------------------------------------------
// M2: the camera follows in math coordinates.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const frame = await runSketch(page, srv.base, FOLLOW);
  await waitFrames(frame, 10);
  const centre = await pixel(frame, 200, 150);
  const cam = await frame.evaluate(() => ({ x: camera.x, y: camera.y, cp: player.canvasPos }));
  check('M2 camera.x/y = player.x/y puts a player at (300, 200) in the centre pixel',
    near(centre, 255, 0, 0) && cam.x === 300 && cam.y === 200 && cam.cp.x === 0 && cam.cp.y === 0,
    JSON.stringify({ centre, cam }));
  await page.close();
}

// ---------------------------------------------------------------------------
// M3: motion. Up is up, 90 degrees is up, positive spin is counter-clockwise.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const frame = await runSketch(page, srv.base, MOTION);
  await waitFrames(frame, 30);
  const st = await frame.evaluate(() => ({
    moverY: mover.y, dirVelY: startDir, dirY: dir.y, dirDirection: dir.direction,
    spin: spinner.rotation, spinSpeed: spinner.rotationSpeed,
  }));
  check('M3a vel.y = 5 moves the sprite UP: y is 100 after 20 frames',
    Math.abs(st.moverY - 100) < 0.01, JSON.stringify(st));
  check('M3b ...and it is drawn higher on the screen (red at pixel row 150 - 100 = 50, black at row 250)',
    near(await pixel(frame, 200, 50), 255, 0, 0) && near(await pixel(frame, 200, 250), 0, 0, 0),
    JSON.stringify({ up: await pixel(frame, 200, 50), down: await pixel(frame, 200, 250) }));
  check('M3c direction = 90 points UP: vel.y is +3 and y went from -100 to -40',
    Math.abs(st.dirVelY - 3) < 1e-6 && Math.abs(st.dirY - -40) < 0.01 && Math.abs(st.dirDirection - 90) < 1e-6, JSON.stringify(st));
  check('M3d rotationSpeed = 2 turns counter-clockwise: rotation is +40 after 20 frames',
    Math.abs(st.spin - 40) < 0.01 && Math.abs(st.spinSpeed - 2) < 1e-6, JSON.stringify(st));
  await page.close();
}

// ---------------------------------------------------------------------------
// M4: gravity.y = -10 falls DOWN the screen and lands on the floor.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const frame = await runSketch(page, srv.base, GRAVITY);
  await waitFrames(frame, 180);
  const st = await frame.evaluate(() => ({ y: faller.y, x: faller.x, g: world.gravity.y, touching: !!faller.colliding(floor) }));
  check('M4a gravity.y = -10 makes the sprite fall and land on the floor at y = -150 (rests at -130)',
    Math.abs(st.y - -130) < 1.5 && st.touching && st.g === -10, JSON.stringify(st));
  check('M4b ...and it is drawn just above the floor (pixel 100,280 is red)',
    near(await pixel(frame, 100, 280), 255, 0, 0), JSON.stringify(await pixel(frame, 100, 280)));
  await page.close();
}

// ---------------------------------------------------------------------------
// M5: showGrid() labels increase UPWARD in math mode and DOWNWARD in screen
// mode; the grid changes nothing about the world.
for (const origin of ['math', null]) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, GRID(origin));
  await mouseMove(frame, 250, 100);
  await waitFrames(frame, 10);
  const st = await frame.evaluate(() => {
    const axisX = world.origin === 'math' ? 200 : 0;
    const yLabels = __labels.filter((l) => Math.abs(l.x - (axisX + 4)) < 1 && l.t !== '0');
    const find = (t) => yLabels.find((l) => l.t === t);
    return {
      origin: world.origin, n: __labels.length,
      y50: find('50') && find('50').y, y100: find('100') && find('100').y,
      zero: __labels.some((l) => l.t === '0'),
      mouseLabel: __labels.find((l) => /^\(-?\d+, -?\d+\)$/.test(l.t)),
      count: allSprites.length, before, stillAt: [still.x, still.y],
      camera: [camera.x, camera.y],
    };
  });
  const label = origin === 'math' ? 'math' : 'default (screen)';
  const ordered = origin === 'math' ? st.y100 < st.y50 : st.y100 > st.y50;
  check(`M5a ${label}: y labels 50 and 100 exist and 100 is ${origin === 'math' ? 'above' : 'below'} 50`,
    typeof st.y50 === 'number' && typeof st.y100 === 'number' && ordered && st.zero, JSON.stringify(st));
  const expectMouse = origin === 'math' ? '(50, 50)' : '(250, 100)';
  check(`M5b ${label}: showMouse() prints the pointer in the active coordinates ${expectMouse}`,
    st.mouseLabel && st.mouseLabel.t === expectMouse, JSON.stringify(st.mouseLabel));
  const expectAt = origin === 'math' ? [60, 60] : [260, 90];
  check(`M5c ${label}: the grid changes no sprite, position or camera`,
    st.count === st.before && st.count === 1 && st.stillAt[0] === expectAt[0] && st.stillAt[1] === expectAt[1]
      && errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ st, page: errors, runner: await frameErrors(page) }));
  await page.close();
}

// ---------------------------------------------------------------------------
// M6: the setter refuses bad values and late changes, in plain words.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const frame = await runSketch(page, srv.base, BAD);
  await waitFrames(frame, 5);
  const st = await frame.evaluate(() => ({ errs, stillMath }));
  check('M6a world.origin = \'polar\' throws a TypeError naming both choices',
    /screen/.test(st.errs.invalid || '') && /math/.test(st.errs.invalid || '') && /polar/.test(st.errs.invalid || ''),
    JSON.stringify(st.errs.invalid));
  check('M6b world.origin = 42 throws too',
    /screen/.test(st.errs.number || '') && /math/.test(st.errs.number || ''), JSON.stringify(st.errs.number));
  check('M6c changing the origin after a sprite exists throws and the mode stays put',
    /before any sprite/.test(st.errs.late || '') && st.stillMath === 'math', JSON.stringify({ late: st.errs.late, stillMath: st.stillMath }));
  await page.close();
}

// ---------------------------------------------------------------------------
// M7: the default is untouched. Origin never set vs 'screen' set by hand:
// same numbers, same pixels, and the numbers are today's.
{
  const runs = [];
  for (const explicit of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = captureErrors(page);
    const frame = await runSketch(page, srv.base, SCREEN(explicit));
    await waitFrames(frame, 110);
    const st = await frame.evaluate(() => ({
      origin: world.origin, frozen, frame: frameCount,
      png: document.querySelector('canvas').toDataURL(),
    }));
    st.sPx = await pixel(frame, 100, 50);
    st.errors = errors.length + (await frameErrors(page)).length;
    runs.push(st);
    await page.close();
  }
  const [a, b] = runs;
  check('M7a with the origin never set, world.origin reads \'screen\' and the sketch froze at frame 90',
    a.origin === 'screen' && a.frozen && a.frame === 90 && a.errors === 0, JSON.stringify({ origin: a.origin, frame: a.frame, errors: a.errors }));
  check('M7b screen mode: the sprite at (100, 50) is at pixel (100, 50); vel.y = 5 went DOWN to the floor; gravity.y = 10 landed on the floor at y = 250 (rests at 230)',
    near(a.sPx, 255, 0, 0) && Math.abs(a.frozen.mover[1] - 230) < 1.5 && Math.abs(a.frozen.faller[1] - 230) < 1.5 && a.frozen.cam[0] === 200 && a.frozen.cam[1] === 150,
    JSON.stringify(a.frozen));
  check('M7c world.origin = \'screen\' set by hand gives the same numbers...',
    JSON.stringify(a.frozen) === JSON.stringify(b.frozen) && b.origin === 'screen' && b.errors === 0,
    JSON.stringify({ a: a.frozen, b: b.frozen }));
  check('M7d ...and the identical canvas, pixel for pixel',
    a.png === b.png && a.png.length > 1000, JSON.stringify({ aLen: a.png.length, bLen: b.png.length }));
}

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
