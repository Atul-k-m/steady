/* STEADY one-minute check: Tap the dots → Hold steady → Read it → explained profile and preferences.
 * Every step is skippable; no scores, no "wrong" feedback. calibrate.html?move=1 adds the older "Move it" drag step
 * after Read it, for research sessions that also study drag-and-drop. */
(function () {
  const S = window.Steady;
  const app = document.getElementById('app');
  const I = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    glasses: '<svg viewBox="0 0 64 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="18" r="10"/><circle cx="48" cy="18" r="10"/><path d="M26 17c4-3 8-3 12 0M6 16L3 8M58 16l3-8"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  };
  const WITH_MOVE = new URLSearchParams(location.search).get('move') === '1';
  const TOTAL = WITH_MOVE ? 4 : 3;
  const fresh = () => ({ device: 'This computer', trials: [], tremor: null, reading: [], readSkipped: false, drag: { attempts: 0, failures: 0, ms: 0 }, t: {} });
  const data = fresh();
  let profile = null, firstRender = true;
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
        <h1 tabindex="-1" id="intro-title">Let’s see how the mouse and the screen feel today.</h1>
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
        <ol class="reasons">
          <li>${I.check}<span><b>Tap the dots.</b> Click 14 dots as they appear around a circle.</span></li>
          <li>${I.check}<span><b>Hold steady.</b> Rest the pointer in a circle for a few seconds.</span></li>
          <li>${I.check}<span><b>Read it.</b> Pick the number you see while it gets smaller. Wear your usual glasses.</span></li>
          ${WITH_MOVE ? `<li>${I.check}<span><b>Move it.</b> Drag a card into a box, twice.</span></li>` : ''}
        </ol>
        <p class="aside-note"><b>Helping someone?</b> Let them hold the mouse. You can read the instructions out loud.</p>
        <p style="margin-top:14px">What we measure stays on this computer. <a href="privacy.html">Your data</a></p>
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
      ${side('Hold steady', 'Move the pointer into the circle and rest it there. The bar fills while you are inside. Leaving is fine; it just waits for you.', `Moment 2 of ${TOTAL}`,
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
      read();
    }
    raf = requestAnimationFrame(tick);
    document.getElementById('skip').onclick = () => { done = true; cancelAnimationFrame(raf); data.t.holdMs = since('hold'); read(); };
  }

  /* ---------- 3. Read it (smallest text read correctly) ----------
   * A 1-up/1-down staircase: right → the next smaller size, wrong or "I can't read it" → the next larger.
   * Stops after 8 numbers, after 20 s (checked between answers, never mid-answer), or when the two most recent
   * wrong answers were at the same size (two misses at one size is the threshold; it also covers two misses in a row
   * at the 40 px cap). core.readingFeatures turns the trials into a text size. */
  const READ = { sizes: [40, 32, 28, 24, 20, 18, 16, 14, 12, 10], start: 24, maxTrials: 8, maxMs: 20000, blankMs: 300, guardMs: 450 };
  const rnd = (n) => Math.floor(Math.random() * n);
  function threeDigit() { return String(100 + rnd(900)); }
  // Three distractors, each differing from the answer in exactly one digit, all different from each other.
  function distractors(v) {
    const out = new Set();
    while (out.size < 3) {
      const i = rnd(3), d = v.split('');
      let nd;
      do { nd = String(i === 0 ? 1 + rnd(9) : rnd(10)); } while (nd === d[i]);
      d[i] = nd;
      out.add(d.join(''));
    }
    return [...out];
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function read() {
    // Answer buttons use the button size measured so far, so the answer is never the hard part.
    const soFar = S.recommend(Object.assign({}, data.trials.length >= 5 ? S.pointingFeatures(data.trials) : {}, data.tremor || {})).settings;
    document.documentElement.style.setProperty('--steady-target', Math.max(56, soFar.target) + 'px');
    document.documentElement.style.setProperty('--steady-gap', Math.max(12, soFar.gap) + 'px');
    app.innerHTML = `<div class="cal">
      <section class="read-stage" id="stage">
        <div class="read-ready">
          <span class="read-icon">${I.glasses}</span>
          <p class="read-big">Sit as you usually do and wear your usual glasses.</p>
          <p>A number appears in a box. Pick the same number from the four buttons under it. The numbers get smaller, and bigger again if they get hard to read. Guessing is fine.</p>
          <button class="btn primary" type="button" id="begin">I’m ready ${I.arrow}</button>
        </div>
      </section>
      ${side('Read it', 'Pick the number that matches the one in the box. If you can’t make it out, choose “I can’t read it”. This only sets the text size.', `Moment 3 of ${TOTAL}`)}
    </div>`;
    focusTitle();
    const endRead = (skipped) => {
      data.t.readMs = since('read');
      if (skipped && data.reading.length < 4) { data.reading = []; data.readSkipped = true; }
      if (WITH_MOVE) drag(); else result();
    };
    document.getElementById('skip').onclick = () => endRead(true);
    document.getElementById('begin').onclick = () => {
      mark('read');
      const stage = document.getElementById('stage');
      stage.innerHTML = `<div class="read-box" role="img" aria-label="The number to read"><span class="read-num" id="read-num"></span></div>
        <p class="read-thanks" id="thanks" role="status"></p>
        <div class="read-answers" role="group" aria-label="Which number did you see?">
          ${[0, 1, 2, 3].map((i) => `<button class="btn" type="button" data-opt="${i}"></button>`).join('')}
        </div>
        <button class="btn read-cant" type="button" id="cant">I can’t read it</button>`;
      const num = document.getElementById('read-num'), thanks = document.getElementById('thanks');
      const opts = [...stage.querySelectorAll('[data-opt]')];
      let idx = READ.sizes.indexOf(READ.start), cur = null, shownAt = 0, busy = true;
      function next() {
        const px = READ.sizes[idx], value = threeDigit();
        const choices = shuffle([value].concat(distractors(value)));
        num.style.fontSize = px + 'px';
        num.textContent = value;
        // The four buttons stay where they are; only their numbers change.
        opts.forEach((b, i) => { b.textContent = choices[i]; b.dataset.v = choices[i]; });
        cur = { px, value };
        shownAt = performance.now();
        busy = false;
      }
      function answer(v) {
        // A press within guardMs of a new number is a repeat of the last press, not an answer to this one.
        if (busy || performance.now() - shownAt < READ.guardMs) return;
        busy = true;
        const correct = v === cur.value;
        data.reading.push({ px: cur.px, correct });
        thanks.textContent = 'Thanks.';
        const wrongs = data.reading.filter((t) => !t.correct);
        const twoMissesHere = !correct && wrongs.length >= 2 && wrongs[wrongs.length - 2].px === cur.px;
        if (data.reading.length >= READ.maxTrials || since('read') > READ.maxMs || twoMissesHere) return endRead(false);
        idx = correct ? Math.min(idx + 1, READ.sizes.length - 1) : Math.max(idx - 1, 0);
        num.textContent = '';
        setTimeout(() => { thanks.textContent = ''; next(); }, READ.blankMs);
      }
      opts.forEach((b) => b.addEventListener('click', () => answer(b.dataset.v)));
      document.getElementById('cant').addEventListener('click', () => answer(null));
      const go = () => { next(); opts[0].focus({ preventScroll: true }); };
      // Wait for the typeface, so the first number is drawn in the same face as the rest.
      if (document.fonts && document.fonts.load) document.fonts.load(`${READ.start}px "Atkinson Hyperlegible Next"`).then(go, go); else go();
    };
  }

  /* ---------- optional: Move it (drag reliability; only with ?move=1) ---------- */
  function drag() {
    const NEED = 2, MAX = 4;
    app.innerHTML = `<div class="cal"><div class="cal-stage wide" id="stage"><div class="drag-box" id="box">Drop here</div><div class="drag-card" id="card">Card</div></div>
      ${side('Move it', 'Press on the card, move it into the box, and let go. We do this twice.', `Moment 4 of ${TOTAL}`)}</div>`;
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

  /* ---------- result: explained profile, overrides and preferences ---------- */
  const TECH = [
    ['autonomy', 'Helper does the safe steps', 'Picks from lists and presses Next, after a yes. Aadhaar, OTP, captcha, consent and Submit stay with you.'],
    ['slipGuard', 'Slip guard', 'A click counts where you pressed.'],
    ['ignoreRepeatMs', 'Ignore double presses', 'A second click straight after is ignored.'],
    ['dragMode', 'Pick, then place', 'Click an item, then click where it goes.'],
    ['dateMode', 'Day list', 'Calendars become large day buttons.'],
    ['sliderMode', 'Stepper', 'Sliders become − and + buttons.'],
    ['confirmFinal', 'Confirm before sending', 'See what will happen, then confirm.'],
  ];
  const ON = { autonomy: 'copilot', ignoreRepeatMs: 400, dragMode: 'pick', dateMode: 'list', sliderMode: 'stepper', slipGuard: true, confirmFinal: true };
  const OFF = { autonomy: 'assist', ignoreRepeatMs: 0, dragMode: 'native', dateMode: 'native', sliderMode: 'native', slipGuard: false, confirmFinal: false };
  const isOn = S.isOn;
  const GAPS = [8, 12, 16, 24, 32];
  const TEXTS = [18, 20, 24, 28, 32, 40];
  // What a step on the portal looks like in the helper, used to preview the text size and the voice.
  const PREVIEW = {
    en: { step: 'Step 6 of 9', main: 'Choose your state from the list.', sub: 'Say yes, and the helper picks it for you.' },
    hi: { step: 'चरण 6 / 9', main: 'सूची से अपना राज्य चुनिए।', sub: 'हाँ कहें, तो सहायक इसे आपके लिए चुन देगा।' },
  };
  // The sentence the helper says when an OTP goes to someone else's phone.
  function otpLine(p) {
    const name = String(p.helperName || '').trim(), end = p.helperPhoneEnd && p.helperPhoneEnd.length === 4 ? p.helperPhoneEnd : '';
    if (p.lang === 'hi') {
      if (name && end) return `${name} से वह कोड पूछिए, जो ${end} पर ख़त्म होने वाले फ़ोन पर आया है।`;
      if (name) return `${name} से वह कोड पूछिए, जो उनके फ़ोन पर आया है।`;
      if (end) return `वह कोड पूछिए, जो ${end} पर ख़त्म होने वाले फ़ोन पर आया है।`;
      return 'आधार से जुड़े फ़ोन पर आया कोड पूछिए।';
    }
    if (name && end) return `Ask ${name} for the code sent to the phone ending ${end}.`;
    if (name) return `Ask ${name} for the code sent to their phone.`;
    if (end) return `Ask for the code sent to the phone ending ${end}.`;
    return 'Ask for the code sent to the phone linked to Aadhaar.';
  }

  function result() {
    const pointing = data.trials.length >= 5 ? S.pointingFeatures(data.trials) : null;
    const t = data.t, sec = (ms) => (ms ? Math.round(ms / 100) / 10 : 0);
    const timing = t.start ? Object.assign({ tapS: sec(t.tapMs), holdS: sec(t.holdMs), readS: sec(t.readMs) }, WITH_MOVE ? { moveS: sec(t.moveMs) } : {}, { totalS: sec(performance.now() - t.start) }) : null;
    // Language, voice and the OTP helper carry over from the active profile, so a re-check doesn't ask again.
    const before = S.loadProfile();
    profile = S.buildProfile({ pointing, tremor: data.tremor, drag: data.drag.attempts ? data.drag : null, reading: data.reading.length ? data.reading : null,
      device: data.device, timing, prefs: before && before.prefs });
    firstRender = true;
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
      <rect x="${c - outer / 2}" y="${c - outer / 2}" width="${outer}" height="${outer}" rx="16" fill="none" stroke="#2F5BAA" stroke-width="1.5" stroke-dasharray="5 5"/>
      <rect x="${c - s.target / 2}" y="${c - s.target / 2}" width="${s.target}" height="${s.target}" rx="12" fill="#E3ECFA" stroke="#2F5BAA" stroke-width="2"/>
      <path d="M${c - 7} ${c}h14M${c} ${c - 7}v14" stroke="#2F5BAA" stroke-width="1.5"/>
      ${pts.map(([x, y]) => `<circle cx="${(c + cl(x)).toFixed(1)}" cy="${(c + cl(y)).toFixed(1)}" r="4" fill="#0E1A3A" fill-opacity=".78"/>`).join('')}
    </svg><figcaption>Where your ${pts.length} clicks landed, at actual size. The filled square is your button. The dashed line marks the gap, where a near-miss does nothing.</figcaption></figure>`;
  }
  const seg = (k, v, pressed, label, extra) => `<button class="btn" type="button" data-k="${k}-${v}" data-${k}="${v}" aria-pressed="${pressed}"${extra || ''}>${label}</button>`;

  function render() {
    const rec = recNow(), s = rec.settings, p = profile.prefs, pv = PREVIEW[p.lang] || PREVIEW.en;
    const focusKey = !firstRender && document.activeElement && app.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--steady-target', s.target + 'px');
    rootStyle.setProperty('--steady-gap', s.gap + 'px');
    rootStyle.setProperty('--steady-text', s.text + 'px');
    const gaps = [...new Set(GAPS.concat(rec.suggestedGap))].sort((a, b) => a - b);
    const texts = [...new Set(TEXTS.concat(rec.suggestedText))].sort((a, b) => a - b);
    const sugg = (on) => (on ? ' <small>suggested</small>' : '');
    app.innerHTML = `<div class="result">
      <svg class="level${firstRender ? '' : ' settled'}" id="level" viewBox="0 0 220 64" aria-hidden="true"><rect x="3" y="12" width="214" height="40" rx="20" fill="none" stroke="currentColor" stroke-width="3"/><path d="M90 12v40M130 12v40" stroke="currentColor" stroke-width="2" opacity=".5"/><circle class="bubble" cx="110" cy="32" r="12" fill="currentColor"/></svg>
      <div>
        <h1 tabindex="-1" id="result-title">Your settings are ready.</h1>
        <p class="lede">Every button on this page is already your size. Change anything you like, then save.</p>
      </div>
      <div class="why"><ul class="reasons">${rec.explain.map((t) => `<li>${I.check}<span>${t}</span></li>`).join('')}</ul>${scatter(s)}</div>
      <div class="settings-grid">
        <div class="setting wide">
          <h3 id="size-h">Button size</h3>
          <div class="segmented" role="group" aria-labelledby="size-h">
            ${S.LEVELS.map((l) => seg('size', l, l === s.target, `${l} px${sugg(l === rec.suggestedTarget)}`)).join('')}
          </div>
          <p style="margin-top:14px;display:flex;align-items:center;gap:14px"><span class="sample" style="height:${s.target}px;min-width:${s.target}px;padding:0 18px">Next</span><span style="color:var(--ink-2);font-size:17px">A button at your size</span></p>
          <p class="why-line">${rec.reasons.target}</p>
        </div>
        <div class="setting wide">
          <h3 id="gap-h">Gap between buttons</h3>
          <div class="segmented" role="group" aria-labelledby="gap-h">
            ${gaps.map((g) => seg('gap', g, g === s.gap, `${g} px${sugg(g === rec.suggestedGap)}`)).join('')}
          </div>
          <p class="why-line">${rec.reasons.gap}</p>
        </div>
        <div class="setting wide">
          <h3 id="text-h">Text size</h3>
          <div class="segmented" role="group" aria-labelledby="text-h">
            ${texts.map((x) => seg('text', x, x === s.text, `${x} px${sugg(x === rec.suggestedText)}`)).join('')}
          </div>
          <p class="preview-k">Preview: a step in the helper, at ${s.text} px</p>
          <div class="text-preview" lang="${p.lang === 'hi' ? 'hi' : 'en'}">
            <span class="k">${pv.step}</span>
            <strong>${pv.main}</strong>
            <span class="sub">${pv.sub}</span>
          </div>
          <p class="why-line">${rec.reasons.text}</p>
        </div>
        ${TECH.map(([k, name, hint]) => `<div class="setting"><h3 id="h-${k}">${name}</h3>
          <button class="btn" type="button" id="t-${k}" data-k="tech-${k}" data-tech="${k}" aria-pressed="${isOn(k, s[k])}" aria-labelledby="h-${k} t-${k}">${isOn(k, s[k]) ? 'On' : 'Off'}</button>
          <p style="margin-top:8px;color:var(--ink-2);font-size:17px">${hint}</p>
          <p class="why-line">${rec.reasons[k]}</p></div>`).join('')}
      </div>
      <section class="prefs" aria-labelledby="prefs-h">
        <h2 id="prefs-h">Preferences</h2>
        <div class="pref">
          <h3 id="lang-h">Language the helper shows and speaks</h3>
          <div class="segmented" role="group" aria-labelledby="lang-h">
            ${seg('lang', 'en', p.lang !== 'hi', 'English')}${seg('lang', 'hi', p.lang === 'hi', '<span lang="hi">हिन्दी</span>')}
          </div>
        </div>
        <div class="pref">
          <h3 id="voice-h">Read each step aloud</h3>
          <div class="row">
            <button class="btn" type="button" data-k="voice" id="voice" aria-pressed="${p.voice !== false}" aria-labelledby="voice-h voice">${p.voice !== false ? 'On' : 'Off'}</button>
            <button class="btn quiet" type="button" data-k="sample" id="sample">${I.speaker} Hear a sample</button>
          </div>
          <p class="hint" id="voice-note" role="status"></p>
        </div>
        <div class="pref">
          <h3>Who receives the OTP codes?</h3>
          <p class="hint">Portals send a one-time code to the phone linked to Aadhaar, often a son’s or daughter’s. Both boxes are optional.</p>
          <div class="otp-fields">
            <label class="field">Their first name
              <input class="text" id="helper-name" maxlength="30" autocomplete="off" value="${S.esc(p.helperName)}">
            </label>
            <label class="field">Last 4 digits of their phone
              <input class="text" id="helper-phone" inputmode="numeric" maxlength="4" size="6" autocomplete="off" value="${S.esc(p.helperPhoneEnd)}" aria-describedby="phone-err">
            </label>
          </div>
          <p class="field-error" id="phone-err" role="alert"></p>
          <p class="say"><span class="say-k">The helper will say</span><span id="say" lang="${p.lang === 'hi' ? 'hi' : 'en'}">“${S.esc(otpLine(p))}”</span></p>
          <p class="hint">This stays on this computer. It is used only for that sentence.</p>
        </div>
      </section>
      <div class="row" id="save-row">
        <button class="btn primary" type="button" id="save">${I.check} Save for “${S.esc(profile.device)}”</button>
        <button class="btn" type="button" id="again">Do the check again</button>
      </div>
      <details class="raw"><summary>What was measured</summary><pre>${S.esc(JSON.stringify({ features: profile.features, seconds: profile.timing, overrides: profile.overrides }, null, 2))}</pre></details>
    </div>`;
    const keep = focusKey && app.querySelector(`[data-k="${focusKey}"]`);
    if (keep) keep.focus({ preventScroll: true });
    else if (firstRender) document.getElementById('result-title').focus({ preventScroll: true });
    if (firstRender) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('level').classList.add('settled')));
    firstRender = false;

    // Choosing the suggested value removes the override, so the profile keeps following the check.
    const choose = (key, v, suggested) => { if (v === suggested) delete profile.overrides[key]; else profile.overrides[key] = v; render(); };
    app.querySelectorAll('[data-size]').forEach((b) => b.onclick = () => choose('target', Number(b.dataset.size), rec.suggestedTarget));
    app.querySelectorAll('[data-gap]').forEach((b) => b.onclick = () => choose('gap', Number(b.dataset.gap), rec.suggestedGap));
    app.querySelectorAll('[data-text]').forEach((b) => b.onclick = () => choose('text', Number(b.dataset.text), rec.suggestedText));
    app.querySelectorAll('[data-tech]').forEach((b) => b.onclick = () => {
      const k = b.dataset.tech, wantOn = !isOn(k, s[k]);
      if (isOn(k, rec.suggested[k]) === wantOn) delete profile.overrides[k]; else profile.overrides[k] = wantOn ? ON[k] : OFF[k];
      render();
    });
    app.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { profile.prefs.lang = b.dataset.lang; render(); });
    document.getElementById('voice').onclick = () => { profile.prefs.voice = profile.prefs.voice === false; render(); };
    document.getElementById('sample').onclick = () => speakSample(pv, p.lang);

    // Typing never re-renders the page, so the cursor stays where it is.
    const nameIn = document.getElementById('helper-name'), phoneIn = document.getElementById('helper-phone');
    const err = document.getElementById('phone-err'), say = document.getElementById('say');
    const updateSay = () => { say.textContent = `“${otpLine(profile.prefs)}”`; };
    nameIn.addEventListener('input', () => { profile.prefs.helperName = nameIn.value; updateSay(); });
    phoneIn.addEventListener('input', () => {
      const v = phoneIn.value.replace(/\D/g, '').slice(0, 4);
      if (v !== phoneIn.value) phoneIn.value = v;
      profile.prefs.helperPhoneEnd = v;
      if (v.length === 0 || v.length === 4) { err.textContent = ''; phoneIn.removeAttribute('aria-invalid'); }
      updateSay();
    });

    document.getElementById('save').onclick = () => {
      const end = profile.prefs.helperPhoneEnd || '';
      if (end.length && end.length !== 4) {
        err.textContent = 'Type all 4 last digits, or leave the box empty.';
        phoneIn.setAttribute('aria-invalid', 'true');
        phoneIn.focus();
        return;
      }
      profile.prefs.helperName = String(profile.prefs.helperName || '').trim();
      profile.settings = recNow().settings;
      profile.explain = recNow().explain;
      S.saveProfile(profile);
      // The extension's site bridge copies the saved profile into its own storage when it hears this.
      document.dispatchEvent(new CustomEvent('steady:saved'));
      if (!S.getPref('condition', '')) S.setPref('condition', 'personal');
      saved();
    };
    document.getElementById('again').onclick = () => { Object.assign(data, fresh()); intro(); focusIntro(); };
  }

  function saved() {
    const tick = I.check.replace('<svg', '<svg style="width:24px;height:24px;vertical-align:-5px;color:var(--spruce)"');
    const row = document.getElementById('save-row');
    row.outerHTML = `<div class="next-steps" id="save-row">
      <p class="profile-line" tabindex="-1" id="saved-line">${tick} Saved for “${S.esc(profile.device)}”.</p>
      <p class="hint" id="ext-line" role="status"></p>
      <h2>Next: put these settings on the helper</h2>
      <div class="row">
        <a class="btn primary" href="get.html">Get the helper extension ${I.arrow}</a>
        <a class="btn" href="portal/index.html">Try the practice portal</a>
      </div>
      <p class="study-k">For the research study</p>
      <div class="row">
        <a class="btn" href="book.html">Book an appointment</a>
        <a class="btn" href="week.html">Plan the medicine week</a>
        <a class="btn quiet" href="hub.html">Study hub</a>
      </div>
    </div>`;
    document.getElementById('saved-line').focus({ preventScroll: true });
    const ext = () => {
      const d = document.documentElement.dataset, line = document.getElementById('ext-line');
      if (line && d.steadyExtInstalled === '1' && d.steadySynced === '1') line.textContent = 'Your settings are on the helper ✓';
    };
    document.addEventListener('steady:ext', ext);
  }

  /* ---------- voice sample: uses the browser's own voices ---------- */
  function voicesReady() {
    return new Promise((resolve) => {
      const v = speechSynthesis.getVoices();
      if (v.length) return resolve(v);
      const done = () => resolve(speechSynthesis.getVoices());
      speechSynthesis.addEventListener('voiceschanged', done, { once: true });
      setTimeout(done, 1200);
    });
  }
  async function speakSample(pv, lang) {
    const note = document.getElementById('voice-note');
    if (!('speechSynthesis' in window)) { note.textContent = 'This browser has no read-aloud voices. The helper will show the text only.'; return; }
    const want = lang === 'hi' ? 'hi' : 'en';
    const voices = await voicesReady();
    const match = (pre) => voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(pre));
    const voice = match(want + '-in') || match(want);
    if (!voice && want === 'hi') {
      note.textContent = 'No Hindi voice was found in this browser. The helper will still show Hindi text. To hear it, add a Hindi voice in Windows Settings → Time & language → Speech, then restart Chrome.';
      return;
    }
    const u = new SpeechSynthesisUtterance(`${pv.main} ${pv.sub}`);
    u.lang = want === 'hi' ? 'hi-IN' : 'en-IN';
    if (voice) u.voice = voice;
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    note.textContent = voice ? `Playing with the voice “${voice.name}”.` : 'Playing with the browser’s default voice.';
  }

  const focusIntro = () => { const h = document.getElementById('intro-title'); if (h) h.focus({ preventScroll: true }); };
  intro();
})();
