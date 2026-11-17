// Scenario: a group's autoDraw / autoUpdate reach sprites made later, and
// group.draw() paints a group by hand (shCode #124). A student set
// allSprites.autoDraw = false and had to set it again every frame, because it
// reached only the sprites already there, and allSprites.draw() did not
// exist. The sketch spies on its own canvas's fillRect/fillText, so the checks
// read the real paint order of one frame. Exit code 0 only if all pass.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const SKETCH = `
function spy() {
  const ctx = document.querySelector('canvas').getContext('2d');
  ops = []; lastOps = [];
  for (const name of ['fillText', 'fillRect']) {
    const real = ctx[name].bind(ctx);
    ctx[name] = (...a) => { ops.push(name === 'fillText' ? 'text:' + a[0] : 'rect ' + String(ctx.fillStyle)); return real(...a); };
  }
}
var tick = 0, handDraw = false, ghostRan = false;
function setup() {
  new Canvas(200, 200);
  world.gravity.y = 0;
  allSprites.autoDraw = false;
  early = new Sprite(50, 50, 20, 20, 'static'); early.color = '#0000ff'; early.layer = 2;
  emptyReads = new Group().autoDraw;
  ghosts = new Group(); ghosts.autoUpdate = false;
  spy();
}
function update() {
  tick++;
  if (tick === 2) {
    late = new Sprite(150, 150, 20, 20, 'static'); late.color = '#ff00ff'; late.layer = 1;
    ghost = new ghosts.Sprite(100, 100, 10, 10, 'none'); ghost.update = () => { ghostRan = true; };
  }
}
function draw() {
  lastOps = ops; ops = [];
  background('#000000');
  if (handDraw) allSprites.draw();
  fill('#ffffff'); text('over', 10, 10);
}
`;

const srv = await serve(8193);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = captureErrors(page);
const frame = await runSketch(page, srv.base, SKETCH);
await waitFrames(frame, 12);

const state = await frame.evaluate(() => ({
  late: late.autoDraw, ghost: ghost.autoUpdate, ghostRan, emptyReads,
  ops: lastOps.filter((o) => o === 'rect #0000ff' || o === 'rect #ff00ff'),
}));
check('G1a a sprite made after allSprites.autoDraw = false is not drawn by the engine', state.late === false && state.ops.length === 0, state);
check('G1b a sprite joining a group after group.autoUpdate = false does not run its update', state.ghost === false && state.ghostRan === false, state);
check('G1c an untouched empty group reads autoDraw true', state.emptyReads === true, state);

await frame.evaluate(() => { handDraw = true; });
await waitFrames(frame, 6);
const seq = await frame.evaluate(() => lastOps.filter((o) => ['rect #000000', 'rect #0000ff', 'rect #ff00ff'].includes(o) || o.startsWith('text:')));
check('G2 allSprites.draw() paints the sprites then and there, lowest layer first, between the background and the text',
  JSON.stringify(seq) === JSON.stringify(['rect #000000', 'rect #ff00ff', 'rect #0000ff', 'text:over']), seq);
check('G3 zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0, JSON.stringify({ page: errors, runner: await frameErrors(page) }));

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
