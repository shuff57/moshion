// Scenario: the docs are written in docs/content/ and built into
// docs/data/moshion-docs.js by scripts/build-docs.mjs (with an API reference
// generated from docs/moshion.d.ts). This checks the built file is current,
// the page rules hold, and the reference lists every name in the typings, so
// a feature cannot ship without at least its typings sentence in the docs.
// No browser: it runs in a second. Exit code 0 only if every check passes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './harness.mjs';
import { build, parseTypings, buildReference, shortDoc } from '../scripts/build-docs.mjs';

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

let failed = 0;
for (const [name, pass, detail] of results) {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : `  -> ${detail}`}`);
}
process.exit(failed ? 1 : 0);
