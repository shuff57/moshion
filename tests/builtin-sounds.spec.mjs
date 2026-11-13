// Scenario: loadSound('coin') plays the engine's own sound (shCode, 2026-11-13).
// A bare name used to be looked up only among SAVED sounds, so the mixer's
// snippet `loadSound('coin')` failed with "there is no saved sound called
// 'coin'" although assets/coin.wav ships with the engine. Now: saved first,
// then the built-in file, and a name that is neither is never fetched.
// Pass condition: every check prints PASS; exit code 0 only if all pass.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// ---------------------------------------------------------------------------
// B1: the engine's list is exactly the .wav files in assets/.
{
  const src = readFileSync(join(ROOT, 'moshion.js'), 'utf8');
  const m = /const BUILTIN_SOUNDS_ = \[([^\]]*)\]/.exec(src);
  const listed = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort() : [];
  const files = readdirSync(join(ROOT, 'assets')).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4)).sort();
  check('B1 BUILTIN_SOUNDS_ lists every assets/*.wav and nothing else', JSON.stringify(listed) === JSON.stringify(files), { listed, files });
}

// A 0.5 s silent 8 kHz mono WAV as a data: URI, so "saved wins" can be told
// apart from the built-in coin by its duration.
const SAVED_WAV = (() => {
  const rate = 8000, n = 4000, buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(n, 40); buf.fill(128, 44);
  return 'data:audio/wav;base64,' + buf.toString('base64');
})();

const SKETCH = `
function setup() {
  new Canvas(100, 100);
  coin = loadSound('coin');
  jump = loadSound('jump');
  zap = loadSound('zap');
  coinWav = loadSound('coin.wav');
  storeItem('sound:hit', ${JSON.stringify(SAVED_WAV)});
  hit = loadSound('hit');
  done = false;
  Promise.all([coin.ready, jump.ready, zap.ready, coinWav.ready, hit.ready]).then(() => { done = true; });
}
function draw() { background(0); }
`;

const srv = await serve(8193);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
const errors = captureErrors(page);
const warnings = [];
page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
const requested = [];
page.on('request', (req) => requested.push(req.url()));

const frame = await runSketch(page, srv.base, SKETCH);
await waitFrames(frame, 5);
await frame.waitForFunction(() => window.done === true, null, { timeout: 10000 });
const st = await frame.evaluate(() => ({
  hasAudio: typeof (window.AudioContext || window.webkitAudioContext) === 'function',
  coin: [coin.loaded, coin.duration, coin.error],
  jump: [jump.loaded, jump.duration, jump.error],
  zap: [zap.loaded, zap.error],
  hit: [hit.loaded, hit.duration, hit.error],
}));

check('B2 the browser has Web Audio (else the load checks prove nothing)', st.hasAudio, st);
check("B3 loadSound('coin') with nothing saved loads assets/coin.wav", st.coin[0] === true && st.coin[1] > 0, st.coin);
check("B4 loadSound('jump') loads too (not a one-name special case)", st.jump[0] === true && st.jump[1] > 0, st.jump);
check('B5 the built-in was fetched from assets/ beside moshion.js', requested.some((u) => u.endsWith('/assets/coin.wav')), requested.filter((u) => u.includes('coin')));
check("B6 a saved 'hit' wins over the built-in hit.wav", st.hit[0] === true && Math.abs(st.hit[1] - 0.5) < 0.01, st.hit);
check("B7 an unknown name ('zap') is not fetched from assets/", !requested.some((u) => u.includes('/assets/zap')), requested.filter((u) => u.includes('zap')));
const zapWarn = warnings.find((w) => w.startsWith("loadSound('zap')")) || '';
check("B8 'zap' warns: no saved or built-in sound, and names the built-ins", st.zap[0] === false && zapWarn.includes("no saved or built-in sound called 'zap'") && zapWarn.includes('coin'), zapWarn);
const wavWarn = warnings.find((w) => w.startsWith("loadSound('coin.wav')")) || '';
check("B9 'coin.wav' says to write loadSound('coin')", wavWarn.includes("Write loadSound('coin')"), wavWarn);
check('B10 no warning for the names that loaded', !warnings.some((w) => /^loadSound\('(coin|jump|hit)'\)/.test(w)), warnings);
// 'zap' and 'coin.wav' are fetched as paths (as before) and fail on purpose;
// the browser logs those two failed requests, and nothing else may appear.
const unexpected = errors.filter((e) => !/\/(zap|coin\.wav)'|Failed to load resource/.test(e));
check('B11 zero engine errors besides the two failing paths', unexpected.length === 0 && (await frameErrors(page)).length === 0, JSON.stringify({ page: unexpected, runner: await frameErrors(page) }));

await page.close();
await browser.close();
srv.close();

let failed = 0;
for (const [name, pass, detail] of results) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '\n      ' + detail}`);
  if (!pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
