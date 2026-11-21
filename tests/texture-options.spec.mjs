// Scenario: what a saved texture can carry beyond its picture (ported from shCode's local patches).
//   saveTexture(name, url, { hitbox, smooth, frames }), sprite.useTextureHitbox(), background('textureName').
// Exercises the REAL surface (browser runner), reading real canvas pixels. Exit 0 only if every check prints PASS.
import { launch, serve, runSketch, waitFrames, captureErrors, frameErrors } from './harness.mjs';

const results = [];
function check(name, pass, detail) {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

// 2 x 2, four different colours (the same picture the docs examples use).
const URL2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGO4o6GhseAOw68TcjYnogApvAYPvPI98QAAAABJRU5ErkJggg==';

const browser = await launch();
const srv = await serve(8231);

async function run(code, frames = 20) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = captureErrors(page);
  const frame = await runSketch(page, srv.base, code);
  await waitFrames(frame, frames);
  return { page, frame, errors };
}
async function done(label, { page, errors }) {
  const errs = [...errors, ...(await frameErrors(page))];
  check(`${label}: no errors`, errs.length === 0, errs);
  await page.close();
}

// ---- saveTexture options -------------------------------------------------
{
  const t = await run(`
    function setup() {
      new Canvas(200, 100);
      saveTexture('plain', '${URL2}');
      saveTexture('box', '${URL2}', { hitbox: { w: 2, h: 2, mask: '1011' } });
      saveTexture('soft', '${URL2}', { smooth: true });
      saveTexture('strip', '${URL2}', { frames: 2, frameDelay: 6 });
      meta = { plain: getItem('texmeta:plain'), box: getItem('texmeta:box'), soft: getItem('texmeta:soft'), strip: getItem('texmeta:strip') };
      // a still saved over an animation drops the frame count, but keeps a hitbox it is given
      saveTexture('strip', '${URL2}', { hitbox: { w: 2, h: 2, mask: '1111' } });
      over = getItem('texmeta:strip');
      s = new Sprite(50, 50, 40, 40); s.texture = 'box';
      hitboxOnlyIsStill = s.ani === null || s.ani === undefined || !(s.ani.frameCount > 1);
    }
    function draw() { background('#222'); }
  `);
  const m = await t.frame.evaluate(() => ({ meta, over, hitboxOnlyIsStill }));
  check('a plain save writes no meta', m.meta.plain === null, m.meta.plain);
  check('hitbox option is stored', JSON.stringify(m.meta.box) === JSON.stringify({ hitbox: { w: 2, h: 2, mask: '1011' } }), m.meta.box);
  check('smooth option is stored', JSON.stringify(m.meta.soft) === JSON.stringify({ smooth: true }), m.meta.soft);
  check('frames option still stores the animation meta', m.meta.strip && m.meta.strip.frames === 2 && m.meta.strip.frameDelay === 6, m.meta.strip);
  check('saving over an animation drops the frame count', m.over && m.over.frames === undefined && m.over.hitbox && m.over.hitbox.mask === '1111', m.over);
  check('a hitbox alone does not make the texture an animation', m.hitboxOnlyIsStill === true, m);
  await done('saveTexture options', t);
}

// ---- useTextureHitbox ----------------------------------------------------
{
  // The same arch shCode's gate uses: a 3x3 mask with an open slot down the top middle.
  const t = await run(`
    function setup() {
      new Canvas(400, 400);
      world.gravity.y = 10;
      saveTexture('arch', '${URL2}', { hitbox: { w: 3, h: 3, mask: '101101111' } });
      saveTexture('nobox', '${URL2}');
      arch = new Sprite(200, 200, 180, 180, 'static');
      arch.texture = 'arch';
      const probe = new Sprite(200, 140, 10, 'none');
      before = probe.overlaps(arch);
      applied = arch.useTextureHitbox();
      opening = probe.overlaps(arch);
      probe.x = 140;
      side = arch.overlaps(probe);
      probe.remove();
      copy = arch.clone();
      copy.x = 600;
      const cp = new Sprite(600, 140, 10, 'none');
      copiedOpening = copy.overlaps(cp);
      copy.useTextureHitbox(false);
      restored = copy.overlaps(cp);
      cp.remove();
      plain = new Sprite(100, 100, 20, 20);
      noTexture = plain.useTextureHitbox();
      plain.texture = 'nobox';
      noHitbox = plain.useTextureHitbox();
      ball = new Sprite(200, 40, 10);
    }
    function draw() { background('#222'); }
  `, 140);
  const r = await t.frame.evaluate(() => ({
    before, applied, opening, side, copiedOpening, restored, noTexture, noHitbox,
    ballY: ball.y, landed: ball.colliding(arch) > 0,
  }));
  check('before the hitbox is on, the dot in the slot overlaps the plain box', r.before === true, r);
  check('useTextureHitbox() returns true when the texture has a hitbox', r.applied === true, r);
  check('the dot in the open slot no longer overlaps', r.opening === false, r);
  check('the solid side still overlaps', r.side === true, r);
  check('a clone keeps the hitbox', r.copiedOpening === false, r);
  check('useTextureHitbox(false) restores the plain box', r.restored === true, r);
  check('no texture: returns false', r.noTexture === false, r);
  check('a texture without a hitbox: returns false', r.noHitbox === false, r);
  check('a ball falls into the slot and rests on the arch base (y about 225)', Math.abs(r.ballY - 225) < 3 && r.landed === true, r);

  // Rotation: turned 90 degrees clockwise, the slot moves from the top middle to the right middle.
  await t.frame.evaluate(() => { arch.rotation = 90; });
  await waitFrames(t.frame, 5);
  const rot = await t.frame.evaluate(() => {
    const a = new Sprite(200, 140, 10, 'none');
    const b = new Sprite(260, 200, 10, 'none');
    const out = { oldSlot: arch.overlaps(a), newSlot: arch.overlaps(b) };
    a.remove(); b.remove();
    return out;
  });
  check('the hitbox turns with the sprite: the old slot is solid, the new one is open', rot.oldSlot === true && rot.newSlot === false, rot);
  await done('useTextureHitbox', t);
}

// ---- background('textureName') -------------------------------------------
{
  const t = await run(`
    var shift = 0, useRed = false;
    function setup() {
      new Canvas(400, 200);
      saveTexture('backdrop', '${URL2}');
    }
    function draw() {
      camera.x = 200 + shift;
      background(useRed ? 'red' : 'backdrop');
    }
  `, 20);
  const px = (frame) => frame.evaluate(() => {
    const c = document.querySelector('canvas').getContext('2d');
    const at = (x, y) => Array.from(c.getImageData(x, y, 1, 1).data).join(',');
    return { tl: at(20, 20), tr: at(380, 20), bl: at(20, 180), br: at(380, 180), mid: at(200, 100) };
  });
  const before = await px(t.frame);
  const colours = new Set([before.tl, before.tr, before.bl, before.br]);
  check('a texture name fills the canvas with the picture (four different corners)', colours.size === 4, before);
  check('the fill is opaque', [before.tl, before.tr, before.bl, before.br].every((c) => c.endsWith(',255')), before);
  await t.frame.evaluate(() => { shift = 60; });
  await waitFrames(t.frame, 10);
  const moved = await px(t.frame);
  check('the background stays fixed while the camera moves', JSON.stringify(before) === JSON.stringify(moved), { before, moved });
  await t.frame.evaluate(() => { useRed = true; });
  await waitFrames(t.frame, 10);
  const red = await px(t.frame);
  check("a CSS colour name is still a colour: background('red')", red.tl === '255,0,0,255' && red.br === '255,0,0,255', red);
  await done('background(texture)', t);
}

// ---- smooth --------------------------------------------------------------
{
  const t = await run(`
    function setup() {
      new Canvas(400, 200);
      world.gravity.y = 0;
      saveTexture('crisp', '${URL2}');
      saveTexture('soft', '${URL2}', { smooth: true });
      a = new Sprite(100, 100, 120, 120, 'none'); a.texture = 'crisp';
      b = new Sprite(300, 100, 120, 120, 'none'); b.texture = 'soft';
      c = b.clone(); c.x = 200; c.y = 30; c.w = 40; c.h = 40;
    }
    function draw() { background('#222'); }
  `, 25);
  const distinct = (cx, y, half) => t.frame.evaluate(([cx, y, half]) => {
    const c = document.querySelector('canvas').getContext('2d');
    const row = c.getImageData(cx - half, y, half * 2, 1).data;
    const set = new Set();
    for (let i = 0; i < row.length; i += 4) set.add(row[i] + ',' + row[i + 1] + ',' + row[i + 2]);
    return set.size;
  }, [cx, y, half]);
  const crisp = await distinct(100, 70, 58);   // a row across the upper half of the crisp sprite
  const soft = await distinct(300, 70, 58);
  const cloned = await distinct(200, 30, 18);
  check('a plain saved texture stays crisp (two colours across a row)', crisp === 2, crisp);
  check('smooth: true blends the colours (more than two across a row)', soft > 2, soft);
  check('a clone of a smooth sprite stays smooth', cloned > 2, cloned);
  await done('smooth', t);
}

await browser.close();
srv.close();

let failed = 0;
for (const [name, pass, detail] of results) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`);
  if (!pass) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
