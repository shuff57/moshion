// Play line raised from y=270 to y=210 so the frame is used: the top 190px
// holds parallax bands and HUD instead of sitting empty. Ground top = 200.
var GROUND_Y = 210;
// Three obstacle types with different jump heights: low bar (hop), tall bar
// (full jump), tall/double (jump the first, land between, hop the second).
var OB_TYPES = [
  { w: 16, h: 14, gap: 55 },
  { w: 16, h: 34, gap: 60 },
  { w: 16, h: 34, gap: 26 },
];
var best = 0;

function setup() {
  new Canvas(460, 300);
  world.gravity.y = 10;
  player = new Sprite(60, GROUND_Y - 12, 24, 24);
  player.color = "#5baafd";
  player.bounciness = 0;
  ground = new Sprite(230, GROUND_Y + 10, 460, 20, "static");
  ground.color = "#333844";
  groundSensor = new Sprite(60, GROUND_Y - 16, 18, 6, "kinematic");
  groundSensor.collider = "none";
  groundSensor.color = "transparent";
  obstacles = new Group();
  obstacles.color = "#ffb86c";
  obstacles.friction = 0;
  score = 0;
  alive = true;
  speed = 3;
  nextSpawn = 60;
}

function restart() {
  obstacles.slice().forEach(function (o) { o.delete(); });
  player.x = 60; player.y = GROUND_Y - 12; player.vel.x = 0; player.vel.y = 0;
  score = 0; alive = true; speed = 3; nextSpawn = 60;
}

function update() {
  groundSensor.x = player.x;
  groundSensor.y = player.y + 16;

  if (!alive) {
    if (kb.presses("up") || kb.presses("space") || mouse.presses()) restart();
    return;
  }

  var grounded = groundSensor.overlaps(ground);
  if ((kb.presses("up") || kb.presses("space") || mouse.presses()) && grounded) player.vel.y = -3.5;

  nextSpawn--;
  if (nextSpawn <= 0) {
    var t = OB_TYPES[Math.floor(Math.random() * OB_TYPES.length)];
    var o = new obstacles.Sprite(480, GROUND_Y + 10 - t.h / 2, t.w, t.h, "kinematic");
    o.vel.x = -speed;
    nextSpawn = t.gap + Math.random() * 45;
  }

  obstacles.slice().forEach(function (o) {
    if (o.x < -20) { o.delete(); score++; }
  });

  if (player.colliding(obstacles)) {
    alive = false;
    if (score > best) best = score;
    player.vel.x = 0; player.vel.y = 0;
    // Kinematic obstacles keep their velocity once update() stops running, and
    // they bulldoze the dead player off the left end of the ground into an
    // endless fall. Freeze the track instead so the game-over frame holds.
    obstacles.forEach(function (o) { o.vel.x = 0; });
  }
  speed += 0.0015;
}

function draw() {
  background("#1e1f29");
  // Parallax bands: three layers scrolling at fractions of the track speed so
  // the raised frame reads as depth. Positions wrap on a period so they never
  // drift off-screen; drawn as rects, no assets.
  var p1 = (frameCount * speed * 0.15) % 460;
  var p2 = (frameCount * speed * 0.35) % 460;
  var p3 = (frameCount * speed * 0.6) % 460;
  noStroke();
  fill("#262838");
  for (var i = -1; i < 2; i++) {
    rect(p1 + i * 460, GROUND_Y - 90, 200, 14, 4);
    rect(p1 + i * 460 + 260, GROUND_Y - 60, 140, 10, 4);
  }
  fill("#2e3145");
  for (var j = -1; j < 2; j++) {
    rect(p2 + j * 460, GROUND_Y - 50, 120, 8, 4);
    rect(p2 + j * 460 + 200, GROUND_Y - 34, 90, 6, 4);
  }
  fill("#3a3e58");
  for (var k = -1; k < 2; k++) {
    rect(p3 + k * 460, GROUND_Y - 22, 70, 5, 3);
    rect(p3 + k * 460 + 150, GROUND_Y - 14, 50, 4, 3);
  }
  // Visible ground surface line: makes the play line unambiguous against the
  // ground fill, which is close in value to the background.
  stroke("#8b95a8");
  strokeWeight(2);
  line(0, GROUND_Y, 460, GROUND_Y);
  noStroke();
}

// The engine calls drawTop() after the world is on the canvas, in screen
// space — so a HUD lands on top of the scenery instead of behind it.
function drawTop() {
  text("SCORE " + score + "   BEST " + best, 14, 20, 12, "#6272a4");
  // Player drawn here with a facing indicator (eye/nose tick) and a run bob:
  // the bob is a small vertical offset keyed to frameCount, paused when
  // airborne so the jump arc stays readable.
  var bob = (groundSensor.overlaps(ground) && alive) ? Math.sin(frameCount * 0.3) * 2 : 0;
  noStroke();
  fill("#5baafd");
  rect(player.x - 12, player.y - 12 + bob, 24, 24, 4);
  // Facing indicator: eye + nose tick on the right edge (direction of travel).
  fill("#1e1f29");
  rect(player.x + 4, player.y - 6 + bob, 4, 4, 2);
  fill("#ffb86c");
  rect(player.x + 10, player.y + bob, 4, 3, 1);
  if (!alive) {
    textAlign("center");
    // Game-over text sits near the ground, not floating in the top void.
    text("game over — press ↑ to restart", 230, GROUND_Y - 40, 13, "#f8f8f2");
    textAlign("left");
  }
}