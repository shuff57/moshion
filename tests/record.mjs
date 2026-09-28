// Records gameplay footage of the six demo games at 20fps.
//
// Two things make this fiddly, and both are load-bearing:
//
// 1. 20fps is a *rate*, not a screenshot loop. The browser composites at ~60Hz,
//    so `Page.startScreencast({everyNthFrame: 3})` samples every third composite
//    frame -- ~20/s -- and the frames arrive already JPEG-compressed with a
//    per-frame sessionId we must ack or the stream stalls. A `setInterval`
//    screenshot loop instead races the compositor and drops frames, which
//    stretches the footage past real time and makes a fast game look slow.
//
// 2. We record the real surface: the homepage's demo panel, tab by tab, driven
//    through the same runner.html iframe a visitor gets. Not sandbox.html.
//
// Usage:  bun tests/record.mjs [--only=game]
// Output: tests/artifacts/replay/<game>.webm  +  <game>-sheet.png (the contact
//         sheet is what I review -- see encode() below for why).
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve, launch, ROOT, keyDown, keyUp, mouseDown, mouseUp, mouseMove } from './harness.mjs';

const OUT = join(ROOT, 'tests/artifacts/replay');
const FPS = 20;
const EVERY_NTH_FRAME = 3; // 60Hz compositor / 3 = 20fps

// ---- input helpers ---------------------------------------------------------
// at() is the only thing a timeline needs: it stamps a group of actions onto
// the clock. Everything below is a plain action taking (frame, page).
const at = (ms, ...acts) => [ms, async (frame, page) => {
  for (const a of acts) await a(frame, page);
}];
const move = (x, y) => async (frame) => mouseMove(frame, x, y);
const hold = (k) => async (frame) => keyDown(frame, k);
const release = (k) => async (frame) => keyUp(frame, k);
const wait = (ms) => async (frame, page) => page.waitForTimeout(ms);
const tap = (k, holdMs = 50) => async (frame, page) => {
  await keyDown(frame, k);
  await page.waitForTimeout(holdMs);
  await keyUp(frame, k);
};
const click = (x, y, button = 'left') => async (frame, page) => {
  await mouseMove(frame, x, y);
  await page.waitForTimeout(40);
  await mouseDown(frame, x, y, button);
  await page.waitForTimeout(70);
  await mouseUp(frame, x, y, button);
};
// Press-and-hold, for the one game (web-swinger) that keeps a web attached
// between mousedown and mouseup.
const grab = (x, y) => async (frame, page) => {
  await mouseMove(frame, x, y);
  await page.waitForTimeout(40);
  await mouseDown(frame, x, y, 'left');
};
const let_go = () => async (frame) => {
  await frame.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('mouseup', {
      clientX: r.left, clientY: r.top, button: 0, buttons: 0, bubbles: true,
    }));
  });
};
// mouse.x/y are WORLD coords, so a game with a moving camera cannot be aimed
// with a hardcoded screen point. Read the live camera and convert:
// screen = world - (camera - halfCanvas).
const atWorld = (wx, wy) => async (frame) => {
  const s = await frame.evaluate(([x, y]) => {
    const c = document.querySelector('canvas');
    return { x: x - (camera.x - c.width / 2), y: y - (camera.y - c.height / 2) };
  }, [wx, wy]);
  await mouseMove(frame, Math.round(s.x), Math.round(s.y));
};
const grabWorld = (wx, wy) => async (frame) => {
  const s = await frame.evaluate(([x, y]) => {
    const c = document.querySelector('canvas');
    return { x: x - (camera.x - c.width / 2), y: y - (camera.y - c.height / 2) };
  }, [wx, wy]);
  await mouseMove(frame, Math.round(s.x), Math.round(s.y));
  await frame.waitForTimeout(40);
  await mouseDown(frame, Math.round(s.x), Math.round(s.y), 'left');
};
// ---- per-game input timelines ---------------------------------------------
// Each entry is [atMs, fn] -- run fn(frame, page) that many ms after recording
// starts. Mouse coords go through the harness helpers, which already convert
// through the canvas's displayed scale exactly the way the engine converts
// them back -- so a 400x300 game in a 900px-wide frame still aims where the
// code says it should. Keys are the DOM values a real keyboard sends
// ('ArrowLeft', ' ') because the engine aliases them to kb.pressing('left') etc.
//
// Everything here is deliberately PLAYER input -- keys, clicks, cursor moves.
// No poking game state via the eval bridge: the footage is only worth anything
// if a person could have produced it.
const SCRIPTS = {
  // Places an orange portal high on the right wall, a blue one on the floor
  // directly under the spawn, then jumps. Falling back onto blue exits the
  // player at the right wall inside the goal zone -> CHAMBER COMPLETE.
  portal: [
    at(150, move(432, 60)), // also arms mouse.isActive, without which a click is ignored
    at(500, click(432, 60)), // left = orange, on the raycast hit against the right wall
    at(900, move(60, 280)),
    at(1200, click(60, 280, 'right')), // right = blue, straight down onto the floor
    at(1700, tap(' ')), // jump -> fall onto blue -> teleport -> goal
    at(2100, move(300, 120)), // keep the tracer visible on the win screen
    at(10500, hold('ArrowRight')), // walk off the ledge afterwards
  ],

  // Weapons 1/2/3, then the tower, then the drone that spawns at frame 200.
  'ray-siege': [
    at(250, move(384, 200)),
    at(600, click(384, 200)), // rifle: one brick
    at(1000, tap('2')), // cannon
    at(1400, click(280, 263)), // tower base -- the explosion collapses the column
    at(2400, move(384, 179)),
    at(2700, click(384, 179)),
    at(3000, tap('3')), // beam
    at(3300, click(120, 230)), // sweep a full row in one shot
    at(4200, tap('1')),
    at(4500, click(430, 220)),
    at(5000, hold('ArrowRight')), // walk out to meet the drone
    at(8600, release('ArrowRight')),
    at(8900, click(300, 150)), // shoot at it
    at(9600, click(300, 150)),
    at(10300, click(300, 150)),
  ],

  // The web attaches where the cursor ray hits, so aim in WORLD coords and let
  // mouseAtWorld() convert through the live camera. Attaching also shoves the
  // player off its perch, which is what starts the swing.
  'web-swinger': [
    at(1200, atWorld(20, 460)), // anchor tower top
    at(1800, grab(20, 460)), // attach, hold
    at(2400, hold('ArrowUp')), // reel in
    at(3300, let_go()), // let go, keep the swing velocity
    at(3600, hold('ArrowRight')), // air control
    at(5200, release('ArrowRight')),
    at(5600, atWorld(120, 460)), // the perch tower
    at(6100, grab(120, 460)),
    at(6600, hold('ArrowUp')),
    at(7600, let_go()),
    at(7900, hold('ArrowRight')),
    at(9400, release('ArrowRight')),
    at(9800, atWorld(460, 560)), // the first orb, off to the right
    at(10200, move(0, 0)),
  ],

  // Spin-and-thrust is the genre-correct way to fly this, and tapping space is
  // the only way to shoot: kb.presses is edge-triggered, so holding it fires once.
  asteroids: [
    at(300, hold('ArrowUp'), hold('ArrowLeft')),
    at(600, tap(' ')),
    at(1000, tap(' ')),
    at(1500, release('ArrowLeft')),
    at(1600, hold('ArrowRight')),
    at(1900, tap(' ')),
    at(2300, tap(' ')),
    at(2800, release('ArrowRight')),
    at(2900, hold('ArrowLeft'), hold('ArrowUp')),
    at(3300, tap(' ')),
    at(3800, tap(' ')),
    at(4300, tap(' ')),
    at(4800, release('ArrowLeft')),
    at(4900, hold('ArrowRight')),
    at(5300, tap(' ')),
    at(5800, tap(' ')),
    at(6300, release('ArrowRight')),
    at(6400, hold('ArrowUp')), // straight shot off the top
    at(6900, tap(' ')),
    at(7400, tap(' ')),
    at(8000, release('ArrowUp')), // coast, drifting
    at(8600, hold('ArrowLeft'), hold('ArrowUp')),
    at(9100, tap(' ')),
    at(9700, tap(' ')),
    at(10300, release('ArrowLeft')),
  ],

  // A blind jump cadence tops out around height 24 in 11s: a jump carries ~119px
  // sideways and the rungs are 86-130px apart, so a fixed beat can only ever be
  // roughly right. Aimed climbing was tried and was WORSE (height 13) -- steering
  // toward a rung thrashes the arrow keys faster than the jump resolves. Kept as
  // the honest best effort; the pit death at the end is the part that matters.
  platformer: [
    at(300, hold('ArrowRight')),
    at(600, tap('ArrowUp')), at(850, tap('ArrowUp')), at(1100, tap('ArrowUp')),
    at(1350, tap('ArrowUp')), at(1600, tap('ArrowUp')), at(1850, tap('ArrowUp')),
    at(2100, tap('ArrowUp')), at(2350, tap('ArrowUp')), at(2600, tap('ArrowUp')),
    at(2850, tap('ArrowUp')), at(3100, tap('ArrowUp')), at(3350, tap('ArrowUp')),
    at(3600, tap('ArrowUp')), at(3850, tap('ArrowUp')), at(4100, tap('ArrowUp')),
    at(4350, tap('ArrowUp')), at(4600, tap('ArrowUp')), at(4850, tap('ArrowUp')),
    at(5100, tap('ArrowUp')), at(5350, tap('ArrowUp')), at(5600, tap('ArrowUp')),
    at(5850, tap('ArrowUp')), at(6100, tap('ArrowUp')),
    at(6800, release('ArrowRight')),
    at(7000, hold('ArrowRight')), // walk off into the gap in the new ground
    at(9600, release('ArrowRight')),
    at(9900, hold('ArrowLeft'), tap('ArrowUp')),
  ],

  // Jump on a ~450ms cadence (obstacles spawn every 55-100 frames, so a fixed
  // beat sometimes wastes a press mid-air; extra presses are simply ignored
  // while airborne). Then stop jumping on purpose to eat one, and restart.
  runner: [
    at(400, tap('ArrowUp')),
    at(1200, tap('ArrowUp')),
    at(1700, tap('ArrowUp')),
    at(2300, tap('ArrowUp')),
    at(2900, tap('ArrowUp')),
    at(3500, tap('ArrowUp')),
    at(4100, tap('ArrowUp')),
    at(4700, tap('ArrowUp')),
    at(5300, tap('ArrowUp')),
    at(5900, tap('ArrowUp')),
    at(6500, tap('ArrowUp')),
    at(7000, tap('ArrowUp')),
    at(7400, move(120, 120)), // lift the cursor off the canvas: it is a jump key here
    at(7600, release('ArrowUp')),
    at(7800, wait(1500)), // coast into the obstacle -> GAME OVER
    at(9400, tap('ArrowUp')), // restart
    at(10500, tap('ArrowUp')),
  ],
};

const GAMES = Object.keys(SCRIPTS);

// ---- recorder --------------------------------------------------------------
async function screencast(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: Date.now(), buf: Buffer.from(f.data, 'base64') });
    // Ack or the compositor stops sending after a few frames.
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: 92, everyNthFrame: EVERY_NTH_FRAME,
  });
  return {
    count: () => frames.length,
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      await cdp.detach().catch(() => {});
      return frames;
    },
  };
}

function encode(name, frames, crop) {
  // Chromium does NOT hand back one frame per compositor tick under load -- across
  // a six-game run the capture rate fell from 20/s to 10/s. Writing whatever
  // arrived and then declaring -framerate 20 turns a 10s session into a 5s
  // slow-motion clip, which is worse than no footage: it lies about how fast the
  // game plays. So the output is built on a real 50ms grid and a missed slot
  // repeats the previous frame. The screen genuinely did not change in those
  // slots, so holding is the truthful reconstruction, and the clip is real-time.
  const STEP = 1000 / FPS;
  const t0 = frames[0].t;
  const tEnd = frames[frames.length - 1].t;
  const grid = [];
  let next = 0;
  for (let t = t0; t <= tEnd; t += STEP) {
    while (next < frames.length - 1 && frames[next + 1].t <= t) next++;
    grid.push(frames[next].buf);
  }

  // Raw frames are kept, not deleted: the contact sheet is for scanning, but
  // when something looks off I need the full-res frame behind it.
  const framesDir = join(OUT, name);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  grid.forEach((b, i) => writeFileSync(join(framesDir, `${String(i).padStart(5, '0')}.jpg`), b));

  // VP9 in webm: ffmpeg here has no libx264. -crf 28 at this size is visually
  // clean for reviewing gameplay and keeps the artifacts small.
  const filter = crop
    ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=trunc(iw/2)*2:trunc(ih/2)*2`
    : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', String(FPS), '-i', join(framesDir, '%05d.jpg'),
    '-vf', filter,
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    join(OUT, `${name}.webm`),
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ${name}: ${r.stderr}`);

  // Contact sheet: what I actually review. I cannot watch video, so this grid
  // is the evidence -- 2fps across the whole clip, labelled by position.
  spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', join(OUT, `${name}.webm`),
    '-vf', 'fps=2,scale=320:-2,tile=6x4', '-frames:v', '1',
    join(OUT, `${name}-sheet.png`),
  ], { encoding: 'utf8' });
  return { path: join(OUT, `${name}.webm`), held: grid.length };
}

// ---- end-of-clip state probe -----------------------------------------------
// Every sketch publishes a "Globals (QA contract)" block, so the final frame's
// numbers are readable without guessing from pixels. This is what turns "it
// looked like nothing happened" into "score went 0 -> 1 and lives 3 -> 1".
// Read-only: it never writes game state.
const PROBE = {
  portal: '{teleports, respawns, won, timer: Math.round(timer)}',
  'ray-siege': '{score, destroyed, BRICKS0, pct: Math.round(destroyed / BRICKS0 * 100), hp, drones: drones.length, weapon}',
  'web-swinger': '{score, respawns, jointsMade, orbs: collectibles.length, towers: buildings.length, spd: +Math.hypot(player.vel.x, player.vel.y).toFixed(2)}',
  asteroids: '{score, lives, alive, rocks: asteroids.length, bullets: bullets.length}',
  platformer: '{best, rungs: platforms.length, camY: Math.round(camera.y)}',
  runner: '{score, alive, speed: +speed.toFixed(2), obstacles: obstacles.length}',
};

async function probe(frame, name) {
  const expr = PROBE[name];
  if (!expr) return null;
  try {
    return await frame.evaluate(`(() => { try { return ${expr}; } catch (e) { return { probeError: String(e.message) }; } })()`);
  } catch (e) {
    return { probeError: String(e.message).split('\n')[0] };
  }
}

// ---- driver ----------------------------------------------------------------
async function record(name, srv, browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(srv.base + '/', { waitUntil: 'load' });
  await page.click(`.demo-tab[data-game="${name}"]`);
  await page.waitForTimeout(1200); // boot, fetch, and the first physics frames
  const frame = page.frames().find((f) => f.url().includes('runner.html'));
  if (!frame) throw new Error(`${name}: no runner frame`);

  const canvas = await frame.locator('canvas').boundingBox();
  if (!canvas) throw new Error(`${name}: no canvas`);
  // A little padding so any overflow/error banner is visible in the footage.
  const pad = 8;
  const crop = {
    x: Math.max(0, Math.round(canvas.x - pad)),
    y: Math.max(0, Math.round(canvas.y - pad)),
    w: Math.round(canvas.width + pad * 2),
    h: Math.round(canvas.height + pad * 2),
  };

  const cast = await screencast(page);
  const t0 = Date.now();
  for (const [atMs, fn] of SCRIPTS[name]) {
    const wait = atMs - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await fn(frame, page);
  }
  // Hold the final state briefly so the last frames aren't a blur.
  await page.waitForTimeout(400);
  const elapsed = Date.now() - t0;
  const frames = await cast.stop();
  // Read the final state while the frame is still alive -- page.close() kills it.
  const state = await probe(frame, name);
  const { path, held } = encode(name, frames, crop);
  return { path, held, captured: frames.length, elapsed, errs, state };
}

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;

const srv = await serve();
const browser = await launch();
mkdirSync(OUT, { recursive: true });
const only = arg('only', '');

let bad = 0;
for (const name of GAMES) {
  if (only && name !== only) continue;
  const r = await record(name, srv, browser);
  const flag = r.errs.length ? `  ERRORS: ${r.errs.slice(0, 2).join(' | ')}` : '';
  if (r.errs.length) bad++;
  console.log(
    `${name.padEnd(12)} captured ${String(r.captured).padStart(3)} ` +
    `(${(r.captured / (r.elapsed / 1000)).toFixed(1)}/s)  -> video ${r.held} frames = ${(r.held / FPS).toFixed(1)}s ` +
    `of ${(r.elapsed / 1000).toFixed(1)}s real  -> ${r.path.replace(ROOT + '/', '')}${flag}`
  );
  console.log(`${' '.repeat(13)}final state: ${JSON.stringify(r.state)}`);
}
await browser.close();
await srv.close();
process.exit(bad ? 1 : 0);
