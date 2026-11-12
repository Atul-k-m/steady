/* STEADY calibration (MVP 1): Tap the dots → Hold steady → Move it → explained profile.
 * Every step is skippable; no scores, no "wrong" feedback. */
(function () {
  const S = window.Steady;
  const app = document.getElementById('app');
  const I = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };
  const fresh = () => ({ device: 'This computer', trials: [], tremor: null, drag: { attempts: 0, failures: 0, ms: 0 }, t: {} });
  const data = fresh();
  let profile = null;
  // Time budgets keep the whole check near a minute. A step only ends between attempts, never under the hand.
  const BUDGET = { tap: 25000, tapMin: 8, move: 20000 };
  const mark = (k) => { data.t[k] = performance.now(); };
  const since = (k) => (data.t[k] ? performance.now() - data.t[k] : 0);

  function side(title, text, progress, extra) {
    return `<div class="cal-side">
      ${progress ? `<p class="progress" id="progress">${progress}</p>` : ''}
      <h2 tabindex="-1" id="step-title">${title}</h2>
      <p>${text}</p>
      ${extra || ''}
      <div class="row"><button class="btn quiet" type="button" id="skip">Skip this part</button></div>
    </div>`;
  }
  const focusTitle = () => { const h = document.getElementById('step-title'); if (h) h.focus({ preventScroll: true }); };

  /* ---------- intro ---------- */
  function intro() {
    const known = S.listProfiles(), active = S.loadProfile();
    const device = (active && active.device) || 'This computer';
    app.innerHTML = `<div class="cal">
      <section>
        <h1>Let’s see how your mouse feels today.</h1>
        <p class="lede">Three short moments, about a minute in all. There are no scores and nothing to get right. Take your time, and skip anything you like.</p>
        <div style="margin-top:32px;display:grid;gap:22px;max-width:520px">
          <label class="field">Which device are you using?
            <input class="text" id="device" value="${S.esc(device)}" list="devices" autocomplete="off">
            <datalist id="devices">${known.map((p) => `<option value="${S.esc(p.device)}"></option>`).join('')}</datalist>
          </label>
          <p style="margin:-8px 0 0;color:var(--ink-2);font-size:17px">Each device keeps its own settings, for example “Laptop trackpad” and “Desk mouse”.${known.length ? ' Using a name you saved before replaces those settings.' : ''}</p>
          <div class="row">
            <button class="btn primary" type="button" id="start">Start ${I.arrow}</button>
            <button class="btn" type="button" id="skip-all">Skip, use standard settings</button>
          </div>
        </div>
      </section>
      <aside class="cal-side">
        <h2>What happens</h2>
        <ol class="reasons" style="counter-reset:none">
          <li>${I.check}<span><b>Tap the dots.</b> Click 14 dots as they appear around a circle.</span></li>
          <li>${I.check}<span><b>Hold steady.</b> Rest the pointer in a circle for a few seconds.</span></li>
          <li>${I.check}<span><b>Move it.</b> Drag a card into a box, twice.</span></li>
        </ol>
        <p style="margin-top:18px">What we measure stays on this computer.</p>
      </aside>
    </div>`;
    const name = () => document.getElementById('device').value.trim() || 'This computer';
    document.getElementById('start').onclick = () => { data.device = name(); mark('start'); tap(); };
    document.getElementById('skip-all').onclick = () => { data.device = name(); result(); };
  }

  /* ---------- 1. Tap the dots (ISO 9241-9 style, 13 positions, 14 trials) ---------- */
  function tap() {
    const N = 13, TRIALS = 14;
    app.innerHTML = `<div class="cal"><div class="cal-stage" id="stage" role="application" aria-label="Dot area. Click each dot as it appears."></div>
      ${side('Tap the dots', 'Click each dot as it appears. Go at your own pace. Wherever your click lands is fine.', `1 of ${TRIALS}`)}</div>`;
    focusTitle();
    mark('tap');
    const stage = document.getElementById('stage');
    const dot = document.createElement('div'); dot.className = 'dot'; stage.appendChild(dot);
    let j = 0, shownAt = 0, down = null, lastUp = 0;
    const pos = (k, r) => { const a = (k * 2 * Math.PI) / N - Math.PI / 2; return { x: r.width / 2 + r.width * 0.38 * Math.cos(a), y: r.height / 2 + r.height * 0.38 * Math.sin(a) }; };
    const order = (i) => (i * 7) % N;
    function show() {
      const r = stage.getBoundingClientRect();
      const p = pos(order(j), r);
      dot.style.left = (p.x / r.width) * 100 + '%';
      dot.style.top = (p.y / r.height) * 100 + '%';
      shownAt = performance.now();
      document.getElementById('progress').textContent = `${j + 1} of ${TRIALS}`;
    }
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = stage.getBoundingClientRect();
      const prev = data.trials[data.trials.length - 1];
      // A repeat = a second press close to the last one, straight after it (not a fast move to the next dot).
      if (prev && performance.now() - lastUp < 300 && Math.hypot(e.clientX - r.left - prev.downX, e.clientY - r.top - prev.downY) < 40) { prev.repeat = true; return; }
      down = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    });
    stage.addEventListener('pointerup', (e) => {
      if (!down) return;
      const r = stage.getBoundingClientRect();
      const tp = pos(order(j), r);
      const fp = j === 0 ? { x: r.width / 2, y: r.height / 2 } : pos(order(j - 1), r);
      data.trials.push({ tx: tp.x, ty: tp.y, fromX: fp.x, fromY: fp.y, downX: down.x, downY: down.y,
        upX: e.clientX - r.left, upY: e.clientY - r.top, mt: down.t - shownAt, repeat: false });
      const g = document.createElement('div'); g.className = 'ghost';
      g.style.left = (down.x / r.width) * 100 + '%'; g.style.top = (down.y / r.height) * 100 + '%';
      stage.appendChild(g);
      down = null; lastUp = performance.now(); j++;
      if (j >= TRIALS || (j >= BUDGET.tapMin && since('tap') > BUDGET.tap)) return endTap();
      show();
    });
    const endTap = () => { data.t.tapMs = since('tap'); hold(); };
    document.getElementById('skip').onclick = endTap;
    show();
  }

  /* ---------- 2. Hold steady (tremor amplitude + frequency) ---------- */
  function hold() {
    const NEED = 4000, GIVE_UP = 12000;
    app.innerHTML = `<div class="cal"><div class="cal-stage wide" id="stage" aria-label="Circle area"><div class="hold-ring" id="ring"></div></div>
      ${side('Hold steady', 'Move the pointer into the circle and rest it there. The bar fills while you are inside. Leaving is fine; it just waits for you.', 'Moment 2 of 3',
        '<div class="meter" aria-hidden="true"><i id="bar"></i></div>')}</div>`;
    focusTitle();
    mark('hold');
    const stage = document.getElementById('stage'), ring = document.getElementById('ring'), bar = document.getElementById('bar');
    let inside = false, seg = [], best = [], acc = 0, last = 0, started = performance.now(), raf = 0, done = false;
    const inRing = (x, y) => { const r = ring.getBoundingClientRect(); return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) <= r.width / 2; };
    stage.addEventListener('pointermove', (e) => {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const now = inRing(e.clientX, e.clientY);
      if (now && !inside) { seg = []; acc = 0; }
      if (!now && inside && seg.length > best.length) best = seg;
      inside = now;
      ring.classList.toggle('in', inside);
      if (inside) for (const c of (evs.length ? evs : [e])) seg.push({ t: c.timeStamp, x: c.clientX, y: c.clientY });
    });
    stage.addEventListener('pointerleave', () => { if (inside && seg.length > best.length) best = seg; inside = false; ring.classList.remove('in'); });
    function tick(t) {
      if (done) return;
      const dt = last ? t - last : 0; last = t;
      if (inside) acc += dt;
      bar.style.width = Math.min(100, (acc / NEED) * 100) + '%';
      if (acc >= NEED || t - started > GIVE_UP) return finish();
      raf = requestAnimationFrame(tick);
    }
    function finish() {
      done = true; cancelAnimationFrame(raf);
      const s = seg.length > best.length ? seg : best;
      if (s.length >= 4) {
        const first = s[0], lastS = s[s.length - 1];
        data.tremor = S.tremorFeatures(s, Math.max(1000, lastS.t - first.t));
      }
      data.t.holdMs = since('hold');
      drag();
    }
    raf = requestAnimationFrame(tick);
    document.getElementById('skip').onclick = () => { done = true; cancelAnimationFrame(raf); data.t.holdMs = since('hold'); drag(); };
  }

  /* ---------- 3. Move it (drag reliability) ---------- */
  function drag() {
    const NEED = 2, MAX = 4;
    app.innerHTML = `<div class="cal"><div class="cal-stage wide" id="stage"><div class="drag-box" id="box">Drop here</div><div class="drag-card" id="card">Card</div></div>
      ${side('Move it', 'Press on the card, move it into the box, and let go. We do this twice.', 'Moment 3 of 3')}</div>`;
    focusTitle();
    mark('move');
    const card = document.getElementById('card'), box = document.getElementById('box');
    let start = null, ok = 0;
    const endMove = () => { if (ok) data.drag.ms /= ok; data.t.moveMs = since('move'); result(); };
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      card.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      card.style.cursor = 'grabbing';
    });
    card.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > 10) start.moved = true;
      card.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    card.addEventListener('pointerup', () => {
      if (!start) return;
      const s = start; start = null; card.style.cursor = '';
      if (!s.moved) { card.style.transform = ''; return; }
      const c = card.getBoundingClientRect(), b = box.getBoundingClientRect();
      const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
      const hit = cx > b.left && cx < b.right && cy > b.top && cy < b.bottom;
      data.drag.attempts++;
      if (hit) { ok++; data.drag.ms += performance.now() - s.t; } else data.drag.failures++;
      card.style.transform = '';
      if (ok >= NEED || data.drag.attempts >= MAX || since('move') > BUDGET.move) return endMove();
      document.getElementById('progress').textContent = hit ? 'One more time' : 'Let’s try that again, no rush';
    });
    document.getElementById('skip').onclick = () => { data.t.moveMs = since('move'); result(); };
  }

  /* ---------- result: explained profile + overrides ---------- */
  const TECH = [
    ['slipGuard', 'Slip guard', 'A click counts where you pressed.'],
    ['ignoreRepeatMs', 'Ignore double presses', 'A second click straight after is ignored.'],
    ['dragMode', 'Pick, then place', 'Click an item, then click where it goes.'],
    ['dateMode', 'Day list', 'Calendars become large day buttons.'],
    ['sliderMode', 'Stepper', 'Sliders become − and + buttons.'],
    ['confirmFinal', 'Confirm before sending', 'See what will happen, then confirm.'],
  ];
  const ON = { ignoreRepeatMs: 400, dragMode: 'pick', dateMode: 'list', sliderMode: 'stepper', slipGuard: true, confirmFinal: true };
  const OFF = { ignoreRepeatMs: 0, dragMode: 'native', dateMode: 'native', sliderMode: 'native', slipGuard: false, confirmFinal: false };
  const isOn = S.isOn;
  const GAPS = [8, 12, 16, 24, 32];

  function result() {
    const pointing = data.trials.length >= 5 ? S.pointingFeatures(data.trials) : null;
    const t = data.t, sec = (ms) => (ms ? Math.round(ms / 100) / 10 : 0);
    const timing = t.start ? { tapS: sec(t.tapMs), holdS: sec(t.holdMs), moveS: sec(t.moveMs), totalS: sec(performance.now() - t.start) } : null;
    profile = S.buildProfile({ pointing, tremor: data.tremor, drag: data.drag.attempts ? data.drag : null, device: data.device, timing });
    render();
  }
  const recNow = () => S.recommend(profile.features, { overrides: profile.overrides });
  // Endpoint scatter at actual CSS-pixel size, drawn from in-memory taps only (raw taps are never saved).
  function scatter(s) {
    if (data.trials.length < 5) return '';
    const pts = data.trials.map((t) => [t.downX - t.tx, t.downY - t.ty]);
    const outer = s.target + 2 * s.gap, size = Math.max(220, outer + 60), c = size / 2;
    const cl = (v) => Math.max(-c + 5, Math.min(c - 5, v));
    return `<figure class="scatter"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pts.length} clicks plotted around the centre of the target, at actual size">
      <rect x="${c - outer / 2}" y="${c - outer / 2}" width="${outer}" height="${outer}" rx="16" fill="none" stroke="#1F5B4C" stroke-width="1.5" stroke-dasharray="5 5"/>
      <rect x="${c - s.target / 2}" y="${c - s.target / 2}" width="${s.target}" height="${s.target}" rx="12" fill="#DCE8E2" stroke="#1F5B4C" stroke-width="2"/>
      <path d="M${c - 7} ${c}h14M${c} ${c - 7}v14" stroke="#1F5B4C" stroke-width="1.5"/>
      ${pts.map(([x, y]) => `<circle cx="${(c + cl(x)).toFixed(1)}" cy="${(c + cl(y)).toFixed(1)}" r="4" fill="#1D1A15" fill-opacity=".78"/>`).join('')}
    </svg><figcaption>Where your ${pts.length} clicks landed, at actual size. The filled square is your button. The dashed line marks the gap, where a near-miss does nothing.</figcaption></figure>`;
  }
  function render() {
    const rec = recNow(), s = rec.settings;
    document.documentElement.style.setProperty('--steady-target', s.target + 'px');
    document.documentElement.style.setProperty('--steady-gap', s.gap + 'px');
    const gaps = [...new Set(GAPS.concat(rec.suggestedGap))].sort((a, b) => a - b);
    app.innerHTML = `<div class="result">
      <svg class="level" id="level" viewBox="0 0 220 64" aria-hidden="true"><rect x="3" y="12" width="214" height="40" rx="20" fill="none" stroke="currentColor" stroke-width="3"/><path d="M90 12v40M130 12v40" stroke="currentColor" stroke-width="2" opacity=".5"/><circle class="bubble" cx="110" cy="32" r="12" fill="currentColor"/></svg>
      <div>
        <h1 tabindex="-1" id="result-title">Your settings are ready.</h1>
        <p class="lede">This page already uses them. Every button you see here is your size.</p>
      </div>
      <div class="why"><ul class="reasons">${rec.explain.map((t) => `<li>${I.check}<span>${t}</span></li>`).join('')}</ul>${scatter(s)}</div>
      <div class="settings-grid">
        <div class="setting wide">
          <h3 id="size-h">Button size</h3>
          <div class="segmented" role="group" aria-labelledby="size-h" id="sizes">
            ${S.LEVELS.map((l) => `<button class="btn" type="button" data-size="${l}" aria-pressed="${l === s.target}">${l} px${l === rec.suggestedTarget ? ' <small>suggested</small>' : ''}</button>`).join('')}
          </div>
          <p style="margin-top:14px;display:flex;align-items:center;gap:14px"><span class="sample" style="height:${s.target}px;min-width:${s.target}px;padding:0 18px">Book</span><span style="color:var(--ink-2);font-size:17px">A button at your size</span></p>
          <p class="why-line">${rec.reasons.target}</p>
        </div>
        <div class="setting wide">
          <h3 id="gap-h">Gap between buttons</h3>
          <div class="segmented" role="group" aria-labelledby="gap-h" id="gaps">
            ${gaps.map((g) => `<button class="btn" type="button" data-gap="${g}" aria-pressed="${g === s.gap}">${g} px${g === rec.suggestedGap ? ' <small>suggested</small>' : ''}</button>`).join('')}
          </div>
          <p class="why-line">${rec.reasons.gap}</p>
        </div>
        ${TECH.map(([k, name, hint]) => `<div class="setting"><h3>${name}</h3>
          <button class="btn" type="button" data-tech="${k}" aria-pressed="${isOn(k, s[k])}">${isOn(k, s[k]) ? 'On' : 'Off'}</button>
          <p style="margin-top:8px;color:var(--ink-2);font-size:17px">${hint}</p>
          <p class="why-line">${rec.reasons[k]}</p></div>`).join('')}
      </div>
      <div class="row" id="save-row">
        <button class="btn primary" type="button" id="save">${I.check} Save for “${S.esc(profile.device)}”</button>
        <button class="btn" type="button" id="again">Do the check again</button>
      </div>
      <details class="raw"><summary>What was measured</summary><pre>${S.esc(JSON.stringify({ features: profile.features, seconds: profile.timing, overrides: profile.overrides }, null, 2))}</pre></details>
    </div>`;
    document.getElementById('result-title').focus({ preventScroll: true });
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('level').classList.add('settled')));
    // Choosing the suggested value removes the override, so the profile keeps following the check.
    const choose = (key, v, suggested) => { if (v === suggested) delete profile.overrides[key]; else profile.overrides[key] = v; render(); };
    app.querySelectorAll('[data-size]').forEach((b) => b.onclick = () => choose('target', Number(b.dataset.size), rec.suggestedTarget));
    app.querySelectorAll('[data-gap]').forEach((b) => b.onclick = () => choose('gap', Number(b.dataset.gap), rec.suggestedGap));
    app.querySelectorAll('[data-tech]').forEach((b) => b.onclick = () => {
      const k = b.dataset.tech, wantOn = !isOn(k, s[k]);
      if (isOn(k, rec.suggested[k]) === wantOn) delete profile.overrides[k]; else profile.overrides[k] = wantOn ? ON[k] : OFF[k];
      render();
    });
    document.getElementById('save').onclick = () => {
      profile.settings = recNow().settings;
      profile.explain = recNow().explain;
      S.saveProfile(profile);
      if (!S.getPref('condition', '')) S.setPref('condition', 'personal');
      document.getElementById('save-row').innerHTML = `<p class="profile-line">${I.check.replace('<svg', '<svg style="width:24px;height:24px;vertical-align:-5px;color:var(--spruce)"')} Saved for “${S.esc(profile.device)}”.</p>
        <a class="btn primary" href="book.html">Try it: book an appointment ${I.arrow}</a><a class="btn" href="week.html">Plan the medicine week</a><a class="btn quiet" href="index.html">Study hub</a>`;
    };
    document.getElementById('again').onclick = () => { Object.assign(data, fresh()); intro(); };
  }

  intro();
})();
