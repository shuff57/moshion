// moSHion docs: Game recipes. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#patterns/<id>); never rename one, add a new page instead.

export default {
  slug: 'patterns',
  title: "Game recipes",
  pages: [
    {
      id: 'top-down',
      title: "Top-down movement",
      body: `For top-down games, keep world.gravity.y at 0 (where it starts) so nothing falls. Writing world.gravity.y = 0 in setup() anyway makes that choice plain to a reader. Move the player by writing to vel.x and vel.y based on the arrow keys.

Clamp the player's position to the canvas edges each frame so it can't leave the screen. A simple Math.max / Math.min pair handles this.

Setting vel to 0 when no key is pressed gives a snappy, arcade feel. For drifty movement, leave vel alone and add small amounts instead.`,
      code: `let player;
const SPEED = 4;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 30, 30);
  player.color = 'deepskyblue';
}

function update() {
  player.vel.x = 0;
  player.vel.y = 0;
  if (kb.pressing('left'))  player.vel.x = -SPEED;
  if (kb.pressing('right')) player.vel.x = SPEED;
  if (kb.pressing('up'))    player.vel.y = -SPEED;
  if (kb.pressing('down'))  player.vel.y = SPEED;

  player.x = Math.max(15, Math.min(385, player.x));
  player.y = Math.max(15, Math.min(385, player.y));
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'platformer-jump',
      title: "Platformer jump",
      body: `A platformer needs gravity, a ground-check, and edge-triggered jump input. Keep the ground sprite in a variable so you can test player.colliding(ground) before jumping.

Use kb.pressing for continuous left/right motion, and kb.presses(' ') for the jump so one tap equals one jump.

For a double jump, or a jump that a wall cannot hand back, set player.maxJumps = 2 and call player.jump(ground): the next page.`,
      code: `let player, ground;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  player = new Sprite(200, 100, 30, 40);
  player.color = 'deepskyblue';
  ground = new Sprite(200, 380, 400, 20, 'static');
  new Sprite(120, 300, 80, 12, 'static');
  new Sprite(300, 240, 80, 12, 'static');
}

function update() {
  if (kb.pressing('left'))       player.vel.x = -5;
  else if (kb.pressing('right')) player.vel.x = 5;

  if (kb.presses(' ') && player.colliding(ground)) {
    player.vel.y = -9;
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'double-jumps',
      title: "Double jumps",
      body: `A sprite can count its own jumps. Set player.maxJumps = 2 and it may jump twice before it has to land again: 1 (the default) is an ordinary jump, 3 a triple jump. Set it in setup(), after the sprite has its size.

player.jump(ground) in update() does the jump, but only while one is left. It gives back true when it jumped and false when it did not. ground is what the player jumps off, the same way player.colliding(ground) names it: a sprite, or a group such as platforms. Landing on it gives every jump back; landing on anything else (a crate, an enemy's head) does not. player.jump() with nothing in the brackets counts anything solid as ground. The player does not have to be touching ground to jump: with maxJumps 2 the second jump is in mid-air.

player.jumpsLeft is how many jumps are left, and player.onGround is true while ground is under the sprite's feet. A wall beside it does not count, and neither does a coin or anything else with collider 'none'. Walking off a ledge uses up the first jump, so with maxJumps 1 there is no jumping in mid-air.

player.jumpPower is how high it jumps. 1 (the default) is a normal jump of about 120 pixels, 2 is twice as high, and 0.5 is half as high. It is the same height whatever world.gravity.y is: moSHion works out how fast the jump has to start. Change any of them later: player.maxJumps = 3 after a power-up, and player.jumpsLeft = player.maxJumps gives every jump back, even in mid-air.`,
      code: `let player, platforms;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  player = new Sprite(200, 300, 30, 40);
  player.color = 'deepskyblue';
  player.rotationLock = true;
  player.maxJumps = 2;

  platforms = new Group();
  platforms.collider = 'static';
  platforms.color = 'slategray';
  new platforms.Sprite(200, 390, 400, 20);
  new platforms.Sprite(110, 260, 100, 12);
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -4;
  } else if (kb.pressing('right')) {
    player.vel.x = 4;
  } else {
    player.vel.x = 0;
  }

  if (kb.presses(' ')) {
    player.jump(platforms);
  }

  if (player.onGround) {
    player.color = 'deepskyblue';
  } else {
    player.color = 'orange';
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  text('Jumps left: ' + player.jumpsLeft, 12, 24);
}`,
    },
    {
      id: 'projectiles',
      title: "Projectiles from a player",
      body: `Keep bullets in a Group so they share defaults and are easy to iterate. Setting group defaults (color, diameter, collider) once saves repeating yourself each spawn.

Spawn a new bullet with new bullets.Sprite(x, y) when the fire key is pressed. Give it a velocity so it flies across the screen.

Remove bullets once they leave the canvas — otherwise they pile up and slow the sketch down. Iterate a copy with [...bullets] so removing doesn't break the loop.`,
      code: `let player, bullets;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(60, 200, 30, 30);
  player.color = 'deepskyblue';

  bullets = new Group();
  bullets.diameter = 10;
  bullets.color = 'gold';
  bullets.collider = 'none';
}

function update() {
  if (kb.pressing('up'))        player.vel.y = -4;
  else if (kb.pressing('down')) player.vel.y = 4;
  else                          player.vel.y = 0;

  if (kb.presses(' ')) {
    const b = new bullets.Sprite(player.x + 20, player.y);
    b.vel.x = 8;
  }

  for (const b of [...bullets]) {
    if (b.x > 420) b.delete();
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'score-timer',
      title: "Score and timer HUD",
      body: `Use plain variables to track game state: one for score, one for the remaining time. Increase the score when the player overlaps a collectible, and remove the collectible so it doesn't re-trigger.

Convert frameCount into seconds by dividing by 60 (the default frame rate). Math.max(0, ...) stops the timer clamping into negative numbers.

Write the score and the time in drawTop(), not draw(). drawTop() runs last, on top of every sprite, with the camera switched off, so a sprite never covers the words and (14, 26) stays in the corner when the camera scrolls ("HUDs that don't scroll" in Text & HUD has more).`,
      code: `let player, coins;
let score = 0;
const LIMIT = 20;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 30, 30);
  player.color = 'deepskyblue';

  coins = new Group();
  coins.diameter = 18;
  coins.color = 'gold';
  coins.collider = 'none';
  for (let i = 0; i < 6; i++) {
    new coins.Sprite(40 + i * 60, 80 + (i % 2) * 200);
  }
}

function update() {
  if (kb.pressing('left'))       player.vel.x = -4;
  else if (kb.pressing('right')) player.vel.x = 4;
  else                           player.vel.x = 0;
  if (kb.pressing('up'))         player.vel.y = -4;
  else if (kb.pressing('down'))  player.vel.y = 4;
  else                           player.vel.y = 0;

  for (const c of [...coins]) {
    if (player.overlapping(c)) {
      score++;
      c.delete();
    }
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  const timeLeft = Math.max(0, LIMIT - Math.floor(frameCount / 60));
  fill('white');
  textSize(18);
  text('Score: ' + score, 14, 26);
  text('Time: ' + timeLeft, 14, 50);
}`,
    },
    {
      id: 'timers',
      title: "Timers: every and after",
      body: `every(frames, fn) calls a function every so many frames, and after(frames, fn) calls it once, that many frames from now. At 60 frames a second, every(60, spawn) runs spawn about once a second.

They count frames, not seconds, so they stay in step with frameCount: every(60, spawn) made in setup() fires on exactly the frames where frameCount % 60 === 0 is true. They pause when the sketch stops with noLoop().

Both give back a timer you can keep in a variable and stop() later: const t = every(30, blink); ... t.stop(); timer.active tells you whether it is still going (an after() timer stops being active once it has fired).`,
      code: `let pipes;
let spawner;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 0;
  pipes = new Group();
  pipes.color = 'limegreen';
  pipes.collider = 'none';

  spawner = every(45, () => {
    const p = new pipes.Sprite(420, 40 + Math.random() * 220, 30, 80);
    p.vel.x = -3;
  });

  after(600, () => {
    spawner.stop();
  });
}

function update() {
  pipes.cull(60);
}

function draw() {
  background('#222');
  fill('white');
  textSize(14);
  text(spawner.active ? 'spawning' : 'stopped', 14, 20);
}`,
    },
    {
      id: 'scenes',
      title: "Scene/state switching",
      body: `A single state variable is enough for most small games. Use strings like 'menu', 'play', and 'gameover' — they're easy to read in if/else branches.

In update(), branch on state to handle input for that scene only. In draw(), branch on state to render the right screen. Changing state is just state = 'play'.

Keep scene-specific sprites hidden or disabled when not in that scene. The simplest approach is to only create them when entering 'play' and remove them when leaving.`,
      code: `let state = 'menu';
let player;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 30, 30);
  player.color = 'deepskyblue';
  player.visible = false;
}

function update() {
  if (state === 'menu' && kb.presses(' ')) {
    state = 'play';
    player.visible = true;
  } else if (state === 'play') {
    if (kb.pressing('left'))       player.vel.x = -4;
    else if (kb.pressing('right')) player.vel.x = 4;
    else                           player.vel.x = 0;
    if (kb.presses('x')) state = 'gameover';
  } else if (state === 'gameover' && kb.presses(' ')) {
    state = 'menu';
    player.visible = false;
  }
}

function draw() {
  background('#222');
  fill('white');
  textSize(20);
  if (state === 'menu') {
    text('Press SPACE to start', 90, 200);
  } else if (state === 'play') {
    text('Press X to end', 14, 24);
  } else {
    text('Game Over', 140, 180);
    text('SPACE for menu', 115, 220);
  }
}`,
    },
  ],
};
