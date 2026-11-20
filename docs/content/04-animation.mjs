// moSHion docs: Art & animation. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#animation/<id>); never rename one, add a new page instead.

export default {
  slug: 'animation',
  title: "Art & animation",
  pages: [
    {
      id: 'images-emoji',
      title: "Images and emoji on sprites",
      body: `sprite.image = 'player.png' loads an image from a URL and draws it in place of the default colored shape. The image stretches to fill the sprite's width and height.

If the string has no dot in it, moSHion treats it as an emoji: sprite.image = '🧍' draws that emoji character centered on the sprite at the sprite's height as the font size. This is a quick way to get a visible character without loading assets.

Setting .image clears any active animation (sprite.texture), and vice versa — they're mutually exclusive.`,
      code: `let player;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  player = new Sprite(200, 200, 64, 64);
  player.collider = 'none';
  player.image = '🦄';
}

function update() {
  if (kb.pressing('left'))       player.x -= 3;
  else if (kb.pressing('right')) player.x += 3;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'image-files',
      title: "Image files on sprites",
      body: `sprite.image = 'assets/star.webp' gives a sprite a picture from a file path, resolved against the runner's own URL — so a path like assets/star.webp finds the file in this repo's assets/ folder no matter which page hosts the preview.

A string with no dot in it is not a path but an emoji placeholder: sprite.image = '🦄' draws the character itself, sized to the sprite, no file needed. The two forms are mutually exclusive — setting one clears the other.

Reading sprite.image gives back what you set. Setting it also clears any animation, the same way .ani and .image already clear each other: a sprite is either a colored shape, a picture, or an animation, never two at once.

For a strip of frames, addAni(name, sheetUrl, frameCount) still slices a horizontal strip into an animation — see the animation section. A single still image is the one-frame case: draw it once, save it as one frame, or just use .image.

Images stretch to the sprite's w/h, whatever their natural pixel size. Pixel art scales up and stays crisp only if the browser is told not to smooth it; this engine smooths, so prefer art at (or near) the size you will display it — assets/star.webp at 270x264 on a 40x40 sprite will look soft rather than blocky.`,
      code: `let player, stars;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  player = new Sprite(200, 300, 48, 48);
  player.collider = 'none';
  player.image = 'assets/star.webp';

  stars = new Group();
  for (let i = 0; i < 5; i++) {
    const c = new stars.Sprite(60 + i * 70, 120, 32, 32);
    c.collider = 'none';
    c.image = 'assets/star.webp';
  }
}

function update() {
  if (kb.pressing('left'))       player.x -= 3;
  else if (kb.pressing('right')) player.x += 3;

  for (let i = stars.length - 1; i >= 0; i--) {
    if (player.overlaps(stars[i])) stars[i].remove();
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'textures',
      title: "Textures: named pixel art",
      body: `sprite.texture = 'coin' picks art by NAME instead of by URL. moSHion ships a catalog of 105 pixel-art textures, so you can give a sprite a picture without finding, hosting, or spelling a file path.

94 are stills; 11 are animated sprite sheets that simply play when you assign the name (see below). The terrain, things, battle, numbers and candy groups are newer: ground to build levels from, flags and switches, swords and shields, the digits 0-9 for a score or a die, and candy.

The names, by group —

characters: player, playerBlue, playerPink, playerYellow, playerBeige, runnerJump, playerWalk, playerBlueWalk, playerPinkWalk, playerYellowWalk, playerBeigeWalk, runner

pickups: coin, coinSilver, coinBronze, star, heart, heartHalf, gem, gemGreen, gemYellow, gemOrange, key, keyGreen, keyBlue, keyOrange

blocks: crate, crateX, block, door, torch, bomb, mushroom, mushroomBrown, cactus, exitSign

creatures: slime, slimeBlue, bee, bat, ghost, fish, fishPink, bird, snail, ladybug, worm, frog, monster, batFly, beeFly, fishSwim, ladybugWalk, snailCrawl

terrain: grass, sand, snow, stone, brick, brickTan, water, waterDeep, lava, lavaDeep, ice, spikes, tree, bush, rock

things: flag, flagGreen, flagRed, flagBlue, sign, signArrow, lock, lockGreen, spring, lever, apple

battle: sword, swordGold, shield, shieldSilver, shieldGold, blaster, burst, burstGreen, burstOrange, burstBlue

numbers: num0, num1, num2, num3, num4, num5, num6, num7, num8, num9

candy: candyOrange, candyGreen, candyYellow, swirl, swirlMint

Call textureNames() to print the list from inside a sketch, and hasTexture('coin') to check one name. A name that does not exist warns in the console and suggests near matches rather than failing silently, so a typo tells you what it was.

Names ending in Walk, Fly, Swim or Crawl are animated sprite sheets, and so are runner (a 6-frame run cycle) and runnerJump. Assigning one plays it with no addAni call. To switch between standing and walking, set the name for what the player is doing, every frame if you like: player.texture = moving ? 'playerWalk' : 'player'. Setting the name it already shows changes nothing, so the walk keeps playing.

Reading sprite.texture gives back the texture itself. Its name is sprite.texture.name, so ask if (s.texture.name === 'coin'). An animated texture is controlled through the same name: sprite.texture.frameDelay is the speed (game frames per picture, lower is faster), sprite.texture.frame is the picture showing now, sprite.texture.loop = false plays it once and stops on the last picture (sprite.texture.loop = 3 plays it three times), and sprite.texture.frameCount says how many pictures it has. A sprite with no texture reads back null. An animation made with addAni() counts too: after addAni, sprite.texture is the animation showing, and sprite.texture = 'run' switches to the sprite's own animation called 'run', like changeAni('run'). Setting .texture clears .image and .ani, exactly the way those two already clear each other.

Setting the texture a sprite already shows does nothing, so door.texture = 'openDoor' inside update() keeps the animation playing instead of starting it over every frame. Setting a different name starts that one at its first picture. To play the same one again from the start, set sprite.texture.frame = 0. A group takes it too: coins.texture = 'coin' dresses every coin that exists and every one you spawn later.

Textures draw with smoothing turned off, so a 21x21 texture stretched across a 50x50 sprite stays blocky instead of blurring. A plain .image still smooths. Textures are square, so give the sprite a roughly square shape; a very tall or wide sprite stretches the picture.

In code, saveTexture('myGuy', dataUrl) stores a data: URL under a name, and from then on sprite.texture = 'myGuy' finds it. A saved name beats a built-in one, so saving 'coin' replaces the built-in coin. Pass { frames: 4 } as a third argument and the picture is read as a horizontal strip of 4 frames, which sprite.texture = 'myGuy' then plays without an addAni call. deleteTexture('myGuy') forgets it. Keep saved art small: the store holds 64 KB per value and 512 KB in total.

Most of the built-in art is Kenney's "Platformer Art: Pixel Redux" pack, released under CC0 — public domain, free for classroom and commercial use alike. runner and runnerJump are original to moSHion.`,
      code: `let player, coins;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  player = new Sprite(200, 300, 48, 48);
  player.collider = 'none';
  player.texture = 'playerWalk'; // an animated sprite sheet

  coins = new Group();
  coins.texture = 'coin';
  for (let i = 0; i < 5; i++) {
    const c = new coins.Sprite(60 + i * 70, 120, 32, 32);
    c.collider = 'none';
  }

  console.log('textures available:', textureNames().length);
}

function update() {
  if (kb.pressing('left'))       player.x -= 3;
  else if (kb.pressing('right')) player.x += 3;

  for (let i = coins.length - 1; i >= 0; i--) {
    if (player.overlaps(coins[i])) coins[i].remove();
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'patterns',
      title: "Patterns: ground that repeats",
      body: `A picture on a big sprite stretches. A floor 400 pixels wide made from one small tile picture comes out smeared. sprite.pattern repeats the picture at its real size instead, starting from the sprite's top-left corner, so the floor looks like many tiles side by side.

moSHion ships two 16 by 16 tiles for this: 'assets/ground_tile.png' and 'assets/grass_tile.png'. sprite.pattern also takes any other picture path, or a canvas you drew on yourself in code.

A group takes a pattern too: platforms.pattern = 'assets/grass_tile.png' covers every platform, each one repeating from its own top-left corner. If the picture fails to load, the sprite keeps its plain color instead of disappearing.

If a sprite has an .image, a .texture or an animation as well, that draws instead of the pattern. Use pattern for surfaces like floors and walls, and texture or image for characters and objects.`,
      code: `let ground, ledge;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;

  ground = new Sprite(200, 276, 400, 48, 'static');
  ground.pattern = 'assets/ground_tile.png';

  ledge = new Sprite(280, 170, 160, 16, 'static');
  ledge.pattern = 'assets/grass_tile.png';

  new Sprite(200, 20, 30, 30);
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'add-ani',
      title: "addAni and changeAni",
      body: `moSHion supports minimal sprite-sheet animation. sprite.addAni(name, sheetUrl, frameCount) loads a horizontal frame strip from an image URL and registers it under the given name. The first addAni call auto-activates that animation.

sprite.changeAni(name) switches to a previously registered animation. If the name isn't found, nothing changes, and the console says so once, listing the names the sprite does have — a misspelt name otherwise looks just like a frozen sprite.

frameDelay controls how many game frames each animation frame is held for (default 4). Set it on the animation addAni returns, or on sprite.texture.frameDelay: after addAni, sprite.texture is the animation showing, and sprite.texture = 'fly' switches to the sprite's own animation called 'fly', the same as changeAni('fly'). (sprite.ani is an older name for the same thing and still works.)

loop is true by default, so an animation repeats forever. Set sprite.texture.loop = false to play it once and stop on the last frame, like a door that opens and stays open. Set sprite.texture.loop to a number to play it that many times, so sprite.texture.loop = 3 plays three times and then stays on the last frame. Set sprite.texture.frame = 0 to play it again (the count starts over). To freeze an animation on the picture showing, call sprite.texture.pause(), and sprite.texture.play() carries on from there. sprite.texture.paused is true while it is frozen.

sprite.texture.frame is the frame showing, starting at 0. Set it to jump: sprite.texture.frame = 2 shows the third frame from the start of its time on screen, and -1 is the last frame. sprite.texture.tick is how many game frames the current frame has been showing; set it after frame to start part-way through a frame that lasts more than one (sprite.texture.frame = 1; sprite.texture.tick = 1; is the second game frame of frame 1).

Setting sprite.image clears any active animation, and vice versa — they're mutually exclusive.`,
      code: `let ghost;

function setup() {
  new Canvas(400, 400);

  ghost = new Sprite(200, 200, 80, 80);
  ghost.collider = 'none';

  // Two frame strips that ship with moSHion.
  // 'idle' is the first addAni, so it starts playing straight away.
  ghost.addAni('idle', 'assets/ghost_idle.avif', 7);
  const fly = ghost.addAni('fly', 'assets/ghost_fly.avif', 4);
  fly.frameDelay = 3; // flap a little faster than the default 4
}

function update() {
  // hold the right arrow (or D) to fly; let go to hover
  if (kb.pressing('right')) {
    ghost.x += 2;
    if (ghost.x > 440) ghost.x = -40; // wrap back to the left edge
    ghost.changeAni('fly');
  } else {
    ghost.changeAni('idle');
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'play-once',
      title: "Playing an animation once from a key press",
      body: `sprite.texture.loop = false makes an animation play through and stop on its last frame. Binding that to a key is the usual next step, and it has one trap: kb.presses(' ') is true on ONE frame only. If the next frame falls through to an else branch that puts the sprite back to its idle art, the animation is overwritten before it can play. The key press worked; the branch behind it reset the sprite.

Keep the pose until the animation has finished by remembering that it is playing: start it on the press and set a flag, leave the texture alone while that flag is set and only watch the frame, then clear the flag when the animation reaches its last frame. The next frame goes back to the idle art.

ghost.ani.frame is the picture showing (0 first) and ghost.ani.frameCount is how many there are, so the animation is finished when frame >= frameCount - 1.

To play it again, start it over from the first picture: for an animation made with addAni, set sprite.ani.frame = 0 (the same animation object is reused, so changeAni alone does not restart it). For a named texture, sprite.texture = 'swing' builds a fresh animation each time it switches back, so it restarts by itself; set sprite.texture.loop = false on the line after the assignment, because the new one starts out looping.

Neither version restarts an animation that is already showing: assigning the same art again, or calling changeAni with the name it is already playing, changes nothing. That is deliberate. Without it, a texture set every frame in update() would freeze on its first picture instead of animating.`,
      code: `let ghost;
let swinging = false;

function setup() {
  new Canvas(400, 200);

  ghost = new Sprite(200, 120, 80, 80);
  ghost.collider = 'none';

  ghost.addAni('idle', 'assets/ghost_idle.avif', 7);
  const swing = ghost.addAni('swing', 'assets/ghost_fly.avif', 4);
  swing.loop = false; // play it once, then hold the last picture
}

function update() {
  if (swinging) {
    // Leave the art alone until the swing has played through.
    if (ghost.ani.frame >= ghost.ani.frameCount - 1) swinging = false;
  } else if (kb.presses(' ')) {
    ghost.changeAni('swing');
    ghost.ani.frame = 0; // start it from the first picture
    swinging = true;
  } else {
    ghost.changeAni('idle');
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'procedural',
      title: "Procedural animation",
      body: `Not every animation needs a sprite sheet. The global frameCount increments every frame — combining it with Math.sin, Math.cos, and the modulo operator is enough for bobbing, spinning, pulsing, and color cycling.

Math.sin(frameCount / period) oscillates between -1 and 1. Multiply by an amplitude and add a baseline to shift it into the range you want.

Modulo (frameCount % n) cycles through integers 0..n-1 each n frames — great for flashing effects or phase changes.`,
      code: `let orb;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  orb = new Sprite(200, 200, 50);
  orb.collider = 'none';
}

function update() {
  orb.x = 200 + 120 * Math.cos(frameCount / 40);
  orb.y = 200 + 60 * Math.sin(frameCount / 20);
  orb.rotation = frameCount * 3;
  orb.scale.x = 1 + 0.25 * Math.sin(frameCount / 15);
  orb.scale.y = orb.scale.x;
  orb.color = (frameCount % 60 < 30) ? 'cyan' : 'magenta';
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'animation-objects',
      title: "Animation objects: Ani, StillTexture and Anis",
      body: `sprite.texture gives you back an object. For a texture that moves it is an Ani, and for a single picture it is a StillTexture. Both have a name, a frame, a frameCount, frameDelay and loop, so you can read them the same way. A still has frameCount 1 and nothing for it to animate.

sprite.texture.frameDelays is an optional list with one number per frame, saying how many game frames to hold that frame for. It is null when every frame lasts frameDelay frames.

sprite.texture.spriteSheet is the loaded picture the frames are cut from. Printing a texture shows its name (that is its toString), so text('using ' + sprite.texture) reads using coin. Anis is the type that holds Ani objects by name.`,
    },
  ],
};
