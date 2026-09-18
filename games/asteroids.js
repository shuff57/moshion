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
  score = 0;
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

function update() {
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
}

function draw() {
  background("#1e1f29");
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
  text("SCORE " + score, 14, 20, 12, "#6272a4");
}
