// moSHion docs: Start here. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#overview/<id>); never rename one, add a new page instead.

export default {
  slug: 'overview',
  title: "Start here",
  pages: [
    {
      id: 'what-is-moshion',
      title: "What is moSHion?",
      body: `moSHion is a beginner-friendly 2D game engine for the web. It pairs a simple drawing canvas with real Box2D physics (via planck.js), so you can draw shapes and make them bump into each other without wiring the two worlds together yourself.

It's aimed at people who've written a little JavaScript and want to make a game this afternoon — not a week from now. The whole API is a handful of globals: Sprite, Group, world, camera, kb, mouse.

You don't import anything. You don't install anything. You write two functions — setup and draw — and the engine runs them for you. Add an update function if you need per-frame input or logic.

moSHion runs in "global mode." That means Canvas, Sprite, world, kb, and friends are already on the page — you just use them. No import, no new Engine(), no setup boilerplate.

The same rule applies to preload, setup, update, draw and drawTop. When you define a top-level function with one of those names, the engine finds it and calls it at the right time ("The sketch lifecycle" in Start here says when).

To share a sprite between setup and update, declare a let at the top of your file and assign to it inside setup. If you use const inside setup, the variable is trapped there and update can't see it.`,
      code: `let player;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  player = new Sprite(200, 100, 40, 40);
  player.color = 'deepskyblue';
  new Sprite(200, 380, 400, 20, 'static');
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'where-does-my-code-go',
      title: "Where does my code go?",
      body: `Not sure which function a line belongs in? Look up what the line does.

In preload(), once, before setup(), only if your game loads files:
loadSound('jump.mp3'), loadJSON('levels.json'), loadImage('hero.png'). The game waits for them, so setup() can use them.

In setup(), once:
new Canvas(400, 400).
The sprites and groups you start with: new Sprite(), new Group().
Settings that start the game: world.gravity.y = 10, player.color, a collider.
The first value of a variable made with let at the top of the file.

In update(), every frame, before physics:
Reading the keys and the mouse: kb.pressing(), kb.presses(), mouse.presses().
Moving things: player.vel.x = 4, player.speed, moveTowards().
Checking touches: player.collides(enemy), player.overlaps(coins, ...).
Changing the score, the lives, a timer, or the level.
Making or deleting a sprite because something happened: a bullet when space is pressed, a coin that was picked up.

In draw(), every frame, after physics:
background(), as its first line.
Shapes and words that belong BEHIND the sprites: a sun, a floor pattern, a sign the player walks in front of.

In drawTop(), every frame, last:
The score, lives, a timer, "Game over": words that must sit on top of every sprite and stay put when the camera moves.

A quick test for any line: if it CHANGES the game, it goes in update(). If you only LOOK at it, it goes in draw() or drawTop(). Behind the sprites is draw(), in front of them is drawTop().

Never in update() or draw(): new Canvas() and the sprites you start with. Those two run 60 times a second, so you would make 60 new sprites every second. A sprite made because something happened (the bullet above) is different: it is made once, on the frame it happens.`,
      code: `let player, coins;
let score = 0;

// setup(): the canvas, the sprites you start with, the settings
function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 30, 30);
  player.color = 'deepskyblue';

  coins = new Group();
  coins.diameter = 18;
  coins.color = 'gold';
  coins.collider = 'none';
  new coins.Sprite(120, 120);
  new coins.Sprite(300, 260);
  new coins.Sprite(260, 320);
}

// update(): keys, movement, touching, score
function update() {
  if (kb.pressing('left')) {
    player.vel.x = -4;
  } else if (kb.pressing('right')) {
    player.vel.x = 4;
  } else {
    player.vel.x = 0;
  }
  if (kb.pressing('up')) {
    player.vel.y = -4;
  } else if (kb.pressing('down')) {
    player.vel.y = 4;
  } else {
    player.vel.y = 0;
  }

  player.overlaps(coins, (p, coin) => {
    score = score + 1;
    coin.delete();
  });
}

// draw(): background first, then the picture behind the sprites
function draw() {
  background('#222');
  fill('#333');
  rect(0, 340, 400, 60);   // a floor stripe, under the sprites
}

// drawTop(): the score, on top of everything
function drawTop() {
  fill('white');
  textSize(16);
  text('Score: ' + score, 10, 24);
  if (score === 3) {
    text('All the coins!', 10, 48);
  }
}`,
    },
    {
      id: 'lifecycle',
      title: "The sketch lifecycle",
      body: `A moSHion sketch is made of up to five functions with special names. You never call them yourself: moSHion finds each one by its name and runs it at the right moment. You always need setup(). The other four are optional, and a sketch without one of them still runs.

Each one has ONE job:
preload() runs ONCE, BEFORE setup(), and only if your game loads files: loadSound(), loadJSON() and loadImage() go here, and the game waits until every file is ready. Most sketches do not need it ("Getting files ready: preload()" in Start here).
setup() runs ONCE, at the very start. Make the canvas and your sprites here.
update() runs EVERY FRAME, BEFORE physics. The rules of your game go here: keys, movement, jumping, touching, score.
draw() runs EVERY FRAME, AFTER physics. The picture BEHIND your sprites goes here: background() first, then any shapes or words.
drawTop() runs EVERY FRAME, LAST, on top of everything. The score, lives and other words that must stay readable go here. The camera is off while it runs, so (10, 20) is always near the top-left corner.

Every frame happens in this order, about 60 times a second:
1. your update() runs,
2. the physics step moves every sprite: gravity, velocity and collisions all happen here,
3. your draw() runs,
4. moSHion paints the sprites, on top of whatever draw() drew,
5. your drawTop() runs, on top of the sprites.

Do you need update()? No. A sketch with only setup() and draw() works, and the course starts that way. Moving the rules into update() changes just one thing: a velocity you set there moves the sprite in this frame, while the same line in draw() waits for the next frame. At 60 frames a second you cannot see that. The real reason to use it is a sketch that reads in halves: the rules in update(), the picture in draw().

One rule is not optional: drawing goes in draw() or drawTop(), never in update(). update() runs first, so the background() at the top of draw() paints over anything update() drew.

frameCount tells you how many frames have passed since the sketch started, which is handy for timing things without a clock. "Where does my code go?", the page before this one, sorts the usual lines into the functions.`,
      code: `let player, ground;
let jumps = 0;

// ONCE, at the start: the canvas and your sprites
function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  player = new Sprite(200, 100, 30, 30);
  player.color = 'deepskyblue';
  ground = new Sprite(200, 380, 400, 20, 'static');
}

// EVERY FRAME, BEFORE physics: the rules (keys, movement, score)
function update() {
  if (kb.pressing('left')) {
    player.vel.x = -4;
  } else if (kb.pressing('right')) {
    player.vel.x = 4;
  } else {
    player.vel.x = 0;
  }

  if (kb.presses(' ') && player.colliding(ground)) {
    player.vel.y = -7;
    jumps = jumps + 1;
  }
}

// EVERY FRAME, AFTER physics: the picture BEHIND the sprites
function draw() {
  background('#222');
  fill('gold');
  circle(340, 70, 50);   // a sun, behind everything
}

// EVERY FRAME, LAST: words ON TOP of everything
function drawTop() {
  fill('white');
  textSize(16);
  text('Jumps: ' + jumps, 10, 24);
  text('frame: ' + frameCount, 10, 44);
}`,
    },
    {
      id: 'preload',
      title: "Getting files ready: preload()",
      body: `A file takes a moment to arrive. Load a sound, a picture or a JSON file in setup() and the game starts without waiting: the sound is not ready yet, the picture's size is 0, and the JSON is still empty.

preload() fixes that. Write it above setup() and load your files in it:
preload() runs once, before setup(). The game waits until every file it asked for is ready, then runs setup().
In setup() everything is there: a picture has its real width and height, the JSON's data is filled in, and sound.loaded is true.
Only three loaders wait: loadSound(), loadJSON() and loadImage(). Called anywhere else, they load in the background, as always.

It waits exactly as long as the files need, no more. A small file is ready in a blink and the game starts at once. A big file on a slow connection takes longer; after a moment the page says "Loading... 2 of 3 files" until it is done.

A file that cannot load (a wrong name, a missing file) does not stop the game. The console says which file and why, and the game starts without it. If no file finishes for 10 seconds, the page says which file it is still waiting for and shows a Start anyway button. Press it to play without that file.

One thing preload() cannot change: browsers keep sound off until the player clicks or presses a key. A sound that is ready still cannot play in setup(), and moSHion says so in the console. Play sound effects on an event (a key, a hit). Music started with .loop() waits and begins at the first click.

loadImage(url) is new: it loads a picture by its address and gives it back, ready for sprite.image. For the built-in pictures you can also just write sprite.texture = 'apple'.`,
      code: `let jump, apple, player;

// ONCE, before setup(): the files this game needs
function preload() {
  jump = loadSound('jump');
  apple = loadImage('textures/apple.png');
}

// ONCE, when every file is ready
function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  // the picture has its real size already, so the sprite can match it
  player = new Sprite(200, 100, apple.width * 2, apple.height * 2);
  player.image = apple;
  new Sprite(200, 290, 400, 20, 'static');
}

function update() {
  if (kb.presses(' ')) {
    player.vel.y = -6;
    jump.play();   // on an event, so the browser lets it play
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  text('apple: ' + apple.width + ' x ' + apple.height + ' px. Press space.', 10, 24, 16);
}`,
    },
    {
      id: 'debugging',
      title: "Debugging your sketch",
      body: `When something goes wrong, open your browser's developer console (F12 on most systems). Errors show up there with a line number. console.log(value) is your best friend — sprinkle it anywhere to see what's happening.

Three mistakes trip up almost every beginner. First: forgetting background() in draw. The canvas never clears, so old frames pile up and everything looks smeared. Second: writing new Sprite() in draw or update where it runs every frame, instead of in setup. You'll make a new sprite 60 times a second and the sketch will grind to a halt. Making one inside an if, when a key is pressed or a timer fires, is fine. Third: using a variable before it's assigned — usually because you wrote let player inside setup instead of at the top of the file.

If a sprite isn't showing up, log its x and y. If input doesn't work, log kb.pressing('left') inside update to confirm the key name.`,
      code: `let player;

function setup() {
  new Canvas(400, 400);
  player = new Sprite(200, 200, 30, 30);
  console.log('setup ran, player at', player.x, player.y);
}

function update() {
  if (kb.presses(' ')) {
    console.log('space pressed on frame', frameCount);
  }
}

function draw() {
  background('#222');
}`,
    },
  ],
};
