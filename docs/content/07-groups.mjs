// moSHion docs: Groups. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#groups/<id>); never rename one, add a new page instead.

export default {
  slug: 'groups',
  title: "Groups",
  pages: [
    {
      id: 'spawning',
      title: "Spawning and defaults",
      body: `A Group holds many sprites that share traits. Set a property on the group and every sprite spawned into it inherits that value as its default.

Settings for how a sprite looks and what it is made of also change the sprites already in the group: enemies.color = 'red' turns every current enemy red, and the next one made too. That covers color, stroke, layer, visible, opacity, scale, text, size (w, h, diameter), collider, bounciness, friction, density and drag. A group's scale can change one direction on its own: walls.scale.y = 3 makes every wall three times as tall and leaves its width alone, and walls.scale = 2 sets both. Where a sprite is and how it moves (x, y, vel, rotation, life) only set the starting value for new sprites, and so does any property you invent yourself, like enemies.hp = 3.

Create a group with new Group(). Then spawn sprites into it with new groupName.Sprite(...) — note the capital S. That factory reads the group's color, diameter, collider, and other defaults, copies them onto the new sprite, and adds the sprite to the group.

Common defaults to set right after creating a group: color, diameter (for circles) or w/h, collider ('none' is useful for pickups and decorations), and layer.`,
      code: `let stars;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  stars = new Group();
  stars.color = 'gold';
  stars.diameter = 16;
  stars.collider = 'none';

  new stars.Sprite(100, 100);
  new stars.Sprite(200, 200);
  new stars.Sprite(300, 300);
}

function draw() {
  background('#112');
}`,
    },
    {
      id: 'clone',
      title: "Copying a sprite: clone()",
      body: `sprite.clone() makes a new sprite that looks and behaves like one you already set up: the same size and shape, colour and outline, picture, texture or animation, layer, rotation, and the same physics settings (collider, bounciness, friction, density, drag). It also joins every group the original is in, so a check like player.colliding(pipes) sees the copy too.

The copy is made in the same spot and starts still. Move it straight away, in the same function: two solid sprites on top of each other push apart on the next frame. It does not copy motion, life, joints, or properties you made up yourself, like hp or points. Set those on the copy.

clone() is for "one more like that one". For many sprites that share settings from the start, a group's factory (new pipes.Sprite(...)) is still the tidier tool.`,
      code: `let pipes, upper, lower;

function setup() {
  new Canvas(400, 400);
  pipes = new Group();
  upper = new pipes.Sprite(300, 60, 50, 120, 'kinematic');
  upper.color = 'green';
  upper.stroke = 'darkgreen';
  upper.strokeWeight = 3;

  lower = upper.clone();   // same size, colour, outline, collider, groups
  lower.y = 340;           // move it before the next frame
}

function draw() {
  background('skyblue');
  text(pipes.length + ' pipes', 10, 20);
}`,
    },
    {
      id: 'tile-maps',
      title: "Tile maps from text",
      body: `new Tiles(map, x, y, w, h, legend) builds a level out of rows of text. map is an array of strings, one per row. legend says which Group each character builds: { '#': walls, 'c': coins }. Any character the legend doesn't name, like a space or a dot, is an empty cell.

Each tile is made with new group.Sprite(), so the group's defaults apply exactly as if you had made it by hand: walls.collider = 'static' makes every wall static, and coins.diameter = 14 makes every coin a small circle instead of a full tile.

x and y are the centre of the top-left tile, the same way a sprite's x and y are its centre, and w and h are the size of one tile. For 40-pixel tiles starting in the canvas corner, pass 20, 20, 40, 40.

What you get back is itself a Group holding every sprite it made, so level.delete() clears the whole level when you want to load the next one.`,
      code: `let walls, coins, player, level;
let score = 0;

function setup() {
  new Canvas(400, 240);
  world.gravity.y = 10;

  walls = new Group();
  walls.collider = 'static';
  walls.color = 'slategray';

  coins = new Group();
  coins.collider = 'none';
  coins.diameter = 14;
  coins.color = 'gold';

  level = new Tiles([
    '##########',
    '#        #',
    '#  c  c  #',
    '#  ##  c #',
    '# c      #',
    '##########',
  ], 20, 20, 40, 40, { '#': walls, 'c': coins });

  player = new Sprite(60, 100, 20, 28);
  player.color = 'deepskyblue';
  player.rotationLock = true;
}

function update() {
  if (kb.pressing('left'))       player.vel.x = -3;
  else if (kb.pressing('right')) player.vel.x = 3;
  else                           player.vel.x = 0;
  if (kb.presses('up')) player.vel.y = -6;

  player.overlaps(coins, (p, coin) => {
    coin.delete();
    score++;
  });
}

function draw() {
  background('#112');
  fill('white');
  textSize(14);
  text('coins: ' + score, 50, 32);
}`,
    },
    {
      id: 'iterating-removing',
      title: "Iterating and removing",
      body: `A Group extends Array. You get .length, indexing with group[i], for..of loops, and array methods like .forEach directly on the group.

One trap: removing sprites while iterating shifts the array and skips items. Iterate over a copy when you might remove entries: for (const s of [...group]). The spread makes a snapshot so the original can shrink safely.

group.remove(sprite) pulls the sprite out of the group but leaves it in the world — it still draws and runs physics. sprite.delete() destroys the sprite entirely and unparents it from every group. These are different operations with different effects.`,
      code: `let drops;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  drops = new Group();
  drops.color = 'deepskyblue';
  drops.diameter = 14;
  drops.collider = 'none';
}

function update() {
  if (frameCount % 10 === 0) {
    new drops.Sprite(Math.random() * 400, 0);
  }
  for (const d of [...drops]) {
    d.y += 3;
    if (d.y > 420) d.delete();
  }
}

function draw() {
  background('#112');
  fill('white');
  textSize(14);
  text('drops: ' + drops.length, 14, 22);
}`,
    },
    {
      id: 'culling',
      title: "Culling sprites that leave the screen",
      body: `Every spawner has the same problem: sprites that drift off the edge are invisible but still alive, still costing physics every frame. Left alone, a game that fires a bullet every 10 frames is dragging thousands of dead bullets around after a few minutes.

group.cull(margin) deletes the members that have gone that far outside the canvas, and returns how many it deleted. cull(0) means "the moment they leave", cull(50) gives them a 50-pixel grace border so a sprite that is only halfway off doesn't vanish mid-view.

Give it a function and it runs that instead of deleting: cull(0, s => s.y = 0). That's how you wrap a sprite around to the other side, or send it back to the spawn point, rather than destroying it. The sprite stays in the group either way.

It measures against the camera, so a scrolling game culls against what's actually on screen, not against the origin.`,
      code: `let drops;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  drops = new Group();
  drops.color = 'deepskyblue';
  drops.diameter = 14;
  drops.collider = 'none';
}

function update() {
  if (frameCount % 10 === 0) {
    new drops.Sprite(Math.random() * 400, 0);
  }
  for (const d of drops) d.y += 3;

  // one line replaces the remove-while-iterating loop
  drops.cull(20);
}

function draw() {
  background('#112');
  fill('white');
  textSize(14);
  text('alive: ' + drops.length, 14, 22);
}`,
    },
    {
      id: 'all-sprites',
      title: "The allSprites group",
      body: `allSprites is a built-in Group that every sprite joins automatically the moment it's created. You never construct it — it's already there as soon as moSHion loads.

It's useful whenever you want to touch "every sprite in the scene" at once: allSprites.length for a live count, or for (const s of allSprites) to iterate the whole world.

Since it extends Array like any other Group, the same patterns apply.`,
      code: `let player, rocks;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 20);
  player.color = 'white';

  rocks = new Group();
  rocks.color = 'slategray';
  rocks.diameter = 18;
  rocks.collider = 'none';
  for (let i = 0; i < 5; i++) {
    new rocks.Sprite(60 + i * 60, 320);
  }
}

function draw() {
  background('#112');
  fill('white');
  textSize(14);
  text('allSprites: ' + allSprites.length, 14, 22);
}`,
    },
    {
      id: 'custom-properties',
      title: "Custom properties",
      body: `You aren't limited to moSHion's built-in properties. Assign any property you like on a group and it becomes a default for every sprite spawned afterward — enemies.hp = 3 gives every new enemy an hp of 3.

Each sprite gets its own copy of the value on spawn, so changing one enemy's hp doesn't affect the others. The group just holds the template.

This is how you keep gameplay data attached to the right sprite. Tag sprites with custom fields like .hp, .score, .kind, or anything else your game needs, and read them back off the individual sprite during collisions.

Pick names the sprite doesn't already use. A sprite has built-in properties, and a field with the same name drives the built-in one instead of making a new field: speed sets its velocity (and reads back 0 on a static sprite), life deletes it after that many frames, direction turns it, and text draws a label on it. The same goes for color, scale, mass, x, y, w, h, d, r, width, height, visible and removed. Use names like hp, moveSpeed, heading or label. This matters most in a class that extends Sprite, where this.speed = 5 looks like your own field and isn't.`,
      code: `let player, enemies;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 20);
  player.color = 'white';

  enemies = new Group();
  enemies.color = 'tomato';
  enemies.diameter = 20;
  enemies.hp = 3;

  for (let i = 0; i < 4; i++) {
    new enemies.Sprite(80 + i * 70, 80);
  }
}

function update() {
  if (player.overlaps(enemies)) {
    for (const e of enemies) {
      if (player.overlaps(e)) { e.hp -= 1; if (e.hp <= 0) e.delete(); }
    }
  }
}

function draw() {
  background('#112');
}`,
    },
    {
      id: 'draw-yourself',
      title: "Drawing sprites yourself: autoDraw and draw()",
      body: `The engine draws every sprite for you after draw() runs. To choose the moment yourself, turn that off with allSprites.autoDraw = false. Set it once, in setup(): it covers the sprites you make later too, like bullets made in the middle of the game.

Then call allSprites.draw() where you want the sprites to appear, in update() or draw(). It draws them right then, lowest layer first, so you can paint the background, then the sprites, then words over the top. Any group works the same way: enemies.autoDraw = false and enemies.draw() for just the enemies.

autoUpdate works like autoDraw: ghosts.autoUpdate = false stops the update you gave each ghost, for the ghosts you have now and the ones you make later. Set either one back to true to hand the job back to the engine.`,
      code: `let player;

function setup() {
  new Canvas(400, 300);
  allSprites.autoDraw = false; // I will draw the sprites myself
  player = new Sprite(200, 150, 50, 50);
  player.color = 'deepskyblue';
}

function update() {
  if (mouse.presses()) {
    let dot = new Sprite(mouse.x, mouse.y, 16);
    dot.color = 'gold';
    dot.collider = 'none';
  }
}

function draw() {
  background('#222');
  allSprites.draw(); // the sprites go here
  fill('white');
  textSize(16);
  text('Click to add a dot.', 20, 40); // drawn over every sprite
}`,
    },
  ],
};
