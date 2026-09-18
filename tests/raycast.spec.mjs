// Scenario: engine world.rayCast — closest hit, normal, sprite resolution,
// closest-hit clipping. Exercises the REAL surface (browser runner).
// Pass condition: every check prints PASS; exit code 0 only if all pass.
import { launch, serve, runSketch, b64url, mouseDown, waitFrames } from './harness.mjs';

const code = `
function setup() {
  new Canvas(460, 300);
  world.gravity.y = 0;
  walls = new Group();
  walls.color = "#333844";
  new walls.Sprite(230, 290, 460, 20, "static");  // floor top edge at y=280
  new walls.Sprite(230, 10, 460, 20, "static");   // ceiling bottom edge at y=20
  new walls.Sprite(10, 150, 20, 300, "static");   // left wall right edge at x=20
  new walls.Sprite(450, 150, 20, 300, "static");  // right wall left edge at x=440
  marker = new Sprite(230, 150, 24, 24, "static");
  marker.color = "#ffb86c";
  hits = [];
  result = null;
}
function update() {}
function draw() { background("#1e1f29"); }
`;

const srv = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const frame = await runSketch(page, srv.base, code);

// Geometry: from (60,150) toward marker center (230,150) — the marker's left
// edge is at x=138, so fraction = (138-60)/(150-60) = 0.8667, point x=138.
const checks = await frame.evaluate(() => {
  const out = [];
  let hit = null;
  world.rayCast(60, 150, 240, 150, function (sprite, point, normal, fraction) {
    if (sprite && sprite.collider === 'none') return -1;
    hit = { sprite: sprite ? sprite === marker : null, point: point, normal: normal, fraction: fraction };
    return fraction;
  });
  out.push(['rayCast hit marker at left edge x=218', hit && Math.abs(hit.point.x - 218) < 0.6 && Math.abs(hit.point.y - 150) < 0.6,
    JSON.stringify(hit && hit.point)]);
  out.push(['fraction matches geometry (0.8778)', hit && Math.abs(hit.fraction - (218 - 60) / (240 - 60)) < 0.01,
    hit && hit.fraction]);
  out.push(['normal points back along ray (-1,0)', hit && Math.abs(hit.normal.x + 1) < 1e-6 && Math.abs(hit.normal.y) < 1e-6,
    JSON.stringify(hit && hit.normal)]);
  out.push(['sprite resolves to the hit Sprite', hit && hit.sprite === true, String(hit && hit.sprite)]);

  // Sensor filtering: a collider='none' sprite must NOT block the ray.
  const ghost = new Sprite(100, 240, 40, 40);
  ghost.collider = 'none';
  let blocked = false;
  world.rayCast(60, 240, 160, 240, function (sprite, point, normal, fraction) {
    if (sprite && sprite.collider === 'none') return -1;
    blocked = true; return 0;
  });
  out.push(['sensor (collider none) is skippable via return -1', blocked === false, String(blocked)]);

  // Closest-hit clipping: two sprites on the ray, closer one reported.
  const near = new Sprite(200, 60, 20, 20, 'static');
  const far = new Sprite(260, 60, 20, 20, 'static');
  let first = null;
  world.rayCast(100, 60, 300, 60, function (sprite, point, normal, fraction) {
    if (sprite && sprite.collider === 'none') return -1;
    first = point.x; return fraction;
  });
  out.push(['closest-hit clipping returns leftmost hit', first !== null && Math.abs(first - 190) < 0.6, String(first)]);

  // Object form: world.rayCast({x,y},{x,y},cb)
  let objForm = null;
  world.rayCast({ x: 60, y: 150 }, { x: 240, y: 150 }, function (sprite, point, normal, fraction) {
    objForm = point.x; return 0;
  });
  out.push(['object-argument form works', objForm !== null && Math.abs(objForm - 218) < 0.6, String(objForm)]);
  return out;
});

await mouseDown(frame, 230, 150);
await waitFrames(frame, 5);

let ok = true;
for (const [name, pass, detail] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}
await page.screenshot({ path: 'tests/artifacts/raycast-verified.png', fullPage: true });

await browser.close();
srv.close();
process.exit(ok ? 0 : 1);