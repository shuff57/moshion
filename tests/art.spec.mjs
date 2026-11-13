// Scenario: sprite art — emoji, image URL, data: URL, <canvas>/<img> elements,
// group-level defaults, and the colored-shape fallback when a URL fails.
// Reads real pixels off the runner canvas. Exit code 0 only if every check passes.
import { launch, serve, runSketch, waitFrames } from './harness.mjs';

const code = `
function setup() {
  new Canvas(460, 300);
  world.gravity.y = 0;
  // A solid-red 20x20 canvas to hand over as art.
  art = document.createElement('canvas'); art.width = art.height = 20;
  var g = art.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 20, 20);
  fromCanvas = new Sprite(40, 40, 20, 20, 'static');  fromCanvas.color = '#0000ff'; fromCanvas.image = art;
  broken = new Sprite(100, 40, 20, 20, 'static');     broken.color = '#0000ff';     broken.image = 'assets/does-not-exist.png';
  // 1x1 red PNG; base64 has no '.' so it must still be read as a URL.
  dataUrl = new Sprite(160, 40, 20, 20, 'static');    dataUrl.color = '#0000ff';
  dataUrl.image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  cleared = new Sprite(220, 40, 20, 20, 'static');    cleared.color = '#0000ff';    cleared.image = art; cleared.image = null;
  emoji = new Sprite(280, 40, 24, 24, 'static');      emoji.color = '#0000ff';      emoji.image = '🐸';
  // 10x10 texture: left half red, right half green. Tiled, not stretched.
  tex = document.createElement('canvas'); tex.width = tex.height = 10;
  var t = tex.getContext('2d'); t.fillStyle = '#ff0000'; t.fillRect(0, 0, 5, 10); t.fillStyle = '#00ff00'; t.fillRect(5, 0, 5, 10);
  tiled = new Sprite(100, 100, 30, 10, 'static');      tiled.color = '#0000ff'; tiled.pattern = tex;   // left edge x=85
  badTex = new Sprite(160, 100, 30, 10, 'static');     badTex.color = '#0000ff'; badTex.pattern = 'assets/nope.png';
  named = new Sprite(40, 100, 24, 24, 'static');       named.color = '#0000ff'; named.texture = 'coin';
  swapped = new Sprite(220, 100, 24, 24, 'static');    swapped.color = '#0000ff'; swapped.texture = 'coin'; swapped.image = art;
  unknown = new Sprite(280, 100, 24, 24, 'static');    unknown.color = '#0000ff'; unknown.texture = 'nopeNotAThing';
  saveTexture('myRed', art.toDataURL());
  mine = new Sprite(340, 100, 24, 24, 'static');       mine.color = '#0000ff'; mine.texture = 'myRed';
  gtex = new Group(); gtex.color = '#0000ff';
  gearly = new gtex.Sprite(400, 100, 24, 24, 'static');
  gtex.texture = 'coin';
  glate = new gtex.Sprite(430, 100, 24, 24, 'static');
  fly = new Sprite(120, 100, 24, 24, 'static');         fly.color = '#0000ff'; fly.texture = 'batFly';
  coins = new Group(); coins.color = '#0000ff';
  early = new coins.Sprite(340, 40, 20, 20, 'static');
  coins.image = art;                                   // after the fact: must reach 'early'
  late = new coins.Sprite(400, 40, 20, 20, 'static');  // and the factory default
}
function update() {}
function draw() { background('#1e1f29'); }
`;

const srv = await serve(8197);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const frame = await runSketch(page, srv.base, code);
await waitFrames(frame, 30);

// Catalog PNGs are plain <img> loads from a null-origin iframe, so they taint the
// sketch canvas and getImageData() throws. Read pixels from a SCREENSHOT of the
// canvas instead (decoded in a clean page) -- which is also what a student sees.
const shotB64 = (await frame.locator('canvas').screenshot()).toString('base64');
const reader = await browser.newPage();
await reader.goto('about:blank');
await reader.evaluate(async (b64) => {
  const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  window.__d = g.getImageData(0, 0, c.width, c.height); window.__k = c.width / 460;
}, shotB64);
const px = (x, y) => reader.evaluate(([x, y]) => {
  const w = window.__d.width, k = window.__k, i = (Math.round(y * k) * w + Math.round(x * k)) * 4, d = window.__d.data;
  return { r: d[i], g: d[i + 1], b: d[i + 2] };
}, [x, y]);
const near = (p, r, g, b) => Math.abs(p.r - r) < 30 && Math.abs(p.g - g) < 30 && Math.abs(p.b - b) < 30;

const checks = [];
const add = (n, ok, d) => checks.push([n, ok, JSON.stringify(d)]);
let p;
p = await px(40, 40);  add('A1 <canvas> art draws (red, not the blue block)', near(p, 255, 0, 0), p);
p = await px(100, 40); add('A2 failed URL falls back to the colored shape', near(p, 0, 0, 255), p);
p = await px(160, 40); add('A3 data: URL (no dot) is read as an image', near(p, 255, 0, 0), p);
p = await px(220, 40); add('A4 image = null restores the colored shape', near(p, 0, 0, 255), p);
const count = (cx, cy, half) => reader.evaluate(([cx, cy, half]) => {
  const w = window.__d.width, k = window.__k, d = window.__d.data;
  let art = 0, blue = 0;
  for (let y = Math.round((cy - half) * k); y < Math.round((cy + half) * k); y++)
    for (let x = Math.round((cx - half) * k); x < Math.round((cx + half) * k); x++) {
      const i = (y * w + x) * 4;
      if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 255) blue++;
      else if (Math.abs(d[i] - 30) + Math.abs(d[i + 1] - 31) + Math.abs(d[i + 2] - 41) > 40) art++;
    }
  return { art, blue };
}, [cx, cy, half]);
const emojiPixels = await count(280, 40, 12);
add('A5 emoji draws glyph pixels and no colored block', emojiPixels.art > 20 && emojiPixels.blue === 0, emojiPixels);
p = await px(340, 40); add('A6 group.image reaches members that already exist', near(p, 255, 0, 0), p);
p = await px(400, 40); add('A7 group.image is the default for new group.Sprite()', near(p, 255, 0, 0), p);

p = await px(87, 100);  add('T1 pattern repeats: first tile, red half', near(p, 255, 0, 0), p);
p = await px(92, 100);  add('T2 pattern repeats: first tile, green half', near(p, 0, 255, 0), p);
p = await px(97, 100);  add('T3 pattern repeats (second tile starts red again, not stretched)', near(p, 255, 0, 0), p);
p = await px(160, 100); add('T4 failed pattern falls back to the colored shape', near(p, 0, 0, 255), p);

const nonBg = (r) => r.art > 40;
const region = (cx, cy) => count(cx, cy, 12);
let r;
r = await region(40, 100);  add('N1 texture = "coin" draws catalog art, no colored block', nonBg(r) && r.blue === 0, r);
r = await region(220, 100); add('N2 setting .image after .texture clears the name', nonBg(r) && r.blue === 0, r);
const names = await frame.evaluate(() => { const nm = (s) => s.texture && s.texture.name; return { get: nm(named), swappedName: swapped.texture, unknown: unknown.texture,
  has: hasTexture('coin'), no: hasTexture('nopeNotAThing'), n: textureNames().length, mine: nm(mine) }; });
add('N3 .texture.name reads back the name', names.get === 'coin' && names.mine === 'myRed', names);
add('N4 .image clears .texture; unknown name leaves it unset', names.swappedName === null && names.unknown === null, names);
add('N5 hasTexture / textureNames cover the 40 built-ins plus saved', names.has && !names.no && names.n >= 41, names);
p = await px(340, 100); add('N6 saveTexture() art is found by name', near(p, 255, 0, 0), p);
r = await region(400, 100); add('N7 group.texture reaches existing members', nonBg(r) && r.blue === 0, r);
r = await region(430, 100); add('N8 group.texture is the default for new group.Sprite()', nonBg(r) && r.blue === 0, r);

await waitFrames(frame, 30);
const anim = await frame.evaluate(() => ({ n: fly.ani && fly.ani.frameCount, f: fly.ani && fly.ani.frame, name: fly.texture && fly.texture.name,
  run: (() => { const s = new Sprite(0, 0, 24, 24); s.texture = 'runner'; return s.ani && s.ani.frameCount; })() }));
add('N9 built-in animated texture plays as a sprite sheet (batFly = 4 frames, advancing)', anim.n === 4 && anim.name === 'batFly' && anim.f > 0, anim);
add('N10 original sheet in the catalog: runner = 6 frames', anim.run === 6, anim);

let ok = true;
for (const [name, pass, detail] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await page.screenshot({ path: 'tests/artifacts/art-verified.png', fullPage: true });
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
