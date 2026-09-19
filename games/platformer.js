function setup() {
  new Canvas(460, 300);
  world.gravity.y = 10;
  player = new Sprite(230, 260, 18, 18);
  player.color = "#5baafd";
  player.bounciness = 0;
  player.friction = 0;
  player.rotationLock = true;
  platforms = new Group();
  platforms.color = "#333844";
  new platforms.Sprite(230, 290, 460, 20, "static");
  // Fixed 45px rungs, not 42 + random*10. The camera centres on the player, so
  // the viewport's top edge sits 165px above whatever platform the player is
  // standing on — at a constant gap that edge always lands BETWEEN platforms
  // (the one 180px up is fully off-screen, the one 135px up is fully on), so
  // none is ever sliced in half along the top of the screen. A random gap put
  // one across it about half the time. 45 is also mid-range for the jump, which
  // rises 66.8px: every rung is reachable, where a random 52 left only 14.8px.
  var y = 235, x = 230, dir = 1;
  for (var i = 0; i < 26; i++) {
    x += dir * (90 + Math.random() * 40);
    x = Math.max(60, Math.min(400, x));
    new platforms.Sprite(x, y, 70, 12, "static");
    y -= 45;
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
  // The camera is centred, so the canvas bottom is camera.y + 150 and an 18px
  // player is fully out of sight by +159. Respawning at +220 left it falling
  // invisibly for ~0.9s first.
  if (player.y - camera.y > 165) respawn();

  var climbed = Math.max(0, Math.floor((startY - player.y) / 4));
  best = Math.max(best, climbed);
}

function draw() {
  background("#1e1f29");
}

// The engine calls drawTop() after the world is on the canvas, in screen
// space — so a HUD lands on top of the scenery instead of behind it.
function drawTop() {
  text("HEIGHT " + best, 20, 20, 12, "#6272a4");
}
