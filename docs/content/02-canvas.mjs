// moSHion docs: Canvas & drawing. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#canvas/<id>); never rename one, add a new page instead.

export default {
  slug: 'canvas',
  title: "Canvas & drawing",
  pages: [
    {
      id: 'creating-the-canvas',
      title: "Creating the canvas",
      body: `new Canvas(width, height)

Call it inside setup() to make the drawing surface for your sketch. Without it, nothing shows up. Call it first, before you make any sprites, so the engine knows how big the world is.

The canvas coordinates start at (0, 0) in the top-left. X grows to the right, y grows downward. A 400 by 400 canvas has its center at (200, 200).

The default background is transparent — you'll usually replace it by calling background() inside draw.

width and height are global numbers that hold the size you gave new Canvas(). Use them instead of typing the size again: width / 2 is always the middle across, and height / 2 the middle down. The example draws a line across the middle of the canvas.`,
      code: `function setup() {
  new Canvas(400, 400);
}

function draw() {
  background('#202030');
  stroke('white');
  line(0, height / 2, width, height / 2);
  noStroke();
  fill('white');
  text('The canvas is ' + width + ' wide and ' + height + ' tall', 20, 30);
}`,
    },
    {
      id: 'background',
      title: "Background and clearing",
      body: `background(color)

This paints over the whole canvas. Call it first thing in draw() so last frame's pixels are erased before new ones go down. Skip it and you'll see comet-like trails behind every moving sprite.

A solid color takes a name ('black', 'tomato'), a hex string ('#222', '#ff00aa'), or an rgba string. For a see-through background use 'rgba(0, 0, 0, 0.1)' — only 10% opaque, so old frames fade out gradually instead of vanishing.

That fade trick is how you get motion trails without tracking history yourself. The lower the alpha, the longer the trail.

clear() wipes the whole canvas to see-through instead of painting a colour. Press the space bar in the example to clear away the trail. noLoop() stops the game loop for good: no more frames, so everything freezes where it is. The example calls it when you press the n key, so press n whenever you want to freeze the picture.`,
      code: `let p;
let wipe = false;

function setup() {
  new Canvas(400, 400);
  p = new Sprite(200, 200, 20);
  p.collider = 'none';
  p.color = 'gold';
}

function update() {
  p.x = 20 + (frameCount * 2) % 360;
  p.y = 200 + Math.sin(frameCount / 20) * 100;
  wipe = kb.presses(' ');
  if (kb.presses('n')) {
    noLoop(); // stop the game: no more frames
  }
}

function draw() {
  if (wipe) {
    clear(); // wipe the canvas to see-through
  } else {
    background('rgba(0, 0, 0, 0.1)');
  }
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

A colour can be a name or string, fill('deepskyblue'), or numbers as in p5: fill(80, 250, 123) for green, fill(200) for grey. For a see-through colour add an alpha: fill(0, 0, 0, 120), where the alpha runs from 0 (clear) to 255 (solid), or the string fill('rgba(0, 0, 0, 0.5)'), where it runs from 0 to 1.

ellipse(x, y, w, h) draws an oval centred on (x, y), w wide and h tall. Give it only w and it is a circle.`,
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

  noStroke();
  fill('limegreen');
  ellipse(150, 180, 120, 50);
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
  text('frames per second: ' + Math.round(frameRate()), 10, 40);
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
  if (x > 380) {
    x = 40;
  }

  if (cooldown > 0) {
    cooldown -= seconds;
  }
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
  if (cooldown > 0) {
    text('Dash in ' + cooldown.toFixed(1) + ' s', 10, 24);
  } else {
    text('Dash: READY (space)', 10, 24);
  }
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
  randomSeed(7); // the same stars every run. Delete this line for new stars each time
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

atan(v) is the angle whose tangent is v, in radians (in degrees after angleMode(DEGREES)).

lerp(a, b, t) is the number a fraction t of the way from a to b: lerp(0, 10, 0.25) is 2.5. dist(x1, y1, x2, y2) is the straight-line distance between two points, and it also takes two things with an x and a y, so dist(a, b) works on two sprites: dist(0, 0, 3, 4) is 5.

nf(num, left, right) turns a number into text with a fixed number of digits, which keeps a score from jumping around on screen. left is how many digits go before the point and right is how many after: nf(7, 2) is '07', nf(3.14159, 1, 2) is '3.14', and nf(12.5, 3, 1) is '012.5'.

millis() is the number of milliseconds since the sketch started. TWO_PI is a full turn in radians and HALF_PI is a quarter turn, next to PI. These are for radians. Sprites always turn in degrees; angleMode() changes only what cos(), sin(), tan(), atan() and atan2() use.`,
      code: `function setup() {
  new Canvas(400, 400);
}

function draw() {
  background(30);
  fill('white');
  textSize(16);
  text('dist(0, 0, 3, 4) = ' + dist(0, 0, 3, 4), 20, 30);
  text('lerp(0, 10, 0.25) = ' + lerp(0, 10, 0.25), 20, 60);
  text('int(-3.7) = ' + int(-3.7), 20, 90);
  text('abs(-4) = ' + abs(-4), 20, 120);
  text('sqrt(9) = ' + sqrt(9), 20, 150);
  text('pow(2, 3) = ' + pow(2, 3), 20, 180);
  text('ceil(3.2) = ' + ceil(3.2), 20, 210);
  text('max(3, 9, 2) = ' + max(3, 9, 2), 20, 240);
  text('min(3, 9, 2) = ' + min(3, 9, 2), 20, 270);
  text('atan(1) = ' + nf(atan(1), 1, 3), 20, 300);
  text('nf(7, 2) = ' + nf(7, 2), 20, 330);
  text('seconds so far = ' + nf(millis() / 1000, 1, 1), 20, 360);
}`,
    },
    {
      id: 'math-more',
      title: "More math: map, constrain, angles and PI",
      body: `map(value, inStart, inStop, outStart, outStop) turns a number from one range into the matching number in another. map(5, 0, 10, 0, 100) is 50, because 5 is halfway through 0 to 10, and 50 is halfway through 0 to 100. mouse.x is a number from 0 to the canvas width, so map() can turn it into a size or a colour. (mouseX and mouseY are older names for mouse.x and mouse.y.)

constrain(value, low, high) keeps a number inside a range: constrain(15, 0, 10) is 10 and constrain(-3, 0, 10) is 0.

radians(deg) turns degrees into radians and degrees(rad) turns radians into degrees. PI is a half turn in radians (about 3.14), TWO_PI is a full turn and HALF_PI is a quarter turn. RADIANS is the name of the radians setting, for angleMode(RADIANS), which is what you start with.

tan(angle) is the tangent of an angle, and atan2(y, x) is the angle of the point (x, y), measured from the +x axis. Both use radians unless you called angleMode(DEGREES). The example turns the angle from the middle of the canvas to the mouse into degrees.`,
      code: `function setup() {
  new Canvas(400, 400);
  angleMode(RADIANS);
}

function draw() {
  background(30);
  fill('white');
  textSize(16);

  // map(): mouse x (0 to 400) becomes a circle size (10 to 100)
  let size = map(mouse.x, 0, 400, 10, 100);
  // constrain(): never smaller than 20 or bigger than 80
  size = constrain(size, 20, 80);
  circle(200, 120, size);
  text('circle size ' + Math.round(size), 20, 30);

  // atan2(): the angle from the middle to the mouse
  let angle = atan2(mouse.y - 200, mouse.x - 200);
  text('angle in radians ' + nf(angle, 1, 2), 20, 230);
  text('same angle in degrees ' + Math.round(degrees(angle)), 20, 260);
  text('radians(180) = ' + nf(radians(180), 1, 2), 20, 290);
  text('tan(PI / 4) = ' + nf(tan(PI / 4), 1, 2), 20, 320);
  text('TWO_PI = ' + nf(TWO_PI, 1, 2) + ', HALF_PI = ' + nf(HALF_PI, 1, 2), 20, 350);
}`,
    },
    {
      id: 'vectors',
      title: "Vectors: createVector",
      body: `A vector is a pair of numbers, x and y, with some maths built in. It is handy for a position or a speed you want to add up.

createVector(x, y)
new Vector(x, y)

Either form makes the same kind of vector.

v.add(x, y), v.sub(x, y), v.mult(n) and v.div(n) CHANGE v and also hand it back, so you can chain them. v.set(x, y) replaces both numbers. v.copy() makes a separate vector, so changing the copy leaves v alone. v.mag() is its length: createVector(3, 4).mag() is 5. v.normalize() shrinks it to length 1 while keeping its direction, and v.dist(other) is the distance to another point: createVector(3, 4).dist(createVector(0, 0)) is 5.

Because add, sub, mult, div and normalize change the vector they are called on, call copy() first when you want to keep the original.

Anywhere a point is wanted, it can be two numbers, a vector, {x: 3, y: 0} or [3, 0]: v.add([1, 2]) and v.set({x: 5}) work (a missing number is 0). Anything that is not a number, like v.add('a'), is refused with a message that says so.

A sprite's sprite.pos and sprite.vel are vectors too, joined to the physics: player.vel.set(0, 0) stops the player and player.vel.add(0, -2) gives it a push up. Assigning a whole vector, player.vel = createVector(3, 0), copies its two numbers in, so the sprite keeps moving with the physics.`,
      code: `let v;

function setup() {
  new Canvas(400, 260);
  v = createVector(3, 4);
}

function draw() {
  background(30);
  fill('white');
  textSize(16);
  let w = v.copy().mult(2);
  text('v = (' + v.x + ', ' + v.y + '), length ' + v.mag(), 20, 30);
  text('copy times 2 = (' + w.x + ', ' + w.y + ')', 20, 55);
  text('v is still (' + v.x + ', ' + v.y + ')', 20, 80);

  let d = v.copy().div(2);
  text('copy divided by 2 = (' + d.x + ', ' + d.y + ')', 20, 105);

  let s = v.copy().sub(1, 1);
  text('copy minus (1, 1) = (' + s.x + ', ' + s.y + ')', 20, 130);

  let n = v.copy().normalize();
  text('copy normalized = (' + nf(n.x, 1, 2) + ', ' + nf(n.y, 1, 2) + ')', 20, 155);

  let t = createVector(0, 0);
  t.set(7, 8);
  text('set to (' + t.x + ', ' + t.y + ')', 20, 180);

  let start = createVector(1, 1);
  start.add(2, 3);
  text('add (2, 3) to (1, 1) = (' + start.x + ', ' + start.y + ')', 20, 205);
  text('v.dist(t) = ' + nf(v.dist(t), 1, 2), 20, 230);
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
    {
      id: 'background-texture',
      title: "A picture as the background",
      body: `background() can also take the name of a texture. background('sunset') fills the whole canvas with that picture instead of one colour. Call it first thing in draw(), just like a colour.

The picture is scaled until it covers the canvas, and the sides or the top and bottom are cropped when the shapes do not match. It stays fixed when the camera moves, so sprites slide over it. An animated texture plays at its own speed. A name that is also a colour, like 'red', is read as the colour, so give a texture a name that is not one.

The example saves a picture under a new name and uses it as the background while the camera sways from side to side. After about two and a half seconds it deletes the picture, and only if it saved the picture itself, and the background falls back to a plain colour.`,
      code: `let ball;
let artName = 'docsDemoBackdrop';
let saved = false;

function setup() {
  new Canvas(400, 200);
  world.gravity.y = 10;

  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGO4o6GhseAOw68TcjYnogApvAYPvPI98QAAAABJRU5ErkJggg==';

  if (hasTexture(artName) === false) {
    saveTexture(artName, dataUrl);
    saved = true;
  }

  ball = new Sprite(200, 40, 30);
  ball.color = 'white';
  ball.bounciness = 0.8;
  new Sprite(200, 195, 600, 10, 'static');
}

function update() {
  camera.x = 200 + 40 * Math.sin(frameCount / 30);
  if (frameCount === 150 && saved === true) {
    deleteTexture(artName);
    saved = false;
  }
}

function draw() {
  if (saved === true) {
    background(artName);
  } else {
    background('#222');
  }
}`,
    },
  ],
};
