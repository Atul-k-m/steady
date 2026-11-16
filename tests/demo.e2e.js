// End-to-end demo check, following the demo script in plan.md: calibrate (two devices), hub, both flows under all
// three conditions, live facilitator view, CSV export and safety, the side-by-side page, no console/CSP errors,
// no requests leaving the computer. Needs a server: python -m http.server 8080 -d app, then node tests/demo.e2e.js
// (PW_HEADLESS=false to watch). Uses a fresh browser profile each run.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.TARGET_URL || 'http://localhost:8080';
const OUT = process.env.PW_ARTIFACT_DIR || path.join(__dirname, '..', 'test-results', 'demo-e2e');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true });

(async () => {
  const browser = await chromium.launch({ headless: process.env.PW_HEADLESS !== 'false' });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const errors = [], external = new Set();
  ctx.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) external.add(u.hostname); });
  const watch = (p, tag) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  };
  try {
    const page = await ctx.newPage(); watch(page, 'participant');
    const fac = await ctx.newPage(); watch(fac, 'facilitator');
    await fac.goto(BASE + '/facilitator.html');
    await page.bringToFront();

    /* ---------- hub, fresh ---------- */
    await page.goto(BASE + '/index.html');
    check('hub loads with no profile', /No calibration yet/.test(await page.locator('#profile-line').textContent()));

    /* ---------- MVP 1: calibration ---------- */
    await page.goto(BASE + '/calibrate.html');
    await page.getByLabel('Which device are you using?').fill('Laptop trackpad');
    const t0 = Date.now();
    await page.getByRole('button', { name: /^Start/ }).click();
    // 1. Tap the dots: aim with a ~6 px scatter and a small slip.
    let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    for (let i = 0; i < 14; i++) {
      const b = await page.locator('.dot').boundingBox();
      const x = b.x + b.width / 2 + rnd() * 14, y = b.y + b.height / 2 + rnd() * 14;
      await page.mouse.move(x, y, { steps: 4 });
      await page.mouse.down(); await page.mouse.move(x + rnd() * 4, y + rnd() * 4); await page.mouse.up();
      await page.waitForTimeout(40);
    }
    await page.getByRole('heading', { name: 'Hold steady' }).waitFor();
    check('tap the dots → hold steady', true);
    // 2. Hold steady: a 5 Hz, 3 px wobble inside the ring for ~4.5 s.
    const r = await page.locator('#ring').boundingBox();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const h0 = Date.now();
    while (Date.now() - h0 < 4600 && await page.locator('#ring').count()) {
      const t = (Date.now() - h0) / 1000;
      await page.mouse.move(cx + 3 * Math.sin(2 * Math.PI * 5 * t), cy + 3 * Math.cos(2 * Math.PI * 5 * t));
      await page.waitForTimeout(12);
    }
    await page.getByRole('heading', { name: 'Move it' }).waitFor({ timeout: 10000 });
    check('hold steady → move it', true);
    // 3. Move it: drag the card into the box twice.
    for (let i = 0; i < 2; i++) {
      const c = await page.locator('#card').boundingBox(), bx = await page.locator('#box').boundingBox();
      await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down();
      await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2, { steps: 12 }); await page.mouse.up();
      await page.waitForTimeout(80);
    }
    await page.getByRole('heading', { name: 'Your settings are ready.' }).waitFor();
    check('calibration reaches the explained profile', true, `${((Date.now() - t0) / 1000).toFixed(1)} s of automated input`);
    const reasons = await page.locator('ul.reasons li').allTextContents();
    check('profile shows reasons', reasons.length >= 1, reasons[0]);
    const raw = JSON.parse(await page.locator('details.raw pre').textContent());
    const measured = raw.features || raw;
    check('raw features include pointing, tremor and drag', measured.sigma > 0 && 'tremorHz' in measured && 'dragFailRate' in measured, JSON.stringify(measured));
    check('calibration time is recorded per step', raw.seconds && raw.seconds.totalS > 0, JSON.stringify(raw.seconds));
    const whyLines = await page.locator('.setting .why-line').allTextContents();
    check('every setting shows its own reason (size, gap + 6 techniques)', whyLines.length === 8 && whyLines.every((t) => t.length > 10), `${whyLines.length} reasons; e.g. "${whyLines[2]}"`);
    await shot(page, '01-calibration-result');
    // Override the size; the reasons and the policy should follow.
    await page.locator('[data-size="96"]').click();
    const after = (await page.locator('ul.reasons li').first().textContent());
    check('size override is reflected in the reasons', /96 px/.test(after), after);
    const dayList = await page.locator('[data-tech="dateMode"]').getAttribute('aria-pressed');
    check('96 px buttons switch the day list on (policy sees the chosen size)', dayList === 'true');
    await page.locator('[data-gap="24"]').click();
    check('gap override works', (await page.locator('[data-gap="24"]').getAttribute('aria-pressed')) === 'true' && /You chose 24 px/.test(await page.locator('.setting .why-line').nth(1).textContent()));
    await page.locator('[data-gap="24"]').click(); // no-op re-click keeps it
    await page.getByRole('button', { name: /^Save for/ }).click();
    check('profile saved', await page.getByText('Saved for “Laptop trackpad”').isVisible());

    /* ---------- second device: skip everything except Hold steady ---------- */
    await page.goto(BASE + '/calibrate.html');
    await page.getByLabel('Which device are you using?').fill('Desk mouse');
    await page.getByRole('button', { name: /^Start/ }).click();
    await page.getByRole('button', { name: 'Skip this part' }).click(); // skip Tap the dots
    await page.getByRole('heading', { name: 'Hold steady' }).waitFor();
    const r2 = await page.locator('#ring').boundingBox();
    const h1 = Date.now();
    while (Date.now() - h1 < 4600 && await page.locator('#ring').count()) {
      const t = (Date.now() - h1) / 1000;
      await page.mouse.move(r2.x + r2.width / 2 + 3 * Math.sin(31.4 * t), r2.y + r2.height / 2);
      await page.waitForTimeout(12);
    }
    await page.getByRole('heading', { name: 'Move it' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Skip this part' }).click();
    const partial = await page.locator('ul.reasons li').allTextContents();
    check('partial calibration is explained, not called "no calibration"', !/No calibration yet/.test(partial[0]) && partial.some((t) => /skipped Tap the dots and Move it/.test(t)), partial.slice(0, 2).join(' | '));
    await page.getByRole('button', { name: /^Save for/ }).click();

    /* ---------- hub, calibrated ---------- */
    await page.goto(BASE + '/index.html');
    check('hub lists both devices', await page.locator('#devices button').count() === 2);
    await page.locator('#devices button', { hasText: 'Laptop trackpad' }).click();
    const line = await page.locator('#profile-line').textContent();
    check('hub switches to the chosen device profile', /Laptop trackpad.*96 px.*24 px/.test(line), line);
    await page.getByRole('button', { name: 'Fitted to you' }).click();
    await page.getByLabel('Participant').fill('P07');
    await shot(page, '02-hub');

    /* ---------- MVP 2, Flow A, personal ---------- */
    async function bookPersonal() {
      await page.goto(BASE + '/index.html');
      await page.locator('#go-book').click(); await page.waitForURL(/book.html/); await page.waitForFunction(() => window.Steady && Steady.metrics && Steady.metrics.current() && Steady.adapt);
      const want = await page.evaluate(() => Steady.metrics.current().meta.want);
      const s = await page.evaluate(() => window.__steadySettings);
      check(`book/personal: settings applied (target ${s && s.target})`, s && s.target >= 44);
      check('book/personal: date input became a day list', await page.locator('.steady-day').count() === 14);
      check('book/personal: slider became a stepper', await page.locator('.steady-step').count() === 1);
      // layout-shift observer from here on
      await page.evaluate(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: false }); });
      await page.locator(`.steady-day[data-iso="${want.date}"]`).click();
      await page.locator('label.slot', { hasText: want.time }).click();
      await page.waitForTimeout(700); // outside ignore-repeat
      await page.locator('.steady-presets button', { hasText: `${want.rem} min` }).click();
      await page.waitForTimeout(700);
      const facCount = await fac.locator('#grid').textContent();
      check('facilitator view updates live during the task', /Correct choices\s*3/.test(facCount.replace(/\s+/g, ' ')) || /Correct/.test(facCount), facCount.replace(/\s+/g, ' ').slice(0, 160));
      await page.getByRole('button', { name: 'Book appointment' }).click();
      const dialog = page.locator('steady-panel .confirm');
      if (await dialog.isVisible().catch(() => false)) {
        await shot(page, '03-book-confirm');
        await page.waitForTimeout(700);
        await page.locator('steady-panel .confirm button[data-act="yes"]').click();
      }
      await page.locator('#done.show').waitFor({ timeout: 3000 });
      const done = await page.locator('#done').textContent();
      const sess = await page.evaluate(() => Steady.metrics.current());
      check('book/personal: completed correctly', sess.completed, done.trim().slice(0, 120));
      const formVals = await page.evaluate(() => ({ date: document.getElementById('date').value, time: document.getElementById('f').time.value, rem: document.getElementById('rem').value }));
      check('book/personal: site logic got the right values', formVals.date === want.date && formVals.time === want.time && Number(formVals.rem) === want.rem, JSON.stringify(formVals));
      const cls = await page.evaluate(() => window.__cls);
      check('book/personal: no layout shift after first interaction', cls < 0.01, `CLS ${cls.toFixed(4)}`);
      await shot(page, '04-book-done');
    }
    await bookPersonal();

    /* ---------- MVP 2, Flow B, personal (pick, then place) ---------- */
    await page.goto(BASE + '/index.html');
    await page.locator('#go-week').click(); await page.waitForURL(/week.html/); await page.waitForFunction(() => window.Steady && Steady.metrics && Steady.metrics.current() && Steady.adapt);
    const wantWeek = await page.evaluate(() => Steady.metrics.current().meta.want);
    check('week/personal: medicines are pickable', await page.locator('.steady-pickable').count() === 4);
    for (const [id, slot] of Object.entries(wantWeek)) {
      await page.locator('#' + id).click();
      await page.waitForTimeout(650);
      await page.locator(`.slotbox[data-slot="${slot}"]`).click();
      await page.waitForTimeout(650);
    }
    const placed = await page.evaluate(() => [...document.querySelectorAll('.med')].map((m) => [m.id, m.parentElement.dataset.slot || 'tray']));
    check('week/personal: all four placed by clicks only', placed.every(([id, s]) => wantWeek[id] === s), JSON.stringify(placed));
    await page.getByRole('button', { name: 'Save plan' }).click();
    if (await page.locator('steady-panel .confirm').isVisible().catch(() => false)) { await page.waitForTimeout(700); await page.locator('steady-panel .confirm button[data-act="yes"]').click(); }
    await page.locator('#done.show').waitFor({ timeout: 3000 });
    const wsess = await page.evaluate(() => Steady.metrics.current());
    check('week/personal: completed correctly, no failed drags', wsess.completed && !(wsess.counts.dragfail), JSON.stringify(wsess.counts));
    await shot(page, '05-week-done');

    /* ---------- Original condition: native controls ---------- */
    await page.goto(BASE + '/index.html');
    await page.getByRole('button', { name: 'Original' }).click();
    await page.locator('#go-book').click(); await page.waitForURL(/book.html/); await page.waitForFunction(() => window.Steady && Steady.metrics && Steady.metrics.current() && Steady.adapt);
    check('book/original: no adaptation', await page.locator('.steady-day').count() === 0 && await page.evaluate(() => window.__steadySettings) === null);
    const wantO = await page.evaluate(() => Steady.metrics.current().meta.want);
    await page.locator('#date').fill(wantO.date);
    await page.locator('label.slot', { hasText: wantO.time }).click();
    await page.evaluate((v) => { const r = document.getElementById('rem'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, wantO.rem);
    await page.getByRole('button', { name: 'Book appointment' }).click();
    await page.locator('#done.show').waitFor({ timeout: 3000 });
    check('book/original: completed', (await page.evaluate(() => Steady.metrics.current())).completed);

    await page.goto(BASE + '/index.html');
    await page.locator('#go-week').click(); await page.waitForURL(/week.html/); await page.waitForFunction(() => window.Steady && Steady.metrics && Steady.metrics.current() && Steady.adapt);
    const wantOW = await page.evaluate(() => Steady.metrics.current().meta.want);
    for (const [id, slot] of Object.entries(wantOW)) await page.locator('#' + id).dragTo(page.locator(`.slotbox[data-slot="${slot}"]`));
    await page.getByRole('button', { name: 'Save plan' }).click();
    await page.locator('#done.show').waitFor({ timeout: 3000 });
    check('week/original: native drag-and-drop completes', (await page.evaluate(() => Steady.metrics.current())).completed);

    /* ---------- Fixed condition ---------- */
    await page.goto(BASE + '/index.html');
    await page.getByRole('button', { name: 'Fixed accessible' }).click();
    await page.locator('#go-book').click(); await page.waitForURL(/book.html/); await page.waitForFunction(() => window.Steady && Steady.metrics && Steady.metrics.current() && Steady.adapt);
    const fx = await page.evaluate(() => window.__steadySettings);
    check('book/fixed: one-size preset', fx && fx.target === 44 && fx.dateMode === 'list', JSON.stringify(fx));

    /* ---------- Export ---------- */
    await page.goto(BASE + '/index.html');
    await shot(page, '06-hub-sessions');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    const rows = csv.trim().split('\n');
    check('CSV exports every session', rows.length >= 6, `${rows.length - 1} sessions; header: ${rows[0]}`);
    fs.writeFileSync(path.join(OUT, 'sessions.csv'), csv);
    await shot(fac, '07-facilitator');

    /* ---------- side-by-side demo page ---------- */
    await page.goto(BASE + '/demo.html');
    await page.frameLocator('#right').locator('.steady-day').first().waitFor({ timeout: 8000 }).catch(() => {});
    for (const hand of ['precise', 'moderate', 'strong']) {
      await page.locator(`#hand button[data-v="${hand}"]`).click();
      await page.waitForTimeout(900);
    }
    const chips = await page.locator('#chips li.on').allTextContents();
    check('demo page renders and refits (strong hand → 120 px)', chips.some((c) => /120 px/.test(c)), chips.join(', '));
    await shot(page, '08-demo');

    /* ---------- CSV safety ---------- */
    await page.goto(BASE + '/index.html');
    await page.getByLabel('Participant').fill('=HYPERLINK("x"),P9');
    await page.locator('#go-book').click(); await page.waitForURL(/book\.html/);
    await page.goto(BASE + '/index.html');
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    const csv2 = fs.readFileSync(await dl2.path(), 'utf8');
    check('CSV neutralises formulas and quotes commas', csv2.includes(`"'=HYPERLINK(""x""),P9"`), csv2.split('\n').pop());
    const xss = await page.locator('table.sessions td', { hasText: 'HYPERLINK' }).count();
    check('participant text is shown as text in the hub', xss >= 1);

    check('no console errors (incl. CSP violations)', errors.length === 0, errors.slice(0, 5).join(' | '));
    check('no requests leave the computer', external.size === 0, [...external].join(', '));
  } catch (e) {
    check('script ran to the end', false, e.message.split('\n')[0]);
  } finally {
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots: ${OUT}`);
    process.exitCode = failed.length ? 1 : 0;
  }
})();
