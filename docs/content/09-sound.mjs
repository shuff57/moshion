// moSHion docs: Sound. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#sound/<id>); never rename one, add a new page instead.

export default {
  slug: 'sound',
  title: "Sound",
  pages: [
    {
      id: 'sound',
      title: "Sound",
      body: `loadSound('file.mp3') gives you a Sound. Call .play() for a one-off effect and .loop() for music that should keep going.

The built-in sounds load by name, no path needed: loadSound('coin'). They are blip, clang, coin, crown, dice, door, explode, hit, jump, laser, levelup, lose, music, pop, potion, powerup, select, step, sword, title, tone, whoosh and win. A sound you save under one of those names plays instead of the built-in one.

.play() starts a fresh copy every time it's called, so firing a laser three times in three frames gives you three overlapping shots rather than one restarting over and over. .loop() is the opposite — it's the single track you start once and stop later, and calling it again while it's already going does nothing.

.volume runs 0 to 1. .pan runs -1 (hard left) to 1 (hard right), so a sound can come from where the thing is: enemy.x < player.x ? -0.6 : 0.6. .rate is playback speed, and because it shifts the pitch too it's the cheapest way to get variety out of one sound: coin.rate = 1 + Math.random() * 0.3 makes every pickup sound slightly different. masterVolume(0.5) halves everything at once without touching any individual .volume — that's your mute button.

.fade(to, seconds) ramps the volume instead of jumping it. music.fade(0, 2) is a two-second fade out, and it stops the sound when it lands so nothing keeps running silently.

If you have a lot of short effects, put them in one file and describe where each one lives: loadSound('sfx.mp3', { clips: { jump: [0, 0.25], hit: [0.5, 0.9] } }), then sfx.play('jump'). One download instead of a dozen. A clip name you haven't defined plays nothing, rather than blasting the whole file.

Two things that will confuse you the first time. Sound files have to download before they can play, so a .play() in the first moment of a sketch does nothing, and the console says so. Load them in preload() ("Getting files ready: preload()" in Start here) and they are ready by setup(). .loop() remembers: it starts as soon as the file arrives, so music.loop() in setup() works either way.

And browsers keep sound off until the player has clicked or pressed a key, even for a sound that is ready. moSHion turns sound on at the first click or key press by itself. Before that, .play() does nothing and the console says "sound turns on after the first click or key press", so play effects on an event (a key, a hit), and start music with .loop(), which waits for that first click.`,
      code: `let coin, music, player, coins;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 0;

  coin = loadSound('coin');
  music = loadSound('music');
  music.volume = 0.3;

  player = new Sprite(60, 150, 24, 24);
  player.color = 'deepskyblue';
  player.collider = 'none';

  coins = new Group();
  coins.diameter = 14;
  coins.color = 'gold';
  coins.collider = 'none';
  for (let i = 0; i < 4; i++) new coins.Sprite(140 + i * 60, 150);
}

function update() {
  player.moveTowards(mouse, 0.08);

  coins.overlaps(player, (c) => {
    coin.rate = 1 + Math.random() * 0.3;   // a slightly different chime each time
    coin.pan = (c.x - 200) / 200;          // and it comes from where the coin was
    coin.play();
    c.delete();
  });

  // safe to call every frame — loop() only ever starts one voice
  music.loop();

  // fade the music down as the coins run out
  if (coins.length === 1 && music.volume > 0.1) music.fade(0.05, 1.5);
}

function draw() {
  background('#111');
  fill('white');
  textSize(13);
  text('click to start the music, move to collect', 14, 24);
}`,
    },
    {
      id: 'sound-status',
      title: "Sound status: playing, loaded, duration",
      body: `A Sound you loaded can tell you how it is doing. sound.loaded is true once the file has downloaded and been decoded, and sound.duration is how long it is in seconds, which is 0 until then. sound.playing is true while it is making noise. sound.url is the name or address you loaded it with.

If something went wrong, sound.error holds a message and the sound stays silent. sound.blocked is true if the browser refused to start audio. That is rare, because the sketch unlocks sound by itself on the first click or key press.`,
    },
  ],
};
