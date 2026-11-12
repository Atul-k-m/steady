/* STEADY adaptation engine (MVP 2).
 * Turns fiddly controls on a page into steady ones, sized by the profile:
 *   date input → day list · range slider → stepper · HTML5 drag-and-drop → pick, then place
 *   buttons/labels → profile size + gap · slip guard · ignore-repeat · final-action confirm
 * The site's own control stays the source of truth: we set its value and fire its events.
 */
(function () {
  const S = (window.Steady = window.Steady || {});
  if (S.adapt) return;

  const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    left: svg('<path d="M15 5l-7 7 7 7"/>'),
    right: svg('<path d="M9 5l7 7-7 7"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>'),
  };
  const LEVEL_MARK = `<svg viewBox="0 0 48 24" width="40" height="20" aria-hidden="true"><rect x="1.5" y="4.5" width="45" height="15" rx="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 4.5v15M29 4.5v15" stroke="currentColor" stroke-width="1.5" opacity=".55"/><circle class="bubble" cx="24" cy="12" r="4.25" fill="currentColor"/></svg>`;

  const ACTIVATABLE = 'button, a[href], label, input:not([type="hidden"]), select, [role="button"], .steady-pickable, [data-steady-drop]';
  const FONT = '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", "Verdana", sans-serif';

  /* ---------- light-DOM styles for transformed controls (works on any host page) ---------- */
  const CSS = `
:root{--steady-target:44px;--steady-gap:8px;--st-paper:#F5F0E6;--st-paper-2:#EAE2D1;--st-ink:#1D1A15;--st-ink-2:#4A443A;--st-line:#BDB29C;--st-spruce:#1F5B4C;--st-spruce-2:#174739;--st-amber:#F2D49B;--st-amber-ink:#6B3F00}
.steady-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;margin:0!important}
html.steady-on :is(button,[role="button"],input[type="submit"],input[type="button"],select,label:has(> input[type="radio"]),label:has(> input[type="checkbox"])):not(.steady-skip):not(.steady-c *):not(.steady-pickable){min-height:var(--steady-target)!important;min-width:var(--steady-target)!important;margin:calc(var(--steady-gap) / 2)!important;font-size:max(1em,18px)!important;box-sizing:border-box!important}
html.steady-on input[type="radio"],html.steady-on input[type="checkbox"]{width:1.25em;height:1.25em}
.steady-c{font-family:${FONT};color:var(--st-ink);font-size:20px;line-height:1.35;margin:8px 0 4px;-webkit-font-smoothing:antialiased}
.steady-c *{box-sizing:border-box}
.steady-c button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.steady-c button:focus-visible,.steady-pickable:focus-visible,[data-steady-drop]:focus-visible{outline:3px solid var(--st-spruce);outline-offset:3px}
.steady-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:var(--steady-target);min-width:var(--steady-target);padding:0 18px;border-radius:12px;border:2px solid var(--st-line);background:var(--st-paper);font-weight:600;transition:background-color .15s,border-color .15s}
.steady-btn:hover{border-color:var(--st-ink-2)}
.steady-btn:disabled{opacity:.45;cursor:not-allowed}
.steady-date-head{display:flex;align-items:center;justify-content:space-between;gap:var(--steady-gap);margin-bottom:var(--steady-gap)}
.steady-date-range{margin:0;font-weight:600;text-align:center}
.steady-days{display:grid;grid-template-columns:repeat(auto-fill,minmax(max(var(--steady-target),84px),1fr));gap:var(--steady-gap)}
.steady-day{flex-direction:column;gap:0;padding:8px 4px;min-height:max(var(--steady-target),76px);line-height:1.1}
.steady-day small{font-size:15px;font-weight:600;color:var(--st-ink-2)}
.steady-day strong{font-size:24px;font-variant-numeric:tabular-nums}
.steady-day .steady-tag{font-size:13px;font-weight:700;letter-spacing:.02em;color:var(--st-spruce)}
.steady-c [aria-pressed="true"]{background:var(--st-spruce);border-color:var(--st-spruce);color:#fff}
.steady-c [aria-pressed="true"] small,.steady-c [aria-pressed="true"] .steady-tag{color:#E4EFEA}
.steady-c [aria-pressed="true"] svg{display:inline}
.steady-day svg{display:none;width:18px;height:18px}
.steady-step{display:flex;align-items:center;gap:var(--steady-gap);flex-wrap:wrap}
.steady-step output{min-width:5.5ch;text-align:center;font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}
.steady-presets{display:flex;flex-wrap:wrap;gap:var(--steady-gap);margin-top:var(--steady-gap)}
.steady-presets button svg{display:none;width:18px;height:18px}
.steady-pickable{cursor:pointer;outline-offset:3px;user-select:none}
.steady-pickable[aria-pressed="true"]{background:var(--st-amber)!important;color:var(--st-amber-ink)!important;box-shadow:0 0 0 3px var(--st-amber-ink),0 6px 16px rgba(60,40,0,.18)!important}
.steady-pickable[aria-pressed="true"]::after{content:"Picked";margin-left:.6em;font:700 14px/1 ${FONT};padding:4px 8px;border-radius:999px;background:var(--st-amber-ink);color:#fff}
html.steady-picking [data-steady-drop]{position:relative;outline:3px dashed var(--st-spruce)!important;outline-offset:-3px;cursor:pointer;background-color:rgba(31,91,76,.06)!important}
html.steady-picking [data-steady-drop]:hover{background-color:rgba(31,91,76,.14)!important}
html.steady-picking [data-steady-drop]::before{content:"Place here";position:absolute;top:6px;right:6px;font:700 15px/1 ${FONT};padding:6px 10px;border-radius:999px;background:var(--st-spruce);color:#fff;pointer-events:none;z-index:1}
`;

  /* ---------- state ---------- */
  let settings = null, condition = 'personal', steadier = false, showOriginal = false;
  const cleanups = [];
  let host = null, root = null, picked = null, lastMove = null, lastPointerY = 0, expanded = false;
  const params = new URLSearchParams(location.search);

  function injectStyle() {
    if (document.getElementById('steady-style')) return;
    const st = document.createElement('style');
    st.id = 'steady-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function apply() {
    teardown();
    condition = S.getPref('condition', 'personal');
    steadier = S.getPref('steadier', '0') === '1';
    const ds = document.documentElement.dataset;
    if (ds.steadyExt === '1') { // on a website, under the extension: the bridge sends settings only, never the profile
      let pushed = null;
      try { pushed = ds.steadySettings ? JSON.parse(ds.steadySettings) : null; } catch (e) { /* ignore */ }
      settings = showOriginal ? null : pushed;
    } else {
      settings = showOriginal ? null : S.settingsFor(condition, S.loadProfile(), steadier && condition === 'personal');
    }
    window.__steadySettings = settings;
    window.__steadySlipGuard = !!(settings && settings.slipGuard);
    const de = document.documentElement;
    de.classList.toggle('steady-on', !!settings);
    if (settings) {
      de.style.setProperty('--steady-target', settings.target + 'px');
      de.style.setProperty('--steady-gap', settings.gap + 'px');
      scan();
    }
    renderPanel();
  }

  function teardown() {
    cancelPick(true);
    while (cleanups.length) { try { cleanups.pop()(); } catch (e) { /* keep going */ } }
    document.documentElement.classList.remove('steady-on');
  }

  function scan() {
    if (!settings) return;
    if (settings.dateMode === 'list') document.querySelectorAll('input[type="date"]:not([data-steady-done])').forEach(dateList);
    if (settings.sliderMode === 'stepper') document.querySelectorAll('input[type="range"]:not([data-steady-done])').forEach(stepper);
    if (settings.dragMode === 'pick') document.querySelectorAll('[draggable="true"]:not([data-steady-done])').forEach(pickable);
  }

  /* ---------- wiring to the site's own controls ---------- */
  function setValue(input, value) {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc.set.call(input, String(value)); // bypasses React's value tracker so its onChange fires
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function labelFor(input) {
    if (input.labels && input.labels[0]) return input.labels[0].textContent.trim();
    return input.getAttribute('aria-label') || input.name || '';
  }
  function keepFocus(container, render) {
    const a = document.activeElement;
    const key = a && container.contains(a) ? a.dataset.key : null;
    render();
    if (key) { const b = container.querySelector(`[data-key="${key}"]`); if (b) b.focus(); }
  }

  /* ---------- date input → day list ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmt = (d, o) => d.toLocaleDateString(undefined, o);

  function dateList(input) {
    input.dataset.steadyDone = '1';
    const today = parse(iso(new Date()));
    const min = input.min ? parse(input.min) : today;
    const max = input.max ? parse(input.max) : null;
    let start = input.value && parse(input.value) > addDays(min, 13) ? parse(input.value) : min;
    const wrap = document.createElement('div');
    wrap.className = 'steady-c steady-date';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', labelFor(input) || 'Choose a day');
    input.classList.add('steady-visually-hidden');
    input.after(wrap);

    function render() {
      const end = addDays(start, 13);
      const days = [];
      for (let i = 0; i < 14; i++) {
        const d = addDays(start, i), v = iso(d);
        const off = d < min || (max && d > max);
        const rel = v === iso(today) ? 'Today' : v === iso(addDays(today, 1)) ? 'Tomorrow' : '';
        const full = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
        days.push(`<button type="button" class="steady-btn steady-day" data-key="${v}" data-iso="${v}" aria-label="${full}${rel ? ', ' + rel : ''}" aria-pressed="${input.value === v}" ${off ? 'disabled' : ''}>
          <small>${fmt(d, { weekday: 'short' })}</small><strong>${d.getDate()}</strong><small>${rel ? `<span class="steady-tag">${rel}</span>` : fmt(d, { month: 'short' })}</small>${ICON.check}</button>`);
      }
      wrap.innerHTML = `<div class="steady-date-head">
          <button type="button" class="steady-btn" data-key="prev" data-dir="-1" ${start <= min ? 'disabled' : ''}>${ICON.left}<span>Earlier</span></button>
          <p class="steady-date-range">${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}</p>
          <button type="button" class="steady-btn" data-key="next" data-dir="1" ${max && end >= max ? 'disabled' : ''}><span>Later</span>${ICON.right}</button>
        </div><div class="steady-days">${days.join('')}</div>`;
    }
    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.dir) {
        start = addDays(start, 14 * Number(b.dataset.dir));
        if (start < min) start = min;
        keepFocus(wrap, render);
      } else if (b.dataset.iso) {
        setValue(input, b.dataset.iso);
        keepFocus(wrap, render);
        announce(`Chosen: ${b.getAttribute('aria-label')}`);
      }
    };
    const onExternal = () => keepFocus(wrap, render);
    wrap.addEventListener('click', onClick);
    input.addEventListener('change', onExternal);
    render();
    cleanups.push(() => { wrap.remove(); input.removeEventListener('change', onExternal); input.classList.remove('steady-visually-hidden'); delete input.dataset.steadyDone; });
  }

  /* ---------- range slider → stepper ---------- */
  function stepper(input) {
    input.dataset.steadyDone = '1';
    const min = input.min !== '' ? Number(input.min) : 0;
    const max = input.max !== '' ? Number(input.max) : 100;
    const step = Number(input.step) || 1;
    const unit = input.dataset.unit || '';
    const snap = (v) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
    const presets = input.dataset.steadyPresets
      ? input.dataset.steadyPresets.split(',').map(Number)
      : [...new Set([0, 0.25, 0.5, 0.75, 1].map((q) => snap(min + q * (max - min))))];
    const wrap = document.createElement('div');
    wrap.className = 'steady-c steady-slider';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', labelFor(input) || 'Adjust value');
    input.classList.add('steady-visually-hidden');
    input.after(wrap);
    const show = (v) => `${v}${unit ? ' ' + unit : ''}`;
    function render() {
      const v = Number(input.value);
      wrap.innerHTML = `<div class="steady-step">
          <button type="button" class="steady-btn" data-key="dec" data-delta="-1" aria-label="Less, by ${step}" ${v <= min ? 'disabled' : ''}>${ICON.minus}</button>
          <output aria-live="polite">${show(v)}</output>
          <button type="button" class="steady-btn" data-key="inc" data-delta="1" aria-label="More, by ${step}" ${v >= max ? 'disabled' : ''}>${ICON.plus}</button>
        </div>
        <div class="steady-presets">${presets.map((p) => `<button type="button" class="steady-btn" data-key="p${p}" data-value="${p}" aria-pressed="${v === p}">${ICON.check}${show(p)}</button>`).join('')}</div>`;
    }
    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const v = Number(input.value);
      const next = b.dataset.delta ? snap(v + Number(b.dataset.delta) * step) : snap(Number(b.dataset.value));
      setValue(input, next);
      keepFocus(wrap, render);
    };
    const onExternal = () => keepFocus(wrap, render);
    wrap.addEventListener('click', onClick);
    input.addEventListener('input', onExternal);
    render();
    cleanups.push(() => { wrap.remove(); input.removeEventListener('input', onExternal); input.classList.remove('steady-visually-hidden'); delete input.dataset.steadyDone; });
  }

  /* ---------- drag-and-drop → pick, then place ---------- */
  const nameOf = (el) => el.getAttribute('aria-label') || el.dataset.name || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
  function pickable(item) {
    item.dataset.steadyDone = '1';
    item.setAttribute('draggable', 'false'); // no accidental native drags while in pick mode
    item.classList.add('steady-pickable');
    const hadRole = item.hasAttribute('role'), hadTab = item.hasAttribute('tabindex');
    if (!hadRole) item.setAttribute('role', 'button');
    if (!hadTab) item.tabIndex = 0;
    item.setAttribute('aria-pressed', 'false');
    const onClick = (e) => { e.preventDefault(); e.stopPropagation(); togglePick(item); };
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePick(item); } };
    item.addEventListener('click', onClick);
    item.addEventListener('keydown', onKey);
    cleanups.push(() => {
      item.removeEventListener('click', onClick); item.removeEventListener('keydown', onKey);
      item.setAttribute('draggable', 'true'); item.classList.remove('steady-pickable'); item.removeAttribute('aria-pressed');
      if (!hadRole) item.removeAttribute('role');
      if (!hadTab) item.removeAttribute('tabindex');
      delete item.dataset.steadyDone;
    });
  }
  function zones() { return [...document.querySelectorAll('[data-steady-drop]')]; }
  function togglePick(item) {
    if (picked === item) { cancelPick(); announce('Put down. Nothing moved.'); return; }
    cancelPick(true);
    picked = item;
    item.setAttribute('aria-pressed', 'true');
    document.documentElement.classList.add('steady-picking');
    zones().forEach((z) => {
      z.dataset.steadyZone = '1';
      if (!z.hasAttribute('tabindex')) { z.tabIndex = 0; z.dataset.steadyTab = '1'; }
      z.setAttribute('aria-label', `Place ${nameOf(item)} in ${z.dataset.name || nameOf(z)}`);
    });
    renderPanel(`Picked: ${nameOf(item)}. Now click where it goes.`);
  }
  function cancelPick(silent) {
    if (!picked) return;
    picked.setAttribute('aria-pressed', 'false');
    picked = null;
    document.documentElement.classList.remove('steady-picking');
    zones().forEach((z) => {
      if (z.dataset.steadyTab) { z.removeAttribute('tabindex'); delete z.dataset.steadyTab; }
      if (z.dataset.steadyZone) { z.removeAttribute('aria-label'); delete z.dataset.steadyZone; }
    });
    if (!silent) renderPanel();
  }
  function fire(el, type, dt, x, y) {
    return el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, clientX: x, clientY: y }));
  }
  function moveTo(item, zone) {
    const from = item.parentElement && item.parentElement.closest('[data-steady-drop]');
    const dt = new DataTransfer();
    const ir = item.getBoundingClientRect(), zr = zone.getBoundingClientRect();
    const cx = zr.left + zr.width / 2, cy = zr.top + zr.height / 2;
    window.__steadySynth = true;
    try {
      fire(item, 'dragstart', dt, ir.left + ir.width / 2, ir.top + ir.height / 2);
      fire(zone, 'dragenter', dt, cx, cy);
      fire(zone, 'dragover', dt, cx, cy);
      fire(zone, 'drop', dt, cx, cy);
      fire(item, 'dragend', dt, cx, cy);
    } finally { window.__steadySynth = false; }
    return from;
  }
  function placeInto(zone) {
    const item = picked;
    if (!item) return;
    cancelPick(true);
    const from = moveTo(item, zone);
    lastMove = from && from !== zone ? { item, from } : null;
    renderPanel(`Placed ${nameOf(item)} in ${zone.dataset.name || nameOf(zone)}.`);
  }
  document.addEventListener('click', (e) => {
    if (!picked) return;
    const t = e.composedPath()[0];
    if (!(t instanceof Element) || t.closest('.steady-ui')) return;
    const zone = t.closest('[data-steady-zone]');
    if (zone) { e.preventDefault(); placeInto(zone); }
  });
  document.addEventListener('keydown', (e) => {
    if (!picked) return;
    if (e.key === 'Escape') { cancelPick(); announce('Put down. Nothing moved.'); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.matches('[data-steady-zone]')) { e.preventDefault(); placeInto(e.target); }
  });

  /* ---------- slip guard + ignore-repeat (Steady Clicks lineage) ---------- */
  let downInfo = null, suppressUntil = 0, lastAct = { t: 0, el: null };
  function synthClick(el) {
    window.__steadySynth = true;
    try { el.click(); } finally { window.__steadySynth = false; }
    lastAct = { t: performance.now(), el };
  }
  window.addEventListener('pointerdown', (e) => {
    lastPointerY = e.clientY;
    if (!settings || !settings.slipGuard || e.button !== 0) { downInfo = null; return; }
    const t = e.composedPath()[0];
    const el = t instanceof Element ? t.closest(ACTIVATABLE) : null;
    downInfo = el ? { el, x: e.clientX, y: e.clientY } : null;
  }, true);
  window.addEventListener('pointerup', (e) => {
    if (!downInfo || !settings || !settings.slipGuard) return;
    const { el, x, y } = downInfo;
    downInfo = null;
    const t = e.composedPath()[0];
    if (t instanceof Element && el.contains(t)) return;
    // Moving farther than one target width still cancels (WCAG 2.5.2 pointer cancellation).
    if (Math.hypot(e.clientX - x, e.clientY - y) > settings.target) return;
    suppressUntil = performance.now() + 150;
    setTimeout(() => synthClick(el), 0);
  }, true);
  window.addEventListener('click', (e) => {
    if (window.__steadySynth) return;
    const now = performance.now();
    if (now < suppressUntil) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!settings || !settings.ignoreRepeatMs) return;
    const t = e.composedPath()[0];
    const el = t instanceof Element ? t.closest(ACTIVATABLE) : null;
    if (!el) return;
    const labelEcho = el.tagName === 'INPUT' && lastAct.el && lastAct.el.tagName === 'LABEL' && lastAct.el.control === el && now - lastAct.t < 100;
    if (!labelEcho && now - lastAct.t < settings.ignoreRepeatMs) {
      e.preventDefault(); e.stopImmediatePropagation();
      S.metrics && S.metrics.log('repeat_blocked', el.id || el.textContent.trim().slice(0, 24));
      return;
    }
    lastAct = { t: now, el };
  }, true);

  /* ---------- final-action confirm ---------- */
  window.addEventListener('submit', (e) => {
    const form = e.target;
    if (!settings || !settings.confirmFinal || !(form instanceof HTMLFormElement)) return;
    if (!form.checkValidity()) return; // let the site show its own validation first
    if (form.dataset.steadyConfirmed === '1') { delete form.dataset.steadyConfirmed; return; }
    e.preventDefault(); e.stopImmediatePropagation();
    showConfirm(form, e.submitter);
  }, true);

  function showConfirm(form, submitter) {
    ensurePanel();
    const action = (submitter && (submitter.value || submitter.textContent).trim()) || 'Submit';
    const summary = form.dataset.steadySummary || 'Please check the details above.';
    const atTop = lastPointerY > innerHeight / 2; // appear away from the hand
    const bar = root.querySelector('.confirm');
    bar.className = 'confirm ' + (atTop ? 'top' : 'bottom');
    bar.innerHTML = `<h2 id="steady-confirm-h" tabindex="-1">Check before you ${action.toLowerCase()}</h2>
      <p>${summary}</p>
      <div class="row"><button type="button" class="primary" data-act="yes" disabled>${ICON.check}<span>Yes, ${action.toLowerCase()}</span></button>
      <button type="button" data-act="no" disabled>${ICON.left}<span>Go back</span></button></div>
      <p class="hint" aria-live="polite">Ready in a moment…</p>`;
    bar.hidden = false;
    bar.querySelector('h2').focus();
    setTimeout(() => { bar.querySelectorAll('button').forEach((b) => (b.disabled = false)); bar.querySelector('.hint').textContent = ''; }, 600);
    bar.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      bar.hidden = true;
      if (b.dataset.act === 'yes') { form.dataset.steadyConfirmed = '1'; form.requestSubmit(submitter || undefined); }
      else announce('Nothing was sent. You can keep editing.');
    };
  }

  /* ---------- panel (shadow DOM, isolated from host styles) ---------- */
  const PANEL_CSS = `
:host{all:initial}
*{box-sizing:border-box}
.panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:min(300px,calc(100vw - 32px));font-family:${FONT};font-size:16px;line-height:1.35;color:#1D1A15;background:#F5F0E6;border:1.5px solid #BDB29C;border-radius:18px;padding:12px 12px 12px 14px;box-shadow:0 10px 30px rgba(40,30,10,.18),0 2px 6px rgba(40,30,10,.12)}
.head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px}
.toggle{min-height:44px!important;padding:0 12px!important;font-size:15px!important}
.ctx{margin-bottom:8px}
[hidden]{display:none!important}
.brand{display:flex;align-items:center;gap:10px;color:#1F5B4C;font:700 20px/1 "Literata",Georgia,serif;margin:0}
.status{margin:0 0 8px;color:#4A443A}
.more{margin-top:4px}
.status b{color:#1D1A15}
.row{display:flex;flex-wrap:wrap;gap:8px}
button,a.btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:var(--t,44px);padding:0 14px;border-radius:12px;border:2px solid #BDB29C;background:#FBF8F2;color:#1D1A15;font:600 16px/1.1 ${FONT};cursor:pointer}
button:hover,a.btn:hover{border-color:#4A443A}
button:focus-visible,a.btn:focus-visible,h2:focus-visible{outline:3px solid #1F5B4C;outline-offset:2px}
button[aria-pressed="true"]{background:#1F5B4C;border-color:#1F5B4C;color:#fff}
button svg,a.btn svg{width:20px;height:20px}
.live{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#EAE2D1;font-weight:600}
.live:empty{display:none}
.confirm{position:fixed;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(640px,calc(100vw - 32px));background:#FBF8F2;color:#1D1A15;border:2px solid #1F5B4C;border-radius:20px;padding:20px 22px;font-family:${FONT};font-size:19px;box-shadow:0 18px 48px rgba(40,30,10,.28),0 3px 8px rgba(40,30,10,.14)}
.confirm.top{top:16px}.confirm.bottom{bottom:16px}
.confirm h2{margin:0 0 6px;font:700 24px/1.2 "Literata",Georgia,serif}
.confirm p{margin:0 0 14px}
.confirm .row button{min-height:max(var(--t,44px),56px);font-size:19px;padding:0 22px}
.confirm .primary{background:#1F5B4C;border-color:#1F5B4C;color:#fff}
.confirm .primary:hover{background:#174739}
.confirm button:disabled{opacity:.5;cursor:wait}
.hint{color:#4A443A;font-size:16px;margin:10px 0 0!important}
.bubble{transition:transform .9s cubic-bezier(.16,1,.3,1)}
@media (prefers-reduced-motion:reduce){.bubble{transition:none}}
`;
  function ensurePanel() {
    if (host) return;
    host = document.createElement('steady-panel');
    host.className = 'steady-ui';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${PANEL_CSS}</style><section class="panel" role="region" aria-label="Steady settings"></section><div class="confirm" role="dialog" aria-labelledby="steady-confirm-h" hidden></div>`;
    (document.body || document.documentElement).appendChild(host);
    root.addEventListener('click', onPanelClick);
  }
  function renderPanel(message) {
    if (params.get('panel') === '0') return;
    ensurePanel();
    const p = root.querySelector('.panel');
    const t = settings ? Math.min(72, Math.max(44, settings.target)) : 44;
    host.style.setProperty('--t', t + 'px');
    const label = { original: 'Original page', fixed: 'Fixed accessible', personal: 'Fitted to you' }[condition] || condition;
    const status = !settings
      ? (showOriginal ? 'Showing the original controls.' : `<b>${label}.</b> Steady is off for this task.`)
      : (condition === 'personal' && !(document.documentElement.dataset.steadyExt === '1' ? document.documentElement.dataset.steadyCalibrated === '1' : S.loadProfile()))
        ? `<b>${label}.</b> Standard settings until you calibrate.`
        : `<b>${label}.</b> Buttons ${settings.target} px, gaps ${settings.gap} px${settings.slipGuard ? ', slip guard on' : ''}.`;
    const calUrl = document.documentElement.dataset.steadyCalibrateUrl || 'calibrate.html';
    const hasSettings = condition !== 'original';
    p.innerHTML = `<div class="head"><p class="brand">${LEVEL_MARK}<span>Steady</span></p>
        ${hasSettings ? `<button type="button" class="toggle" data-act="toggle" aria-expanded="${expanded}">${expanded ? 'Less' : 'Settings'}</button>` : ''}</div>
      <p class="status">${status}</p>
      ${picked || lastMove ? `<div class="row ctx">
        ${picked ? `<button type="button" data-act="cancel">${ICON.x}<span>Cancel</span></button>` : ''}
        ${lastMove ? `<button type="button" data-act="undo">${ICON.undo}<span>Undo move</span></button>` : ''}</div>` : ''}
      <div class="row more" ${expanded && hasSettings ? '' : 'hidden'}>
        ${condition === 'personal' ? `<button type="button" data-act="steadier" aria-pressed="${steadier}">Steadier today</button>` : ''}
        <button type="button" data-act="original" aria-pressed="${showOriginal}">Show original</button>
        ${condition === 'personal' ? `<a class="btn" href="${calUrl}">Recalibrate</a>` : ''}
      </div>
      <p class="live" aria-live="polite">${message || ''}</p>`;
  }
  function announce(msg) { if (!root) return; const l = root.querySelector('.live'); if (l) l.textContent = msg; }
  function onPanelClick(e) {
    const b = e.target.closest('button');
    if (!b || !b.dataset.act) return;
    const act = b.dataset.act;
    if (act === 'toggle') { expanded = !expanded; renderPanel(); root.querySelector('[data-act="toggle"]').focus(); return; }
    if (act === 'steadier') { S.setPref('steadier', steadier ? '0' : '1'); apply(); announce(steadier ? 'Steadier settings on for today.' : 'Back to your usual settings.'); }
    if (act === 'original') { showOriginal = !showOriginal; apply(); }
    if (act === 'cancel') { cancelPick(); announce('Put down. Nothing moved.'); }
    if (act === 'undo' && lastMove) {
      const { item, from } = lastMove;
      lastMove = null;
      moveTo(item, from);
      renderPanel(`Moved ${nameOf(item)} back.`);
    }
  }

  /* ---------- boot ---------- */
  let queued = false;
  function observe() {
    new MutationObserver(() => {
      if (queued || !settings) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; scan(); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  function init() { injectStyle(); apply(); observe(); }
  document.addEventListener('steady:profile', () => apply()); // from the extension bridge

  S.adapt = { apply, settings: () => settings, setValue };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
