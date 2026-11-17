// Scenario: a right-click on the canvas (shCode #127). mouse.presses('right')
// already worked, but the browser's own menu opened over the sketch on every
// right-click, so a game could not use the right button. The canvas now cancels
// contextmenu. Real mouse events on the real runner; the sketch counts what each
// question answered, frame by frame. Exit code 0 only if all pass.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors, mouseMove, mouseDown, mouseUp } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const SKETCH = `
var c = { right: 0, left: 0, any: 0, rightReleased: 0 };
function setup() {
  new Canvas(300, 300);
}
function update() {
  if (mouse.presses('right')) c.right++;
  if (mouse.presses('left')) c.left++;
  if (mouse.presses()) c.any++;
  if (mouse.released('right')) c.rightReleased++;
}
`;

// What a browser sends for one right-click: mousedown (button 2), contextmenu,
// mouseup. Returns whether the contextmenu event was default-prevented, i.e.
// whether the browser's own menu would have been cancelled.
async function contextMenu(frame, x, y) {
  return frame.evaluate(([cx, cy]) => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width ? r.width / canvas.width : 1;
    const sy = canvas.height ? r.height / canvas.height : 1;
    const ev = new MouseEvent('contextmenu', {
      clientX: r.left + cx * sx, clientY: r.top + cy * sy,
      button: 2, buttons: 2, bubbles: true, cancelable: true,
    });
    const notCancelled = canvas.dispatchEvent(ev);
    return { defaultPrevented: ev.defaultPrevented, notCancelled };
  }, [x, y]);
}

const srv = await serve(8195);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = captureErrors(page);
const frame = await runSketch(page, srv.base, SKETCH);
await waitFrames(frame, 6);
const counts = () => frame.evaluate(() => ({ ...c }));

await mouseMove(frame, 150, 150); await waitFrames(frame, 2);
await mouseDown(frame, 150, 150, 'right');
const menu = await contextMenu(frame, 150, 150);
await waitFrames(frame, 4);
await mouseUp(frame, 150, 150, 'right');
await waitFrames(frame, 4);
const k = await counts();

check('R1 a right-click on the canvas is mouse.presses(\'right\') exactly once', k.right === 1, k);
check('R2 a right-click is not mouse.presses(\'left\')', k.left === 0, k);
check('R3 the right button comes up: released(\'right\') once', k.rightReleased === 1, k);
check('R4 the contextmenu event on the canvas is default-prevented (no browser menu)',
  menu.defaultPrevented === true && menu.notCancelled === false, menu);

// Only the canvas: a right-click elsewhere on the page keeps the browser's menu.
const outside = await frame.evaluate(() => {
  const ev = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
  document.body.dispatchEvent(ev);
  return ev.defaultPrevented;
});
check('R5 a right-click outside the canvas still opens the browser\'s menu', outside === false, { defaultPrevented: outside });
check('R6 zero engine errors', errors.length === 0 && (await frameErrors(page)).length === 0, JSON.stringify({ page: errors, runner: await frameErrors(page) }));

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
