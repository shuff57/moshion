// moSHion docs: Input. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#input/<id>); never rename one, add a new page instead.

export default {
  slug: 'input',
  title: "Input",
  pages: [
    {
      id: 'keyboard',
      title: "Keyboard basics",
      body: `The global kb object reports keyboard state every frame.

kb.pressing('key') returns true while the key is held down. Use it for continuous actions like walking.

kb.presses('key') is true only on the first frame of a press (edge-triggered). Use it for single-shot actions like jumping or firing.

Key names are lowercase strings: 'left', 'right', 'up', 'down', 'a', 'w', 'enter', 'shift', 'escape', and either 'space' or ' ' for the space bar. Spelling is forgiving — 'space', 'ArrowRight' and 'arrowright' all find the key they name.

'left', 'right', 'up' and 'down' answer for the arrow key OR its WASD twin, so kb.pressing('left') is true whether the player pressed the left arrow or 'a'. You get both control schemes without writing either one twice.

Two players on one keyboard need the opposite: W must move only one of them. Name the arrow itself and it answers for the arrow only: 'arrowUp', 'arrowDown', 'arrowLeft' and 'arrowRight' for one player, 'w', 'a', 's' and 'd' for the other.

There are shorthand properties too: kb.space, kb.enter, kb.shift, kb.arrowUp and friends give the same number kb.pressing() would.

Arrow keys and space bar are automatically prevented from scrolling the page.`,
      code: `let player;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 40, 40);
  player.color = 'deepskyblue';
}

function update() {
  if (kb.pressing('left'))       player.vel.x = -4;
  else if (kb.pressing('right')) player.vel.x = 4;
  else                           player.vel.x = 0;

  if (kb.presses(' '))   player.color = 'gold';
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'holding-a-key',
      title: "Holding a key",
      body: `kb.pressing('key') isn't just true/false — it's the number of frames the key has been held (0 when idle), so it's still truthy in an if-check but also useful as a charge-up timer.

kb.holds('key') fires exactly once, the frame the hold crosses kb.holdThreshold (12 frames by default — about a fifth of a second at 60fps). kb.holding('key') is the frame count while held past that threshold (0 before it). kb.held('key') fires exactly once, the frame the key comes back up after having been held past the threshold — use it to tell a quick tap apart from a held press.

mouse has the same four: mouse.holds(), mouse.holding(), mouse.held(), mouse.holdThreshold.`,
      code: `let charge = 0;

function setup() {
  new Canvas(400, 200);
}

function update() {
  if (kb.holds(' ')) charge = 0;
  if (kb.holding(' ')) charge = kb.holding(' ');
  if (kb.held(' ')) console.log('released a full charge:', charge);
}

function draw() {
  background('#222');
  fill('gold');
  textSize(16);
  text('hold space — charge: ' + charge, 14, 24);
}`,
    },
    {
      id: 'mouse',
      title: "Mouse position and buttons",
      body: `mouse.x and mouse.y are the cursor's position in world coordinates (already camera-aware).

mouse.pressing() returns true while any mouse button is held. mouse.presses() is true only on the first frame of a click — use it for single-shot actions. mouse.released() is true on the frame the button is released.

To tell the buttons apart, give the button's name: mouse.presses('right') is the first frame of a right-click, mouse.pressing('left') is true while the left button is held, and the same works for 'center' and for released(). With nothing in the brackets they answer for any button. Right-clicking the canvas does not open the browser's menu, so the right button is free for your game. mouse.left, mouse.center and mouse.right also count how many frames each button has been held. mouse.pos is the cursor as an {x, y} object, handy for passing straight to a method that takes a target.

mouse.x and mouse.y are world coordinates — they already include the camera, so comparing them to a sprite's x and y always works. mouse.canvasPos is the same cursor measured in screen pixels instead. Use it for anything pinned to the screen rather than the world, like a HUD button: once the camera scrolls, mouse.x is somewhere out in the level while canvasPos is still where the cursor looks like it is.

Combine mouse position with world.getSpriteAt(x, y) to build click-to-select or drag interactions.`,
      code: `let dot;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  dot = new Sprite(200, 200, 24);
  dot.color = 'white';
  dot.collider = 'none';
}

function update() {
  dot.x = mouse.x;
  dot.y = mouse.y;

  if (mouse.pressing())       dot.color = 'gold';
  else                        dot.color = 'white';
}

function draw() {
  background('#222');
  fill('white');
  textSize(14);
  text('x: ' + Math.round(mouse.x) + '  y: ' + Math.round(mouse.y), 14, 22);
}`,
    },
    {
      id: 'mouse-and-sprite',
      title: "The mouse and a sprite: hover, click, hide the pointer",
      body: `Every sprite has a .mouse that answers questions about the mouse and that one sprite.

button.mouse.hovering() is true while the pointer is over the sprite. button.mouse.hovers() is true only on the first frame it gets there, and button.mouse.hovered() only on the first frame after it leaves: handy for a sound or a grow effect that should happen once.

button.mouse.presses() is true on the frame a click starts on the sprite. button.mouse.pressing() stays true while the button is held down, even if the pointer slides off the sprite, which is just what dragging needs. button.mouse.released() is true on the frame you let go. Like mouse.presses(), each can take 'left', 'center' or 'right'.

To hide the pointer, for a game with its own crosshair sprite, write mouse.visible = false. mouse.visible = true brings it back. mouse.pressing() (no sprite) is true while any mouse button is down anywhere.`,
      code: `let button, crosshair;

function setup() {
  new Canvas(400, 300);
  mouse.visible = false; // the crosshair sprite is the pointer now

  button = new Sprite(200, 150, 160, 60, 'static');
  button.color = 'slateblue';
  button.text = 'Click me';

  crosshair = new Sprite(0, 0, 12);
  crosshair.collider = 'none';
  crosshair.color = 'white';
  crosshair.layer = 10;
}

function update() {
  crosshair.x = mouse.x;
  crosshair.y = mouse.y;

  if (button.mouse.hovering()) button.color = 'mediumslateblue';
  else button.color = 'slateblue';

  if (button.mouse.pressing()) button.scale = 0.9;
  else button.scale = 1;

  if (button.mouse.presses()) button.text = 'Clicked!';
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'hit-testing',
      title: "Hit-testing with the mouse",
      body: `world.getSpriteAt(x, y) returns the top-most sprite at that world position, or undefined if nothing is there: the highest layer, and between two on the same layer, the one made later (the one drawn on top). It checks both circles (radius test) and rectangles (bounding box). It also takes a point, world.getSpriteAt(mouse), and it finds a screenSpace HUD sprite where it is drawn, even after the camera has scrolled.

world.getSpritesAt(x, y) returns every sprite there, top-most first.

This is the pattern for click-to-select: on mouse.presses(), call world.getSpriteAt(mouse.x, mouse.y) and remember the result. Then you can drag it, change its color, or delete it.`,
      code: `let selected;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  for (let i = 0; i < 6; i++) {
    let s = new Sprite(60 + i * 55, 200, 40, 40);
    s.color = 'steelblue';
  }
}

function update() {
  if (mouse.presses()) {
    if (selected) selected.color = 'steelblue';
    selected = world.getSpriteAt(mouse.x, mouse.y);
    if (selected) selected.color = 'tomato';
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'more-mouse',
      title: "More about the mouse: drags, scroll, cursor",
      body: `mouse.position is another name for mouse.pos. mouse.isOnCanvas is true while the pointer is over the canvas.

mouse.drags() is true on the first frame of a drag, mouse.dragging() counts the frames the pointer has been moving with a button held, and mouse.dragged() is true on the frame the drag ends. Each takes a button name: 'left', 'center' or 'right'.

mouse.scrollDelta has an x and a y for how far the wheel moved since the last frame, and is 0 when it did not move. mouse.cursor changes the shape of the pointer over the canvas, with a CSS cursor name: mouse.cursor = 'pointer' gives a pointing hand, and mouse.cursor = 'none' hides it. mouse.visible = false hides the pointer too, and mouse.visible = true brings back the one you had before.

mouse.pressed(button) and mouse.releases(button) are old names, like the kb ones: use presses() and released().`,
    },
    {
      id: 'touch',
      title: "Touch: a finger drives the mouse",
      body: `A single touch drives exactly the same mouse properties — mouse.x, mouse.y, mouse.presses(), mouse.pressing(), mouse.released(). A sketch written against the mouse works on a phone or tablet with no changes at all.

Three things a tap does, all at once: it moves the cursor to where you touched, it starts a press (so mouse.presses() fires on that frame, reading the touch position), and it stops the page from scrolling or zooming out from under the canvas. Dragging a finger across the canvas keeps the press held and keeps mouse.x/y following the finger, like holding the left button down.

Multi-touch is deliberately not mapped. A second finger changes nothing, and there is no touch gesture that stands in for the right mouse button — a sketch that needs two buttons needs a keyboard as well. mouse.isActive also turns true on the first touch, exactly as it does on the first mouse move.`,
      code: `let dot;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  dot = new Sprite(200, 200, 40);
  dot.color = 'white';
  dot.collider = 'none';
}

function update() {
  dot.x = mouse.x;
  dot.y = mouse.y;
  dot.color = mouse.pressing() ? 'gold' : 'white';
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(14);
  text('tap or drag anywhere', 14, 22);
}`,
    },
  ],
};
