function setup() {
  new Canvas(460, 300);
  world.gravity.y = 0;
  ship = new Sprite(230, 150, 22, 16);
  ship.color = "#5baafd";
  ship.friction = 0;
  ship.bounciness = 0;
  bullets = new Group();
  bullets.color = "#f8f8f2";
  bullets.collider = "none";
  bullets.diameter = 4;
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
  for (var i = 0; i < 5; i++) spawnAsteroid();
}

function spawnAsteroid() {
  var edge = Math.floor(Math.random() * 4);
  var x, y;
  if (edge === 0) { x = Math.random() * 460; y = -20; }
  else if (edge === 1) { x = 480; y = Math.random() * 300; }
  else if (edge === 2) { x = Math.random() * 460; y = 320; }
  else { x = -20; y = Math.random() * 300; }
  var a = new asteroids.Sprite(x, y, 20 + Math.random() * 16);
  var ang = Math.random() * Math.PI * 2;
  var spd = 0.5 + Math.random() * 1;
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
  for (var i = 0; i < 5; i++) spawnAsteroid();
}

function update() {
  if (!alive) {
    asteroids.forEach(function (a) { wrap(a, 30); });
    if (kb.presses("space")) restart();
    return;
  }
  if (kb.pressing("left")) ship.rotation -= 4;
  if (kb.pressing("right")) ship.rotation += 4;
  if (kb.pressing("up")) {
    var rad = ship.rotation * Math.PI / 180;
    ship.vel.x += Math.cos(rad) * 0.2;
    ship.vel.y += Math.sin(rad) * 0.2;
  }
  ship.vel.x *= 0.99;
  ship.vel.y *= 0.99;
  wrap(ship, 15);
  asteroids.forEach(function (a) { wrap(a, 30); });

  if (kb.presses("space") && frameCount - lastShot > 14) {
    lastShot = frameCount;
    var rad = ship.rotation * Math.PI / 180;
    var b = new bullets.Sprite(ship.x + Math.cos(rad) * 16, ship.y + Math.sin(rad) * 16, 4);
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
    });
  });

  // Hit by a rock: lose a life and respawn at centre, briefly invulnerable so
  // a rock drifting through the spawn point can't take the next life instantly.
  if (invuln > 0) {
    invuln--;
  } else {
    ship.overlaps(asteroids, function (self, asteroid) {
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
  // Hidden once dead; blinks through the post-hit invulnerability window.
  if (alive && (invuln === 0 || Math.floor(invuln / 6) % 2 === 0)) {
    stroke("#5baafd");
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
}
