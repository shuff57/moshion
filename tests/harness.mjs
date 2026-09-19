// QA harness for moshion demo games.
// Serves the repo root over HTTP (the sandboxed runner iframe requires HTTP),
// runs a sketch in the real sandbox.html surface, and exposes input
// simulation + state inspection helpers for scenario assertions.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.d.ts': 'text/plain', '.md': 'text/plain',
};

export async function serve(port = 8177) {
  // maxHeaderSize: Node's default is 16KB, and the runner passes a sketch's
  // full source as base64url in the URL -- ray-siege.js plus its on-screen
  // touch controls base64-encodes to ~16.7KB, just over that default, so the
  // request line alone 431'd here while working fine on GitHub Pages (which
  // has no such header cap). Matching production, not an artificial ceiling.
  const srv = createServer({ maxHeaderSize: 1048576 }, (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    try {
      const data = readFileSync(join(ROOT, p));
      res.writeHead(200, {
        'content-type': MIME[extname(p)] || 'application/octet-stream',
        // The runner iframe is sandboxed without allow-same-origin, so its
        // requests carry origin `null` — cross-origin even for a file on this
        // very server. <img src> does not care, but fetch() does, and
        // Sound._load() uses fetch. Without this header every loadSound() in
        // a spec fails with 'Failed to fetch' while working fine in
        // production, where GitHub Pages serves access-control-allow-origin:*
        // (verified 2026-09-18). Matching it here keeps the harness honest.
        'access-control-allow-origin': '*',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((r) => srv.listen(port, r));
  return { base: `http://localhost:${port}`, close: () => srv.close() };
}

// runner.html refuses ?code= at top level, so sketches always run via
// sandbox.html's iframe exactly like a real user session.
export async function runSketch(page, base, code) {
  await page.goto(base + '/sandbox.html', { waitUntil: 'load' });
  await page.fill('#code', code);
  await page.click('#run');
  await page.waitForTimeout(700);
  const frame = page.frames().find((f) => f.url().includes('runner.html'));
  if (!frame) throw new Error('runner frame not found');
  return frame;
}

export function b64url(s) {
  return Buffer.from(s, 'utf8').toString('base64url');
}

// Input simulation: the engine listens on the runner frame's window/canvas;
// dispatching synthetic events inside the frame drives kb/mouse for real.
export async function keyDown(frame, keyName) {
  await frame.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  }, keyName);
}

export async function keyUp(frame, keyName) {
  await frame.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
  }, keyName);
}

// Click at game-world canvas coords (same space as Sprite x/y).
// runner.html scales the canvas down when the host frame is narrower than the
// sketch, so every helper converts game coords through the displayed scale
// (r.width / canvas.width) exactly the way the engine converts them back.
export async function mouseDown(frame, x, y, button = 'left') {
  await frame.evaluate(([cx, cy, b]) => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width ? r.width / canvas.width : 1;
    const sy = canvas.height ? r.height / canvas.height : 1;
    const opts = {
      clientX: r.left + cx * sx, clientY: r.top + cy * sy,
      button: b === 'right' ? 2 : 0, buttons: b === 'right' ? 2 : 1, bubbles: true,
    };
    canvas.dispatchEvent(new MouseEvent('mousedown', opts));
  }, [x, y, button]);
}

export async function mouseUp(frame, x, y, button = 'left') {
  await frame.evaluate(([cx, cy, b]) => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width ? r.width / canvas.width : 1;
    const sy = canvas.height ? r.height / canvas.height : 1;
    const opts = {
      clientX: r.left + cx * sx, clientY: r.top + cy * sy,
      button: b === 'right' ? 2 : 0, buttons: 0, bubbles: true,
    };
    canvas.dispatchEvent(new MouseEvent('mouseup', opts));
    canvas.dispatchEvent(new MouseEvent('mousemove', opts));
  }, [x, y, button]);
}

export async function mouseMove(frame, x, y) {
  await frame.evaluate(([cx, cy]) => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width ? r.width / canvas.width : 1;
    const sy = canvas.height ? r.height / canvas.height : 1;
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: r.left + cx * sx, clientY: r.top + cy * sy, bubbles: true,
    }));
  }, [x, y]);
}

// Error capture: runner pipes runtime errors to #error and console; page-level
// pageerror catches engine-load failures.
export function captureErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
  });
  return errors;
}

export async function frameErrors(page) {
  const out = [];
  for (const f of page.frames()) {
    try {
      const el = await f.$('#error');
      if (el) {
        const txt = (await el.textContent() || '').trim();
        if (txt) out.push('runner #error: ' + txt);
      }
    } catch { /* frame gone */ }
  }
  return out;
}

export async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium-browser' });
  }
}

export async function waitFrames(frame, n) {
  // Engine runs at ~60fps; wait n frames' worth of real time with slack.
  await frame.waitForTimeout(Math.ceil((n / 60) * 1000) + 150);
}