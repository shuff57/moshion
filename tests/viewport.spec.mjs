// Scenario: the demo viewport shows the WHOLE sketch, and fills the space it
// is given. The homepage panel used to be narrower than the 460x300 canvas and
// runner.html centred the canvas with overflow hidden — so 15px was shaved off
// each side on desktop and 74px on mobile, silently. The panel is now wider
// than the sketch and loads runner.html with ?fit=1, which scales the sketch up
// to fill it. Exercises the REAL homepage in the REAL browser at several
// widths. Pass condition: every check prints PASS; exit 0 only if all.
import { launch, serve, captureErrors, frameErrors } from './harness.mjs';

const PORT = 8186;
const IDS = ['portal', 'ray-siege', 'web-swinger', 'asteroids', 'platformer', 'runner'];
const SKETCH = { w: 460, h: 300 };

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const srv = await serve(PORT);
const browser = await launch();

// Geometry of the sketch canvas relative to the frame that hosts it. `hidden`
// is what runner.html's overflow would crop; `scale` is the displayed size over
// the backing store (1 = pixel-for-pixel, >1 = scaled up by ?fit=1).
async function measure(page) {
  const frame = page.frames().find((f) => f.url().includes('runner.html'));
  if (!frame) return null;
  return frame.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      attrW: c.width, attrH: c.height,
      cssW: +r.width.toFixed(1), cssH: +r.height.toFixed(1),
      left: +r.left.toFixed(1), top: +r.top.toFixed(1),
      right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1),
      viewW: window.innerWidth, viewH: window.innerHeight,
    };
  });
}

function verdict(m) {
  const hiddenL = Math.max(0, -m.left);
  const hiddenT = Math.max(0, -m.top);
  const hiddenR = Math.max(0, m.right - m.viewW);
  const hiddenB = Math.max(0, m.bottom - m.viewH);
  const cropped = +(hiddenL + hiddenR + hiddenT + hiddenB).toFixed(1);
  const scale = +(m.cssW / m.attrW).toFixed(3);
  const ratio = +(m.cssW / m.cssH).toFixed(3);
  // Unused frame: letterbox bars the sketch is leaving on the table. Cropping
  // and dead space are the two opposite failures, so both are measured.
  const dead = +Math.max(m.viewW - m.cssW, m.viewH - m.cssH).toFixed(1);
  return { cropped, dead, scale, ratio, hidden: { l: hiddenL, r: hiddenR, t: hiddenT, b: hiddenB } };
}

async function openHome(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  await page.goto(srv.base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1400); // games are fetched at boot
  return { ctx, page, errors };
}

// ---------------------------------------------------------------------------
// V1: every game, at the width the page is designed for, renders whole and
// fills the panel.
{
  const { ctx, page, errors } = await openHome(1440, 900);
  const frameW = await page.evaluate(() =>
    +document.getElementById('preview').getBoundingClientRect().width.toFixed(1));
  check('V1a the demo frame is at least as wide as a 460px sketch', frameW >= SKETCH.w,
    'iframe is ' + frameW + 'px wide, sketch is ' + SKETCH.w + 'px');

  for (const id of IDS) {
    await page.click(`.demo-tab[data-game="${id}"]`);
    await page.waitForTimeout(1100);
    const m = await measure(page);
    if (!m) {
      check('V1 (' + id + ') canvas present', false, 'no canvas in the runner frame');
      continue;
    }
    const v = verdict(m);
    check('V1 (' + id + ') renders whole, nothing cropped',
      v.cropped === 0 && m.attrW === SKETCH.w && m.attrH === SKETCH.h,
      JSON.stringify({ canvas: m.attrW + 'x' + m.attrH, shown: m.cssW + 'x' + m.cssH, hidden: v.hidden }));
    // On the desktop panel the frame is wider than the sketch, so a correct
    // fit scales UP. A scale of exactly 1 here would mean letterbox bars.
    check('V1 (' + id + ') fills the panel, scaled up, ratio intact',
      v.dead <= 1.5 && v.scale > 1 && Math.abs(v.ratio - SKETCH.w / SKETCH.h) < 0.02,
      JSON.stringify({ scale: v.scale, ratio: v.ratio, deadPx: v.dead }));
  }
  check('V1z no errors while cycling all six games',
    errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/viewport-desktop.png', fullPage: false });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// V2: on a phone the sketch scales down whole instead of being cropped.
{
  const { ctx, page, errors } = await openHome(390, 844);
  const m = await measure(page);
  const v = m ? verdict(m) : null;
  check('V2a the sketch is not cropped on a 390px-wide phone', !!v && v.cropped === 0,
    v ? JSON.stringify({ shown: m.cssW + 'x' + m.cssH, hidden: v.hidden }) : 'no canvas');
  check('V2b it is scaled down rather than clipped (scale < 1)', !!v && v.scale < 1 && v.scale > 0.4,
    v ? 'scale ' + v.scale : 'no canvas');
  check('V2c the aspect ratio is preserved (460/300 = 1.533)',
    !!v && Math.abs(v.ratio - SKETCH.w / SKETCH.h) < 0.02, v ? 'ratio ' + v.ratio : 'no canvas');
  check('V2d the frame is no taller than the scaled sketch (no dead band)',
    !!m && Math.abs(m.cssH - m.viewH) <= 1.5,
    m ? JSON.stringify({ canvasH: m.cssH, frameH: m.viewH }) : 'no canvas');

  // The engine converts pointer offsets through the displayed scale. Without
  // that, aiming in portal/ray-siege/web-swinger lands short of the cursor by
  // exactly the scale factor — the bug this pairs with.
  const target = { x: 400, y: 250 };
  const seen = await page.frames().find((f) => f.url().includes('runner.html'))
    .evaluate((t) => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      const sx = r.width / c.width, sy = r.height / c.height;
      c.dispatchEvent(new MouseEvent('mousemove', {
        clientX: r.left + t.x * sx, clientY: r.top + t.y * sy, bubbles: true,
      }));
      return { x: +mouse.x.toFixed(1), y: +mouse.y.toFixed(1), scale: +sx.toFixed(3) };
    }, target);
  check('V2e a click on the scaled canvas maps back to sketch coordinates',
    Math.abs(seen.x - target.x) < 2 && Math.abs(seen.y - target.y) < 2,
    JSON.stringify({ aimedAt: target, mouseReads: { x: seen.x, y: seen.y }, scale: seen.scale }));

  check('V2z no errors on mobile', errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await page.screenshot({ path: 'tests/artifacts/viewport-mobile.png', fullPage: false });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// V3: the awkward widths in between — the panel shrinks, the sketch stays whole.
for (const [w, h] of [[1024, 768], [820, 1180], [600, 900]]) {
  const { ctx, page } = await openHome(w, h);
  const m = await measure(page);
  const v = m ? verdict(m) : null;
  check('V3 (' + w + 'x' + h + ') sketch stays whole and fills the panel',
    !!v && v.cropped === 0 && v.dead <= 1.5,
    v ? JSON.stringify({ shown: m.cssW + 'x' + m.cssH, scale: v.scale, deadPx: v.dead }) : 'no canvas');
  await ctx.close();
}

// ---------------------------------------------------------------------------
// V4: scaling UP is opt-in. The homepage asks for it (?fit=1) because its panel
// is a curated showcase; the sandbox and the docs must not, or a student who
// writes `new Canvas(200, 200)` gets a blurry blow-up instead of the 200x200
// they asked for.
{
  const small = 'function setup(){ new Canvas(200,200); b=new Sprite(100,100,40); b.color="#5baafd"; }'
    + ' function draw(){ background("#1e1f29"); }';
  const code = Buffer.from(small, 'utf8').toString('base64url');
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const page = await ctx.newPage();

  // runner.html refuses ?code= at top level, so host it in a frame the way a
  // real page would — one generous enough that a fit=1 canvas would grow.
  const host = (src) => `<!doctype html><iframe id="f" style="width:700px;height:600px;border:0"
     sandbox="allow-scripts allow-downloads" src="${src}"></iframe>`;

  for (const [label, src] of [
    ['without ?fit', `/runner.html?code=${code}`],
    ['with ?fit=1', `/runner.html?fit=1&code=${code}`],
  ]) {
    // Land on the server's own origin first, so setContent's document is a
    // real http page rather than about:blank.
    await page.goto(srv.base + '/runner.html', { waitUntil: 'load' });
    await page.setContent(host(srv.base + src), { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    // setContent keeps the page's previous URL, which is runner.html itself —
    // so the child frame has to be picked explicitly, not by URL alone.
    const f = page.frames().find((fr) => fr !== page.mainFrame() && fr.url().includes('runner.html'));
    const m = f && await f.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { attr: c.width + 'x' + c.height, cssW: +r.width.toFixed(1), cssH: +r.height.toFixed(1),
               scale: +(r.width / c.width).toFixed(3) };
    });
    if (label === 'without ?fit') {
      check('V4a a 200x200 sketch stays 200x200 in a 700x600 frame without ?fit',
        !!m && m.scale === 1, JSON.stringify(m));
    } else {
      check('V4b the same sketch scales up to fill the frame with ?fit=1',
        !!m && m.scale > 2.5 && Math.abs(m.cssW - m.cssH) < 1.5, JSON.stringify(m));
    }
  }
  await ctx.close();
}

let ok = true;
for (const [name, pass, detail] of results) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
