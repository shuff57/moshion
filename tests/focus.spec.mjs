// Scenario: a key or mouse button still held when the sketch loses focus.
// The keyup/mouseup goes to whichever window has focus, never to the sketch,
// so before the fix kb.pressing('d') stayed true forever and the player slid
// off on its own (shCode issue #78). A window `blur` now releases everything
// through the same release states a real keyup/mouseup gives. Exercises the
// REAL surface (browser runner). Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames, keyDown, mouseDown, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const SKETCH = `
var player, held, released, clickHeld, clickReleased;
function setup() {
  new Canvas(400, 300);
  player = new Sprite(200, 150, 30, 30);
  held = false; released = false; clickHeld = false; clickReleased = false;
}
function draw() {
  background('black');
  if (kb.pressing('d')) { player.vel.x = 3; held = true; } else player.vel.x = 0;
  if (kb.released('d')) released = true;
  if (mouse.pressing()) clickHeld = true;
  if (mouse.released()) clickReleased = true;
}
`;

const browser = await launch();
const srv = await serve(8181);
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, SKETCH);
  await waitFrames(frame, 10);
  await keyDown(frame, 'd');
  await mouseDown(frame, 100, 100);
  await waitFrames(frame, 10);
  const before = await frame.evaluate(() => ({ held, pressing: kb.pressing('d'), mouse: mouse.pressing() }));
  check('F1 the held key and button register before focus leaves',
    before.held && before.pressing && before.mouse, before);

  await frame.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitFrames(frame, 5);
  const x1 = await frame.evaluate(() => player.x);
  await waitFrames(frame, 20);
  const after = await frame.evaluate(() => ({
    pressing: kb.pressing('d'), mouse: mouse.pressing(), released, clickReleased, x: player.x,
  }));
  check('F2 losing focus releases the key (no keyup ever arrives)', after.pressing === false, after);
  check('F3 kb.released fires once for it, like a real keyup', after.released === true, after);
  check('F4 the player stops instead of sliding off', Math.abs(after.x - x1) < 0.01, { x1, x2: after.x });
  check('F5 losing focus releases the mouse button too',
    after.mouse === false && after.clickReleased === true, after);
  const errs = [...errors, ...(await frameErrors(page))];
  check('F6 no errors', errs.length === 0, errs);
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
