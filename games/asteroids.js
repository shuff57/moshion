// On-screen controls: shown only on a touch-capable device (no keyboard) so
// a mouse/keyboard desktop never sees them. Held buttons read mouse.pressing()
// against these rects via mouse.canvasPos -- screen space, so the hit test
// stays correct even though this game's camera never actually moves.
var BTN = {
  rotL: { x: 8, y: 250, w: 42, h: 42 },
  rotR: { x: 54, y: 250, w: 42, h: 42 },
  thrust: { x: 100, y: 250, w: 42, h: 42 },
  fire: { x: 400, y: 250, w: 52, h: 42 },
};
function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
function btnHeld(name) { return TOUCH && mouse.pressing() && inRect(mouse.canvasPos, BTN[name]); }
function btnTapped(name) { return TOUCH && mouse.presses() && inRect(mouse.canvasPos, BTN[name]); }
function drawBtn(b, label) {
  fill("rgba(30, 31, 41, 0.82)");
  stroke("#44475a");
  strokeWeight(1);
  rect(b.x, b.y, b.w, b.h, 6);
  noStroke();
  textAlign("center");
  text(label, b.x + b.w / 2, b.y + b.h / 2 + 6, 18, "#8b95a8");
  textAlign("left");
  noFill();
}

function setup() {
  new Canvas(460, 300);
  world.gravity.y = 0;
  ship = new Sprite(230, 150, 22, 16);
  ship.color = "#5baafd";
  ship.friction = 0;
  ship.bounciness = 0;
  bullets = new Group();
  bullets.color = "#ffd166";
  bullets.collider = "none";
  bullets.diameter = 6;
  asteroids = new Group();
  asteroids.color = "#333844";
  asteroids.friction = 0;
  asteroids.bounciness = 1;
  ship.autoDraw = false;
  // Rocks are a hazard, not a bumper: a sensor ship loses a life on contact
  // instead of being shoved (and set spinning) by every glancing hit.
  ship.collider = "none";
  score = 0;
  lives = 3;
  alive = true;
  invuln = 0;
  lastShot = 0;
  thrusting = false;
  TOUCH = navigator.maxTouchPoints > 0;
  // Five rocks AT BOOT, not more. Denser was tempting -- 11s of play logged a
  // lot of empty screen -- but the same 11s logged 2 of 3 lives gone, so this game
  // is already too punishing and more would make it worse. The field instead
  // grows +1 per 3 kills up to 9 (see the bullet handler), which rewards playing
  // well rather than taxing the first ten seconds. The speed floor in
  // spawnAsteroid is the other dial. starter-games A1 pins boot at 5.
  ROCKS = 5;
  for (var i = 0; i < ROCKS; i++) spawnAsteroid();
}

function spawnAsteroid() {
  var edge = Math.floor(Math.random() * 4);
  var x, y;
  if (edge === 0) { x = Math.random() * 460; y = -20; }
  else if (edge === 1) { x = 480; y = Math.random() * 300; }
  else if (edge === 2) { x = Math.random() * 460; y = 320; }
  else { x = -20; y = Math.random() * 300; }
  var a = new asteroids.Sprite(x, y, 20 + Math.random() * 16);
  a.autoDraw = false; // drawn by hand in draw() for spin + craters
  a.spin = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.5);
  a.craters = [];
  var n = 2 + Math.floor(Math.random() * 3); // 2-4 craters, seeded once
  for (var c = 0; c < n; c++) {
    var ca = Math.random() * Math.PI * 2, cd = Math.random() * a.diameter * 0.3;
    a.craters.push([Math.cos(ca) * cd, Math.sin(ca) * cd, 2 + Math.random() * (a.diameter * 0.12)]);
  }
  var ang = Math.random() * Math.PI * 2;
  var spd = 0.6 + Math.random() * 1.0;
  a.vel.x = Math.cos(ang) * spd;
  a.vel.y = Math.sin(ang) * spd;
}

function wrap(s, pad) {
  if (s.x < -pad) s.x = 460 + pad;
  if (s.x > 460 + pad) s.x = -pad;
  if (s.y < -pad) s.y = 300 + pad;
  if (s.y > 300 + pad) s.y = -pad;
}

function restart() {
  asteroids.slice().forEach(function (a) { a.delete(); });
  bullets.slice().forEach(function (b) { b.delete(); });
  ship.x = 230; ship.y = 150; ship.vel.x = 0; ship.vel.y = 0; ship.rotation = 0;
  score = 0; lives = 3; alive = true; invuln = 0;
  for (var i = 0; i < ROCKS; i++) spawnAsteroid();
}

function update() {
  if (!alive) {
    asteroids.forEach(function (a) { wrap(a, 30); });
    if (kb.presses("space") || (TOUCH && mouse.presses())) restart();
    return;
  }
  if (kb.pressing("left") || btnHeld("rotL")) ship.rotation -= 4;
  if (kb.pressing("right") || btnHeld("rotR")) ship.rotation += 4;
  thrusting = kb.pressing("up") || btnHeld("thrust");
  if (thrusting) {
    var rad = ship.rotation * Math.PI / 180;
    ship.vel.x += Math.cos(rad) * 0.2;
    ship.vel.y += Math.sin(rad) * 0.2;
  }
  ship.vel.x *= 0.99;
  ship.vel.y *= 0.99;
  wrap(ship, 15);
  asteroids.forEach(function (a) { wrap(a, 30); });

  if ((kb.presses("space") || btnTapped("fire")) && frameCount - lastShot > 14) {
    lastShot = frameCount;
    var rad = ship.rotation * Math.PI / 180;
    var b = new bullets.Sprite(ship.x + Math.cos(rad) * 16, ship.y + Math.sin(rad) * 16, 6);
    b.vel.x = Math.cos(rad) * 5 + ship.vel.x;
    b.vel.y = Math.sin(rad) * 5 + ship.vel.y;
    b.born = frameCount;
  }

  bullets.slice().forEach(function (b) {
    if (frameCount - b.born > 50 || b.x < -10 || b.x > 470 || b.y < -10 || b.y > 310) { b.delete(); return; }
    b.overlaps(asteroids, function (bullet, asteroid) {
      bullet.delete();
      asteroid.delete();
      score++;
      spawnAsteroid();
      // ponytail: boot stays at 5 (starter-games spec pins the count); the
      // field grows +1 rock per 3 kills up to 9, so play holds more than 5.
      if (score % 3 === 0 && asteroids.length < 9) spawnAsteroid();
    });
  });

  // Hit by a rock: lose a life and respawn at centre, briefly invulnerable so
  // a rock drifting through the spawn point can't take the next life instantly.
  if (invuln > 0) {
    invuln--;
  } else {
    ship.overlaps(asteroids, function (self, asteroid) {
      // overlaps() fires once PER overlapping rock, and the ship is recentred to
      // dead centre where a second rock can easily be sitting. Without this guard
      // a single collision cost two lives whenever two rocks overlapped on the
      // same frame. Latent for a long time; the spec suite only caught it because
      // rock drift is random, so it passes on most runs.
      if (invuln > 0) return;
      asteroid.delete();
      spawnAsteroid();
      lives--;
      ship.x = 230; ship.y = 150; ship.vel.x = 0; ship.vel.y = 0; ship.rotation = 0;
      invuln = 90;
      if (lives <= 0) alive = false;
    });
  }
}

function draw() {
  background("#1e1f29");

  // Rocks: hand-drawn so each one spins at its own rate and shows craters.
  // autoDraw is off per-rock (spawnAsteroid), so nothing double-draws.
  noFill();
  asteroids.forEach(function (a) {
    // A rock can enter the group without spawnAsteroid() (tests, future code):
    // heal the per-rock fields once instead of crashing on them.
    a.spin = a.spin || 0;
    a.craters = a.craters || [];
    a.rotation += a.spin;
    stroke("#6272a4");
    strokeWeight(2);
    circle(a.x, a.y, a.diameter);
    stroke("#4a5568");
    strokeWeight(1);
    for (var i = 0; i < a.craters.length; i++) {
      var c = a.craters[i];
      var cr = Math.cos(a.rotation * Math.PI / 180), sr = Math.sin(a.rotation * Math.PI / 180);
      circle(a.x + c[0] * cr - c[1] * sr, a.y + c[1] * cr + c[0] * sr, c[2] * 2);
    }
  });

  // Bullets: the engine draws the 6px dot; add a short trail behind it.
  bullets.forEach(function (b) {
    stroke("rgba(255, 209, 102, 0.45)");
    strokeWeight(3);
    line(b.x - b.vel.x * 2, b.y - b.vel.y * 2, b.x, b.y);
  });

  // Ship: hidden once dead; fades to a faint ghost through the post-hit
  // invulnerability window (reuses the invuln counter — no new timer), so a
  // rock passing through reads as grace time, not a bug.
  if (alive) {
    var ghost = invuln > 0 && Math.floor(invuln / 6) % 2 === 1;
    stroke(ghost ? "rgba(91, 170, 253, 0.25)" : "#5baafd");
    strokeWeight(2);
    var rad = ship.rotation * Math.PI / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    var pts = [[14, 0], [-10, -8], [-10, 8]];
    var sx = [], sy = [];
    for (var i = 0; i < 3; i++) {
      sx.push(ship.x + pts[i][0] * cos - pts[i][1] * sin);
      sy.push(ship.y + pts[i][0] * sin + pts[i][1] * cos);
    }
    line(sx[0], sy[0], sx[1], sy[1]);
    line(sx[1], sy[1], sx[2], sy[2]);
    line(sx[2], sy[2], sx[0], sy[0]);
    // Thrust flame: flickers between two lengths while up/thrust is held.
    if (thrusting) {
      var flick = Math.floor(frameCount / 3) % 2 === 0 ? 10 : 16;
      var fx = ship.x + (-14 - flick) * cos, fy = ship.y + (-14 - flick) * sin;
      stroke("#ff9f43");
      strokeWeight(3);
      line(ship.x - 10 * cos, ship.y - 10 * sin, fx, fy);
    }
  }
}

// The engine calls drawTop() after the world is on the canvas, in screen
// space — so a HUD lands on top of the scenery instead of behind it.
function drawTop() {
  // Rocks wrap through every edge by design, so one drifts behind the counters
  // sooner or later and the muted #6272a4 loses its contrast against #333844.
  // A backing plate fixes that without pinning the rocks out of the corner.
  // 12px monospace advances exactly 7.2px per character (measured), so the
  // plate tracks the string as the score grows into more digits.
  var hud = "SCORE " + score + "   LIVES " + lives;
  noStroke();
  fill("rgba(30, 31, 41, 0.82)");
  rect(8, 8, hud.length * 7.2 + 12, 20, 4);
  noFill();
  text(hud, 14, 20, 12, "#6272a4");
  if (!alive) {
    textAlign("center");
    text("game over — press space to restart", 230, 150, 13, "#f8f8f2");
    textAlign("left");
  }
  if (TOUCH) {
    drawBtn(BTN.rotL, "\u25C0");
    drawBtn(BTN.rotR, "\u25B6");
    drawBtn(BTN.thrust, "\u25B2");
    drawBtn(BTN.fire, "\u25CF");
  }
}
