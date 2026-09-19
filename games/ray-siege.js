// RAY SIEGE — a destructible-fortress siege shooter for the moSHion demo.
// WASD moves, mouse aims, left click fires. 1 = rifle (single hit), 2 = cannon
// (radial blast + debris), 3 = beam (everything along the ray, slow cooldown).
// Bricks are static until unsupported: destroying one runs a flood fill from
// the ground and anything it can no longer reach falls. Drones hunt the player.
//
// Globals (QA contract): player, bricks, BRICKS0, weapon, drones, debris,
// destroyed, hp, score. The camera stays at its default so screen coordinates
// equal world coordinates.

function setup() {
  new Canvas(460, 300);
  world.gravity.y = 10;

  ground = new Sprite(230, 285, 460, 30, "static");
  ground.color = "#333844";
  wallL = new Sprite(-5, 150, 10, 300, "static");
  wallL.color = "#333844";
  wallR = new Sprite(465, 150, 10, 300, "static");
  wallR.color = "#333844";

  bricks = new Group();
  bricks.color = "#333844";
  bricks.stroke = "#6272a4";
  bricks.strokeWeight = 1;

  // Deterministic fortress on the right half. Brick is 14x14; rows sit 14px
  // apart on the ground (top of ground at y=270).
  // Free-standing 4-brick tower at x=280: reachable from the player, so the
  // collapse behavior is observable away from the main keep.
  buildColumn(280, 0, 3);
  // Main keep: six columns with a window gap, plus a connected roof row.
  for (var col = 350; col <= 420; col += 14) {
    var rows = 6;
    if (col === 378 || col === 392) rows = 2; // window gap
    for (var row = 0; row < rows; row++) buildColumn(col, row, row);
  }
  for (var c2 = 350; c2 <= 420; c2 += 14) {
    new bricks.Sprite(c2, 270 - 7 - 6 * 14, 14, 14, "static"); // roof row
  }

  BRICKS0 = bricks.length;

  player = new Sprite(70, 250, 16, 22);
  player.color = "#5baafd";
  player.friction = 0;
  player.bounciness = 0;
  player.rotationLock = true;

  drones = new Group();
  drones.color = "#ef4444";
  debris = new Group();
  debris.color = "#8a8f98";

  weapon = 1;
  destroyed = 0;
  hp = 3;
  score = 0;

  fireCooldown = 0;
  beamCooldown = 0;
  invuln = 0;
  droneTimer = 200;
  flashX = 0;
  flashY = 0;
  flashT = 0;
  tracerT = 0;
  tracerX1 = 0; tracerY1 = 0; tracerX2 = 0; tracerY2 = 0;
  tracer = null;
  supportDirty = false;

  // Prev-velocity snapshots for the same landing-crossing reason as portal.js.
  player._pvx = 0;
  player._pvy = 0;
}

// Drops a brick column of `count` bricks starting at ground level upward.
function buildColumn(x, from, to) {
  for (var row = from; row <= to; row++) {
    new bricks.Sprite(x, 270 - 7 - row * 14, 14, 14, "static");
  }
}

// Ray from just outside the player toward the mouse; first solid hit.
function castAim(tx, ty) {
  var dx = tx - player.x, dy = ty - player.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return null;
  var ex = player.x + dx / len * 1200;
  var ey = player.y + dy / len * 1200;
  // planck does not report fixtures in order — clip the ray at every hit and
  // keep the minimum-fraction one (the docs' own closest-hit pattern).
  var hit = null;
  world.rayCast(player.x, player.y, ex, ey, function (sprite, point, normal, fraction) {
    if (sprite && sprite.collider === "none") return -1;
    if (sprite === player) return -1;
    if (!hit || fraction < hit.fraction) {
      hit = { sprite: sprite, point: { x: point.x, y: point.y }, normal: { x: normal.x, y: normal.y }, fraction: fraction };
    }
    return fraction;
  });
  return hit;
}

// Every solid fixture along the aim ray (beam).
function castAll(tx, ty) {
  var dx = tx - player.x, dy = ty - player.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return [];
  var ex = player.x + dx / len * 1200;
  var ey = player.y + dy / len * 1200;
  var hits = [];
  world.rayCast(player.x, player.y, ex, ey, function (sprite, point, normal, fraction) {
    if (sprite && sprite.collider === "none") return -1;
    if (sprite === player) return -1;
    if (sprite && bricks.contains(sprite)) hits.push({ sprite: sprite, point: { x: point.x, y: point.y } });
    return 1;
  });
  return hits;
}

function destroyBrick(b) {
  if (!b || b._dead) return;
  destroyed++;
  score += 25;
  b.delete();
  supportDirty = true;
}

// Flood fill 4-connected from ground-level static bricks; anything static and
// unreached loses support and falls. Runs at most once per frame.
function recomputeSupport() {
  var statics = [];
  var i;
  for (i = 0; i < bricks.length; i++) {
    if (bricks[i].collider === "static" && !bricks[i]._dead) statics.push(bricks[i]);
  }
  var byKey = {};
  for (i = 0; i < statics.length; i++) {
    var k = Math.round(statics[i].x) + ":" + Math.round(statics[i].y);
    byKey[k] = statics[i];
  }
  var visited = {};
  var queue = [];
  for (i = 0; i < statics.length; i++) {
    var b = statics[i];
    // Ground level: bottom edge near the ground surface (y=270).
    if (b.y + 7 >= 269) {
      var k0 = Math.round(b.x) + ":" + Math.round(b.y);
      if (!visited[k0]) { visited[k0] = true; queue.push(b); }
    }
  }
  while (queue.length) {
    var cur = queue.pop();
    var dirs = [[14, 0], [-14, 0], [0, 14], [0, -14]];
    for (var d = 0; d < 4; d++) {
      var nk = Math.round(cur.x + dirs[d][0]) + ":" + Math.round(cur.y + dirs[d][1]);
      if (visited[nk]) continue;
      if (!byKey[nk]) continue;
      visited[nk] = true;
      queue.push(byKey[nk]);
    }
  }
  for (i = 0; i < statics.length; i++) {
    var kb = Math.round(statics[i].x) + ":" + Math.round(statics[i].y);
    if (!visited[kb]) {
      statics[i].collider = "dynamic";
      statics[i].bounciness = 0.1;
      statics[i].allowSleeping = false;
      // Rubble crumbles shortly after falling so it never piles up in front
      // of the fortress sight lines.
      statics[i].life = 50;
    }
  }
}

function spawnDebris(x, y, n) {
  for (var i = 0; i < 4; i++) {
    var d = new debris.Sprite(x + (i % 2) * 6 - 3, y + (i % 2) * 6 - 3, 6, 6);
    d.vel.x = (i % 2 === 0 ? -1 : 1) * (1.5 + i * 0.4);
    d.vel.y = -(1.5 + i * 0.3);
    d.life = 50;
    d.gravityScale = 1;
  }
}

function fire(tx, ty) {
  if (fireCooldown > 0) return;
  if (weapon === 3) {
    if (beamCooldown > 0) return;
    beamCooldown = 40;
  }
  fireCooldown = 12;
  flashX = tx; flashY = ty; flashT = 6;
  tracerX1 = player.x; tracerY1 = player.y;
  tracerX2 = tx; tracerY2 = ty; tracerT = 5;

  var hit = castAim(tx, ty);
  if (weapon === 1) {
    if (hit && hit.sprite) {
      if (bricks.contains(hit.sprite)) {
        hit.sprite.delete();
        destroyed++;
        score += 25;
        supportDirty = true;
      } else if (drones.contains(hit.sprite)) {
        hit.sprite.delete();
        score += 100;
      }
    }
  } else if (weapon === 2) {
    if (hit && hit.sprite) {
      var hx = hit.point.x, hy = hit.point.y;
      world.explodeAt(hx, hy, 55, 110, 0.05);
      var victims = [];
      var i;
      for (i = 0; i < bricks.length; i++) {
        var b = bricks[i];
        if (b._dead || b.collider !== "static") continue;
        if (Math.hypot(b.x - hx, b.y - hy) <= 55 + 7) victims.push(b);
      }
      for (i = 0; i < victims.length; i++) {
        victims[i].delete();
        destroyed++;
        score += 25;
      }
      supportDirty = true;
      spawnDebris(hx, hy);
      if (drones.contains(hit.sprite)) { hit.sprite.delete(); score += 100; }
    }
  } else {
    var all = castAll(tx, ty);
    var i2;
    for (i2 = 0; i2 < all.length; i2++) {
      all[i2].sprite.delete();
      destroyed++;
      score += 25;
    }
    if (all.length) supportDirty = true;
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
  if (fireCooldown > 0) fireCooldown--;
  if (beamCooldown > 0) beamCooldown--;
  if (invuln > 0) invuln--;

  if (kb.pressing("left") || kb.pressing("a")) player.vel.x = -2.4;
  else if (kb.pressing("right") || kb.pressing("d")) player.vel.x = 2.4;
  else player.vel.x = player.vel.x * 0.85;

  if ((kb.presses("up") || kb.presses("space") || kb.presses("w")) && grounded()) {
    player.vel.y = -6;
  }

  if (kb.presses("1")) weapon = 1;
  if (kb.presses("2")) weapon = 2;
  if (kb.presses("3")) weapon = 3;

  if (mouse.presses() && fireCooldown === 0 && (weapon !== 3 || beamCooldown === 0)) {
    fire(mouse.x, mouse.y);
  }
  // Drones spawn from the right edge and seek the player.
  droneTimer--;
  if (droneTimer <= 0) {
    var dr = new drones.Sprite(440, 120 + (score % 3) * 30, 14);
    dr.gravityScale = 0;
    dr.friction = 0;
    dr.bounciness = 0;
    droneTimer = 300;
  }
  drones.slice().forEach(function (dr) {
    var dx = player.x - dr.x, dy = player.y - dr.y;
    var len = Math.hypot(dx, dy) || 1;
    // Hover out of ramming range: a drone parked next to the player would sit
    // in front of every aim ray the player casts.
    var approach = len > 130 ? 1.4 : 0;
    dr.vel.x = (dx / len) * approach;
    dr.vel.y = (dy / len) * approach;
    if (Math.hypot(dr.x - player.x, dr.y - player.y) < 20 && invuln === 0) {
      hp--;
      invuln = 60;
      player.vel.x = -4;
      player.vel.y = -3;
      if (hp <= 0) {
        hp = 3;
        score = Math.max(0, score - 200);
        player.pos.x = 70;
        player.pos.y = 250;
        player.vel.x = 0;
        player.vel.y = 0;
      }
    }
    if (dr.x < -20 || dr.x > 560) dr.delete();
  });

  // Debounced support recompute: at most one flood fill per frame.
  if (supportDirty) {
    supportDirty = false;
    recomputeSupport();
  }

  debris.slice().forEach(function (d) {
    if (d.y > 340) d.delete();
  });

  player._pvx = player.vel.x;
  player._pvy = player.vel.y;
}

function draw() {
  background("#1e1f29");

  if (flashT > 0) {
    flashT--;
    noStroke();
    fill(flashT % 2 ? "#ffb86c" : "#f8f8f2");
    circle(flashX, flashY, 14 - flashT);
    noFill();
  }
  // Hitscan tracer: a fading line from the muzzle toward the last shot.
  if (tracerT > 0) {
    tracerT--;
    stroke("#ffb86c");
    strokeWeight(tracerT > 3 ? 3 : 1);
    line(tracerX1, tracerY1, tracerX2, tracerY2);
  }

}

// The engine calls drawTop() after the world is on the canvas, in screen
// space — so a HUD lands on top of the scenery instead of behind it.
function drawTop() {
  var pct = BRICKS0 ? Math.round((destroyed / BRICKS0) * 100) : 0;
  text("SCORE " + score + "   DESTROYED " + pct + "%", 14, 22, 12, "#6272a4");
  text("MODE " + (weapon === 1 ? "RIFLE" : weapon === 2 ? "CANNON" : "BEAM"), 14, 40, 12, "#6272a4");
  for (var i = 0; i < hp; i++) {
    noStroke();
    fill("#ef4444");
    rect(14 + i * 16, 50, 10, 10, 2);
    noFill();
  }
}