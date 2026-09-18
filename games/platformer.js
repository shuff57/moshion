function setup() {
  new Canvas(460, 300);
  world.gravity.y = 10;
  player = new Sprite(230, 260, 18, 18);
  player.color = "#5baafd";
  player.bounciness = 0;
  player.friction = 0;
  platforms = new Group();
  platforms.color = "#333844";
  new platforms.Sprite(230, 290, 460, 20, "static");
  var y = 250, x = 230, dir = 1;
  for (var i = 0; i < 26; i++) {
    x += dir * (90 + Math.random() * 40);
    x = Math.max(60, Math.min(400, x));
    new platforms.Sprite(x, y, 70, 12, "static");
    y -= 42 + Math.random() * 10;
    dir = -dir;
  }
  startY = player.y;
  camera.y = 150;
  best = 0;
}

function respawn() {
  player.x = 230; player.y = 260; player.vel.x = 0; player.vel.y = 0;
  camera.y = 150;
}

function update() {
  if (kb.pressing("left")) player.vel.x = -2.2;
  else if (kb.pressing("right")) player.vel.x = 2.2;
  else player.vel.x = 0;

  var grounded = player.colliding(platforms);
  if ((kb.presses("up") || kb.presses("space")) && grounded) player.vel.y = -4.5;

  camera.y = Math.min(camera.y, player.y);
  if (player.y - camera.y > 220) respawn();

  var climbed = Math.max(0, Math.floor((startY - player.y) / 4));
  best = Math.max(best, climbed);
}

function draw() {
  background("#1e1f29");
  camera.off();
  text("HEIGHT " + best, 20, 20, 12, "#6272a4");
  camera.on();
}
