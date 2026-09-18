// Scenario: web-swinger — grappling-hook style DistanceJoint swinging across
// a deterministic building city. Exercises the REAL surface (browser runner)
// against games/web-swinger.js. Pass condition: every check prints PASS;
// exit code 0 only if all pass. RED (exit 1) until the game file exists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, launch, serve, runSketch,
  mouseDown, mouseUp, mouseMove, waitFrames,
  captureErrors, frameErrors,
} from './harness.mjs';

const GAME_REL = 'games/web-swinger.js';
const GAME_PATH = join(ROOT, GAME_REL);

let gameSrc;
try {
  gameSrc = readFileSync(GAME_PATH, 'utf8');
} catch {
  console.log('RED: games/web-swinger.js not found');
  process.exit(1);
}

const srv = await serve(8183);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = captureErrors(page);
const frame = await runSketch(page, srv.base, gameSrc);

const results = [];
let framesWaited = 0;
async function wait(n) {
  await waitFrames(frame, n);
  framesWaited += n;
}

const startPos = await frame.evaluate(() => ({ x: player.x, y: player.y }));

// ---- S1: aim at a reachable building top-face point, expect a precise hit -
const picked = await frame.evaluate(() => {
  function rayAABB(px, py, tx, ty, bx, by, bw, bh) {
    const minX = bx - bw / 2, maxX = bx + bw / 2;
    const minY = by - bh / 2, maxY = by + bh / 2;
    const dx = tx - px, dy = ty - py;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) {
      if (px < minX || px > maxX) return null;
    } else {
      let a = (minX - px) / dx, b = (maxX - px) / dx;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return null;
    }
    if (Math.abs(dy) < 1e-9) {
      if (py < minY || py > maxY) return null;
    } else {
      let a = (minY - py) / dy, b = (maxY - py) / dy;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return null;
    }
    return t0;
  }

  const p = { x: player.x, y: player.y };
  const margin = 30;
  let candidate = null;
  for (let i = 0; i < buildings.length && !candidate; i++) {
    const b = buildings[i];
    const topY = b.y - b.h / 2;
    const leftX = b.x - b.w / 2;
    const rightX = b.x + b.w / 2;
    const samples = 24;
    for (let s = 1; s < samples; s++) {
      const tx = leftX + (rightX - leftX) * (s / samples);
      const ty = topY;
      const d = Math.hypot(tx - p.x, ty - p.y);
      if (d > 40 && d < MAXWEB - margin) { candidate = { x: tx, y: ty }; break; }
    }
  }
  if (!candidate) return null;

  let bestT = Infinity, hit = null;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const t = rayAABB(p.x, p.y, candidate.x, candidate.y, b.x, b.y, b.w, b.h);
    if (t !== null && t >= -1e-6 && t <= 1 + 1e-6 && t < bestT) {
      bestT = t;
      hit = { x: p.x + (candidate.x - p.x) * t, y: p.y + (candidate.y - p.y) * t };
    }
  }
  if (!hit) return null;

  return {
    screenX: candidate.x - (camera.x - 230),
    screenY: candidate.y - (camera.y - 150),
    expectedX: hit.x,
    expectedY: hit.y,
  };
});

let attached = false;
if (picked) {
  await mouseMove(frame, picked.screenX, picked.screenY);
  await mouseDown(frame, picked.screenX, picked.screenY);
  await wait(3);

  const s1 = await frame.evaluate((exp) => {
    const webOk = !!window.web;
    const anchorOk = !!window.anchor;
    return {
      webOk, anchorOk,
      ax: anchorOk ? window.anchor.x : null,
      ay: anchorOk ? window.anchor.y : null,
      dx: anchorOk ? Math.abs(window.anchor.x - exp.x) : Infinity,
      dy: anchorOk ? Math.abs(window.anchor.y - exp.y) : Infinity,
    };
  }, { x: picked.expectedX, y: picked.expectedY });

  attached = s1.webOk && s1.anchorOk && s1.dx <= 2 && s1.dy <= 2;
  results.push(['S1 web+anchor attach within 2px of ray hit', attached,
    `web=${s1.webOk} anchor=(${s1.ax},${s1.ay}) expected=(${picked.expectedX.toFixed(1)},${picked.expectedY.toFixed(1)}) dx=${s1.dx} dy=${s1.dy}`]);
} else {
  results.push(['S1 web+anchor attach within 2px of ray hit', false,
    'no building top-face within MAXWEB of the player was found']);
}

// ---- S2/S3: only meaningful once actually attached in S1 -------------------
if (attached) {
  const s2StartX = await frame.evaluate(() => player.x);
  let maxAbsDx = 0, maxSpeed = 0;
  for (let i = 0; i < 4; i++) {
    await wait(30);
    const sample = await frame.evaluate(() => ({ x: player.x, vx: player.vel.x, vy: player.vel.y }));
    maxAbsDx = Math.max(maxAbsDx, Math.abs(sample.x - s2StartX));
    maxSpeed = Math.max(maxSpeed, Math.hypot(sample.vx, sample.vy));
  }
  const s2Pass = maxAbsDx > 60 && maxSpeed > 1.5;
  results.push(['S2 swinging displaces player >60px with speed >1.5', s2Pass,
    `maxAbsDx=${maxAbsDx.toFixed(1)} maxSpeed=${maxSpeed.toFixed(2)}`]);

  const preRelease = await frame.evaluate(() => ({ x: player.vel.x, y: player.vel.y }));
  await mouseMove(frame, 230, 150);
  await mouseUp(frame, 230, 150);
  await wait(3);
  const s3 = await frame.evaluate((pre) => {
    const preMag = Math.hypot(pre.x, pre.y);
    const curMag = Math.hypot(player.vel.x, player.vel.y);
    const within20 = preMag < 0.2 ? curMag < 0.2 : Math.abs(curMag - preMag) / preMag <= 0.2;
    return {
      webNull: window.web === null || window.web === undefined,
      jointsEmpty: player.joints.length === 0,
      within20, preMag, curMag,
    };
  }, preRelease);
  const s3Pass = s3.webNull && s3.jointsEmpty && s3.within20;
  results.push(['S3 release clears web/joints, velocity within 20%', s3Pass,
    `webNull=${s3.webNull} joints=${s3.jointsEmpty} pre=${s3.preMag.toFixed(2)} cur=${s3.curMag.toFixed(2)}`]);
} else {
  results.push(['S2 swinging displaces player >60px with speed >1.5', false, 'skipped: S1 did not attach']);
  results.push(['S3 release clears web/joints, velocity within 20%', false, 'skipped: S1 did not attach']);
}

// ---- S4: fall below the world respawns near the start ---------------------
await frame.evaluate(() => { player.y = 5000; });
await wait(40);
const s4 = await frame.evaluate((start) => ({
  respawns: window.respawns,
  dist: Math.hypot(player.x - start.x, player.y - start.y),
  x: player.x, y: player.y,
}), startPos);
const s4Pass = s4.respawns >= 1 && s4.dist <= 120;
results.push(['S4 falling below world respawns near start', s4Pass,
  `respawns=${s4.respawns} pos=(${s4.x.toFixed(1)},${s4.y.toFixed(1)}) dist=${s4.dist.toFixed(1)}`]);

// ---- S5: aiming beyond MAXWEB+40 never attaches (edge case) ----------------
const farPick = await frame.evaluate(() => {
  const dist = MAXWEB + 200;
  const tx = player.x + dist, ty = player.y;
  if (!(Math.hypot(tx - player.x, ty - player.y) > MAXWEB + 40)) return null;
  return {
    screenX: tx - (camera.x - 230),
    screenY: ty - (camera.y - 150),
    jointsMadeBefore: window.jointsMade,
  };
});

if (farPick) {
  await mouseMove(frame, farPick.screenX, farPick.screenY);
  await mouseDown(frame, farPick.screenX, farPick.screenY);
  await wait(5);
  const s5 = await frame.evaluate((before) => ({
    webNull: window.web === null || window.web === undefined,
    jointsMadeSame: window.jointsMade === before,
  }), farPick.jointsMadeBefore);
  await mouseMove(frame, 230, 150);
  await mouseUp(frame, 230, 150);
  const s5Pass = s5.webNull && s5.jointsMadeSame;
  results.push(['S5 aiming beyond MAXWEB+40 does not attach', s5Pass, JSON.stringify(s5)]);
} else {
  results.push(['S5 aiming beyond MAXWEB+40 does not attach', false,
    'could not construct an out-of-range target']);
}

// ---- error-free run over 300+ frames ---------------------------------------
if (framesWaited < 300) await wait(300 - framesWaited);
const runnerErrors = await frameErrors(page);
const errPass = errors.length === 0 && runnerErrors.length === 0;
results.push(['zero engine errors after 300+ frames', errPass,
  JSON.stringify({ pageErrors: errors, runnerErrors })]);

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await page.screenshot({ path: 'tests/artifacts/web-swinger-verified.png', fullPage: true });

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
