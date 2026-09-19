// Scenario: the three starter demos — asteroids, platformer, runner. These
// ship on the homepage alongside the three raycast games but had no coverage,
// so every regression in them was invisible. Exercises the REAL surface
// (browser runner) against games/*.js. Pass condition: every check prints
// PASS; exit code 0 only if all pass.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, launch, serve, runSketch,
  keyDown, keyUp, waitFrames, captureErrors, frameErrors,
} from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch {
    console.log('RED: ' + rel + ' not found');
    process.exit(1);
  }
}

// A tap is a press held long enough for the engine to see the edge, then
// released — kb.presses() is edge-triggered and resets after the frame.
async function tap(frame, key, hold = 2) {
  await keyDown(frame, key);
  await waitFrames(frame, hold);
  await keyUp(frame, key);
}

// Poll an in-page predicate. Used where the game's own timers decide when
// something exists (runner spawns obstacles every 55-100 frames).
async function until(frame, fn, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (await frame.evaluate(fn)) return true;
    await waitFrames(frame, 6);
  }
  return false;
}

const srv = await serve(8185);
const browser = await launch();

async function boot(rel) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, read(rel));
  await waitFrames(frame, 20); // let the sketch settle on its ground
  return { page, frame, errors };
}

// ---------------------------------------------------------------------------
// ASTEROIDS: thrust/rotate/fire, and the fail state (rocks cost a life).
{
  const { page, frame, errors } = await boot('games/asteroids.js');

  check('A1 boots with 5 rocks, 3 lives, alive',
    await frame.evaluate(() => asteroids.length === 5 && lives === 3 && alive === true),
    await frame.evaluate(() => ({ rocks: asteroids.length, lives: lives, alive: alive })));

  await keyDown(frame, 'ArrowUp');
  await waitFrames(frame, 30);
  await keyUp(frame, 'ArrowUp');
  const thrust = await frame.evaluate(() => Math.hypot(ship.vel.x, ship.vel.y));
  check('A2a holding thrust builds speed (> 1 px/frame)', thrust > 1, String(thrust));

  const spun = await frame.evaluate(async () => {
    const before = ship.rotation;
    return { before: before };
  });
  await keyDown(frame, 'ArrowRight');
  await waitFrames(frame, 15);
  await keyUp(frame, 'ArrowRight');
  const rot = await frame.evaluate(() => ship.rotation);
  check('A2b holding right turns the ship', Math.abs(rot - spun.before) > 10,
    JSON.stringify({ before: spun.before, after: rot }));

  // Deterministic gunnery: one rock parked dead ahead of a stationary ship.
  await frame.evaluate(() => {
    asteroids.slice().forEach((a) => a.delete());
    bullets.slice().forEach((b) => b.delete());
    ship.x = 100; ship.y = 150; ship.rotation = 0; ship.vel.x = 0; ship.vel.y = 0;
    const a = new asteroids.Sprite(220, 150, 26);
    a.vel.x = 0; a.vel.y = 0;
    score = 0;
  });
  await waitFrames(frame, 5);
  await tap(frame, ' ');
  await waitFrames(frame, 50);
  const shot = await frame.evaluate(() => ({ score: score, rocks: asteroids.length }));
  check('A3 a bullet destroys the rock ahead and scores (score 1, rock respawned)',
    shot.score === 1 && shot.rocks === 1, JSON.stringify(shot));

  // Ram a rock three times: a life each, then game over.
  const hits = [];
  for (let i = 0; i < 3; i++) {
    await frame.evaluate(() => {
      const a = asteroids[0];
      a.x = ship.x; a.y = ship.y; a.vel.x = 0; a.vel.y = 0;
    });
    await waitFrames(frame, 8);
    hits.push(await frame.evaluate(() => ({
      lives: lives, alive: alive, invuln: invuln,
      x: +ship.x.toFixed(1), y: +ship.y.toFixed(1),
    })));
    await waitFrames(frame, 95); // ride out the invulnerability window
  }
  check('A4a first hit costs a life and recentres the ship at (230,150)',
    hits[0].lives === 2 && hits[0].x === 230 && hits[0].y === 150, JSON.stringify(hits[0]));
  check('A4b the hit grants temporary invulnerability (invuln > 0)',
    hits[0].invuln > 0, String(hits[0].invuln));
  check('A4c lives count down 2 -> 1 -> 0',
    hits[1].lives === 1 && hits[2].lives === 0, JSON.stringify(hits.map((h) => h.lives)));
  check('A4d the last life ends the game (alive === false)',
    hits[2].alive === false, String(hits[2].alive));

  await tap(frame, ' ');
  await waitFrames(frame, 20);
  const restarted = await frame.evaluate(() => ({
    lives: lives, alive: alive, score: score, rocks: asteroids.length,
  }));
  check('A5 space restarts a fresh game (3 lives, score 0, 5 rocks, alive)',
    restarted.lives === 3 && restarted.alive === true && restarted.score === 0 && restarted.rocks === 5,
    JSON.stringify(restarted));

  await waitFrames(frame, 60);
  check('A6 zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/asteroids-verified.png', fullPage: true });
  await page.close();
}

// ---------------------------------------------------------------------------
// PLATFORMER: climbing, an upward-only camera, and a respawn that fires while
// the player is still near the screen edge rather than deep out of sight.
{
  const { page, frame, errors } = await boot('games/platformer.js');

  const boot0 = await frame.evaluate(() => ({
    platforms: platforms.length, camY: camera.y, y: +player.y.toFixed(1), best: best,
  }));
  check('P1 boots with a platform stack and the camera at 150',
    boot0.platforms > 20 && boot0.camY === 150, JSON.stringify(boot0));

  // Jump from the ground: the engine gates the jump on contact, so land first.
  await frame.evaluate(() => { player.x = 230; player.y = 260; player.vel.x = 0; player.vel.y = 0; });
  await waitFrames(frame, 20);
  await frame.evaluate(() => {
    window.__jump = { minVy: 0 };
    (function watch() {
      if (player.vel.y < window.__jump.minVy) window.__jump.minVy = player.vel.y;
      requestAnimationFrame(watch);
    })();
  });
  await tap(frame, 'ArrowUp');
  await waitFrames(frame, 10);
  const jump = await frame.evaluate(() => window.__jump.minVy);
  check('P2 jumping off a platform gives upward velocity', jump < -2, String(jump));

  // The camera tracks the player upward and never scrolls back down.
  await frame.evaluate(() => { player.x = 230; player.y = 40; player.vel.x = 0; player.vel.y = 0; });
  await waitFrames(frame, 8);
  const up = await frame.evaluate(() => +camera.y.toFixed(1));
  check('P3a the camera follows the player up (camera.y <= 50)', up <= 50, String(up));

  // Probe the fall in-page: a cross-process poll is several frames coarse, and
  // the whole point of the check is where the respawn trips to the frame.
  await frame.evaluate(() => {
    window.__fall = { maxBelow: -1e9 };
    (function watch() {
      const below = player.y - camera.y;
      if (below > window.__fall.maxBelow) window.__fall.maxBelow = below;
      requestAnimationFrame(watch);
    })();
    player.x = 20; player.y = camera.y + 60; player.vel.x = 0; player.vel.y = 6;
  });
  await waitFrames(frame, 150);
  const fell = await frame.evaluate(() => +window.__fall.maxBelow.toFixed(1));
  const back = await frame.evaluate(() => ({ y: +player.y.toFixed(1), camY: +camera.y.toFixed(1) }));
  // Canvas is 300 tall and the camera is centred, so the bottom edge sits at
  // camera.y + 150 and an 18px player is fully hidden by +159.
  check('P3b falling off the bottom respawns near the edge, not deep out of sight (<= 175)',
    fell <= 175, 'max ' + fell + 'px below camera (screen edge = 150)');
  check('P4 the respawn returns the player to the start and resets the camera',
    Math.abs(back.y - 270.6) < 6 && back.camY === 150, JSON.stringify(back));

  check('P5 zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/platformer-verified.png', fullPage: true });
  await page.close();
}

// ---------------------------------------------------------------------------
// RUNNER: jumping, the obstacle conveyor, and a game over that holds its frame.
{
  const { page, frame, errors } = await boot('games/runner.js');

  const boot0 = await frame.evaluate(() => ({
    alive: alive, score: score, speed: speed,
    sensorDebug: groundSensor.debug === true, sensorColor: groundSensor.color,
  }));
  check('R1a boots alive at score 0', boot0.alive === true && boot0.score === 0, JSON.stringify(boot0));
  // The ground sensor is bookkeeping, not scenery: with debug on the engine
  // draws its wireframe and a green box rides under the player.
  check('R1b the ground sensor draws nothing (debug off)', boot0.sensorDebug === false,
    'groundSensor.debug = ' + boot0.sensorDebug);

  await frame.evaluate(() => {
    window.__j = { minY: 1e9 };
    (function watch() {
      if (player.y < window.__j.minY) window.__j.minY = player.y;
      requestAnimationFrame(watch);
    })();
  });
  const rest = await frame.evaluate(() => +player.y.toFixed(1));
  await tap(frame, ' ');
  await waitFrames(frame, 30);
  const peak = await frame.evaluate(() => +window.__j.minY.toFixed(1));
  check('R2 a jump lifts the player clear of a 40px obstacle (>= 45px of rise)',
    rest - peak >= 45, JSON.stringify({ rest: rest, peak: peak, rise: +(rest - peak).toFixed(1) }));

  const spawned = await until(frame, () => obstacles.length > 0);
  const moving = spawned && await frame.evaluate(() => obstacles[0].vel.x < 0);
  check('R3 obstacles spawn and travel leftward', spawned && moving,
    JSON.stringify(await frame.evaluate(() => obstacles.map((o) => ({ x: +o.x.toFixed(0), vx: +o.vel.x.toFixed(2) })))));

  // Park an obstacle on the player to force the collision deterministically.
  await frame.evaluate(() => { const o = obstacles[0]; o.x = player.x; o.y = player.y; });
  await waitFrames(frame, 15);
  const died = await frame.evaluate(() => ({
    alive: alive, vels: obstacles.map((o) => +o.vel.x.toFixed(2)),
  }));
  check('R4a colliding with an obstacle ends the run', died.alive === false, JSON.stringify(died));
  check('R4b the track freezes on death (every obstacle vel.x === 0)',
    died.vels.length > 0 && died.vels.every((v) => v === 0), JSON.stringify(died.vels));

  await waitFrames(frame, 180); // three seconds parked on the game-over frame
  const held = await frame.evaluate(() => ({
    x: +player.x.toFixed(1), y: +player.y.toFixed(1),
    onScreen: player.x > 0 && player.x < 460 && player.y > 0 && player.y < 300,
  }));
  check('R4c the dead player stays on screen (not bulldozed off the ground)',
    held.onScreen === true, JSON.stringify(held));

  await tap(frame, ' ');
  await waitFrames(frame, 20);
  const restarted = await frame.evaluate(() => ({
    alive: alive, score: score, obstacles: obstacles.length,
  }));
  check('R5 space restarts (alive, score 0, track cleared)',
    restarted.alive === true && restarted.score === 0 && restarted.obstacles === 0,
    JSON.stringify(restarted));

  check('R6 zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/runner-verified.png', fullPage: true });
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
