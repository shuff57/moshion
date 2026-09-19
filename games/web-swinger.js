// WEB SWINGER — a momentum-preserving web-swinging toy for the moSHion demo.
// Hold the mouse to cast a web toward the cursor (a raycast that retries at
// small angular offsets on a miss); a rigid DistanceJoint to the hit point
// makes a real pendulum. Release to fly. W (up) reels the web in. Grab the
// glowing orbs for points.
//
// Globals (QA contract): player, web, anchor, jointsMade, respawns, score,
// buildings, collectibles, MAXWEB. Camera follows the player; screen = world
// minus the camera offset.

function setup() {
  new Canvas(460, 300);
  world.gravity.y = 10;

  buildings = new Group();
  buildings.color = "#333844";

  // Deterministic city, world 1600x600. Ground strip + towers with flat tops.
  groundL = new Sprite(400, 700, 800, 20, "static");   // ground: top y=690
  groundL.color = "#333844";
  groundR = new Sprite(1200, 700, 800, 20, "static");
  groundR.color = "#333844";

  // Buildings (x, topY, w, h), creation order matters: the first one is the
  // tall tower left of the start perch — its top/right face is the anchor the
  // swinging contract tests, and the pendulum needs free air around it.
  buildTower(20, 460, 30, 100);     // anchor tower: spans x 5..35, y 460..560 (sky platform)
  buildTower(120, 670, 14, 20);     // start perch under the player
  buildTower(460, 560, 120, 130);   // right-side towers all start past x=380 so
  buildTower(620, 520, 110, 170);   // nothing intersects a MAXWEB-length aim ray
  buildTower(780, 470, 120, 220);   // fired at the player's own height
  buildTower(940, 540, 110, 150);
  buildTower(1100, 480, 110, 210);
  buildTower(1260, 550, 120, 140);
  buildTower(1420, 500, 110, 190);

  player = new Sprite(120, 663, 14);
  player.color = "#5baafd";
  player.friction = 0;
  player.bounciness = 0;
  player.rotationLock = true;

  web = null;
  anchor = null;
  jointsMade = 0;
  respawns = 0;
  score = 0;
  MAXWEB = 260;

  startX = 120;
  startY = 663;

  holding = false;
  aimedX = 0;
  aimedY = 0;

  collectibles = new Group();
  collectibles.color = "#ffb86c";
  // Deterministic orb slots between towers.
  orbSlots = [[300, 560], [450, 470], [620, 430], [780, 380], [940, 460], [1100, 410], [1260, 470], [1420, 430]];
  orbIndex = 0;
  spawnOrb();

  camera.x = 230;
  camera.y = 480;
}

function buildTower(x, topY, w, h) {
  new buildings.Sprite(x, topY + h / 2, w, h, "static");
}

function spawnOrb() {
  var slot = orbSlots[orbIndex % orbSlots.length];
  orbIndex++;
  var orb = new collectibles.Sprite(slot[0], slot[1], 16);
  orb.collider = "none";   // sensor: collectible, not a solid body
  orb.gravityScale = 0;    // orbs float where the city needs them
}

// The web cast: a ray from the player toward the cursor, up to MAXWEB long.
// On a miss, retry at +-8 and +-16 degrees before giving up. Sensors skipped.
function castWeb() {
  var dx = aimedX - player.x, dy = aimedY - player.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 8) return null;
  var base = Math.atan2(dy, dx);
  // The spread assist rescues precision misses on in-range aims only — an
  // aim beyond the web's range is a clean miss, never conjured into a hit.
  var tries = len <= MAXWEB ? [0, -8, 8, -16, 16] : [0];
  for (var t = 0; t < tries.length; t++) {
    var ang = base + tries[t] * Math.PI / 180;
    var reach = Math.min(len, MAXWEB);
    var ex = player.x + Math.cos(ang) * reach;
    var ey = player.y + Math.sin(ang) * reach;
    var hit = null;
    world.rayCast(player.x, player.y, ex, ey, function (sprite, point, normal, fraction) {
      if (sprite && sprite.collider === "none") return -1;
      if (sprite === player) return -1;
      // planck reports fixtures out of order: keep the closest.
      if (!hit || fraction < hit.fraction) {
        hit = { sprite: sprite, point: { x: point.x, y: point.y }, fraction: fraction };
      }
      return fraction;
    });
    if (hit && hit.sprite) {
      return hit;
    }
  }
  return null;
}

function attachWeb() {
  var hit = castWeb();
  if (!hit) return;
  player.sleeping = false; // a settled body stays asleep through joint creation
  // A resting player is pinned between the perch's vertical normal and the
  // now-taut rope's radial constraint — no small hop escapes that equilibrium
  // because the solver projects any radial velocity straight back out. A
  // horizontal shove works: the perch can't resist it (friction is zero), the
  // player slides off the platform edge, and the rope catches the fall into a
  // real pendulum swing.
  if (Math.hypot(player.vel.x, player.vel.y) < 1 && hit.point.x !== player.x) {
    player.vel.x += player.x > hit.point.x ? 2.5 : -2.5;
  }
  anchor = new Sprite(hit.point.x, hit.point.y, 2, 2, "static");
  anchor.collider = "none";
  anchor.color = "transparent";
  anchor.visible = false;
  web = new DistanceJoint(player, anchor);
  // A rope the exact length of the cast leaves the player pinned between the
  // perch and the rod; reeling in a little on attach pulls the player off its
  // feet and starts the swing.
  if (web.length > 40) web.length = web.length - 20;
  jointsMade++;
}

function detachWeb() {
  if (web) { web.delete(); web = null; }
  if (anchor) { anchor.delete(); anchor = null; }
}

function update() {
  // Fresh-press latch: press edge starts the web; holding keeps it; release
  // detaches with velocity untouched.
  if (mouse.presses() && !web && mouse.isActive) {
    aimedX = mouse.x;
    aimedY = mouse.y;
    holding = true;
    attachWeb();
  } else if (holding && mouse.pressing() && web) {
    aimedX = mouse.x;
    aimedY = mouse.y;
  }
  if (mouse.released()) {
    holding = false;
    detachWeb();
  }

  // Air control: gentle push while not attached.
  if (!web) {
    if (kb.pressing("left")) player.vel.x = Math.max(player.vel.x - 0.3, -6);
    if (kb.pressing("right")) player.vel.x = Math.min(player.vel.x + 0.3, 6);
  } else {
    // Reel in.
    if (kb.pressing("up") && web.length > 30) {
      web.length = web.length - 2;
    }
    // Auto-pump: while attached and below the anchor, push along velocity.
    if (anchor && player.y > anchor.y) {
      var sp = Math.hypot(player.vel.x, player.vel.y);
      if (sp > 0.3 && sp < 40) {
        player.applyForceScaled((player.vel.x / sp) * 0.5, (player.vel.y / sp) * 0.5);
      }
    }
  }

  // Orbs.
  player.overlaps(collectibles, function (self, orb) {
    score += 10;
    orb.delete();
    spawnOrb();
  });

  // Kill plane.
  if (player.y > 780) {
    detachWeb();
    holding = false;
    player.pos.x = startX;
    player.pos.y = startY;
    player.vel.x = 0;
    player.vel.y = 0;
    respawns++;
  }

  // Camera follows, clamped to the world.
  // Follow the player with a half-view margin so a big swing on the left
  // anchor tower never carries the player off-screen; only the right side is
  // clamped (the world ends at x=1600).
  var tx = Math.min(1370, Math.max(0, player.x));
  var ty = Math.max(150, Math.min(570, player.y));
  camera.x += (tx - camera.x) * 0.1;
  camera.y += (ty - camera.y) * 0.1;
}

function draw() {
  background("#1e1f29");

  // Web line with a slight sag.
  if (web && anchor) {
    var mx = (player.x + anchor.x) / 2, my = (player.y + anchor.y) / 2;
    var ddx = anchor.x - player.x, ddy = anchor.y - player.y;
    var dl = Math.hypot(ddx, ddy) || 1;
    var rest = web.length;
    var sag = Math.max(0, rest - dl) * 0.9 + 4;
    stroke("#f8f8f2");
    strokeWeight(2);
    var steps = 8;
    var px = player.x, py = player.y;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var lx = player.x + ddx * t;
      var ly = player.y + ddy * t + Math.sin(t * Math.PI) * sag * 0.3;
      line(px, py, lx, ly);
      px = lx; py = ly;
    }
    stroke("#f8f8f2");
    strokeWeight(1);
    for (var s2 = 1; s2 <= 3; s2++) {
      var tt = s2 / 4;
      var bx = player.x + ddx * tt;
      var by = player.y + ddy * tt;
      line(bx - 3, by - 3, bx + 3, by + 3);
    }
  }

  // Speed lines when fast.
  var spd = Math.hypot(player.vel.x, player.vel.y);
  if (spd > 5) {
    stroke("#6272a4");
    strokeWeight(1);
    line(player.x - player.vel.x * 1.5, player.y - player.vel.y * 1.5,
         player.x - player.vel.x * 2.5, player.y - player.vel.y * 2.5);
  }

}

// The engine calls drawTop() after the world is on the canvas, in screen
// space — so a HUD lands on top of the scenery instead of behind it.
function drawTop() {
  var spd = Math.hypot(player.vel.x, player.vel.y);
  text("SCORE " + score, 14, 22, 12, "#6272a4");
  text("SPEED " + Math.round(spd * 10) / 10, 14, 40, 12, "#6272a4");
}