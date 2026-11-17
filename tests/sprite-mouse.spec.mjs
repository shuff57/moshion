// Scenario: sprite.mouse and mouse.visible (shCode #125). A student asked for
// code to hide the pointer and to tell when the mouse is over, or pressing, a
// sprite. Real mouse events on the real runner; the sketch counts what each
// question answered, frame by frame. Exit code 0 only if all pass.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors, mouseMove, mouseDown, mouseUp } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const SKETCH = `
var c = { hovering: 0, hovers: 0, hovered: 0, presses: 0, pressingOff: 0, released: 0, otherPresses: 0 };
function setup() {
  mouse.cursor = 'crosshair';
  new Canvas(300, 300);
  world.gravity.y = 0;
  btn = new Sprite(100, 100, 60, 40, 'static');
  other = new Sprite(250, 250, 20, 20, 'static');
}
function update() {
  const m = btn.mouse;
  if (m.hovering()) c.hovering++;
  if (m.hovers()) c.hovers++;
  if (m.hovered()) c.hovered++;
  if (m.presses()) c.presses++;
  if (m.pressing() && !m.hovering()) c.pressingOff++;
  if (m.released()) c.released++;
  if (other.mouse.presses()) c.otherPresses++;
}
`;

const srv = await serve(8194);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = captureErrors(page);
const frame = await runSketch(page, srv.base, SKETCH);
await waitFrames(frame, 6);
const counts = () => frame.evaluate(() => ({ ...c }));

await mouseMove(frame, 100, 100); await waitFrames(frame, 6);
let k = await counts();
check('M1 moving onto a sprite: hovering() for several frames, hovers() once', k.hovering >= 3 && k.hovers === 1 && k.hovered === 0, k);
await mouseDown(frame, 100, 100); await waitFrames(frame, 4);
await mouseMove(frame, 10, 10); await waitFrames(frame, 4);
k = await counts();
check('M2 a press on the sprite: presses() once; pressing() stays true after sliding off', k.presses === 1 && k.pressingOff >= 2 && k.hovered === 1, k);
await mouseUp(frame, 10, 10); await waitFrames(frame, 4);
k = await counts();
check('M3 letting go off the sprite: released() once, pressing() ends', k.released === 1, k);
await mouseMove(frame, 250, 250); await waitFrames(frame, 2);
await mouseDown(frame, 250, 250); await waitFrames(frame, 3); await mouseUp(frame, 250, 250); await waitFrames(frame, 3);
k = await counts();
check('M4 a press elsewhere belongs to another sprite: presses() still 1, the other sprite saw its own', k.presses === 1 && k.otherPresses === 1, k);

const cur = await frame.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const out = [canvas.style.cursor];
  mouse.visible = false; out.push(canvas.style.cursor, mouse.visible);
  mouse.visible = true; out.push(canvas.style.cursor, mouse.visible);
  return out;
});
check('M5 mouse.cursor set before new Canvas() is applied; visible = false hides it, true brings it back',
  JSON.stringify(cur) === JSON.stringify(['crosshair', 'none', false, 'crosshair', true]), cur);
check('M6 zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0, JSON.stringify({ page: errors, runner: await frameErrors(page) }));

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
