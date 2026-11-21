// Scenario: sound.pause() keeps the place (2026-11-21). It used to be stop(), so music paused for a pause menu
// started again from the beginning. Now pause() remembers where the loop (or the newest play()) was, by the
// audio clock, and the next loop() or play() carries on from there; stop() forgets it; a speed change while
// playing does not move the resume point; a pause() before the file has loaded keeps a pending loop() silent.
// Exercises the REAL surface (browser runner). Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// A 4 s silent 8 kHz mono WAV, saved as sound:long so it loads from the store.
const LONG_WAV = (() => {
  const rate = 8000, n = rate * 4, buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(n, 40); buf.fill(128, 44);
  return 'data:audio/wav;base64,' + buf.toString('base64');
})();

const SKETCH = `
var music, early, done;
function setup() {
  new Canvas(200, 200);
  storeItem('sound:long', ${JSON.stringify(LONG_WAV)});
  music = loadSound('long');
  done = false;
  music.ready.then(() => { done = true; });
}
function draw() { background(0); }
`;

const srv = await serve(8195);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = captureErrors(page);
const frame = await runSketch(page, srv.base, SKETCH);
await frame.waitForFunction(() => window.done === true, null, { timeout: 10000 });
// Sound turns on at the first click.
const canvas = await frame.$('canvas');
await canvas.click();
await waitFrames(frame, 10);

const ctxState = await frame.evaluate(async () => {
  const v = music.loop();
  await new Promise((r) => setTimeout(r, 300));
  return { started: !!v, t: v && v.context ? v.context.currentTime : null, state: v && v.context ? v.context.state : null };
});
check('S0 the audio clock runs after a click (else the timings prove nothing)', ctxState.started && ctxState.state === 'running', ctxState);

const p1 = await frame.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 900));
  music.pause();
  return { pos: music._pausedAt && music._pausedAt.pos, paused: music.paused, playing: music.playing };
});
check('S1 pause() stops the sound and says paused', p1.paused === true && p1.playing === false, p1);
check('S2 pause() remembers about where the loop was (about 1.2 s in)', p1.pos > 0.9 && p1.pos < 1.6, p1);

const p2 = await frame.evaluate(async () => {
  music.pause(); // a second pause keeps the first place
  const kept = music._pausedAt && music._pausedAt.pos;
  await new Promise((r) => setTimeout(r, 500));
  const v = music.loop();
  return { kept, from: v && v.__anchor ? v.__anchor.from : null, paused: music.paused, playing: music.playing };
});
check('S3 pausing twice keeps the first place', Math.abs(p2.kept - p1.pos) < 1e-9, p2);
check('S4 loop() after pause() carries on from that place, not from 0', Math.abs(p2.from - p1.pos) < 1e-9 && p2.playing && !p2.paused, p2);

const p3 = await frame.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 400));
  music.rate = 2;
  await new Promise((r) => setTimeout(r, 400));
  music.pause();
  return { pos: music._pausedAt && music._pausedAt.pos };
});
// From p1.pos: 0.4 s at speed 1, then 0.4 s at speed 2 = about 1.2 s further.
const want3 = p1.pos + 1.2;
check('S5 a speed change while playing keeps the place right (0.4 s at 1x + 0.4 s at 2x)', Math.abs(p3.pos - want3) < 0.25, { ...p3, want: want3 });

const p4 = await frame.evaluate(() => {
  music.rate = 1;
  music.stop();
  const v = music.loop();
  const out = { from: v && v.__anchor ? v.__anchor.from : null, paused: music.paused };
  music.stop();
  return out;
});
check('S6 stop() forgets the place: the next loop() starts at 0', p4.from === 0 && p4.paused === false, p4);

const p5 = await frame.evaluate(async () => {
  music.play();
  await new Promise((r) => setTimeout(r, 700));
  music.pause();
  const pos = music._pausedAt && music._pausedAt.pos;
  const v = music.play();
  const out = { pos, from: v && v.__anchor ? v.__anchor.from : null, looping: v ? v.loop : null };
  music.stop();
  return out;
});
check('S7 music started with play() resumes with play(), once (not looping)', p5.pos > 0.5 && Math.abs(p5.from - p5.pos) < 1e-9 && p5.looping === false, p5);

const p6 = await frame.evaluate(async (wav) => {
  storeItem('sound:late', wav);
  early = loadSound('late');
  early.loop();   // before it has loaded: remembered
  early.pause();  // ...and paused before it lands
  await early.ready;
  await new Promise((r) => setTimeout(r, 200));
  const silent = !early.playing;
  early.loop();
  const after = early.playing;
  early.stop();
  return { silent, after };
}, LONG_WAV);
check('S8 pause() before the file has loaded keeps a pending loop() silent; loop() again starts it', p6.silent && p6.after, p6);

const errs = [...errors, ...(await frameErrors(page))];
check('S9 no errors', errs.length === 0, errs);

await browser.close();
srv.close();

let failed = 0;
for (const [name, pass, detail] of results) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`);
  if (!pass) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
