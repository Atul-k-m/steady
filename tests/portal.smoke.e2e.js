// Smoke test for the mock enrolment portal (app/portal). Plain Node script, no test framework.
// Run:  PLAYWRIGHT_PATH=D:/mbapp/node_modules/playwright node tests/portal.smoke.e2e.js
// Serves app/ on PORTAL_PORT (default 8091). If nothing answers there it starts
// `python -m http.server 8091 -d app` itself and stops it at the end. PW_HEADLESS=false to watch.
// Prints PASS/FAIL lines and exits non-zero on any failure. Screenshots go to test-results/portal-*.png.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const PORT = Number(process.env.PORTAL_PORT || 8091);
const BASE = process.env.PORTAL_BASE || `http://localhost:${PORT}`;
const PORTAL = BASE + '/portal/index.html';
const APP_DIR = path.join(__dirname, '..', 'app');
const OUT = path.join(__dirname, '..', 'test-results');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable(u) {
  try { const r = await fetch(u); return r.ok; } catch { return false; }
}
async function ensureServer() {
  if (await reachable(PORTAL)) return null;
  const child = spawn(process.env.PYTHON || 'python', ['-m', 'http.server', String(PORT), '-d', APP_DIR], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (await reachable(PORTAL)) return child;
  }
  child.kill();
  throw new Error('could not start a static server on port ' + PORT);
}

// Launch Chromium. If this Playwright's own browser build is not installed, fall back to installed Chrome,
// then to the newest Chromium under ms-playwright (or PW_EXECUTABLE if set).
function installedChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  try {
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      for (const sub of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(root, d, sub);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch { /* no ms-playwright folder */ }
  return null;
}
async function launch() {
  const headless = process.env.PW_HEADLESS !== 'false';
  if (process.env.PW_EXECUTABLE) return chromium.launch({ headless, executablePath: process.env.PW_EXECUTABLE });
  try { return await chromium.launch({ headless }); } catch (e) { if (!/Executable doesn't exist/i.test(String(e))) throw e; }
  try { return await chromium.launch({ headless, channel: 'chrome' }); } catch { /* no installed Chrome */ }
  const exe = installedChromium();
  if (!exe) throw new Error('no Chromium found: run `npx playwright install chromium` or set PW_EXECUTABLE');
  return chromium.launch({ headless, executablePath: exe });
}

/* ---------- page helpers ---------- */
const T = 12000; // longest simulated server wait is 3 s; leave room
async function waitStep(page, name) {
  await page.waitForFunction((n) => document.body.dataset.step === n, name, { timeout: T });
}
async function waitIdle(page) {
  await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: T });
}
async function errorText(page) {
  await page.locator('#error-msg').waitFor({ state: 'visible', timeout: T });
  return (await page.locator('#error-msg').textContent()).trim();
}
async function invariant(page, expected) {
  const s = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('section.pstep')].filter((el) => !el.hidden);
    const banner = document.getElementById('mock-banner');
    const r = banner.getBoundingClientRect();
    return {
      count: vis.length,
      visible: vis[0] ? vis[0].dataset.step : null,
      body: document.body.dataset.step,
      banner: r.height > 0 && r.top >= 0 && r.top < 5,
      errHidden: document.getElementById('error-msg').hidden
    };
  });
  const ok = s.count === 1 && s.visible === expected && s.body === expected && s.banner && s.errHidden;
  check(`step "${expected}": one visible section, body[data-step] matches, banner on top, no stale error`, ok, ok ? '' : JSON.stringify(s));
}
const hook = (page, fn) => page.evaluate((f) => window.__portalTest[f](), fn);

async function login(page, mobile = '9876543210') {
  await page.fill('#mobile', mobile);
  await page.fill('#captcha-input', await hook(page, 'captcha'));
  await page.click('#btn-get-otp');
  await waitStep(page, 'otp');
  await page.fill('#otp-input', await hook(page, 'otp'));
  await page.click('#btn-verify-otp');
  await waitStep(page, 'search');
}
async function fillSearch(page, aadhaar, scheme = '#scheme-senior') {
  await page.check(scheme);
  await page.fill('#aadhaar-input', aadhaar);
  await page.fill('#captcha2-input', await hook(page, 'captcha2'));
}
async function throughEkyc(page) {
  await page.click('#btn-proceed-ekyc');
  await waitStep(page, 'ekyc');
  await page.check('#consent-check');
  await page.click('#btn-send-aadhaar-otp');
  await waitStep(page, 'ekyc-otp');
  await page.fill('#aotp-input', await hook(page, 'aotp'));
  await page.click('#btn-verify-aotp');
  await waitStep(page, 'details');
}
// Script-driven select: set value, then dispatch a bubbling change event (how the agent drives it).
async function scriptSelect(page, id, value) {
  await page.evaluate(([i, v]) => {
    const el = document.getElementById(i);
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, value]);
}
async function fillDetails(page) {
  await scriptSelect(page, 'd-state', 'Karnataka');
  await scriptSelect(page, 'd-district', 'Mysuru');
  await scriptSelect(page, 'd-ward', 'Ward 3');
  await page.fill('#d-address', '14, 2nd Cross, Saraswathipuram');
}

(async () => {
  let server = null, browser = null;
  const consoleErrors = [], external = new Set();
  try {
    server = await ensureServer();
    browser = await launch();
    const newPage = async (query) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      ctx.on('request', (r) => {
        const u = new URL(r.url());
        if (!['localhost', '127.0.0.1'].includes(u.hostname) && !['data:', 'blob:'].includes(u.protocol)) external.add(u.href);
      });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${query}: ${m.text()}`); });
      page.on('pageerror', (e) => consoleErrors.push(`${query}: ${e.message}`));
      await page.goto(PORTAL + query);
      return page;
    };

    /* ===== (1) happy path, every step to done ===== */
    {
      const page = await newPage('?test=1&chaos=0&fixedotp=1');
      await invariant(page, 'login');
      const header = (await page.locator('header h1').textContent()).trim();
      check('header reads the practice-copy title', header === 'Senior Health Cover · Beneficiary Portal (practice copy)', header);
      check('#mock-banner text', (await page.locator('#mock-banner').textContent()).trim() === 'Practice copy for testing. Not a government website. Nothing you type leaves this computer.');
      check('no "Ayushman" anywhere on the page', !/ayushman/i.test(await page.content()));
      const leak = await page.evaluate(() => {
        const ans = window.__portalTest.captcha();
        const src = decodeURIComponent(document.getElementById('captcha-img').src);
        const attrs = [...document.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.name + '=' + a.value)).join('\n');
        return { ans, svg: src.startsWith('data:image/svg+xml'), text: /<text/i.test(src), inSrc: src.includes(ans), inDom: document.documentElement.outerHTML.includes(ans) || attrs.includes(ans) };
      });
      check('captcha is an SVG data URL with 6 chars and no <text> element', leak.svg && !leak.text && /^[A-HJ-NP-Z2-9]{6}$/.test(leak.ans), leak.ans);
      check('captcha answer is not in the DOM or any attribute', !leak.inSrc && !leak.inDom);
      await page.screenshot({ path: path.join(OUT, 'portal-login.png'), fullPage: true });

      await page.fill('#mobile', '9876543210');
      await page.fill('#captcha-input', (await hook(page, 'captcha')).toLowerCase()); // case-insensitive
      await page.click('#btn-get-otp');
      check('Get OTP shows #loading during the simulated server wait', await page.locator('#loading').isVisible());
      await waitStep(page, 'otp');
      await invariant(page, 'otp');
      check('lower-case captcha accepted', true);
      check('#otp-sent-to masks the mobile', (await page.locator('#otp-sent-to').textContent()).trim() === 'OTP sent to XXXXXX3210');
      const sms1 = (await page.locator('#demo-sms').textContent()).trim();
      check('#demo-sms shows the login OTP text', sms1 === 'SMS to +91 XXXXXX3210: 123456 is your OTP for Senior Health Cover login.', sms1);
      check('fixedotp=1 gives 123456', (await hook(page, 'otp')) === '123456');
      check('#otp-timer counts down from 2 minutes', /^Time remaining: 0[12]:\d\d$/.test((await page.locator('#otp-timer').textContent()).trim()));
      await page.fill('#otp-input', '000000');
      await page.click('#btn-verify-otp');
      check('wrong OTP is rejected', (await errorText(page)) === 'Invalid OTP. Please try again.');
      await page.fill('#otp-input', '123456');
      await page.click('#btn-verify-otp');
      await waitStep(page, 'search');
      await invariant(page, 'search');

      await fillSearch(page, '234567891234');
      await page.click('#btn-search');
      await page.locator('#search-result').waitFor({ state: 'visible', timeout: T });
      const sr = await page.locator('#search-result').textContent();
      check('search result shows masked name and age 74', sr.includes('R***** K****') && /\b74\b/.test(sr));
      check('test hook step() reports the step', (await hook(page, 'step')) === 'search');

      await page.click('#btn-proceed-ekyc');
      await waitStep(page, 'ekyc');
      await invariant(page, 'ekyc');
      await page.click('#btn-send-aadhaar-otp');
      check('e-KYC without consent is refused', (await errorText(page)) === 'Please accept the consent to proceed.');
      await page.check('#consent-check');
      await page.click('#btn-send-aadhaar-otp');
      await waitStep(page, 'ekyc-otp');
      await invariant(page, 'ekyc-otp');
      check('#aotp-sent-to masks the Aadhaar-linked phone', (await page.locator('#aotp-sent-to').textContent()).trim() === 'OTP sent to Aadhaar-linked mobile XXXXXX4321');
      const sms2 = (await page.locator('#demo-sms').textContent()).trim();
      check('#demo-sms shows the Aadhaar OTP text', sms2 === 'SMS to phone ending 4321: 123456 is your Aadhaar OTP.', sms2);
      await page.fill('#aotp-input', await hook(page, 'aotp'));
      await page.click('#btn-verify-aotp');
      await waitStep(page, 'details');
      await invariant(page, 'details');

      const ro = await page.evaluate(() => ['d-name', 'd-dob', 'd-gender'].map((id) => document.getElementById(id).textContent.trim()));
      check('read-only details are Ramesh Kumar / 12-03-1951 / Male', ro.join('|') === 'Ramesh Kumar|12-03-1951|Male', ro.join('|'));
      check('#d-mobile is prefilled with the login mobile', (await page.inputValue('#d-mobile')) === '9876543210');
      check('#d-district starts disabled', await page.locator('#d-district').isDisabled());
      await page.click('#btn-save-details');
      check('save without state asks for State', (await errorText(page)) === 'Please select State.');

      /* (6) script-dispatched change populates the district, then the ward */
      await scriptSelect(page, 'd-state', 'Karnataka');
      const dist = await page.evaluate(() => {
        const el = document.getElementById('d-district');
        return { disabled: el.disabled, opts: [...el.options].map((o) => o.value) };
      });
      check('(6) state change event fills #d-district', !dist.disabled && dist.opts.join('|') === '|Bengaluru Urban|Mysuru|Belagavi', dist.opts.join('|'));
      await scriptSelect(page, 'd-district', 'Mysuru');
      const wards = await page.evaluate(() => [...document.getElementById('d-ward').options].map((o) => o.value));
      check('district change event fills #d-ward with Ward 1..8', wards.length === 9 && wards[1] === 'Ward 1' && wards[8] === 'Ward 8');
      await page.click('#btn-save-details');
      check('save without ward asks for Ward/Village', (await errorText(page)) === 'Please select Ward/Village.');
      await fillDetails(page);
      await page.screenshot({ path: path.join(OUT, 'portal-details.png'), fullPage: true });
      await page.click('#btn-save-details');
      await waitStep(page, 'photo');
      await invariant(page, 'photo');

      await page.click('#btn-upload-photo');
      check('upload without a photo is refused', (await errorText(page)) === 'Please choose a photo.');
      await page.click('#btn-sample-photo');
      check('sample photo shows in #photo-preview', await page.evaluate(() => {
        const img = document.getElementById('photo-preview');
        return !img.hidden && img.src.startsWith('data:image/svg+xml');
      }));
      await page.click('#btn-upload-photo');
      await waitStep(page, 'review');
      await invariant(page, 'review');

      const summary = await page.locator('#review-summary').textContent();
      check('review shows the Aadhaar masked, never in full', summary.includes('XXXX XXXX 1234') && !summary.includes('234567891234'));
      check('review lists state, district, ward and address', ['Karnataka', 'Mysuru', 'Ward 3', 'Saraswathipuram', '9876543210', 'Ramesh Kumar'].every((s) => summary.includes(s)));
      await page.click('#btn-submit');
      check('submit without declaration is refused', (await errorText(page)) === 'Please accept the declaration.');
      await page.check('#declare-check');
      await page.click('#btn-submit');
      await waitStep(page, 'done');
      await invariant(page, 'done');
      const ref = (await page.locator('#ref-no').textContent()).trim();
      check('(1) happy path reaches done with #ref-no SHC-2026-######', /^SHC-2026-\d{6}$/.test(ref), ref);
      check('done shows "Pending approval"', (await page.locator('#step-done').textContent()).includes('Pending approval'));
      await page.click('#btn-new');
      await waitStep(page, 'login');
      check('"Start new application" returns to an empty login', (await page.inputValue('#mobile')) === '' && (await page.locator('#demo-sms').isHidden()));
      await page.context().close();
    }

    /* ===== (2) wrong captcha, invalid mobile, OTP resend ===== */
    {
      const page = await newPage('?test=1&chaos=0');
      await page.fill('#mobile', '12345');
      await page.fill('#captcha-input', await hook(page, 'captcha'));
      await page.click('#btn-get-otp');
      check('short mobile number is refused', (await errorText(page)) === 'Please enter a valid 10-digit mobile number.');
      await page.fill('#mobile', '9876543210');
      const before = { src: await page.getAttribute('#captcha-img', 'src'), ans: await hook(page, 'captcha') };
      await page.fill('#captcha-input', before.ans === 'ZZZZZZ' ? 'YYYYYY' : 'ZZZZZZ');
      await page.click('#btn-get-otp');
      const msg = await errorText(page);
      const after = { src: await page.getAttribute('#captcha-img', 'src'), ans: await hook(page, 'captcha') };
      check('(2) wrong captcha shows "Invalid Captcha. Please try again."', msg === 'Invalid Captcha. Please try again.', msg);
      check('(2) wrong captcha changes the captcha image', before.src !== after.src && before.ans !== after.ans);
      check('wrong captcha clears the captcha box and stays on login', (await page.inputValue('#captcha-input')) === '' && (await hook(page, 'step')) === 'login');
      const s3 = await page.getAttribute('#captcha-img', 'src');
      await page.click('#captcha-refresh');
      check('Refresh link draws a new captcha', (await page.getAttribute('#captcha-img', 'src')) !== s3 && page.url().indexOf('#') === -1);

      await page.fill('#captcha-input', await hook(page, 'captcha'));
      await page.click('#btn-get-otp');
      await waitStep(page, 'otp');
      const otp1 = await hook(page, 'otp');
      await page.click('#otp-resend');
      await waitIdle(page);
      const otp2 = await hook(page, 'otp');
      check('Resend OTP issues a new code and a new SMS', otp1 !== otp2 && (await page.locator('#demo-sms').textContent()).includes(otp2));
      await page.fill('#otp-input', otp1);
      await page.click('#btn-verify-otp');
      check('the old OTP is rejected after a resend', (await errorText(page)) === 'Invalid OTP. Please try again.');
      await page.context().close();
    }

    /* ===== (3) search errors ===== */
    {
      const page = await newPage('?test=1&chaos=0&fixedotp=1');
      await login(page);
      await page.click('#btn-search');
      check('search without scheme asks for a scheme', (await errorText(page)) === 'Please select a scheme.');
      await page.check('#scheme-senior');
      await page.fill('#aadhaar-input', '12345');
      await page.click('#btn-search');
      check('short Aadhaar is refused', (await errorText(page)) === 'Please enter a valid 12-digit Aadhaar number.');
      await fillSearch(page, '234567891234');
      await page.fill('#captcha2-input', 'zzzzzz' === (await hook(page, 'captcha2')).toLowerCase() ? 'yyyyyy' : 'zzzzzz');
      const c2 = await page.getAttribute('#captcha2-img', 'src');
      await page.click('#btn-search');
      check('wrong search captcha is refused and redrawn', (await errorText(page)) === 'Invalid Captcha. Please try again.' && (await page.getAttribute('#captcha2-img', 'src')) !== c2);
      await fillSearch(page, '999912345678');
      await page.click('#btn-search');
      const m = await errorText(page);
      check('(3) Aadhaar 9999... shows "No beneficiary found in the given search."', m === 'No beneficiary found in the given search.', m);
      check('no result table after a failed search', await page.locator('#search-result').isHidden());
      await fillSearch(page, '234567891234', '#scheme-pmjay');
      await page.click('#btn-search');
      check('PM-JAY choice explains the 70+ card', (await errorText(page)) === 'No PM-JAY record found. If you are 70 or older, choose Senior citizen 70+ card.');
      await page.context().close();
    }

    /* ===== (4) chaos=2: first search and first upload fail, retries succeed ===== */
    {
      const page = await newPage('?test=1&chaos=2&fixedotp=1');
      await login(page);
      await fillSearch(page, '234567891234');
      await page.click('#btn-search');
      const m = await errorText(page);
      check('(4) chaos=2 first search fails with "Server not responding. Please try again later."', m === 'Server not responding. Please try again later.', m);
      await page.fill('#captcha2-input', await hook(page, 'captcha2'));
      await page.click('#btn-search');
      await page.locator('#search-result').waitFor({ state: 'visible', timeout: T });
      check('(4) chaos=2 second search succeeds', await page.locator('#error-msg').isHidden());
      await throughEkyc(page);
      await fillDetails(page);
      await page.click('#btn-save-details');
      await waitStep(page, 'photo');
      await page.click('#btn-sample-photo');
      await page.click('#btn-upload-photo');
      check('chaos=2 first upload fails with "Upload failed. Please try again."', (await errorText(page)) === 'Upload failed. Please try again.');
      await page.click('#btn-upload-photo');
      await waitStep(page, 'review');
      check('chaos=2 second upload succeeds', true);
      await page.context().close();
    }

    /* ===== (5) idle timeout clears everything ===== */
    {
      const page = await newPage('?test=1&chaos=0&timeout=3');
      const cap = await page.getAttribute('#captcha-img', 'src');
      await page.fill('#mobile', '9876543210');
      await page.fill('#captcha-input', 'ABC');
      await page.locator('#session-modal').waitFor({ state: 'visible', timeout: 8000 });
      check('(5) after 3 s idle #session-modal appears', (await page.locator('#session-modal').textContent()).includes('Your session has expired. Please login again.'));
      check('expiry already wiped the fields', (await page.inputValue('#mobile')) === '');
      await page.click('#session-ok');
      await waitStep(page, 'login');
      await invariant(page, 'login');
      check('(5) OK returns to login with #mobile empty', (await page.inputValue('#mobile')) === '' && (await page.inputValue('#captcha-input')) === '' && (await page.locator('#session-modal').isHidden()));
      check('a new captcha is drawn after expiry', (await page.getAttribute('#captcha-img', 'src')) !== cap);
      await page.context().close();
    }

    /* ===== (7) console + network ===== */
    check('(7) no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    check('no requests leave the computer', external.size === 0, [...external].slice(0, 5).join(', '));
  } catch (e) {
    check('test run completed without exceptions', false, e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : String(e));
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
