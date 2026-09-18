// Scenario: games/portal.js — a portal-placement/teleport game built on the
// real engine (world.rayCast for placement, live Sprite state for physics).
// Pinned contract: ES5 sketch, Canvas(460,300), gravity 10; bare globals
// player, portals={orange,blue}, teleports, respawns, cooldown, won, timer;
// left click -> orange portal, right click -> blue portal, placement via
// world.rayCast(player center -> mouse) filtering collider === 'none';
// left wall inner edge x=30, right wall inner edge x=430, player starts near
// (60, 250) on the floor. Pass condition: every check prints PASS; exit code
// 0 only if all pass.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launch, serve, runSketch, mouseDown, mouseUp, mouseMove, keyDown, keyUp,
  captureErrors, frameErrors, waitFrames,
} from './harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_PATH = join(__dirname, '..', 'games', 'portal.js');

let gameCode;
try {
  gameCode = readFileSync(GAME_PATH, 'utf8');
} catch {
  console.log('RED: games/portal.js not found');
  process.exit(1);
}

const results = [];
function check(name, pass, detail) {
  results.push([name, !!pass, detail]);
}

// Independent oracle: the SAME raycast the game's own placement logic is
// contracted to run (player center -> target, sensors filtered, closest
// solid hit) so floor/level geometry never has to be hardcoded here.
async function rayOracle(frame, tx, ty) {
  return frame.evaluate(([x, y]) => {
    let hit = null;
    world.rayCast(player.x, player.y, x, y, function (sprite, point, normal, fraction) {
      if (sprite && sprite.collider === 'none') return -1;
      hit = { point: point, normal: normal };
      return fraction;
    });
    return hit;
  }, [tx, ty]);
}

const srv = await serve(8181);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = captureErrors(page);
const frame = await runSketch(page, srv.base, gameCode);
await waitFrames(frame, 10); // let the player settle to rest on the floor

const start = await frame.evaluate(() => ({ x: player.x, y: player.y }));

// ---------------------------------------------------------------------------
// P1: orange portal placement on the floor + contextmenu suppression
// ---------------------------------------------------------------------------
try {
  const t1 = { x: 150, y: 280 };
  const oracle1 = await rayOracle(frame, t1.x, t1.y);

  await mouseMove(frame, t1.x, t1.y);
  await mouseDown(frame, t1.x, t1.y, 'left');
  await waitFrames(frame, 3);
  await mouseUp(frame, t1.x, t1.y, 'left');

  const orange1 = await frame.evaluate(() => (
    portals.orange ? { x: portals.orange.x, y: portals.orange.y } : null
  ));

  check(
    'P1 orange portal placed on floor at raycast hit point',
    !!(oracle1 && orange1
      && Math.abs(orange1.x - oracle1.point.x) < 0.6
      && Math.abs(orange1.y - oracle1.point.y) < 0.6),
    JSON.stringify({ oracle: oracle1 && oracle1.point, orange: orange1 }),
  );

  const cmPrevented = await frame.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(evt);
    return evt.defaultPrevented;
  });
  check('P1 contextmenu is preventDefault-ed by the game', cmPrevented === true, String(cmPrevented));
} catch (e) {
  check('P1 orange portal placed on floor at raycast hit point', false, 'threw: ' + e.message);
  check('P1 contextmenu is preventDefault-ed by the game', false, 'threw: ' + e.message);
}

// ---------------------------------------------------------------------------
// P2: blue on floor, orange on the left wall (known normal), teleport arc
// ---------------------------------------------------------------------------
let p2State = null;
try {
  const p = await frame.evaluate(() => ({ x: player.x, y: player.y }));
  // Horizontal ray at the player's own height -> deterministic hit at the
  // left wall's pinned inner edge (x=30) regardless of exact player start.
  const wallTarget = { x: 10, y: p.y };
  const floorTarget = { x: 250, y: 280 };
  const oracleFloor = await rayOracle(frame, floorTarget.x, floorTarget.y);

  await mouseMove(frame, floorTarget.x, floorTarget.y);
  await mouseDown(frame, floorTarget.x, floorTarget.y, 'right');
  await waitFrames(frame, 2);
  await mouseUp(frame, floorTarget.x, floorTarget.y, 'right');

  await mouseMove(frame, wallTarget.x, wallTarget.y);
  await mouseDown(frame, wallTarget.x, wallTarget.y, 'left');
  await waitFrames(frame, 3);
  await mouseUp(frame, wallTarget.x, wallTarget.y, 'left');

  const placed = await frame.evaluate(() => ({
    blue: portals.blue ? { x: portals.blue.x, y: portals.blue.y, nx: portals.blue.nx, ny: portals.blue.ny } : null,
    orange: portals.orange ? { x: portals.orange.x, y: portals.orange.y, nx: portals.orange.nx, ny: portals.orange.ny } : null,
  }));

  check(
    'P2 blue portal placed on floor at raycast hit point',
    !!(oracleFloor && placed.blue
      && Math.abs(placed.blue.x - oracleFloor.point.x) < 0.6
      && Math.abs(placed.blue.y - oracleFloor.point.y) < 0.6),
    JSON.stringify({ oracle: oracleFloor && oracleFloor.point, blue: placed.blue }),
  );
  check(
    'P2 orange portal placed on left wall inner edge (x=30, normal 1,0)',
    !!(placed.orange
      && Math.abs(placed.orange.x - 30) < 0.6
      && Math.abs(placed.orange.y - p.y) < 0.6
      && Math.abs(placed.orange.nx - 1) < 0.05
      && Math.abs(placed.orange.ny) < 0.05),
    JSON.stringify(placed.orange),
  );

  // Drop the player straight down through the floor (blue) portal.
  await frame.evaluate((b) => {
    player.x = b.x;
    player.y = b.y - 60;
    player.vel.x = 0;
    player.vel.y = 12;
  }, placed.blue);

  // Poll fast: the exit-velocity window is ~2 frames wide (12px/frame flight vs
  // a 40px radius), so the sample has to land within a couple of frames of the
  // teleport — waitFrames(3)'s +150ms slack made polls ~12 game-frames apart.
  let teleportState = null;
  for (let i = 0; i < 60 && !(teleportState && teleportState.teleports >= 1); i++) {
    await frame.waitForTimeout(20);
    teleportState = await frame.evaluate(() => ({
      teleports: teleports, cooldown: cooldown,
      vx: player.vel.x, vy: player.vel.y, x: player.x, y: player.y,
    }));
  }

  const orangeNow = placed.orange;
  const speed = teleportState ? Math.hypot(teleportState.vx, teleportState.vy) : NaN;
  const dirDot = (teleportState && orangeNow && speed)
    ? (teleportState.vx / speed) * orangeNow.nx + (teleportState.vy / speed) * orangeNow.ny
    : NaN;
  const distToOrange = (teleportState && orangeNow)
    ? Math.hypot(teleportState.x - orangeNow.x, teleportState.y - orangeNow.y)
    : NaN;

  check('P2 teleport occurred (teleports >= 1)', !!teleportState && teleportState.teleports >= 1, JSON.stringify(teleportState));
  check('P2 exit speed within +/-10% of 12', Math.abs(speed - 12) <= 1.2, String(speed));
  check('P2 exit direction aligned with orange normal (dot > 0.7)', dirDot > 0.7, String(dirDot));
  check('P2 player exits within 40px of orange portal', distToOrange < 40, String(distToOrange));

  p2State = teleportState && teleportState.teleports >= 1
    ? { orange: orangeNow, teleportsAfter: teleportState.teleports }
    : null;
} catch (e) {
  const msg = 'threw: ' + e.message;
  check('P2 blue portal placed on floor at raycast hit point', false, msg);
  check('P2 orange portal placed on left wall inner edge (x=30, normal 1,0)', false, msg);
  check('P2 teleport occurred (teleports >= 1)', false, msg);
  check('P2 exit speed within +/-10% of 12', false, msg);
  check('P2 exit direction aligned with orange normal (dot > 0.7)', false, msg);
  check('P2 player exits within 40px of orange portal', false, msg);
}

// ---------------------------------------------------------------------------
// P3: cooldown guard right after the teleport, then out-of-bounds respawn
// ---------------------------------------------------------------------------
try {
  if (!p2State) {
    check('P3 cooldown guard prevents immediate re-teleport', false, 'skipped: P2 teleport did not occur');
  } else {
    const before = p2State.teleportsAfter;
    await frame.evaluate((o) => {
      player.vel.x = -o.nx * 12;
      player.vel.y = -o.ny * 12;
    }, p2State.orange);
    await waitFrames(frame, 3);
    const after = await frame.evaluate(() => teleports);
    check('P3 cooldown guard prevents immediate re-teleport', after === before, JSON.stringify({ before, after }));
  }

  await frame.evaluate(() => { player.vel.x = 0; player.vel.y = 0; player.y = 5000; });
  let respawnState = null;
  for (let i = 0; i < 20 && !(respawnState && respawnState.respawns >= 1); i++) {
    await waitFrames(frame, 3);
    respawnState = await frame.evaluate(() => ({ respawns: respawns, x: player.x, y: player.y }));
  }
  const backNearStart = !!respawnState && Math.hypot(respawnState.x - start.x, respawnState.y - start.y) < 10;

  check('P3 falling out of bounds triggers respawn (respawns >= 1)', !!respawnState && respawnState.respawns >= 1, JSON.stringify(respawnState));
  check('P3 respawned player is back near the start position', backNearStart, JSON.stringify({ start, respawnState }));
} catch (e) {
  const msg = 'threw: ' + e.message;
  check('P3 cooldown guard prevents immediate re-teleport', false, msg);
  check('P3 falling out of bounds triggers respawn (respawns >= 1)', false, msg);
  check('P3 respawned player is back near the start position', false, msg);
}

// ---------------------------------------------------------------------------
// P4: plain movement/jump with no portals involved + zero runner errors
// ---------------------------------------------------------------------------
try {
  await frame.evaluate(() => { portals.orange = null; portals.blue = null; });

  const beforeX = await frame.evaluate(() => player.x);
  await keyDown(frame, 'right');
  await waitFrames(frame, 30);
  const afterX = await frame.evaluate(() => player.x);
  await keyUp(frame, 'right');
  check('P4 holding right for 30 frames moves player.x by >= 15px', (afterX - beforeX) >= 15, String(afterX - beforeX));

  await keyDown(frame, 'up');
  let jumpVy = null;
  for (let i = 0; i < 3 && !(jumpVy < 0); i++) {
    await waitFrames(frame, 1);
    jumpVy = await frame.evaluate(() => player.vel.y);
  }
  await keyUp(frame, 'up');
  check('P4 pressing up gives upward (negative) vel.y within 3 frames', jumpVy < 0, String(jumpVy));
} catch (e) {
  const msg = 'threw: ' + e.message;
  check('P4 holding right for 30 frames moves player.x by >= 15px', false, msg);
  check('P4 pressing up gives upward (negative) vel.y within 3 frames', false, msg);
}

await waitFrames(frame, 300);
const runnerErrors = await frameErrors(page);
check('P4 captureErrors(page) is empty after 300+ frames', errors.length === 0, JSON.stringify(errors));
check('P4 frameErrors(page) is empty after 300+ frames', runnerErrors.length === 0, JSON.stringify(runnerErrors));

// ---------------------------------------------------------------------------
let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await page.screenshot({ path: 'tests/artifacts/portal-verified.png', fullPage: true });

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
