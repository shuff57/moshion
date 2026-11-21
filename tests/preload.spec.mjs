// Scenario: preload(), the optional hook that runs once before setup() and
// makes the game wait for the files it asks for (docs/LOAD-SPEC.md, owner's
// decisions 2026-11-17). Exercises the REAL surface (sandbox.html -> runner
// iframe) against a server that can answer slowly, or never:
//   /__delay/<ms>/<path>   the file at <path>, after <ms>
//   /__hang/<name>         never answers
//   /__json                {"world1":[1,2,3]}
// Pass condition: every check prints PASS; exit code 0 only if all pass.
// Takes about 15 s: two checks need the real 10-second stall.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, serve, runSketch, waitFrames, frameErrors, ROOT } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const hung = [];
function extra(req, res) {
  const url = new URL(req.url, 'http://x');
  const cors = { 'access-control-allow-origin': '*' };
  const answer = (path) => {
    if (path === '/__json') {
      res.writeHead(200, { ...cors, 'content-type': 'application/json' });
      res.end('{"world1":[1,2,3]}');
      return;
    }
    try {
      const data = readFileSync(join(ROOT, path));
      const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream';
      res.writeHead(200, { ...cors, 'content-type': type });
      res.end(data);
    } catch {
      res.writeHead(404, cors);
      res.end('not found');
    }
  };
  if (url.pathname === '/__json') { answer('/__json'); return true; }
  const m = /^\/__delay\/(\d+)(\/.*)$/.exec(url.pathname);
  if (m) { setTimeout(() => answer(m[2]), Number(m[1])); return true; }
  if (url.pathname.startsWith('/__hang/')) { hung.push(res); return true; }
  return false;
}

const srv = await serve(8196, extra);
const B = srv.base;
const browser = await launch();

async function open(code, { args } = {}) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'warn') warnings.push(m.text()); });
  const frame = await runSketch(page, B, code);
  return { page, frame, warnings };
}
const ev = (frame, fn) => frame.evaluate(fn);
async function noteText(frame) {
  return frame.evaluate(() => {
    const el = document.querySelector('[data-moshion-preload]');
    return el ? el.textContent : null;
  });
}
async function until(frame, fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await frame.evaluate(fn)) return true;
    await frame.waitForTimeout(50);
  }
  return false;
}

// ---- P1-P3, P7a, P8: a slow load (1.5 s) of a sound, a JSON file and a picture.
const SLOW = `
var log = [];
var t0 = performance.now();
var noteSeen = false;
new MutationObserver(function () {
  if (document.querySelector('[data-moshion-preload]')) noteSeen = true;
}).observe(document.body, { childList: true, subtree: true });
function preload() {
  log.push('preload');
  jump = loadSound('${B}/__delay/1500/assets/coin.wav');
  levels = loadJSON('${B}/__delay/1200/__json');
  hero = loadImage('${B}/__delay/900/textures/apple.png');
  inPreloadWorld = levels.world1;
}
function setup() {
  log.push('setup');
  setupAt = performance.now() - t0;
  ms0 = millis();
  new Canvas(200, 200);
  heroW = hero.width;
  world1 = levels.world1;
  jumpLoaded = jump.loaded;
  player = new Sprite(100, 100, 20, 20);
  player.image = hero;
}
function draw() { background(0); }
`;
{
  const { page, frame } = await open(SLOW);
  // Around 0.8 s in: still loading, the note shows with a count.
  await frame.waitForTimeout(250);
  const midLog = await ev(frame, () => log.slice());
  const midNote = await noteText(frame);
  check('P1a setup() waits while files are loading', JSON.stringify(midLog) === '["preload"]', JSON.stringify(midLog));
  check('P7a a slow load shows "Loading... N of 3 files"', /^Loading\.\.\. [0-3] of 3 files$/.test(midNote || ''), String(midNote));
  await until(frame, () => log.length === 2, 5000);
  const st = await ev(frame, () => ({ log, setupAt, ms0, heroW, world1, jumpLoaded, inPreloadWorld: inPreloadWorld === undefined ? 'undefined' : inPreloadWorld }));
  check('P1b preload() runs once, before setup(), and setup() after the last file',
    JSON.stringify(st.log) === '["preload","setup"]' && st.setupAt >= 1400, st);
  check('P2 in setup(): the JSON is filled in, the picture has a width, the sound is loaded',
    JSON.stringify(st.world1) === '[1,2,3]' && st.heroW > 0 && st.jumpLoaded === true, st);
  check('P8 millis() counts from setup(), not from the loading', st.ms0 >= 0 && st.ms0 < 100, String(st.ms0));
  await waitFrames(frame, 10);
  check('P7b the note is gone once the game starts', (await noteText(frame)) === null, String(await noteText(frame)));
  check('P1c the game runs after the wait', (await ev(frame, () => frameCount)) > 3, String(await ev(frame, () => frameCount)));
  await page.close();
}

// ---- P4: a file that fails never stops the game; the console names it once.
const MISSING = `
function preload() {
  levels = loadJSON('${B}/nope/levels.json');
  hero = loadImage('${B}/nope/hero.png');
  jump = loadSound('${B}/nope/jump.wav');
}
function setup() { new Canvas(200, 200); started = true; }
`;
{
  const { page, frame, warnings } = await open(MISSING);
  const started = await until(frame, () => typeof started !== 'undefined' && started, 3000);
  const named = ['levels.json', 'hero.png', 'jump.wav'].map((f) => warnings.filter((w) => w.includes(f)).length);
  check('P4 three missing files: the game still starts, one console line names each',
    started && named.every((n) => n === 1), { started, named, warnings });
  await page.close();
}

// ---- P5 + P6 run side by side (both need real seconds).
// P5: one file never answers. No start by itself; at 10 s the note names it
//     and offers Start anyway; pressing it starts the game.
// P6: slow but healthy, three files finishing 4 s apart (12 s in all): the
//     button never appears, setup() runs right after the last one.
const HANG = `
function preload() {
  coins = loadJSON('${B}/__json');
  hero = loadImage('${B}/__hang/hero.png');
}
function setup() { new Canvas(200, 200); started = true; }
`;
const STEADY = `
var t0 = performance.now();
var buttonSeen = false;
new MutationObserver(function () {
  var el = document.querySelector('[data-moshion-preload] button');
  if (el) buttonSeen = true;
}).observe(document.body, { childList: true, subtree: true });
function preload() {
  a = loadJSON('${B}/__delay/4000/__json');
  b = loadJSON('${B}/__delay/8000/__json');
  c = loadImage('${B}/__delay/12000/textures/apple.png');
}
function setup() { new Canvas(200, 200); setupAt = performance.now() - t0; }
`;
{
  const [h, s] = await Promise.all([open(HANG), open(STEADY)]);
  await h.frame.waitForTimeout(9000);
  const early = { started: await ev(h.frame, () => typeof started !== 'undefined'), note: await noteText(h.frame) };
  check('P5a a file that never answers: no start by itself, no button before 10 s',
    !early.started && /^Loading\.\.\. 1 of 2 files$/.test(early.note || ''), early);
  const btn = await until(h.frame, () => !!document.querySelector('[data-moshion-preload] button'), 2500);
  const late = await noteText(h.frame);
  check('P5b at 10 s with nothing finishing, the note names the file and offers Start anyway',
    btn && /Still waiting for .*__hang\/hero\.png/.test(late || '') && /Start anyway/.test(late || '') &&
    h.warnings.some((w) => w.includes('hero.png has not finished after 10 seconds')), { btn, late, warnings: h.warnings });
  check('P5c ...and it still has not started by itself', !(await ev(h.frame, () => typeof started !== 'undefined')), '');
  await h.frame.click('[data-moshion-preload] button');
  const went = await until(h.frame, () => typeof started !== 'undefined' && started, 2000);
  check('P5d pressing Start anyway starts the game and removes the note',
    went && (await noteText(h.frame)) === null, { went, note: await noteText(h.frame) });

  const ranAt = await until(s.frame, () => typeof setupAt !== 'undefined', 6000);
  const st = await ev(s.frame, () => ({ setupAt: typeof setupAt === 'undefined' ? null : setupAt, buttonSeen }));
  check('P6 slow but healthy (12 s, 4 s apart): no Start anyway, setup() right after the last file',
    ranAt && !st.buttonSeen && st.setupAt >= 11900 && st.setupAt < 13000, st);
  await h.page.close();
  await s.page.close();
}

// ---- P9: a fast load starts within one frame of the last file, and never
// flashes the note.
const FAST = `
var noteSeen = false;
new MutationObserver(function () {
  if (document.querySelector('[data-moshion-preload]')) noteSeen = true;
}).observe(document.body, { childList: true, subtree: true });
function preload() {
  levels = loadJSON('${B}/__json');
  levels.then(function () { lastAt = performance.now(); });
}
function setup() { new Canvas(200, 200); gap = performance.now() - lastAt; }
`;
{
  const { page, frame } = await open(FAST);
  await until(frame, () => typeof gap !== 'undefined', 2000);
  const st = await ev(frame, () => ({ gap: typeof gap === 'undefined' ? null : gap, noteSeen }));
  check('P9 a fast load: setup() within one frame of the last file, no note', st.gap !== null && st.gap < 17 && !st.noteSeen, st);
  await page.close();
}

// ---- P10: outside preload() the loaders do not wait.
const NO_WAIT = `
function setup() {
  new Canvas(200, 200);
  levels = loadJSON('${B}/__delay/1000/__json');
  atSetup = levels.world1 === undefined;
}
`;
{
  const { page, frame } = await open(NO_WAIT);
  await waitFrames(frame, 20);
  const st = await ev(frame, () => ({ atSetup, frames: frameCount }));
  check('P10 a loader in setup() does not wait: setup() ran at once, the frames keep coming',
    st.atSetup === true && st.frames > 10, st);
  await page.close();
}

// ---- P11: a sketch with no preload() boots on the same tick as before.
const PLAIN = `
var setupRan = false;
setTimeout(function () { seenAtTimeout = setupRan; }, 0);
function setup() { new Canvas(200, 200); setupRan = true; }
`;
{
  const { page, frame } = await open(PLAIN);
  await waitFrames(frame, 5);
  check('P11 no preload(): setup() runs synchronously at boot, as today',
    (await ev(frame, () => seenAtTimeout)) === true, String(await ev(frame, () => seenAtTimeout)));
  await page.close();
}

// ---- P12-P14: errors and the preload-without-setup line.
{
  const { page, frame } = await open(`
function preload() { levels = loadJSON('${B}/__json'); oops(); }
function setup() { new Canvas(200, 200); started = true; }`);
  await frame.waitForTimeout(400);
  const errs = await frameErrors(page);
  check('P12 an error in preload() is reported and the game does not start',
    errs.some((e) => /oops/.test(e)) && !(await ev(frame, () => typeof started !== 'undefined')), errs);
  await page.close();
}
{
  const { page, frame } = await open(`
function preload() { levels = loadJSON('${B}/__json'); }
function setup() { new Canvas(200, 200); levels.world1.push(4); notThere(); }`);
  await frame.waitForTimeout(500);
  const errs = await frameErrors(page);
  check('P13 an error in setup() after preload() is reported like any error in setup()',
    errs.some((e) => /notThere/.test(e)), errs);
  await page.close();
}
{
  const { page, frame, warnings } = await open(`function preload() { levels = loadJSON('${B}/__json'); }`);
  await frame.waitForTimeout(300);
  check('P14 preload() with no setup(): one console line says so',
    warnings.filter((w) => w.includes('no setup() to start the game')).length === 1, warnings);
  await page.close();
}

// ---- P15: play() before the first click does nothing and warns; after a
// real click it plays. A browser that keeps sound off until a gesture, as
// every student's does.
{
  const strict = await launch({ args: ['--autoplay-policy=user-gesture-required'] }).catch(() => null);
  if (!strict) {
    check('P15 play() before the first click', false, 'could not launch a strict-autoplay browser');
  } else {
    const page = await strict.newPage({ viewport: { width: 900, height: 700 } });
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    const frame = await runSketch(page, B, `
function preload() { jump = loadSound('${B}/assets/coin.wav'); }
function setup() { new Canvas(200, 200); early = jump.play(); }
function update() { if (mouse.presses()) late = jump.play(); }`);
    await until(frame, () => typeof early !== 'undefined', 3000);
    const before = await ev(frame, () => ({ early: early === null ? null : 'voice', loaded: jump.loaded }));
    await frame.click('canvas');
    await until(frame, () => typeof late !== 'undefined', 2000);
    const after = await ev(frame, () => (typeof late === 'undefined' ? 'not called' : late === null ? null : 'voice'));
    const said = warnings.filter((w) => w.includes('sound turns on after the first click or key press')).length;
    check('P15 play() before the first click does nothing and says so once; after a click it plays',
      before.loaded && before.early === null && said === 1 && after === 'voice', { before, after, said, warnings });
    await strict.close();
  }
}

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
for (const r of hung) { try { r.destroy(); } catch {} }
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
