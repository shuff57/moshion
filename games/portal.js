// PORTAL CHAMBERS — a momentum-conserving portal puzzle for the moSHion demo.
// Left click places the orange portal, right click places the blue one.
// Anything that falls into one portal exits the other with its velocity
// rotated from the entry normal to the exit normal. Reach the goal zone.
//
// Globals (QA contract): player, portals = {orange, blue}, teleports, respawns,
// cooldown, won, timer. The whole chamber fits one 460x300 screen; the camera
// stays at its default so screen coordinates match world coordinates.

// On-screen controls: touch has no right-click equivalent, so without this
// the blue portal is unreachable on a phone. TOGGLE_BTN is a small pill in
// the corner; tapping it (touch only -- desktop keeps right-click) flips
// which color the next tap places. Hit-tested against mouse.canvasPos,
// which is screen space regardless of camera (this game's camera never
// moves, but the pattern matches every other game's HUD buttons).
var TOGGLE_BTN = { x: 382, y: 8, w: 70, h: 24 };
function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function setup() {
  new Canvas(460, 300);
  world.gravity.y = 10;

  solids = new Group();
  solids.color = "#333844";

  // Shell: floor, side walls (inner faces pinned at x=30 / x=430).
  new solids.Sprite(230, 285, 400, 30, "static");   // floor, top edge y=270
  new solids.Sprite(15, 130, 30, 320, "static");    // left wall, inner edge x=30
  new solids.Sprite(445, 130, 30, 320, "static");   // right wall, inner edge x=430
  new solids.Sprite(230, -15, 400, 30, "static");   // ceiling, bottom edge y=0

  // Interior: a step, a high ledge, and the goal zone on the ledge.
  new solids.Sprite(300, 250, 120, 40, "static");   // step, top edge y=230
  new solids.Sprite(360, 170, 20, 100, "static");   // ledge column
  new solids.Sprite(410, 124, 100, 12, "static");   // ledge floor, top y=118
  new solids.Sprite(366, 90, 8, 56, "static");      // ledge lip (left)
  new solids.Sprite(456, 90, 8, 56, "static");      // ledge lip (right)

  player = new Sprite(60, 250, 18, 26);
  player.color = "#5baafd";
  player.friction = 0;
  player.bounciness = 0;
  player.rotationLock = true;

  crate = new Sprite(330, 219, 22, 22);
  crate.color = "#ffb86c";
  crate.friction = 0.4;

  portals = { orange: null, blue: null };
  teleports = 0;
  respawns = 0;
  cooldown = 0;
  won = false;
  timer = 0;

  spawnX = 60;
  spawnY = 250;

  latchL = false;
  latchR = false;

  TOUCH = navigator.maxTouchPoints > 0;
  placeColor = "orange";

  window.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}

// Placement ray: exactly from the player's center toward the cursor, extended
// far along the same direction (planck skips shapes containing the start
// point, so the player's own body is never reported). First solid hit.
function castAim(tx, ty) {
  var dx = tx - player.x, dy = ty - player.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return null;
  var ex = player.x + dx / len * 1200;
  var ey = player.y + dy / len * 1200;
  var hit = null;
  world.rayCast(player.x, player.y, ex, ey, function (sprite, point, normal, fraction) {
    if (sprite && sprite.collider === "none") return -1;
    if (!hit) hit = { point: { x: point.x, y: point.y }, normal: { x: normal.x, y: normal.y } };
    return fraction;
  });
  return hit;
}

function placePortal(which, tx, ty) {
  var hit = castAim(tx, ty);
  if (!hit) return;
  var other = which === "orange" ? portals.blue : portals.orange;
  if (other) {
    var dd = Math.hypot(other.x - hit.point.x, other.y - hit.point.y);
    if (dd < 30) return;
  }
  var ang = Math.atan2(hit.normal.y, hit.normal.x) * 180 / Math.PI;
  portals[which] = { x: hit.point.x, y: hit.point.y, nx: hit.normal.x, ny: hit.normal.y, angle: ang };
}

function doTeleport(body, pIn, pOut) {
  // Rotate the incoming velocity by the angle from the reversed entry normal
  // to the exit normal, so "into the wall" becomes "out of the wall".
  var aA = Math.atan2(-pIn.ny, -pIn.nx);
  var aB = Math.atan2(pOut.ny, pOut.nx);
  var th = aB - aA;
  var c = Math.cos(th), s = Math.sin(th);
  var vx = body.vel.x, vy = body.vel.y;
  var ox = vx * c - vy * s;
  var oy = vx * s + vy * c;
  var sp = Math.hypot(ox, oy);
  if (sp > 55) { ox = ox / sp * 55; oy = oy / sp * 55; }
  body.vel.x = ox;
  body.vel.y = oy;
  body.pos.x = pOut.x + pOut.nx * 16;
  body.pos.y = pOut.y + pOut.ny * 16;
}

function tryTeleport(body) {
  if (cooldown > 0) return;
  // A landing body's velocity is zeroed by the floor contact inside the same
  // physics step that carries it into the portal region, so the current
  // velocity can read as settled the moment the body first qualifies. The
  // velocity snapshotted at the end of the previous update is what the body
  // was actually carrying into this step — prefer it when the live velocity
  // has already been quenched by contact.
  var vx = Math.abs(body.vel.x) + Math.abs(body.vel.y) > 0.5 ? body.vel.x : (body._pvx || 0);
  var vy = Math.abs(body.vel.x) + Math.abs(body.vel.y) > 0.5 ? body.vel.y : (body._pvy || 0);
  for (var i = 0; i < 2; i++) {
    var pIn = i === 0 ? portals.orange : portals.blue;
    var pOut = i === 0 ? portals.blue : portals.orange;
    if (!pIn || !pOut) continue;
    var d = Math.hypot(body.x - pIn.x, body.y - pIn.y);
    if (d > 20) continue;
    var into = vx * pIn.nx + vy * pIn.ny;
    if (into > -0.5) continue;
    body.vel.x = vx;
    body.vel.y = vy;
    doTeleport(body, pIn, pOut);
    body._pvx = body.vel.x;
    body._pvy = body.vel.y;
    teleports++;
    cooldown = 40;
    return;
  }
}

function grounded() {
  var hit = null;
  world.rayCast(player.x, player.y + 12, player.x, player.y + 20, function (sprite, point, normal, fraction) {
    if (sprite && sprite.collider === "none") return -1;
    hit = sprite;
    return 0;
  });
  return hit !== null;
}

function update() {
  timer++;
  if (cooldown > 0) cooldown--;

  if (kb.pressing("left")) player.vel.x = -2.6;
  else if (kb.pressing("right")) player.vel.x = 2.6;

  if ((kb.presses("up") || kb.presses("space")) && grounded()) {
    player.vel.y = -4.2; // rise ~106px — the goal ledge (152px up) needs a portal fling
  }

  // Placement with a latch so a quick tap only fires once (the engine's
  // per-button counters read 1 both on press and on a quick release).
  if (mouse.presses()) {
    if (TOUCH && !latchL && inRect(mouse.canvasPos, TOGGLE_BTN)) {
      // Touch has no right button -- this is the only way to reach blue.
      latchL = true;
      placeColor = placeColor === "orange" ? "blue" : "orange";
    } else if (mouse.left > 0 && !latchL) {
      latchL = true;
      placePortal(placeColor, mouse.x, mouse.y);
    }
    if (mouse.right > 0 && !latchR) { latchR = true; placePortal("blue", mouse.x, mouse.y); }
  }
  if (mouse.left === 0) latchL = false;
  if (mouse.right === 0) latchR = false;

  tryTeleport(player);
  tryTeleport(crate);

  if (player.y > 340) {
    player.pos.x = spawnX;
    player.pos.y = spawnY;
    player.vel.x = 0;
    player.vel.y = 0;
    respawns++;
    cooldown = 0;
  }
  if (crate.y > 360) {
    crate.pos.x = 330;
    crate.pos.y = 200;
    crate.vel.x = 0;
    crate.vel.y = 0;
  }

  if (!won && player.x > 388 && player.x < 452 && player.y < 118) {
    won = true;
  }

  // Snapshot the velocity the body carries INTO the next physics step — the
  // contact solver may quench it during that step, and tryTeleport above
  // needs it one frame later (see the comment there).
  player._pvx = player.vel.x;
  player._pvy = player.vel.y;
  crate._pvx = crate.vel.x;
  crate._pvy = crate.vel.y;
}

function drawGhostRing(tx, ty) {
  var hit = castAim(tx, ty);
  if (!hit) return;
  var p = { x: hit.point.x, y: hit.point.y, nx: hit.normal.x, ny: hit.normal.y };
  var col = mouse.right > 0 ? "#5b8cff" : (placeColor === "orange" ? "#ff9f43" : "#5b8cff");
  stroke(col);
  strokeWeight(1);
  var tx2 = -p.ny, ty2 = p.nx;
  var steps = 26;
  var px = 0, py = 0;
  for (var i = 0; i <= steps; i++) {
    var t = (i / steps) * Math.PI * 2;
    var ox = tx2 * Math.cos(t) * 21 + p.nx * Math.sin(t) * 5;
    var oy = ty2 * Math.cos(t) * 21 + p.ny * Math.sin(t) * 5;
    var nx = p.x + ox, ny = p.y + oy;
    if (i > 0) line(px, py, nx, ny);
    px = nx; py = ny;
  }
}

function drawPortalRing(which) {
  var p = portals[which];
  if (!p) return;
  var col = which === "orange" ? "#ff9f43" : "#5b8cff";
  var tx = -p.ny, ty = p.nx; // tangent (perpendicular to the surface normal)
  var rw = 21, rh = 5;
  var steps = 26;
  for (var ring = 0; ring < 2; ring++) {
    var rr = ring === 0 ? 1 : 0.62;
    stroke(col);
    strokeWeight(ring === 0 ? 3 : 1.5);
    var px = 0, py = 0;
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * Math.PI * 2;
      var ox = tx * Math.cos(t) * rw * rr + p.nx * Math.sin(t) * rh * rr;
      var oy = ty * Math.cos(t) * rw * rr + p.ny * Math.sin(t) * rh * rr;
      var nx = p.x + ox, ny = p.y + oy;
      if (i > 0) line(px, py, nx, ny);
      px = nx; py = ny;
    }
  }
}

function draw() {
  background("#1e1f29");

  drawPortalRing("orange");
  drawPortalRing("blue");

  // Aim tracer from the player toward the cursor, with a ghost ring showing
  // where the next placement would land. An untouched mouse reads (0,0) — a
  // real world coordinate — so without the isActive guard the demo opens with
  // a rope drawn to its own top-left corner before anyone has aimed anything.
  if (mouse.isActive) {
    stroke("#8b95a8");
    strokeWeight(2);
    line(player.x, player.y, mouse.x, mouse.y);
    drawGhostRing(mouse.x, mouse.y);
  }

  // Goal marker on the ledge.
  stroke("#ffb86c");
  strokeWeight(2);
  line(392, 116, 452, 116);
}

// The engine calls drawTop() after the world is on the canvas, in screen
// space — so a HUD lands on top of the scenery instead of behind it.
function drawTop() {
  var secs = Math.floor(timer / 60);
  text("TIME " + secs + "s", 14, 22, 12, "#6272a4");
  if (won) {
    textAlign("center");
    text("CHAMBER COMPLETE", 230, 120, 18, "#ffb86c");
    textAlign("left");
  }
  if (TOUCH) {
    fill("rgba(30, 31, 41, 0.82)");
    stroke("#44475a");
    strokeWeight(1);
    rect(TOGGLE_BTN.x, TOGGLE_BTN.y, TOGGLE_BTN.w, TOGGLE_BTN.h, 5);
    noStroke();
    fill(placeColor === "orange" ? "#ff9f43" : "#5b8cff");
    circle(TOGGLE_BTN.x + 12, TOGGLE_BTN.y + TOGGLE_BTN.h / 2, 10);
    noFill();
    text(placeColor === "orange" ? "ORANGE" : "BLUE", TOGGLE_BTN.x + 22, TOGGLE_BTN.y + 16, 10, "#8b95a8");
  }
}