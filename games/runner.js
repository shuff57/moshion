function setup() {
  new Canvas(460, 300);
  world.gravity.y = 10;
  player = new Sprite(60, 240, 24, 24);
  player.color = "#5baafd";
  player.bounciness = 0;
  ground = new Sprite(230, 280, 460, 20, "static");
  ground.color = "#333844";
  groundSensor = new Sprite(60, 254, 18, 6, "kinematic");
  groundSensor.collider = "none";
  groundSensor.color = "transparent";
  groundSensor.debug = true;
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
  player.x = 60; player.y = 240; player.vel.x = 0; player.vel.y = 0;
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
    var h = 20 + Math.random() * 20;
    var o = new obstacles.Sprite(480, 267 - h / 2, 16, h, "kinematic");
    o.vel.x = -speed;
    nextSpawn = 55 + Math.random() * 45;
  }

  obstacles.slice().forEach(function (o) {
    if (o.x < -20) { o.delete(); score++; }
  });

  if (player.colliding(obstacles)) alive = false;
  speed += 0.0015;
}

function draw() {
  background("#1e1f29");
  text("SCORE " + score, 14, 20, 12, "#6272a4");
  if (!alive) {
    textAlign("center");
    text("game over — press ↑ to restart", 230, 150, 13, "#f8f8f2");
    textAlign("left");
  }
}
