// Scenario: games/ray-siege.js — a destructible-fortress siege game built on
// the real engine (world.rayCast for hitscan weapons, world.explodeAt for the
// cannon, live Group state for the brick fortress and its support collapse).
// Pinned contract: ES5 sketch, Canvas(460,300), gravity 10; bare globals
// player, bricks, BRICKS0, weapon, drones, debris, destroyed, hp, score;
// fortress is a deterministic static-rect grid at x >= 260 (brick 14x14) with
// a free-standing column of >=4 bricks. Weapon 1 = rifle (raycast, destroys 1
// brick), weapon 2 = cannon (explodeAt radius ~55, spawns debris), weapon 3 =
// beam (destroys every brick along the ray, ~40-frame cooldown). Destroying a
// brick triggers a 4-connected BFS support check from ground-level statics —
// unsupported static bricks flip collider to 'dynamic' and fall. Pass
// condition: every check prints PASS; exit code 0 only if all pass.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launch, serve, runSketch, mouseDown, mouseUp, mouseMove, keyDown, keyUp,
  captureErrors, frameErrors, waitFrames,
} from './harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_PATH = join(__dirname, '..', 'games', 'ray-siege.js');

let gameCode;
try {
  gameCode = readFileSync(GAME_PATH, 'utf8');
} catch {
  console.log('RED: games/ray-siege.js not found');
  process.exit(1);
}

const results = [];
function check(name, pass, detail) {
  results.push([name, !!pass, detail]);
}

const srv = await serve(8182);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = captureErrors(page);
const frame = await runSketch(page, srv.base, gameCode);

let framesWaited = 0;
async function wait(n) {
  await waitFrames(frame, n);
  framesWaited += n;
}

await wait(10); // let the player settle onto the ground strip

// ---------------------------------------------------------------------------
// Target pickers: independent oracles evaluated in-page (so sprite identity
// never has to cross the frame.evaluate boundary) that discover fortress
// geometry from the LIVE `bricks` group rather than hard-coding layout. Each
// probe ray starts 40px along the aim direction from the player's own center,
// not AT it, so a query never has to reason about whether a ray originating
// inside the player's own fixture reports a degenerate self-hit.
// ---------------------------------------------------------------------------

async function pickFrontBrick(frame) {
  return frame.evaluate(() => {
    function reachable(b) {
      const dx = b.x - player.x, dy = b.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) return false;
      const sx = player.x + (dx / d) * 40, sy = player.y + (dy / d) * 40;
      let hit = null;
      world.rayCast(sx, sy, b.x, b.y, (sprite, point, normal, fraction) => {
        if (sprite && sprite.collider === 'none') return -1;
        hit = sprite;
        return fraction;
      });
      return hit === b;
    }
    let best = null;
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (b.collider !== 'static' || !reachable(b)) continue;
      if (!best || b.x < best.x || (b.x === best.x && b.y < best.y)) best = b;
    }
    return best ? { x: best.x, y: best.y } : null;
  });
}

async function pickCollapsePair(frame) {
  return frame.evaluate(() => {
    function reachable(b) {
      const dx = b.x - player.x, dy = b.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) return false;
      const sx = player.x + (dx / d) * 40, sy = player.y + (dy / d) * 40;
      let hit = null;
      world.rayCast(sx, sy, b.x, b.y, (sprite, point, normal, fraction) => {
        if (sprite && sprite.collider === 'none') return -1;
        hit = sprite;
        return fraction;
      });
      return hit === b;
    }
    const cols = {};
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (b.collider !== 'static') continue;
      const key = Math.round(b.x);
      (cols[key] = cols[key] || []).push(b);
    }
    for (const key in cols) {
      const col = cols[key].slice().sort((a, b) => a.y - b.y);
      for (let j = 0; j < col.length - 1; j++) {
        const upper = col[j], lower = col[j + 1];
        if (Math.abs(upper.x - lower.x) > 1) continue;
        if (Math.abs((lower.y - upper.y) - 14) > 2) continue;
        if (!reachable(lower)) continue;
        return { lowerX: lower.x, lowerY: lower.y, upperX: upper.x, upperY: upper.y };
      }
    }
    return null;
  });
}

async function pickDenseCluster(frame) {
  return frame.evaluate(() => {
    function reachable(b) {
      const dx = b.x - player.x, dy = b.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) return false;
      const sx = player.x + (dx / d) * 40, sy = player.y + (dy / d) * 40;
      let hit = null;
      world.rayCast(sx, sy, b.x, b.y, (sprite, point, normal, fraction) => {
        if (sprite && sprite.collider === 'none') return -1;
        hit = sprite;
        return fraction;
      });
      return hit === b;
    }
    const statics = [];
    for (let i = 0; i < bricks.length; i++) if (bricks[i].collider === 'static') statics.push(bricks[i]);
    let best = null, bestCount = -1;
    for (let i = 0; i < statics.length; i++) {
      const b = statics[i];
      if (!reachable(b)) continue;
      let count = 0;
      for (let j = 0; j < statics.length; j++) {
        if (i === j) continue;
        if (Math.hypot(statics[j].x - b.x, statics[j].y - b.y) <= 55) count++;
      }
      if (count > bestCount) { bestCount = count; best = b; }
    }
    return best ? { x: best.x, y: best.y, neighbors: bestCount } : null;
  });
}

async function pickDeepRow(frame) {
  return frame.evaluate(() => {
    function reachable(b) {
      const dx = b.x - player.x, dy = b.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) return false;
      const sx = player.x + (dx / d) * 40, sy = player.y + (dy / d) * 40;
      let hit = null;
      world.rayCast(sx, sy, b.x, b.y, (sprite, point, normal, fraction) => {
        if (sprite && sprite.collider === 'none') return -1;
        hit = sprite;
        return fraction;
      });
      return hit === b;
    }
    const rows = {};
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (b.collider !== 'static') continue;
      const key = Math.round(b.y);
      (rows[key] = rows[key] || []).push(b);
    }
    let bestRow = null;
    for (const key in rows) if (!bestRow || rows[key].length > bestRow.length) bestRow = rows[key];
    if (!bestRow) return null;
    let far = null;
    for (let i = 0; i < bestRow.length; i++) {
      if (!reachable(bestRow[i])) continue;
      if (!far || bestRow[i].x > far.x) far = bestRow[i];
    }
    return far ? { x: far.x, y: far.y, rowLen: bestRow.length } : null;
  });
}

// ---------------------------------------------------------------------------
// R1: default weapon (rifle) fired at the front-most reachable brick destroys
// at least one brick.
// ---------------------------------------------------------------------------
try {
  const n0 = await frame.evaluate(() => bricks.length);
  const target = await pickFrontBrick(frame);
  if (!target) throw new Error('no reachable static brick found');
  await mouseMove(frame, target.x, target.y);
  await mouseDown(frame, target.x, target.y);
  await wait(3);
  const after = await frame.evaluate(() => ({ len: bricks.length, destroyed }));
  await mouseUp(frame, target.x, target.y);
  check('R1 rifle destroys >=1 brick on hit (bricks.length<=n0-1, destroyed>=1)',
    after.len <= n0 - 1 && after.destroyed >= 1,
    JSON.stringify({ n0, ...after }));
} catch (e) {
  check('R1 rifle destroys >=1 brick on hit (bricks.length<=n0-1, destroyed>=1)', false, 'threw: ' + e.message);
}

// ---------------------------------------------------------------------------
// R2: destroying a brick's sole support flips the now-unsupported brick above
// it to a falling dynamic body.
// ---------------------------------------------------------------------------
try {
  const pair = await pickCollapsePair(frame);
  if (!pair) throw new Error('no static column pair (~14px apart, same x) found');
  await mouseMove(frame, pair.lowerX, pair.lowerY);
  await mouseDown(frame, pair.lowerX, pair.lowerY);
  await mouseUp(frame, pair.lowerX, pair.lowerY);
  await wait(30);
  const upperAfter = await frame.evaluate(([ux, uy0]) => {
    // Re-locate by position: a fallen dynamic brick can only have moved DOWN
    // from its own original spot, so the nearest-to-original match at the
    // same x is unambiguously the same piece (columns are 14px apart).
    let best = null;
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (Math.abs(b.x - ux) > 3 || b.y < uy0 - 2) continue;
      if (!best || b.y < best.y) best = b;
    }
    return best ? { collider: best.collider, y: best.y } : null;
  }, [pair.upperX, pair.upperY]);
  const dy = upperAfter ? upperAfter.y - pair.upperY : -Infinity;
  check('R2 destroying the supporting brick drops the unsupported one (collider dynamic, y+>=4)',
    !!upperAfter && upperAfter.collider === 'dynamic' && dy >= 4,
    JSON.stringify({ pair, upperAfter, dy }));
} catch (e) {
  check('R2 destroying the supporting brick drops the unsupported one (collider dynamic, y+>=4)', false, 'threw: ' + e.message);
}

// ---------------------------------------------------------------------------
// R3: switching to the cannon and firing into a dense cluster drops several
// bricks at once and spawns debris.
// ---------------------------------------------------------------------------
try {
  await keyDown(frame, '2');
  await keyUp(frame, '2');
  await wait(2);
  const w2 = await frame.evaluate(() => weapon);
  check('R3a weapon key "2" switches to the cannon (weapon===2)', w2 === 2, String(w2));
} catch (e) {
  check('R3a weapon key "2" switches to the cannon (weapon===2)', false, 'threw: ' + e.message);
}

try {
  const n0 = await frame.evaluate(() => bricks.length);
  const target = await pickDenseCluster(frame);
  if (!target) throw new Error('no reachable dense brick cluster found');
  await mouseMove(frame, target.x, target.y);
  await mouseDown(frame, target.x, target.y);
  await mouseUp(frame, target.x, target.y);
  await wait(10);
  const after = await frame.evaluate(() => ({ len: bricks.length, debrisLen: debris.length }));
  check('R3b cannon blast drops bricks.length by >=3 and spawns debris',
    (n0 - after.len) >= 3 && after.debrisLen > 0,
    JSON.stringify({ n0, after, neighbors: target.neighbors }));
} catch (e) {
  check('R3b cannon blast drops bricks.length by >=3 and spawns debris', false, 'threw: ' + e.message);
}

// ---------------------------------------------------------------------------
// R4: weapon switching (1 -> 3 -> 1), the beam destroying every brick along
// its ray in one shot, and drones closing distance on the player.
// ---------------------------------------------------------------------------
try {
  await keyDown(frame, '1');
  await keyUp(frame, '1');
  await wait(2);
  const w1 = await frame.evaluate(() => weapon);
  check('R4a weapon key "1" switches to the rifle (weapon===1)', w1 === 1, String(w1));
} catch (e) {
  check('R4a weapon key "1" switches to the rifle (weapon===1)', false, 'threw: ' + e.message);
}

try {
  await keyDown(frame, '3');
  await keyUp(frame, '3');
  await wait(2);
  const w3 = await frame.evaluate(() => weapon);
  check('R4b weapon key "3" switches to the beam (weapon===3)', w3 === 3, String(w3));
} catch (e) {
  check('R4b weapon key "3" switches to the beam (weapon===3)', false, 'threw: ' + e.message);
}

try {
  const n0 = await frame.evaluate(() => bricks.length);
  const row = await pickDeepRow(frame);
  if (!row) throw new Error('no reachable static brick row found');
  await mouseMove(frame, row.x, row.y);
  await mouseDown(frame, row.x, row.y);
  await mouseUp(frame, row.x, row.y);
  await wait(10);
  const after = await frame.evaluate(() => bricks.length);
  const expectMin = Math.min(2, row.rowLen);
  check('R4c beam destroys every brick along the ray in one shot (drop >= min(2,rowLen))',
    (n0 - after) >= expectMin,
    JSON.stringify({ n0, after, rowLen: row.rowLen, expectMin }));
} catch (e) {
  check('R4c beam destroys every brick along the ray in one shot (drop >= min(2,rowLen))', false, 'threw: ' + e.message);
}

try {
  await keyDown(frame, '1');
  await keyUp(frame, '1');
  await wait(2);
  const w1b = await frame.evaluate(() => weapon);
  check('R4d weapon key "1" switches back to the rifle after the beam (weapon===1)', w1b === 1, String(w1b));
} catch (e) {
  check('R4d weapon key "1" switches back to the rifle after the beam (weapon===1)', false, 'threw: ' + e.message);
}

try {
  let count = await frame.evaluate(() => drones.length);
  let polled = 0;
  while (count === 0 && polled < 240) {
    await wait(20);
    polled += 20;
    count = await frame.evaluate(() => drones.length);
  }
  if (count === 0) throw new Error('drones.length stayed 0 for 240+ frames');
  const d0 = await frame.evaluate(() => Math.hypot(drones[0].x - player.x, drones[0].y - player.y));
  await wait(60);
  const d1 = await frame.evaluate(() => (
    drones.length > 0 ? Math.hypot(drones[0].x - player.x, drones[0].y - player.y) : Infinity
  ));
  check('R4e drone seeks the player: distance(player,drones[0]) decreases by >=5 over 60 frames',
    (d0 - d1) >= 5,
    JSON.stringify({ d0, d1, delta: d0 - d1 }));
} catch (e) {
  check('R4e drone seeks the player: distance(player,drones[0]) decreases by >=5 over 60 frames', false, 'threw: ' + e.message);
}

// ---------------------------------------------------------------------------
// error-free run over 300+ frames
// ---------------------------------------------------------------------------
if (framesWaited < 300) await wait(300 - framesWaited);
const runnerErrors = await frameErrors(page);
check('zero page errors after 300+ frames', errors.length === 0, JSON.stringify(errors));
check('zero runner errors after 300+ frames', runnerErrors.length === 0, JSON.stringify(runnerErrors));

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await page.screenshot({ path: 'tests/artifacts/ray-siege-verified.png', fullPage: true });

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
