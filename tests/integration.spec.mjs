// Scenario: homepage integration — 3 new tabs (portal, ray-siege, web-swinger)
// land before asteroids, backed by fetch('games/<id>.js') at boot with a
// graceful fallback when a game file is missing. Exercises the REAL homepage
// (index.html) in the REAL browser — not sandbox.html, not runSketch().
// Pass condition: every check prints PASS; exit code 0 only if all pass.
import { launch, serve, captureErrors, frameErrors } from './harness.mjs';

const PORT = 8184;
const NEW_TABS = ['portal', 'ray-siege', 'web-swinger'];
const EXPECTED_IDS = ['portal', 'ray-siege', 'web-swinger', 'asteroids', 'platformer', 'runner'];
const LABELS = {
  portal: 'Portal', 'ray-siege': 'Ray Siege', 'web-swinger': 'Web Swinger',
  asteroids: 'Asteroids', platformer: 'Platformer', runner: 'Runner',
};
const PINNED_GLOBAL = { portal: 'portals', 'ray-siege': 'bricks', 'web-swinger': 'buildings' };

let ok = true;
function check(name, pass, detail) {
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + detail);
  if (!pass) ok = false;
}

function trunc(s, n = 90) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function waitForRunnerFrame(page, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const frame = page.frames().find((f) => f.url().includes('runner.html'));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  return null;
}

const srv = await serve(PORT);
const browser = await launch();

try {
  // ---- I1: tab inventory — 6 game tabs, DOM order, labels, the Code toggle in
  // the card footer at the bottom-right, flex-wrap ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(srv.base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const buttons = page.locator('.demo-tabs > button');
    const count = await buttons.count();
    check('I1: .demo-tabs has exactly 6 game buttons', count === 6, 'count=' + count);

    const ids = [];
    const texts = [];
    for (let i = 0; i < count; i++) {
      const b = buttons.nth(i);
      ids.push(await b.getAttribute('data-game'));
      texts.push(((await b.textContent()) || '').trim());
    }

    check('I1: data-game order is [portal, ray-siege, web-swinger, asteroids, platformer, runner]',
      JSON.stringify(ids) === JSON.stringify(EXPECTED_IDS), JSON.stringify(ids));

    const expectedLabels = EXPECTED_IDS.map((id) => LABELS[id]);
    check('I1: visible labels are Portal, Ray Siege, Web Swinger, Asteroids, Platformer, Runner',
      JSON.stringify(texts) === JSON.stringify(expectedLabels), JSON.stringify(texts));

    // The Code toggle switches the whole panel between the preview and the
    // editor, so it lives in the card's footer next to the caption rather than
    // as a seventh game tab.
    const toggle = await page.evaluate(() => {
      const t = document.getElementById('codeToggle');
      if (!t) return null;
      const card = document.querySelector('.demo-card');
      const shown = [...card.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      return {
        inTabs: !!t.closest('.demo-tabs'),
        inFooter: !!t.closest('.demo-footer'),
        text: (t.textContent || '').trim(),
        isLastShown: shown[shown.length - 1] === t,
        prevSibling: t.previousElementSibling ? t.previousElementSibling.id : null,
      };
    });
    check('I1: Code toggle sits in the card footer, not in the tab strip',
      !!toggle && toggle.inFooter && !toggle.inTabs, JSON.stringify(toggle));
    check('I1: Code toggle is the last shown button in the card, right after the caption',
      !!toggle && toggle.isLastShown && toggle.prevSibling === 'demoCaption', JSON.stringify(toggle));
    check('I1: Code toggle text is "Code"', !!toggle && toggle.text === 'Code',
      String(toggle && toggle.text));

    // Bottom-RIGHT, measured: its right edge lines up with the preview frame's
    // and it sits below the frame. A toggle left in the tab strip would satisfy
    // a DOM-only check while still rendering in the wrong corner.
    const corner = await page.evaluate(() => {
      const t = document.getElementById('codeToggle').getBoundingClientRect();
      const f = document.getElementById('previewView').getBoundingClientRect();
      return { offRight: +(f.right - t.right).toFixed(1), belowFrame: +(t.top - f.bottom).toFixed(1) };
    });
    check('I1: Code toggle renders at the panel\'s bottom-right corner',
      Math.abs(corner.offRight) <= 4 && corner.belowFrame > 0, JSON.stringify(corner));

    const flexWrap = await page.locator('.demo-tabs').evaluate((el) => getComputedStyle(el).flexWrap);
    check('I1: .demo-tabs computed flex-wrap is "wrap"', flexWrap === 'wrap', flexWrap);

    await page.screenshot({ path: 'tests/artifacts/integration-home.png', fullPage: true }).catch(() => {});
    await page.close();
  }

  // ---- I2: each NEW tab loads its runner frame, zero errors, pinned global, iframe src has code= ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = captureErrors(page);
    await page.goto(srv.base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(300);

    for (const id of NEW_TABS) {
      const errBefore = pageErrors.length;
      let clicked = false;
      try {
        await page.click(`.demo-tab[data-game="${id}"]`, { timeout: 3000 });
        clicked = true;
      } catch (e) {
        check(`I2 (${id}): tab is clickable`, false, 'not clickable -> ' + String(e.message).split('\n')[0]);
      }
      if (!clicked) {
        check(`I2 (${id}): runner.html frame present after click`, false, 'skipped — tab not clickable');
        check(`I2 (${id}): zero errors 3s after click`, false, 'skipped — tab not clickable');
        check(`I2 (${id}): pinned global window.${PINNED_GLOBAL[id]} exists`, false, 'skipped — tab not clickable');
        check(`I2 (${id}): iframe src contains "code="`, false, 'skipped — tab not clickable');
        continue;
      }

      const frame = await waitForRunnerFrame(page, 5000);
    check(`I2 (${id}): runner.html frame present after click`, !!frame, frame ? trunc(frame.url()) : 'not found');

      await page.waitForTimeout(3000);

      const fErrors = await frameErrors(page);
      const newPageErrors = pageErrors.slice(errBefore);
      check(`I2 (${id}): zero errors 3s after click (page+frame)`,
        newPageErrors.length === 0 && fErrors.length === 0,
        JSON.stringify({ pageErrors: newPageErrors, frameErrors: fErrors }));

      let globalOk = false;
      let globalDetail = 'frame missing';
      if (frame) {
        try {
          globalOk = await frame.evaluate((g) => window[g] !== undefined, PINNED_GLOBAL[id]);
          globalDetail = 'window.' + PINNED_GLOBAL[id] + ' !== undefined -> ' + globalOk;
        } catch (e) {
          globalDetail = 'eval failed -> ' + String(e.message).split('\n')[0];
        }
      }
      check(`I2 (${id}): pinned global window.${PINNED_GLOBAL[id]} exists`, globalOk, globalDetail);

      const iframeSrc = await page.locator('#preview').getAttribute('src').catch(() => null);
      check(`I2 (${id}): iframe src contains "code="`, !!iframeSrc && iframeSrc.includes('code='), trunc(String(iframeSrc)));
    }

    await page.close();
  }

  // ---- I3: regression — Asteroids still loads with zero errors ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = captureErrors(page);
    await page.goto(srv.base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(300);

    let clicked = false;
    try {
      await page.click('.demo-tab[data-game="asteroids"]', { timeout: 3000 });
      clicked = true;
    } catch (e) {
      check('I3: Asteroids tab is clickable', false, String(e.message).split('\n')[0]);
    }

    if (clicked) {
      const frame = await waitForRunnerFrame(page, 5000);
      check('I3: runner.html frame loads for Asteroids', !!frame, frame ? trunc(frame.url()) : 'not found');
      await page.waitForTimeout(1500);
      const fErrors = await frameErrors(page);
      check('I3: zero errors (regression)', pageErrors.length === 0 && fErrors.length === 0,
        JSON.stringify({ pageErrors, frameErrors: fErrors }));
    } else {
      check('I3: runner.html frame loads for Asteroids', false, 'skipped — tab not clickable');
      check('I3: zero errors (regression)', false, 'skipped — tab not clickable');
    }

    await page.close();
  }

  // ---- I4: fallback — portal.js fetch fails, tab disabled + caption message, asteroids unaffected ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = captureErrors(page);
    await page.route('**/games/portal.js', route => route.abort());
    await page.goto(srv.base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const portalTab = page.locator('.demo-tab[data-game="portal"]');
    const tabCount = await portalTab.count();
    check('I4: portal tab exists in DOM', tabCount > 0, 'count=' + tabCount);

    let disabledState = false;
    let disabledDetail = 'tab not found';
    if (tabCount > 0) {
      const isDisabled = await portalTab.first().isDisabled().catch(() => false);
      const ariaDisabled = await portalTab.first().getAttribute('aria-disabled').catch(() => null);
      disabledState = isDisabled || ariaDisabled === 'true';
      disabledDetail = `disabled=${isDisabled} aria-disabled=${ariaDisabled}`;
      await portalTab.first().click({ force: true, timeout: 2000 }).catch(() => {});
    }
    check('I4: portal tab is disabled or aria-disabled after fetch failure', disabledState, disabledDetail);

    await page.waitForTimeout(300);
    const captionText = ((await page.locator('#demoCaption').textContent().catch(() => '')) || '').trim();
    const messageShown = /unavailable|disabled|fail|could not|error|missing/i.test(captionText);
    check('I4: caption (or click) surfaces an unavailable message', messageShown, JSON.stringify(captionText));

    const errBeforeAsteroids = pageErrors.length;
    let asteroidsClicked = false;
    try {
      await page.click('.demo-tab[data-game="asteroids"]', { timeout: 3000 });
      asteroidsClicked = true;
    } catch (e) {
      check('I4: Asteroids tab still clickable', false, String(e.message).split('\n')[0]);
    }
    if (asteroidsClicked) {
      const frame = await waitForRunnerFrame(page, 5000);
      check('I4: Asteroids runner frame loads despite portal fallback', !!frame, frame ? trunc(frame.url()) : 'not found');
      await page.waitForTimeout(1500);
      const fErrors = await frameErrors(page);
      const newPageErrors = pageErrors.slice(errBeforeAsteroids);
      check('I4: Asteroids runs error-free', newPageErrors.length === 0 && fErrors.length === 0,
        JSON.stringify({ pageErrors: newPageErrors, frameErrors: fErrors }));
    } else {
      check('I4: Asteroids runner frame loads despite portal fallback', false, 'skipped — tab not clickable');
      check('I4: Asteroids runs error-free', false, 'skipped — tab not clickable');
    }

    await page.close();
  }
} catch (e) {
  console.log('FAIL  unexpected error during test run  -> ' + ((e && e.stack) || e));
  ok = false;
} finally {
  await browser.close().catch(() => {});
  srv.close();
}

process.exit(ok ? 0 : 1);
