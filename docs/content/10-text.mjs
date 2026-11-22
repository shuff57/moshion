// moSHion docs: Text & HUD. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#text/<id>); never rename one, add a new page instead.

export default {
  slug: 'text',
  title: "Text & HUD",
  pages: [
    {
      id: 'displaying-text',
      title: "Displaying text",
      body: `text(words, x, y)

Pass the text to display, then its canvas position. Call it from draw() so it gets re-drawn every frame — otherwise background() will erase it.

textSize(px) sets the font size in pixels. fill(color) sets the text color (yes, the same fill you use for shapes). textAlign('left' | 'center' | 'right') changes how x positions the string — 'left' puts x at the left edge, 'center' puts x at the middle.

You can also pass size and color directly to text(): text('hello', 10, 20, 18, 'gold'). The constants CENTER, LEFT, and RIGHT are available for textAlign.

For a different typeface, bold, italic, underlines, outlines and wrapped lines, see the next three pages: Fonts, Weight and style, and Lines, outlines and spacing.

You can build strings with + just like normal JavaScript: 'Score: ' + score.`,
      code: `let score = 0;

function setup() {
  new Canvas(400, 400);
}

function update() {
  if (kb.presses(' ')) {
    score++;
  }
}

function draw() {
  background('#112');

  fill('white');
  textSize(28);
  textAlign(CENTER);
  text('moSHion', 200, 80);

  fill('gold');
  textSize(18);
  textAlign(LEFT);
  text('Score: ' + score, 20, 140);

  fill('#888');
  textSize(12);
  text('press space to score', 20, 160);
}`,
    },
    {
      id: 'fonts',
      title: "Fonts: textFont()",
      body: `textFont('name') picks the typeface for the text() calls that follow. Like textSize(), it lasts until you change it.

The built-in fonts:
'sans' clean and plain
'serif' like a book
'code' code, every letter the same width
'rounded' soft round ends
'pixel' pixel art
'arcade' old arcade screens
'handwriting' written with a marker
'comic' comic book
'bubbly' round and bubbly
'space' sci-fi
'spooky' dripping horror
'slab' thick square feet
'blocky' big blocky signs
'script' joined-up handwriting
'tall' tall and narrow

textFont('monospace') goes back to the default font.

fontNames() gives you the list of every font you can use, as an array of names, including the fonts you saved yourself. The example prints the first few names with text().

A name it does not know prints "No font named ..." in the console once, and the text keeps the font it had. Check the spelling: font names are in quotes and are case-sensitive.

Fonts load while your sketch starts. The preview waits a moment for the fonts named in textFont('...'), so the first frame is right. A name built up from pieces (textFont('pix' + 'el')) works too, but can show the default font for a moment first.`,
      code: `function setup() {
  new Canvas(400, 300);
}

function draw() {
  background('#1b1d2a');
  fill('white');
  textSize(26);

  textFont('arcade');
  text('GAME OVER', 20, 50);

  textFont('handwriting');
  text('Nice try!', 20, 110);

  textFont('spooky');
  fill('limegreen');
  text('The swamp wins', 20, 170);

  textFont('rounded');
  fill('gold');
  text('Score: 120', 20, 230);

  textFont('sans');
  textSize(14);
  fill('white');
  let names = fontNames();
  for (let i = 0; i < 4; i++) {
    text('font ' + i + ': ' + names[i], 220, 40 + i * 24);
  }
}`,
    },
    {
      id: 'weight-style',
      title: "Weight and style: textWeight(), textStyle()",
      body: `textWeight(n) sets how thick the letters are, from 100 (thin) to 900 (heavy). 400 is normal and 700 is bold. A font that does not have the weight you ask for uses its nearest one: 'sans' goes all the way from 100 to 900, but 'arcade' only has one weight.

textStyle(BOLD) is weight 700, textStyle(ITALIC) slants the letters, textStyle(BOLDITALIC) does both, and textStyle(NORMAL) goes back to plain, upright, weight 400. Each textStyle() call replaces the last one, so textStyle(ITALIC) followed by textStyle(BOLD) is just bold. For both, use BOLDITALIC.

To get slanted AND a particular weight, call textStyle(ITALIC) first, then textWeight(): textWeight() only changes the weight.`,
      code: `function setup() {
  new Canvas(400, 400);
}

function draw() {
  background('#1b1d2a');
  fill('white');
  textFont('sans');
  textSize(22);

  textStyle(NORMAL);
  for (let i = 0; i < 5; i++) {
    let w = 100 + i * 200;
    textWeight(w);
    text('weight ' + w, 20, 40 + i * 34);
  }

  textStyle(ITALIC);
  textWeight(800);
  fill('orange');
  text('slanted and heavy', 20, 250);

  fill('white');
  textStyle(BOLD);
  text('bold', 20, 300);

  textStyle(BOLDITALIC);
  text('bold and slanted', 20, 340);
}`,
    },
    {
      id: 'lines-outlines',
      title: "Lines, outlines and spacing",
      body: `A '\\n' inside the words starts a new line: text('Line one\\nLine two', 20, 40).

textWrap(width) breaks long text onto new lines so it fits inside width pixels, between words (textWrap(width, WORD) says the same thing). textWrap(width, CHAR) may break in the middle of a word, which suits a name with no spaces. textWrap() turns wrapping off.

textAlign(RIGHT) lines the text up so x is its right edge (LEFT and CENTER are the other two). The last line of the example is lined up with RIGHT.

textLeading(px) is the distance from one line to the next. textLeading(null) goes back to the normal gap (1.25 times the text size).

textDecoration(UNDERLINE) draws a line under the text, textDecoration(STRIKETHROUGH) a line through it, textDecoration(UNDERLINE, STRIKETHROUGH) both, and textDecoration(NONE) neither. The line is the text's colour.

textOutline('black', 3) draws a 3-pixel outline around every letter, which makes words easy to read on a busy background. textOutline() turns it off.

textSpacing(px) puts extra pixels between the letters (a negative number squeezes them together). textSpacing(0) is normal.

All of these last until you change them, like textSize(), and they work with textAlign(), textLayer() and every font.`,
      code: `function setup() {
  new Canvas(400, 400);
}

function draw() {
  background('#3a6');
  textFont('bubbly');
  textSize(30);
  fill('white');
  textOutline('black', 4);
  textAlign(CENTER);
  text('LEVEL 2', 200, 50);
  textOutline();

  textAlign(LEFT);
  textFont('sans');
  textSize(16);
  fill('#112');
  textWrap(220, WORD);
  textLeading(22);
  text('Collect every coin before the timer runs out. Watch out for the bats!', 20, 100);
  textWrap(120, CHAR);
  text('Supercalifragilisticexpialidocious', 250, 100);
  textWrap();
  textLeading(null);

  textDecoration(UNDERLINE);
  text('Press SPACE to start', 20, 220);
  textDecoration(STRIKETHROUGH);
  text('Old price: 50 coins', 20, 250);
  textDecoration(NONE);

  textSpacing(6);
  text('S P A C E D', 20, 290);
  textSpacing(0);

  textAlign(RIGHT);
  text('Score 120', 380, 340);
  textAlign(LEFT);
}`,
    },
    {
      id: 'hud',
      title: "HUDs that don't scroll",
      body: `When you move camera.x to follow the player, everything drawn inside draw() scrolls with the world — including your score text. And there is a second, quieter problem: the engine draws every sprite AFTER draw(), so anything draw() paints lands underneath the sprites — a score in the top-left corner disappears behind whatever wall happens to be up there.

drawTop() is the answer to both. It runs after the sprites are on the canvas, with the camera off for its duration, so text('Score: ' + score, 10, 24) means 10 pixels from the canvas edge and lands on top of the world. Define it like any other hook — the engine calls it every frame if it exists, and a sketch without it runs exactly as before.

camera.off() around drawing inside draw() still works for positioning, and it is still the right tool when you want something under the sprites on purpose (a vignette, a floor grid). But a HUD wants drawTop().`,
      code: `let player;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Sprite(1000, 390, 2000, 20, 'static');
  player = new Sprite(200, 300, 30, 30);
  player.color = 'deepskyblue';
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -5;
  } else if (kb.pressing('right')) {
    player.vel.x = 5;
  }
  camera.x += (player.x - camera.x) * 0.1;
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(16);
  text('x: ' + Math.round(player.x), 10, 24);
}`,
    },
    {
      id: 'text-layer',
      title: "Text between sprites: textLayer()",
      body: `Text drawn in draw() goes under every sprite, and drawTop() puts it over all of them. To put words in between (a sign over the player but behind a tree), give the text a layer, the same way you give a sprite one.

textLayer(5) works like textSize(): every text() you write after it, in update() or draw(), goes on layer 5. It is painted over every sprite whose layer is 5 or lower, and under every sprite whose layer is higher. Change the number to move the text up or down. textLayer() with nothing in the brackets puts text back under every sprite.

It lasts until you change it, so text you write before textLayer() in the very first frame is the only text it misses. Text is not a sprite, so text.layer = 10 does nothing: write textLayer(10) instead. drawTop() is still the place for a score or a timer, because it goes over everything, whatever the layer.`,
      code: `let player, tree;

function setup() {
  new Canvas(400, 300);
  player = new Sprite(80, 150, 40, 40);
  player.color = 'deepskyblue';
  player.layer = 1;

  tree = new Sprite(260, 150, 70, 120);
  tree.collider = 'none';
  tree.color = 'forestgreen';
  tree.layer = 10;
}

function update() {
  player.vel.x = 0;
  if (kb.pressing('left')) {
    player.vel.x = -3;
  }
  if (kb.pressing('right')) {
    player.vel.x = 3;
  }
}

function draw() {
  background('#222');
  fill('white');
  textSize(24);
  textLayer(5); // over the player (layer 1), under the tree (layer 10)
  text('Welcome to the forest', 60, 160);
  textLayer();  // back to under every sprite
}`,
    },
    {
      id: 'labels',
      title: "Labels on sprites",
      body: `sprite.text puts a label directly on a sprite — a name tag, an HP counter, a damage number — without you tracking its x/y yourself. It's centered over the sprite and follows it automatically as the sprite moves, and it stays right-side-up even if the sprite rotates. Set it to null (the default) to remove the label.

sprite.textColor and sprite.textSize style it, same idea as fill()/textSize() for the global text() function but scoped to just this one sprite. It respects sprite.opacity too, so a fading sprite's label fades with it.

sprite.textStroke is the colour of an outline around the letters, and sprite.textStrokeWeight is how thick that outline is in pixels. An outline keeps a label easy to read on a busy colour.

This is a different tool from the global text() function above: text() is for one-off draws you position yourself (titles, HUDs); sprite.text is for a label that's tied to a specific sprite.`,
      code: `let enemy;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  enemy = new Sprite(200, 200, 50, 50);
  enemy.color = 'firebrick';
  enemy.text = 'HP 3';
  enemy.textColor = 'white';
  enemy.textSize = 14;
  enemy.textStroke = 'black';
  enemy.textStrokeWeight = 3;
}

function update() {
  if (kb.presses(' ')) {
    enemy.text = 'HP 2';
  }
}

function draw() {
  background('#222');
}`,
    },
  ],
};
