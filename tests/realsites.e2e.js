// Inject the unmodified Steady engine into real third-party pages and record what it does.
const fs = require('fs');
const path = require('path');
// Playwright: `npm i -D playwright` in this repo, or set PLAYWRIGHT_PATH to an existing install.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const APP = path.join(__dirname, '../app/js/');
const OUT = path.join(__dirname, '../test-results/real-');
fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
const hook = fs.readFileSync(APP + 'hook.js', 'utf8');
const core = fs.readFileSync(APP + 'core.js', 'utf8');
const adapt = fs.readFileSync(APP + 'adapt.js', 'utf8');
// A "moderate" example profile, so every swap is switched on.
const setup = `(function(){ try {
  const S = window.Steady; const p = S.buildProfile({ pointing: S.pointingFeatures(S.synthTrials({ sigma: 12, slip: 7, n: 30, seed: 5 })),
    tremor: { tremorRms: 2.6, tremorHz: 5 }, drag: { attempts: 3, failures: 1, ms: 2100 }, device: 'Real-site test' });
  S.saveProfile(p); S.setPref('condition', 'personal');
} catch (e) { window.__steadySetupError = String(e); } })();`;

const SITES = [
  'https://getbootstrap.com/docs/5.3/forms/range/',
  'https://www.w3schools.com/howto/howto_js_rangeslider.asp',
  'https://www.w3schools.com/html/html5_draganddrop.asp',
  'https://interactive-examples.mdn.mozilla.net/pages/tabbed/input-date.html',
  'https://interactive-examples.mdn.mozilla.net/pages/tabbed/input-range.html',
  'https://jqueryui.com/datepicker/',
];

(async () => {
  const browser = await chromium.launch();
  for (const url of SITES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(hook);
    await ctx.addInitScript(core + '\n' + setup + '\n' + adapt);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { if (/steady|Steady/.test(e.stack || e.message)) errs.push(e.message); });
    const r = { url };
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const frames = page.frames();
      let found = { date: 0, range: 0, draggable: 0, zonesHook: 0, zonesAttr: 0, days: 0, steppers: 0, pickables: 0 };
      for (const f of frames) {
        try {
          const c = await f.evaluate(() => ({
            date: document.querySelectorAll('input[type="date"]').length,
            range: document.querySelectorAll('input[type="range"]').length,
            draggable: document.querySelectorAll('[draggable="true"], .steady-pickable').length,
            zonesHook: document.querySelectorAll('[data-steady-drop]').length,
            zonesAttr: document.querySelectorAll('[ondrop]').length,
            days: document.querySelectorAll('.steady-day').length,
            steppers: document.querySelectorAll('.steady-step').length,
            pickables: document.querySelectorAll('.steady-pickable').length,
            custom: document.querySelectorAll('.ui-datepicker, .hasDatepicker, [role="slider"], [role="grid"]').length,
          }));
          for (const k of Object.keys(c)) found[k] = (found[k] || 0) + c[k];
        } catch (e) { /* cross-origin frame without access */ }
      }
      r.found = found;
      // Interaction checks in the first frame that has the control.
      for (const f of frames) {
        try {
          if (await f.locator('.steady-step [data-delta="1"]').count()) {
            const before = await f.evaluate(() => document.querySelector('input[type="range"]').value);
            await f.locator('.steady-step [data-delta="1"]').first().click();
            const after = await f.evaluate(() => document.querySelector('input[type="range"]').value);
            r.stepper = `${before} → ${after}`;
          }
          if (await f.locator('.steady-day:not([disabled])').count()) {
            await f.locator('.steady-day:not([disabled])').nth(2).click();
            r.date = await f.evaluate(() => document.querySelector('input[type="date"]').value || '(empty)');
          }
          if (await f.locator('.steady-pickable').count()) {
            await f.locator('.steady-pickable').first().click();
            await f.waitForTimeout(700);
            const zone = f.locator('[data-steady-zone]');
            r.zonesOffered = await zone.count();
            if (r.zonesOffered) { await zone.last().click({ position: { x: 8, y: 8 } }); r.dropped = 'clicked a zone'; }
          }
        } catch (e) { r.interactErr = e.message.split('\n')[0]; }
      }
      await page.screenshot({ path: OUT + new URL(url).hostname.replace(/\W/g, '_') + '_' + (new URL(url).pathname.split('/').filter(Boolean).pop() || 'home').replace(/\W/g, '_') + '.png' });
    } catch (e) { r.loadErr = e.message.split('\n')[0]; }
    r.steadyErrors = errs;
    console.log(JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();
