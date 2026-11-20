// Scenario: the docs are written in docs/content/ and built into
// docs/data/moshion-docs.js by scripts/build-docs.mjs (with an API reference
// generated from docs/moshion.d.ts). This checks the built file is current,
// the page rules hold, and the reference lists every name in the typings, so
// a feature cannot ship without at least its typings sentence in the docs.
// No browser: it runs in a second. Exit code 0 only if every check passes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './harness.mjs';
import { build, parseTypings, buildReference, shortDoc, validate, fnBody, deletesWhileLooping, shorthandIssues, namesWithoutExamples, proseShorthand } from '../scripts/build-docs.mjs';

const results = [];
function check(name, pass, detail = '') {
  results.push([name, pass, typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

const { errs, text } = build();
check('D1 every page follows the rules (ids, titles, no "page 4")', errs.length === 0, errs);
const have = readFileSync(join(ROOT, 'docs', 'data', 'moshion-docs.js'), 'utf8');
check('D2 docs/data/moshion-docs.js is built from the current sources (run node scripts/build-docs.mjs)', have === text);

const dts = readFileSync(join(ROOT, 'docs', 'moshion.d.ts'), 'utf8');
const { blocks, globals } = parseTypings(dts);
const ref = buildReference(dts);
const refText = ref.pages.map((p) => p.body).join('\n');
const missing = [];
for (const g of globals) if (!new RegExp(`(^|\\n)${g.name}[(:]`).test(refText)) missing.push(g.name);
for (const b of blocks) for (const m of b.members) if (!refText.includes(`.${m.name}`)) missing.push(`${b.name}.${m.name}`);
check('D3 the reference lists every name in moshion.d.ts', missing.length === 0, missing.slice(0, 20));
check('D4 the parser finds the main types', ['Sprite', 'Group', 'World', 'Kb', 'Mouse', 'Sound', 'Ani'].every((n) => blocks.some((b) => b.name === n)), blocks.map((b) => b.name));
check('D5 the parser reads functions and constants', globals.some((g) => g.name === 'createVector' && g.kind === 'function') && globals.some((g) => g.name === 'DEGREES' && g.kind === 'const'));
check('D6 old names land on the "Old names" page with their replacement', /kb\.pressed: .*presses/.test(ref.pages.find((p) => p.id === 'old-names').body));
check('D7 a description stops at a sentence, never inside ".rotation"', shortDoc('Degrees per frame, same turning direction as .rotation.') === 'Degrees per frame, same turning direction as .rotation.');

const props = ref.pages.map((p) => p.body).join('\n');
check('D8 a get/set accessor is listed as a property, never as a call (sprite.texture, ani.loop, group.scale)',
  ['sprite.texture:', 'ani.loop:', 'group.scale:'].every((s) => props.includes(s)) &&
  !/sprite\.texture\(|ani\.loop\(|group\.scale\(/.test(props));

// Exact lines, each once mangled by a comment's layout: a leading minus sign,
// a wrapped line that starts with a quote, an indented list, quoted words.
const line = (name) => { const l = props.split('\n').find((x) => x.startsWith(name + ': ') || x.startsWith(name + ' or ')) || ''; return l.slice(l.indexOf(': ') + 2); };
check('D9 sound.pan keeps its minus sign', line('sound.pan') === '-1 hard left, 0 centre, 1 hard right.', line('sound.pan'));
check('D10 textFont lists its fonts as one sentence, in words that fit any host (no "Library")', /^The typeface for text\(\): a built-in font \('sans', 'serif', 'code', 'rounded', 'pixel',/.test(line('textFont(name)')) && !/Library/.test(line('textFont(name)')), line('textFont(name)'));
check('D11 world.origin names both of its values and ends on a whole sentence',
  /'screen' \(the default/.test(line('world.origin')) && /'math'/.test(line('world.origin')) &&
  /\.$/.test(line('world.origin')) && !/,\./.test(line('world.origin')), line('world.origin'));
check('D12 camera.off() keeps the quoted words inside its sentence', /^Draw in screen space from here on — for HUDs and overlays\. In math mode "screen space" is still centred/.test(line('camera.off()')), line('camera.off()'));
check('D13 the collider kinds stay a list', /'dynamic' moves, falls, gets pushed \(the default\); 'static' never moves/.test(line('sprite.collider')), line('sprite.collider'));

// The example rules catch what they are for (a page that breaks one is refused).
const probe = (code) => validate([{ slug: 'x', title: 'X', pages: [{ id: 'p', title: 'P', body: 'b', code }] }]);
check('D14 an example that moves sprites but never clears the canvas is refused',
  probe('function setup() { new Canvas(400, 300); new Sprite(10, 10); }').some((e) => /never clears the canvas/.test(e)) &&
  probe('function setup() {\n  new Canvas(400, 300);\n  new Sprite(10, 10);\n}\nfunction draw() {\n  background(0);\n}').length === 0 &&
  probe('function setup() { new Canvas(400, 300); background(0); new Sprite(10, 10); }').some((e) => /never clears the canvas/.test(e)));
check('D15 deleting while looping over the group itself is refused; over a copy it is fine',
  probe('function update() {\n  for (const e of enemies) {\n    e.delete();\n  }\n}\nfunction draw() {\n  background(0);\n}').some((e) => /loop over a copy/.test(e)) &&
  probe('function update() {\n  for (const e of [...enemies]) {\n    e.delete();\n  }\n}\nfunction draw() {\n  background(0);\n}').length === 0);

// fnBody counts braces in code only: a brace in a string, a template or a
// comment does not end draw() early.
const tricky = "function draw() {\n  text('}', 10, 10); // }\n  text(\"{\", 1, 1); /* } */ text(`${'}'}`, 2, 2);\n  background(0);\n}\nfunction update() {}";
check('D16 fnBody is not fooled by braces in strings, templates or comments', /background\(0\)/.test(fnBody(tricky, 'draw')) && !/update/.test(fnBody(tricky, 'draw')),
  fnBody(tricky, 'draw'));

check('D17 the delete-in-loop rule sees a delete after a nested block, and a loop with no braces; a copy is fine',
  deletesWhileLooping('for (const e of enemies) {\n  if (e.hp > 0) {\n    e.hp--;\n  }\n  e.delete();\n}').join() === 'enemies' &&
  deletesWhileLooping('for (const d of drops) d.delete();').join() === 'drops' &&
  deletesWhileLooping('for (const d of [...drops]) d.delete();').length === 0);

// Proper notation: every body in { }, no a ? b : c, no one-line arrows. Words in a
// string or a comment are not code, and ?. and ?? are not the ? operator.
const sh = (code) => shorthandIssues(code).map((i) => i.replace(/^line \d+: /, ''));
check('D18 shorthand is refused: a body without { }, a one-line arrow, a ternary, a statement beside {',
  sh('if (a) b();').join() === 'if without { }' &&
  sh('for (let i = 0; i < 3; i++) n++;').join() === 'for without { }' &&
  sh('if (a) {\n  b();\n} else c();').join() === 'else without { }' &&
  sh('let f = (n) => n * 2;').join() === 'an arrow function without a { } body' &&
  sh('let x = a ? 1 : 2;').join() === 'a ? b : c; write it as if / else' &&
  sh('if (a) { b(); }').includes('statements on the same line as { ; put each on its own line'),
  sh('let x = a ? 1 : 2;'));
check('D19 proper code passes: braces, else if, do-while, ?. and ??, and shorthand inside strings or comments',
  sh('if (a) {\n  b();\n} else if (c) {\n  d();\n} else {\n  e();\n}\ndo {\n  n++;\n} while (n < 3);\nlet f = (n) => {\n  return n;\n};\nlet y = s?.x ?? 0;\ntext(\'a ? b : c\', 1, 1); // if (a) b();\nlet o = { x: 1 };').length === 0,
  sh('do {\n  n++;\n} while (n < 3);'));

// Every name in the typings needs a runnable example: used in code, not in a comment or string.
const names = (code, d) => namesWithoutExamples([{ slug: 'x', title: 'X', pages: [{ id: 'p', title: 'P', body: 'b', code }] }], d);
const tinyDts = 'declare function ellipse(x: number): void;\ndeclare function noLoop(): void;\ninterface Sprite {\n  /** Size. */\n  w: number;\n  /** @deprecated use w */\n  width2: number;\n}\ndeclare function start(): void;';
check('D20 a name is covered only by code, never by a comment or a string; deprecated names and the exempt ones are skipped',
  names("ellipse(1); // noLoop()\ntext('s.w', 1, 1);", tinyDts).sort().join() === 'Sprite.w,noLoop' &&
  names('ellipse(1);\nnoLoop();\nlet q = s.w;', tinyDts).length === 0,
  names("ellipse(1); // noLoop()\ntext('s.w', 1, 1);", tinyDts));

check('D21 shorthand hidden inside a template\'s ${ }, a second statement on a line, and do without { } are refused',
  sh('let s = `${a ? 1 : 2}`;').join() === 'a ? b : c; write it as if / else' &&
  sh('let t = `${xs.map((n) => n * 2)}`;').join() === 'an arrow function without a { } body' &&
  sh('let a = 1; let b = 2;').length === 1 &&
  sh('if (a) {\n  b(); }').length === 1 &&
  sh('do n++; while (n < 3);').includes('do without { }'),
  sh('let s = `${a ? 1 : 2}`;'));
check('D22 a regular expression is not code: /it\'s/ does not open a string, /=>/ is not an arrow, a / b / c still divides',
  sh("let r = /it's/;\nif (a) b();").join() === 'if without { }' &&
  sh('let r = /=>/;').length === 0 && sh('let q = a / b / c;').length === 0,
  sh("let r = /it's/;\nif (a) b();"));
check('D23 prose snippets are checked too; a braced one-liner in a sentence is fine',
  proseShorthand('call cull(0, s => s.y = 0) to wrap').length === 1 &&
  proseShorthand('pan is x < 0 ? -1 : 1 here').length === 1 &&
  proseShorthand('like if (hit) score++ every time').length === 1 &&
  proseShorthand('cull(0, (s) => { s.y = 0; }) and if (hit) { score++; }, or if (it is wet) you slip').length === 0,
  proseShorthand('cull(0, (s) => { s.y = 0; }) and if (hit) { score++; }, or if (it is wet) you slip'));
const kinds = 'declare class Ani {\n  /** a */\n  pause(): void;\n}\ndeclare class Sound {\n  /** b */\n  pause(): void;\n}\ndeclare function loadSound(u: string): Sound;';
check('D24 a name two kinds share needs an example on each kind: a texture\'s pause() is not a sound\'s',
  names("let s = loadSound('coin');\nlet t = player.texture;\nplayer.texture.pause();", kinds).join() === 'Sound.pause' &&
  names("let s = loadSound('coin');\nplayer.texture.pause();\ns.pause();", kinds).length === 0,
  names("let s = loadSound('coin');\nplayer.texture.pause();", kinds));

let failed = 0;
for (const [name, pass, detail] of results) {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : `  -> ${detail}`}`);
}
process.exit(failed ? 1 : 0);
