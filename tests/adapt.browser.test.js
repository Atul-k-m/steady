/* Browser tests for the MVP 2 engine (adapt.js) and study metrics (metrics.js), against plan.md §4.
 * Needs Playwright with Chromium. Skips itself when Playwright isn't installed.
 *   node --test tests/                       (with playwright resolvable, e.g. npm i -D playwright)
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* skip below */ }

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

// A tremor profile that turns everything on: target 96 px, slip guard, ignore-repeat 600 ms, pick-then-place, list, stepper, confirm.
const HEAVY = { version: 1, device: 'Test hand', overrides: {}, settings: {}, explain: [], level: 4, model: 'test',
  features: { sigma: 18, slipP90: 10, repeatRate: 0.2, tremorRms: 3, dragFailRate: 0.3, trials: 14 } };
const SETUPS = {
  fixed: { condition: 'fixed', steadier: '0', profile: null },
  steadier: { condition: 'personal', steadier: '1', profile: null },
  heavy: { condition: 'personal', steadier: '0', profile: HEAVY },
};
const WANT_WEEK = { 'm-levo': 'Morning', 'm-vitd': 'Midday', 'm-calc': 'Evening', 'm-mela': 'Night' };

describe('MVP 2 engine in a real browser', { skip: chromium ? false : 'playwright is not installed' }, () => {
  let server, base, browser, ctx;

  before(async () => {
    server = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(buf);
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route((url) => url.hostname !== '127.0.0.1', (r) => r.abort()); // no web fonts: keeps layout deterministic
  });
  after(async () => { await browser?.close(); server?.close(); });

  async function open(flow, setup, { settle = 700 } = {}) {
    const page = await ctx.newPage();
    await page.goto(`${base}/index.html`);
    await page.evaluate((s) => {
      localStorage.clear();
      localStorage.setItem('steady.condition', s.condition);
      localStorage.setItem('steady.steadier', s.steadier);
      localStorage.setItem('steady.participant', 'PTEST');
      if (s.profile) localStorage.setItem('steady.profile.v1', JSON.stringify(s.profile));
    }, setup);
    await page.goto(`${base}/${flow}.html?v=1`);
    await page.locator(flow === 'book' ? '.steady-day' : '.steady-pickable').first().waitFor();
    if (settle) await page.waitForTimeout(settle);
    return page;
  }
  const settings = (page) => page.evaluate(() => window.__steadySettings);
  const events = (page) => page.evaluate(() => Steady.metrics.current().events.map((e) => e.outcome));
  const measure = (page, sel, inPanel) => page.evaluate(([sel, inPanel]) => {
    const scope = inPanel ? document.querySelector('steady-panel').shadowRoot : document;
    return [...scope.querySelectorAll(sel)].filter((el) => el.getClientRects().length).map((el) => {
      const r = el.getBoundingClientRect();
      return { name: (el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
    });
  }, [sel, inPanel]);
  const undersized = (boxes, target) => boxes.filter((b) => Math.min(b.w, b.h) < target);
  // Page-coordinate boxes of everything a user aims at, keyed so re-rendered controls still match.
  const layout = (page) => page.evaluate(() => {
    const out = {};
    let n = 0;
    document.querySelectorAll('[data-key], [data-task-step], .steady-step output, .med, .submit, h1').forEach((el) => {
      const k = el.dataset.key ? 'key:' + el.dataset.key : el.id || `${el.tagName}.${el.className}#${n++}`;
      const r = el.getBoundingClientRect();
      out[k] = [r.left + scrollX, r.top + scrollY, r.width, r.height].map(Math.round).join(',');
    });
    return out;
  });
  const wantDay = async (page) => page.locator(`.steady-day[aria-label="${await page.textContent('#want-date')}"]`);
  async function slipOff(page, label, dx) {
    const b = await page.locator('label.slot', { hasText: label }).boundingBox();
    await page.mouse.move(b.x + b.width - 4, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width - 4 + dx, b.y + b.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  async function confirmIfAsked(page) {
    const yes = page.locator('steady-panel').getByRole('button', { name: /^Yes,/ });
    if (await yes.isVisible()) { await page.waitForTimeout(700); await yes.click(); }
  }

  /* ---------- every STEADY control ≥ the profile's target size ---------- */
  for (const name of ['fixed', 'heavy']) {
    it(`pick-mode medicine chips are at least the target size (${name})`, async () => {
      const page = await open('week', SETUPS[name]);
      const { target } = await settings(page);
      assert.deepEqual(undersized(await measure(page, '.steady-pickable'), target), [], `target ${target}px`);
      await page.close();
    });
  }

  it('drop zones are at least the target size in pick mode', async () => {
    const page = await open('week', SETUPS.heavy);
    const { target } = await settings(page);
    const short = (await measure(page, '[data-steady-drop]')).filter((b) => b.h < target);
    assert.deepEqual(short, [], `target ${target}px`);
    await page.close();
  });

  it('panel buttons are at least the target size, collapsed and expanded', async () => {
    const page = await open('book', SETUPS.heavy);
    const { target } = await settings(page);
    const collapsed = await measure(page, 'button, a.btn', true);
    await page.locator('steady-panel').getByRole('button', { name: 'Settings' }).click();
    const expanded = await measure(page, 'button, a.btn', true);
    assert.ok(expanded.length > collapsed.length, 'expanding shows more controls');
    assert.deepEqual(undersized(expanded, target), [], `target ${target}px`);
    await page.close();
  });

  it('confirm buttons are at least the target size', async () => {
    const page = await open('book', SETUPS.heavy);
    const { target } = await settings(page);
    await (await wantDay(page)).click(); await page.waitForTimeout(700);
    await page.locator('label.slot', { hasText: '10:30' }).click(); await page.waitForTimeout(700);
    await page.locator('button.submit').click();
    await page.locator('steady-panel').getByRole('button', { name: /^Yes,/ }).waitFor();
    assert.deepEqual(undersized(await measure(page, '.confirm button', true), target), [], `target ${target}px`);
    await page.close();
  });

  /* ---------- keyboard: no invisible tab stops ---------- */
  it('Tab never lands on a hidden original control', async () => {
    const page = await open('book', SETUPS.steadier);
    const stops = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      stops.push(await page.evaluate(() => {
        let a = document.activeElement;
        while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
        if (!a || a === document.body) return null;
        const r = a.getBoundingClientRect();
        return { id: a.id || a.dataset.key || a.textContent.trim().slice(0, 20), invisible: r.width < 4 || r.height < 4 };
      }));
    }
    assert.deepEqual(stops.filter((s) => s && s.invisible), []);
    await page.close();
  });

  /* ---------- nothing moves under the hand ---------- */
  it('choosing a day or a reminder value moves nothing on the page', async () => {
    const page = await open('book', SETUPS.steadier);
    const start = await layout(page);
    const steps = [
      ['day', async () => (await wantDay(page)).click()],
      ['30 min', () => page.locator('.steady-presets button', { hasText: /^30 min$/ }).click()],
      ['120 min', () => page.locator('.steady-presets button', { hasText: /^120 min$/ }).click()],
      ['minus', () => page.getByRole('button', { name: /^Less/ }).click()],
    ];
    for (const [label, act] of steps) {
      await act(); await page.waitForTimeout(150);
      const now = await layout(page);
      const moved = Object.keys(start).filter((k) => now[k] !== start[k]).map((k) => `${k}: ${start[k]} -> ${now[k]}`);
      assert.deepEqual(moved, [], `after ${label}`);
    }
    await page.close();
  });

  it('picking a medicine moves nothing on the page', async () => {
    const page = await open('week', SETUPS.steadier);
    const start = await layout(page);
    await page.locator('#m-levo').click(); await page.waitForTimeout(150);
    const now = await layout(page);
    const moved = Object.keys(start).filter((k) => now[k] !== start[k]).map((k) => `${k}: ${start[k]} -> ${now[k]}`);
    assert.deepEqual(moved, []);
    await page.close();
  });

  /* ---------- metrics ---------- */
  it('a slip released into the gap is logged as a slip when the guard is off', async () => {
    const page = await open('book', SETUPS.fixed);
    const { gap } = await settings(page);
    await slipOff(page, '10:30', 4 + gap / 2);
    assert.equal(await page.evaluate(() => document.querySelector('#f').time.value), '', 'no guard, so nothing is chosen');
    assert.ok((await events(page)).includes('slip'), `events: ${await events(page)}`);
    await page.close();
  });

  it('a slip released into the gap is rescued and logged as rescued when the guard is on', async () => {
    const page = await open('book', SETUPS.heavy);
    const s = await settings(page);
    assert.equal(s.slipGuard, true);
    await slipOff(page, '10:30', 4 + s.gap / 2);
    assert.equal(await page.evaluate(() => document.querySelector('#f').time.value), '10:30');
    const ev = await events(page);
    assert.ok(ev.includes('slip_rescued') && !ev.includes('slip'), `events: ${ev}`);
    await page.close();
  });

  it('a release farther than one target is a slip, not a rescue, even with the guard on', async () => {
    const page = await open('book', SETUPS.heavy);
    const { target } = await settings(page);
    await slipOff(page, '10:30', Math.round(target * 1.5));
    assert.equal(await page.evaluate(() => document.querySelector('#f').time.value), '', 'guard lets a long move cancel');
    const ev = await events(page);
    assert.ok(ev.includes('slip') && !ev.includes('slip_rescued'), `events: ${ev}`);
    await page.close();
  });

  /* ---------- ignore-repeat ---------- */
  it('the first click after the page loads is not ignored', async () => {
    const page = await open('book', SETUPS.heavy, { settle: 0 });
    const t = await page.evaluate(() => Math.round(performance.now()));
    await (await wantDay(page)).click();
    assert.notEqual(await page.inputValue('#date'), '', `clicked at ${t} ms after load; events: ${await events(page)}`);
    await page.close();
  });

  /* ---------- regression: both flows, clicks only and keyboard only ---------- */
  for (const name of ['fixed', 'heavy']) {
    it(`book an appointment with clicks only (${name})`, async () => {
      const page = await open('book', SETUPS[name]);
      const pause = () => page.waitForTimeout(700); // longer than the ignore-repeat window
      await (await wantDay(page)).click(); await pause();
      await page.locator('label.slot', { hasText: '10:30' }).click(); await pause();
      await page.locator('.steady-presets button', { hasText: /^30 min$/ }).click(); await pause();
      await page.locator('button.submit').click(); await pause();
      await confirmIfAsked(page);
      await page.locator('#done.show').waitFor();
      const s = await page.evaluate(() => Steady.metrics.current());
      assert.equal(s.completed, true, JSON.stringify(s.meta.final));
      await page.close();
    });

    it(`plan the medicine week with clicks only (${name})`, async () => {
      const page = await open('week', SETUPS[name]);
      const pause = () => page.waitForTimeout(700);
      for (const [id, slot] of Object.entries(WANT_WEEK)) {
        await page.locator('#' + id).click(); await pause();
        await page.locator(`.slotbox[data-slot="${slot}"]`).click({ position: { x: 8, y: 8 } }); await pause();
      }
      await page.locator('button.submit').click(); await pause();
      await confirmIfAsked(page);
      await page.locator('#done.show').waitFor();
      assert.equal(await page.evaluate(() => Steady.metrics.current().completed), true);
      await page.close();
    });
  }

  it('both flows work with the keyboard only', async () => {
    let page = await open('book', SETUPS.steadier);
    await (await wantDay(page)).focus(); await page.keyboard.press('Enter');
    await page.locator('label.slot', { hasText: '10:30' }).locator('input').focus(); await page.keyboard.press('Space');
    await page.locator('.steady-presets button', { hasText: /^30 min$/ }).focus(); await page.keyboard.press('Enter');
    await page.locator('button.submit').focus(); await page.keyboard.press('Enter');
    await page.waitForTimeout(700); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await page.locator('#done.show').waitFor();
    assert.equal(await page.evaluate(() => Steady.metrics.current().completed), true, 'book');
    await page.close();

    page = await open('week', SETUPS.steadier);
    for (const [id, slot] of Object.entries(WANT_WEEK)) {
      await page.locator('#' + id).focus(); await page.keyboard.press('Enter');
      await page.locator(`.slotbox[data-slot="${slot}"]`).focus(); await page.keyboard.press('Enter');
    }
    await page.locator('button.submit').focus(); await page.keyboard.press('Enter');
    await page.waitForTimeout(700); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await page.locator('#done.show').waitFor();
    assert.equal(await page.evaluate(() => Steady.metrics.current().completed), true, 'week');
    await page.close();
  });
});
