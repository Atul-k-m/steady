// node tests/extension.e2e.js (needs Playwright + Chromium). Loads app/ as an unpacked MV3 extension and checks: hub works under extension CSP, profile never reaches
// a website's page, the website's storage is untouched, inline/property ondrop zones work, no-zone drags stay native.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const APP = process.env.APP_DIR || path.join(__dirname, '..', 'app');
const results = [];
const check = (name, ok, detail = '') => { results.push({ ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>Some website</title></head><body style="font:14px system-ui">
<p><label for="d">Date</label> <input type="date" id="d"></p>
<p><label for="r">Volume</label> <input type="range" id="r" min="0" max="10" value="5"></p>
<div id="z1" ondrop="drop(event)" ondragover="event.preventDefault()" style="width:240px;height:90px;border:1px solid #999;margin:8px 0">Zone 1 (inline ondrop)</div>
<div id="z2" style="width:240px;height:90px;border:1px solid #999;margin:8px 0">Zone 2 (el.ondrop = fn)</div>
<span id="item" draggable="true" ondragstart="event.dataTransfer.setData('text', event.target.id)" style="display:inline-block;padding:4px;border:1px solid">Item</span>
<script>
  function drop(ev) { ev.preventDefault(); ev.currentTarget.appendChild(document.getElementById(ev.dataTransfer.getData('text'))); }
  const z2 = document.getElementById('z2'); z2.ondragover = (e) => e.preventDefault(); z2.ondrop = drop;
</script></body></html>`;
const NOZONE = `<!doctype html><html><head><meta charset="utf-8"><title>No zones</title></head><body><div id="free" draggable="true">Drag me (no drop handler we can see)</div></body></html>`;

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steady-ext-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    headless: true, channel: 'chromium',
    args: [`--disable-extensions-except=${APP}`, `--load-extension=${APP}`],
  });
  const errors = [];
  try {
    await ctx.route('http://site.test/**', (route) => route.fulfill({ contentType: 'text/html', body: route.request().url().includes('nozone') ? NOZONE : FIXTURE }));
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
    const id = new URL(sw.url()).host;
    check('extension loads (service worker up)', !!id, id);
    const ext = (p) => `chrome-extension://${id}/${p}`;

    /* hub under the extension's CSP */
    const hub = await ctx.newPage();
    hub.on('console', (m) => { if (m.type() === 'error') errors.push('hub: ' + m.text()); });
    hub.on('pageerror', (e) => errors.push('hub: ' + e.message));
    await hub.goto(ext('index.html'));
    const pressed = await hub.locator('#cond button[aria-pressed="true"]').count();
    check('extension hub runs its script (no inline-script CSP block)', pressed === 1);

    /* calibrate inside the extension: skip, choose 96 px, turn pick-then-place on, save */
    await hub.goto(ext('calibrate.html'));
    await hub.getByLabel('Which device are you using?').fill('Laptop trackpad');
    await hub.getByRole('button', { name: 'Skip, use standard settings' }).click();
    await hub.locator('[data-size="96"]').click();
    if ((await hub.locator('[data-tech="dragMode"]').getAttribute('aria-pressed')) !== 'true') await hub.locator('[data-tech="dragMode"]').click();
    await hub.getByRole('button', { name: /^Save for/ }).click();
    const stored = await sw.evaluate(() => chrome.storage.local.get(null));
    check('profile saved to chrome.storage', !!stored['steady.profile.v1'] && !!stored['steady.profiles.v1']);

    /* a website */
    const site = await ctx.newPage();
    site.on('pageerror', (e) => errors.push('site: ' + e.message));
    await site.goto('http://site.test/page');
    await site.waitForFunction(() => document.documentElement.dataset.steadySettings && window.Steady && window.Steady.adapt, null, { timeout: 10000 });
    const ds = await site.evaluate(() => Object.assign({}, document.documentElement.dataset));
    const pushed = JSON.parse(ds.steadySettings);
    check('website gets settings (96 px, pick mode)', pushed.target === 96 && pushed.dragMode === 'pick', ds.steadySettings);
    check('website gets no profile or measurements', !('steadyProfile' in ds) && !/sigma|tremor|slip[PR]|features|device/i.test(JSON.stringify(ds)), Object.keys(ds).join(', '));
    check('day list applied on the website; slider follows the policy', await site.locator('.steady-day').count() === 14 && (await site.locator('.steady-step').count() === 1) === (pushed.sliderMode === 'stepper'), 'sliderMode ' + pushed.sliderMode);
    check('el.ondrop = fn zone is detected by the hook', await site.locator('#z2[data-steady-drop]').count() === 1);
    await site.locator('#item').click();
    await site.waitForTimeout(700);
    await site.locator('#z1').click();
    check('pick, then place into an inline ondrop="…" zone', await site.locator('#z1 #item').count() === 1);
    await site.waitForTimeout(700);
    await site.locator('#item').click();
    await site.waitForTimeout(700);
    await site.locator('#z2').click();
    check('pick, then place into a property ondrop zone', await site.locator('#z2 #item').count() === 1);

    /* Steadier today from the in-page panel */
    await site.waitForTimeout(700);
    await site.locator('steady-panel').evaluate((h) => h.shadowRoot.querySelector('[data-act="steadier"]').click());
    await site.waitForFunction(() => JSON.parse(document.documentElement.dataset.steadySettings).target === 120, null, { timeout: 5000 }).catch(() => {});
    const after = JSON.parse(await site.evaluate(() => document.documentElement.dataset.steadySettings));
    check('"Steadier today" from the page goes through the extension (96 → 120 px)', after.target === 120, `target ${after.target}`);
    const siteKeys = await site.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('steady')));
    check("nothing is written to the website's localStorage", siteKeys.length === 0, siteKeys.join(', '));
    const forged = await site.evaluate(async () => {
      document.dispatchEvent(new CustomEvent('steady:pref', { detail: JSON.stringify({ key: 'steady.condition', value: 'original' }) }));
      await new Promise((r) => setTimeout(r, 300));
      return document.documentElement.dataset.steadyCondition;
    });
    check('a website cannot switch Steady off through the pref event', forged === 'personal', forged);

    /* no zones we can see → native drag is left alone */
    const nz = await ctx.newPage();
    await nz.goto('http://site.test/nozone');
    await nz.waitForFunction(() => window.Steady && window.Steady.adapt && document.documentElement.dataset.steadySettings);
    await nz.waitForTimeout(300);
    check('no visible drop zones → native drag kept', (await nz.locator('#free').getAttribute('draggable')) === 'true' && !(await nz.locator('#free.steady-pickable').count()));

    check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  } catch (e) {
    check('script ran to the end', false, e.message.split('\n')[0]);
  } finally {
    await ctx.close();
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed.`);
    process.exitCode = failed ? 1 : 0;
  }
})();
