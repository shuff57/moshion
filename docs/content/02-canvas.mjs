// moSHion docs: Canvas & drawing. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#canvas/<id>); never rename one, add a new page instead.

export default {
  slug: 'canvas',
  title: "Canvas & drawing",
  pages: [
    {
      id: 'creating-the-canvas',
      title: "Creating the canvas",
      body: `new Canvas(width, height) inside setup() makes the drawing surface for your sketch. Without it, nothing shows up. Call it first, before you make any sprites, so the engine knows how big the world is.

The canvas coordinates start at (0, 0) in the top-left. X grows to the right, y grows downward. A 400 by 400 canvas has its center at (200, 200).

The default background is transparent — you'll usually replace it by calling background() inside draw.`,
      code: `function setup() {
  new Canvas(400, 400);
}

function draw() {
  background('#202030');
}`,
    },
    {
      id: 'background',
      title: "Background and clearing",
      body: `background(color) paints over the whole canvas. Call it first thing in draw() so last frame's pixels are erased before new ones go down. Skip it and you'll see comet-like trails behind every moving sprite.

A solid color takes a name ('black', 'tomato'), a hex string ('#222', '#ff00aa'), or an rgba string. For a see-through background use 'rgba(0, 0, 0, 0.1)' — only 10% opaque, so old frames fade out gradually instead of vanishing.

That fade trick is how you get motion trails without tracking history yourself. The lower the alpha, the longer the trail.`,
      code: `let p;

function setup() {
  new Canvas(400, 400);
  p = new Sprite(200, 200, 20);
  p.collider = 'none';
  p.color = 'gold';
}

function update() {
  p.x = 200 + Math.cos(frameCount / 20) * 150;
  p.y = 200 + Math.sin(frameCount / 20) * 150;
}

function draw() {
  background('rgba(0, 0, 0, 0.1)');
}`,
    },
    {
      id: 'colour-alpha',
      title: "A colour with alpha",
      body: `A colour is a CSS string. fill(), stroke(), background() and a sprite's .color all take the same one, and the alpha can go inside it: 'rgba(255, 99, 71, 0.5)' is that red at half strength, with the alpha from 0 to 1. fill(), stroke() and background() also take numbers the way p5 does: fill(255, 99, 71) for red, fill(200) for light grey, and a fourth number for alpha, fill(255, 99, 71, 128), where the alpha runs from 0 to 255.

Two helpers build the string for you. rgba(r, g, b, a) rounds and clamps the channels and the alpha, and randomColor(alpha) or randomColor(minAlpha, maxAlpha) picks a random colour for you. Both return a plain string, so they go anywhere a colour goes.`,
      code: `let dots = [];

function setup() {
  new Canvas(400, 400);
  for (let i = 0; i < 8; i++) {
    const d = new Sprite(random(60, 340), random(60, 340), 60);
    d.collider = 'none';
    d.color = randomColor(0.3, 1);
    dots.push(d);
  }
}

function draw() {
  background('#111');
  fill(rgba(255, 255, 255, 0.35));
  text('eight random colours', 12, 24);
}`,
    },
    {
      id: 'shapes',
      title: "Drawing plain shapes",
      body: `Not everything on screen has to be a sprite. Inside draw() you can paint a shape straight onto the canvas: rect(x, y, w, h), square(x, y, size), circle(x, y, diameter) and line(x1, y1, x2, y2). These have no physics and nothing collides with them; they are just pixels, redrawn every frame after background().

rect and square are placed by their top-left corner. circle is placed by its centre, the same way a sprite is.

fill(color) sets the colour inside the next shapes, and stroke(color) sets the outline. noFill() and noStroke() turn either one off, and strokeWeight(n) makes the outline thicker. They stay set until you change them, so set the colour just before the shape it belongs to. square() follows fill() like every other shape: fill('deepskyblue') then square(...) draws a blue square.

A colour can be a name or string, fill('deepskyblue'), or numbers as in p5: fill(80, 250, 123) for green, fill(200) for grey. For a see-through colour add an alpha: fill(0, 0, 0, 120), where the alpha runs from 0 (clear) to 255 (solid), or the string fill('rgba(0, 0, 0, 0.5)'), where it runs from 0 to 1.`,
      code: `function setup() {
  new Canvas(400, 300);
}

function draw() {
  background('#222');

  noStroke();
  fill('deepskyblue');
  square(40, 60, 80);

  fill('tomato');
  circle(220, 100, 80);

  noFill();
  stroke('gold');
  strokeWeight(4);
  rect(280, 60, 80, 120);
  line(40, 240, 360, 240);
}`,
    },
    {
      id: 'frame-count',
      title: "frameCount",
      body: `frameCount is a global number that starts at 0 and goes up by 1 every frame. It's the simplest way to animate: use it to offset a position, wrap a counter with %, or trigger something every N frames.

Combine frameCount with Math.sin or Math.cos to get smooth back-and-forth motion without any physics.

A game runs 60 frames a second on every screen, including 120 Hz and 144 Hz monitors, so frameCount, vel.x and every() mean the same thing on any computer. A slow computer can still fall below 60.

frameRate() (no arguments) returns how many frames per second your sketch is actually managing right now — call it inside draw() and print it if you want to see whether a busy scene is slowing things down.`,
      code: `let ball;

function setup() {
  new Canvas(400, 400);
  ball = new Sprite(200, 200, 40);
  ball.collider = 'none';
  ball.color = 'gold';
}

function update() {
  ball.x = 200 + Math.sin(frameCount / 30) * 120;
}

function draw() {
  background('#222');
  fill('white');
  textSize(14);
  text('frame ' + frameCount, 10, 20);
}`,
    },
    {
      id: 'delta-time',
      title: "Time in seconds: deltaTime",
      body: `deltaTime is how many milliseconds passed since the last frame: about 16.7 when the game runs at 60 frames a second, more when the computer is slow. Divide by 1000 to get seconds.

That lets you write timing in seconds instead of counting frames. x += 120 * deltaTime / 1000 moves 120 pixels every second, and a cooldown can be a number of seconds that counts down by deltaTime / 1000 each frame, so 2.5 means two and a half seconds.

Counting frames still works too (frameCount, every(), 60 frames = 1 second). Use whichever reads more clearly for what you are making.`,
      code: `let cooldown = 0;   // seconds until you can dash again
let x = 40;

function setup() {
  new Canvas(400, 200);
}

function update() {
  let seconds = deltaTime / 1000;
  x += 60 * seconds;            // 60 pixels a second
  if (x > 380) x = 40;

  if (cooldown > 0) cooldown -= seconds;
  if (kb.presses('space') && cooldown <= 0) {
    x += 80;
    cooldown = 1.5;             // one and a half seconds
  }
}

function draw() {
  background('#222');
  fill('gold');
  circle(x, 100, 30);
  fill('white');
  textSize(16);
  text(cooldown > 0 ? 'Dash in ' + cooldown.toFixed(1) + ' s' : 'Dash: READY (space)', 10, 24);
}`,
    },
    {
      id: 'random',
      title: "Fresh dice: random() and randomSeed()",
      body: `random() with nothing in the brackets gives a number from 0 up to (not including) 1. random(10) gives one from 0 up to 10, random(5, 10) one from 5 up to 10, and random(['red', 'gold', 'lime']) picks one item from a list.

Every time you press Run, the numbers are different, so each playthrough deals a new level, a new enemy wave, a new set of stars.

To get the same numbers every run, call randomSeed(n) at the top of setup() with any whole number. The same seed always gives the same sequence. That helps when you are hunting a bug that only happens with one particular layout: seed it, and the layout comes back every time.`,
      code: `function setup() {
  new Canvas(400, 300);
  // randomSeed(7); // uncomment: the same stars every run
  for (let i = 0; i < 40; i++) {
    const star = new Sprite(random(400), random(300), random(2, 6));
    star.collider = 'none';
    star.color = random(['white', 'gold', 'lightblue']);
  }
}

function draw() {
  background('#112');
}`,
    },
    {
      id: 'math-helpers',
      title: "Math helpers: abs, sqrt, lerp, dist and friends",
      body: `These work the way they do in p5 and in plain math class. abs(n) drops a minus sign: abs(-4) is 4. sqrt(n) is the square root: sqrt(9) is 3. pow(base, exponent) raises to a power: pow(2, 3) is 8. ceil(n) rounds up, floor(n) rounds down, and int(n) is the same as floor(n), so int(3.7) is 3 and int(-3.7) is -4. max(...) and min(...) pick the biggest or smallest of the numbers you give them, or of one list: max(3, 9, 2) is 9.

atan(v) is the angle whose tangent is v, in radians (in degrees after angleMode(DEGREES)). ellipse(x, y, w, h) draws an oval w wide and h tall, and with no h it is a circle w across.

lerp(a, b, t) is the number a fraction t of the way from a to b: lerp(0, 10, 0.25) is 2.5. dist(x1, y1, x2, y2) is the straight-line distance between two points, and it also takes two things with an x and a y, so dist(a, b) works on two sprites: dist(0, 0, 3, 4) is 5.

nf(num, left, right) turns a number into text with a fixed number of digits, which keeps a score from jumping around on screen. left is how many digits go before the point and right is how many after: nf(7, 2) is '07', nf(3.14159, 1, 2) is '3.14', and nf(12.5, 3, 1) is '012.5'.

millis() is the number of milliseconds since the sketch started. TWO_PI is a full turn in radians and HALF_PI is a quarter turn, next to PI. These are for radians; sprites turn in degrees unless you call angleMode().`,
      code: `function setup() {
  new Canvas(400, 200);
}

function draw() {
  background(30);
  fill('white');
  textSize(16);
  text('dist(0, 0, 3, 4) = ' + dist(0, 0, 3, 4), 20, 40);
  text('lerp(0, 10, 0.25) = ' + lerp(0, 10, 0.25), 20, 70);
  text('int(-3.7) = ' + int(-3.7), 20, 100);
  text('nf(7, 2) = ' + nf(7, 2), 20, 130);
  text('seconds so far = ' + nf(millis() / 1000, 1, 1), 20, 160);
}`,
    },
    {
      id: 'vectors',
      title: "Vectors: createVector",
      body: `A vector is a pair of numbers, x and y, with some maths built in. createVector(x, y) makes one (new Vector(x, y) does the same). It is handy for a position or a speed you want to add up.

v.add(x, y), v.sub(x, y), v.mult(n) and v.div(n) CHANGE v and also hand it back, so you can chain them. v.set(x, y) replaces both numbers. v.copy() makes a separate vector, so changing the copy leaves v alone. v.mag() is its length: createVector(3, 4).mag() is 5. v.normalize() shrinks it to length 1 while keeping its direction, and v.dist(other) is the distance to another point.

Because add, sub, mult, div and normalize change the vector they are called on, call copy() first when you want to keep the original.

A sprite's sprite.pos and sprite.vel are vectors too, joined to the physics: player.vel.set(0, 0) stops the player and player.vel.add(0, -2) gives it a push up. Assigning a whole vector, player.vel = createVector(3, 0), copies its two numbers in, so the sprite keeps moving with the physics.`,
      code: `let v;

function setup() {
  new Canvas(400, 200);
  v = createVector(3, 4);
}

function draw() {
  background(30);
  fill('white');
  textSize(16);
  let w = v.copy().mult(2);
  text('v = (' + v.x + ', ' + v.y + '), length ' + v.mag(), 20, 50);
  text('copy times 2 = (' + w.x + ', ' + w.y + ')', 20, 90);
  text('v is still (' + v.x + ', ' + v.y + ')', 20, 130);
}`,
    },
    {
      id: 'angle-mode',
      title: "Degrees for trig: angleMode()",
      body: `Every angle on a sprite is in degrees: rotation, direction, angleTo(). But cos(), sin() and tan() start out in radians, the unit math uses, where a half turn is PI (about 3.14) instead of 180. So cos(90) is not 0.

Call angleMode(DEGREES) once at the top of setup() and they switch to degrees: cos(90) is 0, sin(90) is 1, and atan2(y, x) gives its answer back in degrees. Now the angle a sprite faces goes straight into cos() and sin(): the example below fires a dot the way a spinning turret points.

angleMode(RADIANS) switches back, and angleMode() with nothing tells you which one is on.`,
      code: `let turret;

function setup() {
  new Canvas(400, 300);
  angleMode(DEGREES);
  turret = new Sprite(200, 150, 40, 12, 'static');
  turret.color = 'gold';
}

function update() {
  turret.rotation += 2;
  if (frameCount % 20 === 0) {
    const shot = new Sprite(turret.x, turret.y, 8);
    shot.collider = 'none';
    shot.vel.x = cos(turret.rotation) * 4;
    shot.vel.y = sin(turret.rotation) * 4;
    shot.life = 60;
  }
}

function draw() {
  background('#222');
}`,
    },
  ],
};
