// On-screen controls: touch-capable devices only (see asteroids.js for why,
// and for the hit-test pattern every game here shares).
var BTN = {
  moveL: { x: 8, y: 254, w: 60, h: 38 },
  moveR: { x: 76, y: 254, w: 60, h: 38 },
  jump: { x: 392, y: 254, w: 60, h: 38 },
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

// The goal sits partway up the ladder, not at the top of it, so a run has a
// finish line a minute away as well as a height to chase past it.
var GOAL_STEP = 12;

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

  // The ground is two segments with a gap between them, not one full-width bar.
  // It used to span all 460px, which made the death test below almost
  // unreachable: nothing could fall past the floor, so the only way to die was
  // to climb five rungs and then fall the entire way back onto solid ground.
  // With a gap you can miss a rung at any height and actually lose.
  new platforms.Sprite(145, 290, 290, 20, "static"); // x 0..290
  new platforms.Sprite(420, 290, 80, 20, "static");  // x 380..460, gap 290..380

  // A zigzagging ladder, as before, but the rungs vary in width and some of
  // them move. The 45px rise stays fixed on purpose: the camera's top edge sits
  // 165px above whatever the player stands on, and at a constant gap that edge
  // always lands BETWEEN two rungs, so none is ever sliced in half along the
  // top of the screen. A random gap put one across it about half the time. 45
  // is also mid-range for the jump, which rises 66.8px, so every rung is
  // reachable where a random 52 left only 14.8px of clearance.
  var y = 235, x = 230, dir = 1;
  movers = [];
  for (var i = 0; i < 26; i++) {
    x += dir * (86 + Math.random() * 44);
    x = Math.max(58, Math.min(402, x));
    var rung = new platforms.Sprite(x, y, 54 + Math.random() * 34, 12, "static");
    // Every seventh rung slides, so there is something to time rather than only
    // something to climb. Moved by writing x each frame instead of by making it
    // kinematic: a body that teleports every frame does not carry a rider, and
    // static is the one body type certain to behave under the spec suite.
    if (i > 0 && i % 7 === 6) {
      rung.mover = { t: 0, home: x, span: 24 + Math.random() * 22 };
      movers.push(rung);
    }
    if (i === GOAL_STEP) goalX = x;
    y -= 45;
    dir = -dir;
  }
  goalY = 235 - 45 * GOAL_STEP;
  startY = player.y;
  // The goal in the same HEIGHT units as best, so "n TO GOAL" counts down and
  // never back up when the player falls -- the live-position version read higher
  // on the way down, which is worse than no counter at all.
  goalH = Math.floor((startY - goalY) / 4);
  camera.y = 150;
  best = 0;
  bestFlash = 0;
  face = 1;
  squash = 0;
  wasGrounded = false;
  reached = false;
  runTime = 0;
  TOUCH = navigator.maxTouchPoints > 0;
}

function respawn() {
  player.x = 230; player.y = 260; player.vel.x = 0; player.vel.y = 0;
  camera.y = 150;
  reached = false;
  runTime = 0;
}

function update() {
  if (!reached) {
    if (kb.pressing("left") || btnHeld("moveL")) { player.vel.x = -2.2; face = -1; }
    else if (kb.pressing("right") || btnHeld("moveR")) { player.vel.x = 2.2; face = 1; }
    else player.vel.x = 0;
  } else {
    player.vel.x = 0;
  }

  var grounded = player.colliding(platforms);
  if (!reached && (kb.presses("up") || kb.presses("space") || btnTapped("jump")) && grounded) {
    player.vel.y = -4.5;
  }
  // Flatten on landing, stretch while rising: the player is an 18px square with
  // no other tell for "that jump just connected".
  if (grounded && !wasGrounded && player.vel.y > -1) squash = 5;
  wasGrounded = grounded;
  if (squash > 0) squash--;
  if (player.vel.y < 0) squash = -3; else if (squash < 0 && player.vel.y >= 0) squash = 0;

  for (var i = 0; i < movers.length; i++) {
    var m = movers[i].mover;
    movers[i].x = m.home + m.span * Math.sin(++m.t * 0.05);
  }

  camera.y = Math.min(camera.y, player.y);
  // The camera is centred, so the canvas bottom is camera.y + 150 and an 18px
  // player is fully out of sight by +159. Respawning at +220 left it falling
  // invisibly for ~0.9s first.
  if (player.y - camera.y > 165) respawn();

  var climbed = Math.max(0, Math.floor((startY - player.y) / 4));
  if (climbed > best) {
    best = climbed;
    bestFlash = 45;
  }
  if (bestFlash > 0) bestFlash--;
  if (!reached) {
    runTime++;
    if (player.y <= goalY) reached = true;
  }
}

// Faint rules every 180px of climb, so "how far up am I" and "how far is left"
// are both answerable without counting rungs.
function draw() {
  background("#1e1f29");
  var first = Math.ceil((camera.y - 300) / 180) * 180;
  for (var y = first; y < camera.y + 150; y += 180) {
    stroke("rgba(98, 114, 164, 0.13)");
    strokeWeight(1);
    line(0, y, 460, y);
    noStroke();
  }
  if (!reached) {
    // The goal: a flag on the rung at GOAL_STEP, pulsing so it reads as
    // somewhere to go rather than as scenery. A stepped pennant, because the
    // engine has no triangle primitive.
    var pulse = (0.55 + 0.45 * Math.sin(runTime * 0.12)).toFixed(2);
    fill("rgba(152, 195, 121, " + pulse + ")");
    rect(goalX - 1, goalY - 30, 2, 30);
    rect(goalX + 1, goalY - 30, 19, 6);
    rect(goalX + 1, goalY - 18, 13, 5);
    noFill();
  }
}

// The engine calls drawTop() after the world is on the canvas, in screen
// space — so a HUD lands on top of the scenery instead of behind it.
function drawTop() {
  var sx = player.x, sy = player.y - camera.y + 150;
  // Only a facing pip is drawn here. The engine already renders the player
  // sprite in render(), so drawing a second body on top would double its edge;
  // and Sprite has no squash property, so the landing tell is the pip riding up.
  fill("#1e1f29");
  rect(sx + face * 3.5 - 1.5, sy - 3 + (squash > 0 ? -2 : 0), 3, 3, 1);
  noFill();

  text(reached ? "SUMMIT REACHED" : "HEIGHT " + best, 20, 20, 12, "#6272a4");
  if (bestFlash > 0) text("NEW BEST", 20, 36, 11, "#98c379");
  textAlign("right");
  text(reached ? "GOAL CLEARED" : Math.max(0, goalH - best) + " TO GOAL", 440, 20, 12, "#8a92a8");
  textAlign("left");
  if (reached) {
    fill("rgba(30, 31, 41, 0.86)");
    rect(80, 108, 300, 84, 8);
    noFill();
    textAlign("center");
    text("SUMMIT REACHED", 230, 138, 20, "#98c379");
    text("HEIGHT " + best + "   TIME " + (runTime / 60).toFixed(1) + "s", 230, 162, 13, "#a6adc8");
    textAlign("left");
  }
  if (TOUCH) {
    drawBtn(BTN.moveL, "◀");
    drawBtn(BTN.moveR, "▶");
    drawBtn(BTN.jump, "▲");
  }
}
