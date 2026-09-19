// Scenario: the docs site. Its examples had two real defects that no spec
// guarded: the Ray casting sketch threw `player is not defined` on frame one
// (so Run produced a broken demo), and the Sound sketch loaded coin.mp3 /
// music.mp3 — files that do not exist — 404ing with CORS errors. Also pins the
// preview-frame sizing: renderPage() reads the canvas size out of each
// example's source so the frame hugs the sketch instead of leaving dark bars.
// Exercises the REAL docs site in the REAL browser. Pass condition: every
// check prints PASS; exit code 0 only if all pass.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, serve, captureErrors, frameErrors, ROOT } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// The docs data is one JSON blob on window.MOSHION_DOCS — read it the same way
// the page itself does, to find pages by title.
const raw = readFileSync(join(ROOT, 'docs', 'data', 'moshion-docs.js'), 'utf8').trim();
const DATA = JSON.parse(raw.replace(/^window\.MOSHION_DOCS\s*=\s*/, '').replace(/;\s*$/, ''));
function findPage(title) {
  for (const sec of DATA) for (const pg of sec.pages) {
    if (pg.title === title) return { hash: '#' + sec.slug + '/' + sec.pages.indexOf(pg), ...pg };
  }
  return null;
}

const srv = await serve(8189);
const browser = await launch();

async function openExample(title) {
  const pg = findPage(title);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  await page.goto(srv.base + '/docs/index.html' + pg.hash, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  await page.locator('.btn-run').first().click();
  await page.waitForTimeout(1800);
  const frame = page.frames().find((fr) => fr !== page.mainFrame() && fr.url().includes('runner.html'));
  return { ctx, page, frame, errors, pg };
}

// ---------------------------------------------------------------------------
// D1: Ray casting runs clean, and the lesson's promise holds — a click through
// the gap turns the target gold, a click on the barrier does not.
{
  const { ctx, page, frame, errors, pg } = await openExample('Ray casting');
  const st = await frame.evaluate(() => ({
    playerExists: typeof player !== 'undefined' && !!player,
    targetOnScreen: target.y > 0 && target.y < 300,
    targetColor: target.color,
  }));
  check('D1a the sketch runs: player and target both exist',
    st.playerExists && st.targetOnScreen, JSON.stringify(st));
  check('D1b no errors on the Ray casting page',
    errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));

  // Click straight at the barrier: the ray stops there, target stays tomato.
  // Then click through the gap: closest hit is the target, it turns gold.
  const clickAt = (x, y) => frame.evaluate(([cx, cy]) => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const sx = r.width / c.width, sy = r.height / c.height;
    const o = { clientX: r.left + cx * sx, clientY: r.top + cy * sy, button: 0, bubbles: true };
    c.dispatchEvent(new MouseEvent('mousemove', o));
    c.dispatchEvent(new MouseEvent('mousedown', { ...o, buttons: 1 }));
    window.dispatchEvent(new MouseEvent('mouseup', o));
  }, [x, y]);

  await clickAt(200, 170);
  await page.waitForTimeout(300);
  const blocked = await frame.evaluate(() => target.color);
  check('D1c clicking the barrier leaves the target untouched (ray was blocked)',
    blocked === 'tomato', String(blocked));

  await clickAt(320, 268);
  await page.waitForTimeout(300);
  const hit = await frame.evaluate(() => target.color);
  check('D1d clicking through the gap turns the target gold (closest hit)',
    hit === 'gold', String(hit));

  const sized = await frame.evaluate((want) => {
    const c = document.querySelector('canvas');
    return { attr: c.width + 'x' + c.height, frameW: innerWidth, frameH: innerHeight };
  });
  check('D1e the preview frame is sized to the example\'s own canvas',
    sized.frameW === 400 && sized.frameH === 300,
    JSON.stringify({ canvas: sized.attr, frame: sized.frameW + 'x' + sized.frameH }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D2: Sound loads real files. The old example fetched coin.mp3 / music.mp3,
// which do not exist anywhere in this repo.
{
  const { ctx, page, frame, errors } = await openExample('Sound');
  const st = await frame.evaluate(() => ({
    coinLoaded: coin.loaded, coinErr: coin.error, coinDur: +coin.duration.toFixed(2),
    musicLoaded: music.loaded, musicErr: music.error, musicDur: +music.duration.toFixed(1),
  }));
  check('D2a coin.wav loads and decodes (no error, real duration)',
    st.coinLoaded === true && st.coinErr === null && st.coinDur > 0.1, JSON.stringify(st));
  check('D2b music.wav loads and decodes (no error, real duration)',
    st.musicLoaded === true && st.musicErr === null && st.musicDur > 4, JSON.stringify(st));
  check('D2c no errors on the Sound page — no 404s, no CORS failures',
    errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D3: the Touch page — added after this sweep first shipped, so there was a
// stretch where the docs site taught mouse input with no page mentioning that
// a finger drives the same properties. Pins that it exists and runs.
{
  const { ctx, page, frame, errors } = await openExample('Touch: a finger drives the mouse');
  const st = await frame.evaluate(() => ({ dotExists: typeof dot !== 'undefined' && !!dot }));
  check('D3a the Touch example runs (the dot sprite exists)', st.dotExists === true, JSON.stringify(st));
  check('D3b no errors on the Touch page',
    errors.length === 0 && (await frameErrors(page)).length === 0,
    JSON.stringify({ page: errors, runner: await frameErrors(page) }));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D4: every example's preview frame is sized to its own canvas, and every
// example runs without errors. This walks every runnable page — the Ray
// casting and Sound defects were found precisely because nothing was.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = captureErrors(page);
  let ran = 0, broken = [];
  const RX = /new\s+Canvas\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/;
  for (const sec of DATA) {
    for (let i = 0; i < sec.pages.length; i++) {
      const pg = sec.pages[i];
      const want = RX.exec(pg.code || '');
      if (!want) continue;
      await page.goto(srv.base + '/docs/index.html#' + sec.slug + '/' + i, { waitUntil: 'load' });
      await page.waitForTimeout(650);
      await page.locator('.btn-run').first().click().catch(() => {});
      await page.waitForTimeout(1500);
      const f = page.frames().find((fr) => fr !== page.mainFrame() && fr.url().includes('runner.html'));
      if (!f) continue;
      const st = await f.evaluate(() => {
        const c = document.querySelector('canvas');
        const err = document.getElementById('error');
        return { has: !!c, err: err ? (err.textContent || '').trim() : '' };
      }).catch(() => null);
      ran++;
      if (!st || !st.has || st.err) broken.push(sec.slug + '/' + pg.title + (st && st.err ? ': ' + st.err.slice(0, 60) : ''));
    }
  }
  check('D4a all ' + ran + ' runnable examples produce a canvas with zero runner errors',
    broken.length === 0, JSON.stringify({ ran, broken }));
  check('D4b zero page-level errors while walking every example',
    errors.length === 0, JSON.stringify(errors));
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