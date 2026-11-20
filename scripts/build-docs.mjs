// Builds the docs site's data file, docs/data/moshion-docs.js, from the readable
// sources in docs/content/ (one file per section) plus an API reference generated
// from docs/moshion.d.ts.
//
//   node scripts/build-docs.mjs          write docs/data/moshion-docs.js
//   node scripts/build-docs.mjs --check  exit 1 if it is out of date or a rule below fails
//
// docs/content/ is the ONE copy of the moSHion docs. shCode (the course app)
// copies the built file in with its `npm run sync:moshion` and adds its own
// pages on top, so a page is written once, here.
//
// Rules it enforces: every section has a unique slug and every page a unique id
// within its section (an id is a permanent address: never rename one); every
// page has a title and a body; a page that is not the reference names no other
// page by number ("page 4"), because numbers move when pages are added.
//
// The reference (last section) lists every name in docs/moshion.d.ts with the
// first sentences of its doc comment, one page per object, plus one page of old
// names (@deprecated) and what to use instead. It is generated, so it cannot
// drift from the typings: edit the comment in moshion.d.ts, not the output.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sections as authored } from '../docs/content/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/data/moshion-docs.js');
const DTS = join(ROOT, 'docs/moshion.d.ts');

// ---- the typings ----------------------------------------------------------

/** Parse moshion.d.ts into { blocks: [{name, kind, members}], globals: [] }.
 *  It is a small line parser written for this file's own shape (it has no
 *  dependencies, so the repo needs no npm install). Each entry: {name, kind:
 *  'prop'|'method'|'const'|'function'|'class', params: [string[]], doc, deprecated}. */
export function parseTypings(text) {
  const lines = text.split('\n');
  const blocks = [];
  const globals = [];
  let doc = null; // pending /** */ comment
  let block = null;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const t = line.trim();
    if (t.startsWith('/**')) {
      let c = t;
      while (!c.includes('*/') && i + 1 < lines.length) c += '\n' + lines[++i].trim();
      doc = readDoc(c);
      continue;
    }
    if (!t || t.startsWith('//') || t.startsWith('*')) { if (!t) doc = doc; continue; }
    if (depth === 0) {
      let m;
      if ((m = /^(?:declare\s+)?(class|interface)\s+([A-Za-z_$][\w$]*)/.exec(t))) {
        block = { name: m[2], kind: m[1], members: [], doc: doc?.text || '' };
        blocks.push(block);
      } else if ((m = /^declare\s+function\s+([A-Za-z_$][\w$]*)\s*(<[^>]*>)?\s*\(/.exec(t))) {
        let sig = t;
        while (!balanced(sig) && i + 1 < lines.length) sig += ' ' + lines[++i].trim();
        add(globals, { name: m[1], kind: 'function', params: [params(sig)], ...docFields(doc) });
      } else if ((m = /^declare\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(t))) {
        add(globals, { name: m[1], kind: 'const', params: [], ...docFields(doc) });
      }
      doc = null;
    } else if (depth === 1 && block) {
      const m = /^((?:readonly\s+|static\s+|get\s+|set\s+)*)([A-Za-z_$][\w$]*)\??\s*(<[^>]*>)?\s*([(:])/.exec(t);
      if (m && m[2] !== 'constructor') {
        // `get texture(): X` / `set texture(v)` declare a PROPERTY, whatever
        // the brackets look like: it is read and written as sprite.texture.
        const accessor = /\b(get|set)\s/.test(m[1]);
        const method = m[4] === '(' && !accessor;
        let sig = t;
        if (m[4] === '(') while (!balanced(sig) && i + 1 < lines.length) { sig += ' ' + lines[i + 1].trim(); i++; line = sig; }
        add(block.members, { name: m[2], kind: method ? 'method' : 'prop', params: method ? [params(sig)] : [], ...docFields(doc) });
      }
      doc = null;
    }
    for (const ch of strip(line)) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0) block = null;
  }
  return { blocks, globals };
}

const strip = (s) => s.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"/g, '');
function balanced(s) { let d = 0; for (const ch of strip(s)) { if (ch === '(') d++; else if (ch === ')') d--; } return d === 0; }
function params(sig) {
  const open = sig.indexOf('(');
  let d = 0, end = open;
  for (let k = open; k < sig.length; k++) { if (sig[k] === '(') d++; else if (sig[k] === ')') { d--; if (d === 0) { end = k; break; } } }
  const inner = sig.slice(open + 1, end);
  const out = [];
  let cur = '', bd = 0;
  for (const ch of inner) {
    if ('({[<'.includes(ch)) bd++;
    if (')}]>'.includes(ch)) bd--;
    if (ch === ',' && bd === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((p) => p.trim().replace(/\s*:.*$/s, '')).filter(Boolean);
}
function readDoc(c) {
  // Keep each line's indentation after the leading "*": it is what tells a
  // list item from a wrapped line.
  const lines = c.replace(/^\/\*\*/, '').replace(/\*\/$/, '').split('\n').map((l, i) => (i === 0 ? l : l.replace(/^\s*\*/, '')));
  const body = lines.join('\n');
  const dep = /@deprecated\s*([\s\S]*?)(?=\n\s*@|$)/.exec(body);
  const prose = [];
  for (const l of lines) { if (/^\s*@/.test(l)) break; prose.push(l); }
  // A list (like the collider kinds) is lines indented deeper than the
  // comment's own text that start with a quote or "- "; a deeper line that
  // does not is the item's own wrapped text. Items are joined with "; ", and
  // the first line back at the comment's indent starts a new sentence. A
  // line merely STARTING with a quote or a minus sign ('rounded', -1) at the
  // comment's indent is ordinary wrapped text.
  const indent = (l) => l.match(/^ */)[0].length;
  const rest = prose.slice(1).filter((l) => l.trim());
  const base = rest.length ? Math.min(...rest.map(indent)) : 0;
  let text = '';
  let inList = false;
  prose.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const deeper = i > 0 && indent(raw) > base;
    const item = deeper && /^(['"]|- )/.test(line);
    const clean = item ? line.replace(/^-\s+/, '') : line;
    if (!text) text = clean;
    else if (item) text += (inList ? '; ' : ' ') + clean;
    else if (deeper && inList) text += ' ' + clean; // the item's wrapped text
    else if (inList) text += (/[.!?]$/.test(text) ? ' ' : '. ') + clean;
    else text += ' ' + clean;
    if (item) inList = true;
    else if (!deeper) inList = false;
  });
  text = text.replace(/\s+/g, ' ').trim();
  return { text, deprecated: dep ? dep[1].replace(/\s+/g, ' ').trim() || 'Old name.' : null };
}
const docFields = (d) => ({ doc: d?.text || '', deprecated: d?.deprecated || null });
function add(list, e) {
  const prev = list.find((x) => x.name === e.name && x.kind === e.kind);
  if (!prev) { list.push(e); return; }
  if (e.params.length && !prev.params.some((p) => p.join() === e.params[0].join())) prev.params.push(e.params[0]);
  if (!prev.doc && e.doc) prev.doc = e.doc;
  if (!prev.deprecated && e.deprecated) prev.deprecated = e.deprecated;
}

/** The first sentences of a doc comment, about two lines' worth. */
export function shortDoc(s) {
  if (!s) return '';
  let out = '';
  for (const sentence of s.split(/(?<=[.!?])\s+/)) {
    if (out && (out + ' ' + sentence).length > 220) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  return out.trim();
}

// ---- the reference --------------------------------------------------------

// One page per object, in the order a student meets them. `as` is how the
// examples write it (a sprite is usually called sprite, a group group).
const PAGES = [
  { id: 'sprite', title: 'Sprite: every property and method', types: [['Sprite', 'sprite'], ['SpriteMouse', 'sprite.mouse'], ['Sensor', 'sensor']] },
  { id: 'group', title: 'Group: every property and method', types: [['Group', 'group'], ['Tiles', 'tiles'], ['Walls', 'walls']] },
  { id: 'world', title: 'world and camera', types: [['World', 'world'], ['RayHit', 'hit'], ['Camera', 'camera']] },
  { id: 'input', title: 'kb and mouse', types: [['Kb', 'kb'], ['Mouse', 'mouse']] },
  { id: 'art', title: 'Animations and textures', types: [['Ani', 'ani'], ['StillTexture', 'texture'], ['Anis', 'sprite.anis']] },
  { id: 'sound', title: 'Sound', types: [['Sound', 'sound'], ['SoundClips', 'clips']] },
  { id: 'joints', title: 'Joints', types: [['Joint', 'joint'], ['JointOptions', 'options'], ['HingeJoint', 'hinge'], ['DistanceJoint', 'joint'], ['SliderJoint', 'joint'], ['WheelJoint', 'joint'], ['GrabberJoint', 'grabber'], ['GlueJoint', 'glue']] },
  { id: 'helpers', title: 'Vectors, timers and the canvas', types: [['Vector', 'v'], ['Vec2', 'v'], ['FrameTimer', 'timer'], ['Canvas', 'canvas']] },
];

function entryLine(e, prefix) {
  const call = e.kind === 'method' || e.kind === 'function'
    ? e.params.map((p) => `${prefix}${e.name}(${p.join(', ')})`).join(' or ')
    : `${prefix}${e.name}`;
  return `${call}: ${shortDoc(e.doc) || 'No description yet.'}`;
}

export function buildReference(dtsText) {
  const { blocks, globals } = parseTypings(dtsText);
  const byName = new Map(blocks.map((b) => [b.name, b]));
  const placed = new Set();
  const old = [];
  const pages = [];
  for (const pg of PAGES) {
    const paras = [];
    for (const [type, as] of pg.types) {
      const b = byName.get(type);
      if (!b) continue;
      placed.add(type);
      const live = [];
      for (const m of b.members) {
        if (m.deprecated) { old.push(`${as}.${m.name}: ${m.deprecated}`); continue; }
        live.push(entryLine(m, `${as}.`));
      }
      if (!live.length) continue;
      paras.push(`${type}${b.doc ? `. ${shortDoc(b.doc)}` : ''}\n${live.sort(byLower).join('\n')}`);
    }
    pages.push({ id: pg.id, title: pg.title, body: paras.join('\n\n') });
  }
  const leftover = blocks.filter((b) => !placed.has(b.name) && b.members.length);
  if (leftover.length) throw new Error(`build-docs: types with no reference page (add them to PAGES): ${leftover.map((b) => b.name).join(', ')}`);

  const fns = [], consts = [];
  for (const g of globals) {
    if (g.deprecated) { old.push(`${g.name}: ${g.deprecated}`); continue; }
    (g.kind === 'function' ? fns : consts).push(entryLine(g, ''));
  }
  pages.unshift({
    id: 'functions',
    title: 'Every function you can call',
    body: `Every global function, A to Z. Each line gives the function's argument names and the first sentence of its description; the pages before this one show it working.\n\n${fns.sort(byLower).join('\n')}`,
  });
  pages.splice(1, 0, {
    id: 'constants',
    title: 'Constants and values',
    body: `Names that hold a value: constants such as DEGREES or WORD, and values the engine keeps up to date, such as frameCount, width and mouseX.\n\n${consts.sort(byLower).join('\n')}`,
  });
  pages.push({
    id: 'old-names',
    title: 'Old names and what to use instead',
    body: `These names still work, so an older program keeps running, but each has a newer or clearer name. Use the new one in anything you write.\n\n${old.sort(byLower).join('\n')}`,
  });
  return { slug: 'reference', title: 'API reference', pages };
}
const byLower = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

// ---- checks + output ------------------------------------------------------

// Reading input or moving sprites: what belongs in update(), never draw() (the
// lifecycle page teaches that split, so every example must model it).
export const GAME_LOGIC = /\bkb\.\w+\(|\bmouse\.(presses|pressing|released|pressed)\(|\.vel\.[xy]\s*[-+*]?=|\.vel\s*=/;

export function validate(sections) {
  const errs = [];
  const slugs = new Set();
  for (const s of sections) {
    if (!/^[a-z][a-z0-9-]*$/.test(s.slug || '')) errs.push(`section slug "${s.slug}" must be lower-case words joined by -`);
    if (slugs.has(s.slug)) errs.push(`two sections are called "${s.slug}"`);
    slugs.add(s.slug);
    const ids = new Set();
    for (const p of s.pages) {
      const where = `${s.slug}/${p.id}`;
      if (!/^[a-z][a-z0-9-]*$/.test(p.id || '')) errs.push(`${s.slug}: page "${p.title}" needs an id of lower-case words joined by -`);
      if (ids.has(p.id)) errs.push(`${where}: two pages share this id`);
      ids.add(p.id);
      if (!p.title || !p.body) errs.push(`${where}: a page needs a title and a body`);
      if (s.slug !== 'reference' && /\bpages? \d/i.test(p.body)) errs.push(`${where}: names another page by number; name it by its title instead`);
      const draw = p.code && /function draw\(\)\s*\{([\s\S]*?)\n\}/.exec(p.code);
      if (draw && GAME_LOGIC.test(draw[1])) errs.push(`${where}: the example reads keys or moves sprites in draw(); the rules of a game go in update()`);
    }
  }
  return errs;
}

export function build() {
  const reference = buildReference(readFileSync(DTS, 'utf8'));
  const sections = [...authored, reference];
  const errs = validate(sections);
  const plain = sections.map((s) => ({ slug: s.slug, title: s.title, pages: s.pages.map((p) => ({ id: p.id, title: p.title, body: p.body, ...(p.code ? { code: p.code } : {}) })) }));
  return { errs, text: `window.MOSHION_DOCS = ${JSON.stringify(plain, null, 1)};\n` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errs, text } = build();
  if (errs.length) { console.error(`build-docs: ${errs.length} problem(s):\n  ${errs.join('\n  ')}`); process.exit(1); }
  if (process.argv.includes('--check')) {
    const have = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (have !== text) { console.error('build-docs: docs/data/moshion-docs.js is out of date; run node scripts/build-docs.mjs'); process.exit(1); }
    console.log('build-docs: docs/data/moshion-docs.js is up to date');
  } else {
    writeFileSync(OUT, text);
    console.log(`build-docs: wrote docs/data/moshion-docs.js`);
  }
}
