/* STEADY core: features → estimator → policy → profile.
 * Pure functions, no DOM. Loads in the browser (window.Steady) and in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Steady = Object.assign(root.Steady || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LEVELS = [44, 56, 72, 96, 120];          // px; 44 = WCAG 2.5.5 AAA floor
  const PRIOR = { sigma: 6, weight: 4, slipP90: 2 }; // population prior (literature-informed, (A))
  const Z_AXIS = 2.24;                             // per-axis z → ~95% joint 2-D hit
  const MODEL_ID = 'policy-tree@0.1.0';

  /* ---------- small stats ---------- */
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  function quantile(arr, q) {
    if (!arr.length) return 0;
    const s = [...arr].sort((x, y) => x - y);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }
  const round1 = (v) => Math.round(v * 10) / 10;

  /* ---------- features: pointing ---------- */
  // trial: { tx, ty, fromX, fromY, downX, downY, upX, upY, mt, repeat }
  function pointingFeatures(trials) {
    const rows = [];
    for (const t of trials) {
      const dx = t.downX - t.tx, dy = t.downY - t.ty;
      const ax = t.tx - t.fromX, ay = t.ty - t.fromY;
      const len = Math.hypot(ax, ay) || 1;
      const ux = ax / len, uy = ay / len;
      rows.push({
        dist: Math.hypot(dx, dy),
        along: dx * ux + dy * uy,
        across: -dx * uy + dy * ux,
        slip: Math.hypot((t.upX ?? t.downX) - t.downX, (t.upY ?? t.downY) - t.downY),
        mt: t.mt || 0,
        repeat: !!t.repeat,
      });
    }
    // Drop lapses (looked away, wrong dot): > max(80px, 4× median distance)
    const med = quantile(rows.map((r) => r.dist), 0.5);
    const kept = rows.filter((r) => r.dist <= Math.max(80, 4 * med));
    const n = kept.length;

    // Bayesian shrinkage of variance toward the prior: σ² = (w·σ0² + Σ(a²+c²)/2) / (w + n)
    const ss = sum(kept.map((r) => (r.along ** 2 + r.across ** 2) / 2));
    const sigma = Math.sqrt((PRIOR.weight * PRIOR.sigma ** 2 + ss) / (PRIOR.weight + n));
    const sdAxis = (key) =>
      Math.sqrt((PRIOR.weight * PRIOR.sigma ** 2 + sum(kept.map((r) => r[key] ** 2))) / (PRIOR.weight + n));

    return {
      sigma: round1(sigma),
      sigmaAlong: round1(sdAxis('along')),
      sigmaAcross: round1(sdAxis('across')),
      slipP50: round1(quantile(rows.map((r) => r.slip), 0.5)),
      slipP90: round1(quantile(rows.map((r) => r.slip), 0.9)),
      repeatRate: rows.length ? round1((rows.filter((r) => r.repeat).length / rows.length) * 100) / 100 : 0,
      mtMs: Math.round(quantile(rows.map((r) => r.mt), 0.5)),
      trials: n,
    };
  }

  /* ---------- features: hold-still tremor ---------- */
  // samples: [{ t (ms), x, y }] irregular; resample at 60 Hz, detrend, RMS + dominant frequency.
  function tremorFeatures(samples, durationMs) {
    if (!samples || samples.length < 4) return { tremorRms: 0, tremorHz: 0 };
    const fs = 60, t0 = samples[0].t, T = durationMs || samples[samples.length - 1].t - t0;
    const N = Math.max(8, Math.floor((T / 1000) * fs));
    const xs = new Array(N), ys = new Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const t = t0 + (i * 1000) / fs;
      while (j < samples.length - 2 && samples[j + 1].t < t) j++;
      const a = samples[j], b = samples[Math.min(j + 1, samples.length - 1)];
      const span = b.t - a.t || 1;
      const k = Math.min(1, Math.max(0, (t - a.t) / span));
      xs[i] = a.x + (b.x - a.x) * k;
      ys[i] = a.y + (b.y - a.y) * k;
    }
    // detrend with a 250 ms centred moving average (removes slow drift, keeps 3–15 Hz tremor)
    const w = Math.round(0.25 * fs), half = Math.floor(w / 2);
    const detrend = (arr) =>
      arr.map((v, i) => {
        const lo = Math.max(0, i - half), hi = Math.min(arr.length, i + half + 1);
        return v - mean(arr.slice(lo, hi));
      });
    const dx = detrend(xs), dy = detrend(ys);
    const rms = Math.sqrt(mean(dx.map((v, i) => v * v + dy[i] * dy[i])));
    let bestHz = 0, bestP = 0;
    if (rms >= 0.3) {
      for (let f = 2; f <= 15; f += 0.25) {
        let re = 0, im = 0, re2 = 0, im2 = 0;
        for (let i = 0; i < N; i++) {
          const ph = (2 * Math.PI * f * i) / fs;
          re += dx[i] * Math.cos(ph); im -= dx[i] * Math.sin(ph);
          re2 += dy[i] * Math.cos(ph); im2 -= dy[i] * Math.sin(ph);
        }
        const p = re * re + im * im + re2 * re2 + im2 * im2;
        if (p > bestP) { bestP = p; bestHz = f; }
      }
    }
    return { tremorRms: round1(rms), tremorHz: round1(bestHz) };
  }

  // Returns {} when the step was skipped, so "was it measured?" can be read from the features alone.
  function dragFeatures(d) {
    if (!d || !d.attempts) return {};
    return { dragFailRate: round1((d.failures / d.attempts) * 100) / 100, dragMs: Math.round(d.ms || 0) };
  }
  const STEPS = [['tap', 'Tap the dots'], ['hold', 'Hold steady'], ['move', 'Move it']];
  function measuredSteps(features) {
    const f = features || {};
    return { tap: f.trials > 0, hold: 'tremorRms' in f, move: 'dragFailRate' in f };
  }

  /* ---------- policy: a decision tree stored as JSON (replaceable by a trained export) ---------- */
  const POLICY = {
    id: MODEL_ID,
    outputs: {
      slipGuard: { if: ['slipP90', '>', 5], then: true, else: false },
      ignoreRepeatMs: { if: ['repeatRate', '>=', 0.15], then: 600, else: { if: ['repeatRate', '>', 0], then: 400, else: 0 } },
      dragMode: { if: ['dragFailRate', '>', 0], then: 'pick', else: { if: ['sigma', '>', 8], then: 'pick', else: { if: ['tremorRms', '>', 2], then: 'pick', else: 'native' } } },
      dateMode: { if: ['target', '>=', 56], then: 'list', else: { if: ['sigma', '>', 6], then: 'list', else: 'native' } },
      sliderMode: { if: ['tremorRms', '>', 1.5], then: 'stepper', else: { if: ['sigma', '>', 6], then: 'stepper', else: 'native' } },
      confirmFinal: { if: ['repeatRate', '>', 0], then: true, else: { if: ['slipP90', '>', 8], then: true, else: { if: ['target', '>=', 72], then: true, else: false } } },
    },
  };

  const OPS = { '>': (a, b) => a > b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, '<=': (a, b) => a <= b };
  function evalNode(node, f) {
    if (node && typeof node === 'object' && Array.isArray(node.if)) {
      const [key, op, val] = node.if;
      return evalNode(OPS[op](f[key] ?? 0, val) ? node.then : node.else, f);
    }
    return node;
  }

  /* ---------- recommend ---------- */
  function sizeFor(sigma, slipP90) {
    const raw = 2 * Z_AXIS * sigma + slipP90;
    let idx = LEVELS.findIndex((l) => l >= raw);
    if (idx === -1) idx = LEVELS.length - 1;
    return { raw: round1(raw), idx };
  }

  const STEADIER_ON = { slipGuard: true, confirmFinal: true, dragMode: 'pick', dateMode: 'list', sliderMode: 'stepper' };
  const nextLevel = (px) => LEVELS.find((l) => l > px) || LEVELS[LEVELS.length - 1];

  // opts: { steadier, overrides }. A chosen size or gap feeds the policy (big buttons → big calendars);
  // a chosen technique wins over the policy; "Steadier today" adds one size and turns the guards on.
  function recommend(features, opts) {
    const o = opts || {}, ov = o.overrides || {};
    const f = Object.assign({ sigma: PRIOR.sigma, slipP90: PRIOR.slipP90, repeatRate: 0, tremorRms: 0, dragFailRate: 0 }, features || {});
    const { raw, idx } = sizeFor(f.sigma, f.slipP90);
    const suggestedTarget = LEVELS[idx], suggestedGap = Math.max(8, Math.round(f.sigma));
    const baseTarget = ov.target || suggestedTarget, baseGap = ov.gap || suggestedGap;
    const target = o.steadier ? nextLevel(baseTarget) : baseTarget;
    const gap = baseGap + (o.steadier ? 4 : 0);
    const ctx = Object.assign({}, f, { target });
    const suggested = { target, gap };
    for (const key of Object.keys(POLICY.outputs)) suggested[key] = evalNode(POLICY.outputs[key], ctx);
    const settings = Object.assign({}, suggested);
    for (const key of Object.keys(POLICY.outputs)) if (key in ov) settings[key] = ov[key];
    if (o.steadier) Object.assign(settings, STEADIER_ON);
    const why = reasons(f, settings, { ov, steadier: !!o.steadier, suggestedTarget, suggested, measured: measuredSteps(features) });
    return { settings, suggested, suggestedTarget, suggestedGap, rawTarget: raw, level: LEVELS.indexOf(settings.target) + 1, reasons: why.byKey, explain: why.summary };
  }

  const isOn = (k, v) => (k === 'ignoreRepeatMs' ? v > 0 : v === true || v === 'pick' || v === 'list' || v === 'stepper');

  // One plain reason per setting (on or off), plus a short summary list for the result page.
  function reasons(f, s, { ov, steadier, suggestedTarget, suggested, measured }) {
    const px = (v) => `${Math.round(v)} px`;
    const by = {};
    by.target = ov.target ? `You chose ${s.target} px buttons. The check suggested ${suggestedTarget} px.`
      : measured.tap ? `Your clicks land within about ${px(f.sigma)} of where you aim, so buttons are ${s.target} px.`
      : `Buttons use the standard ${s.target} px size, because the dots were not measured.`;
    if (steadier) by.target += ' “Steadier today” adds one size.';
    by.gap = ov.gap ? `You chose ${s.gap} px gaps.`
      : measured.tap ? `Gaps are ${s.gap} px, about one typical miss, so a near-miss lands in the gap and does nothing.`
      : `Gaps use the standard ${s.gap} px.`;
    const auto = {
      slipGuard: [`Your pointer moves about ${px(f.slipP90)} while the button goes down, so a click counts where you pressed, not where you let go.`,
        measured.tap ? 'Your pointer stays put while the button goes down, so clicks work as usual.' : 'Off, because slipping was not measured.'],
      ignoreRepeatMs: [`Some presses came twice, so a second click within ${s.ignoreRepeatMs} ms is ignored.`,
        'No double presses were seen, so every click counts.'],
      dragMode: [`${f.dragFailRate > 0 ? 'A drag missed the box during the check, so dragging' : f.tremorRms > 2 ? 'The pointer shook while holding still, so dragging' : 'Dragging'} is replaced by pick, then place: click the item, then click where it goes.`,
        measured.move ? 'Your drags landed in the box, so dragging works as usual.' : 'Dragging works as usual.'],
      dateMode: [`${s.target >= 56 ? 'Buttons are large, so calendars' : 'Calendars'} become a list of large day buttons.`,
        'Your aim fits the site’s own calendar, so it stays as it is.'],
      sliderMode: [`${f.tremorRms > 1.5 ? 'The pointer shook while holding still, so sliders' : 'Sliders'} become − and + buttons with preset values.`,
        measured.hold ? 'Your hand held still, so sliders work as usual.' : 'Sliders work as usual.'],
      confirmFinal: ['Before anything is booked or saved, you see what will happen and confirm it.',
        'Final buttons work straight away, with no extra step.'],
    };
    for (const k of Object.keys(auto)) {
      const on = isOn(k, s[k]);
      if (steadier && k in STEADIER_ON) by[k] = `“Steadier today” turns this on. ${auto[k][0]}`;
      else if (k in ov) by[k] = `You turned this ${on ? 'on' : 'off'}. The check suggested ${isOn(k, suggested[k]) ? 'on' : 'off'}.`;
      else by[k] = auto[k][on ? 0 : 1];
    }

    const summary = [];
    const skipped = STEPS.filter(([k]) => !measured[k]).map(([, name]) => name);
    if (skipped.length === STEPS.length) summary.push('No calibration yet, so these are standard large settings. A 60-second check will fit them to you.');
    else {
      summary.push(ov.target
        ? `You chose ${s.target} px buttons with ${s.gap} px gaps. A near-miss lands in the gap and does nothing.`
        : measured.tap
          ? `Your clicks land within about ${px(f.sigma)} of where you aim, so buttons are ${s.target} px with ${s.gap} px gaps. A near-miss lands in the gap and does nothing.`
          : `Buttons are the standard ${s.target} px with ${s.gap} px gaps.`);
      if (skipped.length) summary.push(`You skipped ${skipped.join(' and ')}, so the settings that depend on ${skipped.length > 1 ? 'them' : 'it'} use standard values.`);
    }
    for (const k of Object.keys(auto)) if (isOn(k, s[k])) summary.push(by[k]);
    return { byKey: by, summary };
  }

  /* ---------- presets & conditions ---------- */
  const FIXED = Object.freeze({ target: 44, gap: 8, slipGuard: false, ignoreRepeatMs: 0, dragMode: 'pick', dateMode: 'list', sliderMode: 'stepper', confirmFinal: false });

  function buildProfile({ pointing, tremor, drag, device, timing }) {
    const features = Object.assign({}, pointing || {}, tremor || {}, dragFeatures(drag));
    const rec = recommend(features);
    const name = String(device || '').trim() || 'This computer';
    return {
      version: 2,
      id: profileId(name),
      device: name,
      createdAt: new Date().toISOString(),
      features,
      timing: timing || null,
      settings: rec.settings,
      overrides: {},
      explain: rec.explain,
      level: rec.level,
      model: MODEL_ID,
    };
  }

  // condition: 'original' | 'fixed' | 'personal'
  function settingsFor(condition, profile, steadier) {
    if (condition === 'original') return null;
    if (condition === 'fixed') return Object.assign({}, FIXED);
    return recommend(profile ? profile.features : null, { steadier: !!steadier, overrides: profile && profile.overrides }).settings;
  }

  /* ---------- small output helpers ---------- */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // never let a cell run as a spreadsheet formula
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  /* ---------- storage ----------
   * On STEADY's own pages: localStorage, mirrored to chrome.storage when running as the extension.
   * On other websites (data-steady-ext="1", set by the extension bridge): nothing is written to the site's storage;
   * prefs go to the bridge as an event and come back as data-* attributes. The profile never enters the site's page. */
  const KEYS = { profile: 'steady.profile.v1', profiles: 'steady.profiles.v1', condition: 'steady.condition', steadier: 'steady.steadier', participant: 'steady.participant', variant: 'steady.variant' };
  function ls() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }
  function hostDataset() { try { return typeof document !== 'undefined' ? document.documentElement.dataset : null; } catch (e) { return null; } }
  const extMode = () => { const d = hostDataset(); return !!(d && d.steadyExt === '1'); };
  const dsName = (name) => 'steady' + name[0].toUpperCase() + name.slice(1);
  function readJSON(key) {
    try { const v = ls() && ls().getItem(key); if (v) return JSON.parse(v); } catch (e) { /* ignore */ }
    return null;
  }
  const hasChromeStorage = () => { try { return typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local); } catch (e) { return false; } };
  function write(key, value) {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    try { ls() && ls().setItem(key, s); } catch (e) { /* ignore */ }
    try { if (hasChromeStorage()) chrome.storage.local.set({ [key]: s }); } catch (e) { /* ignore */ }
  }
  function remove(key) {
    try { ls() && ls().removeItem(key); } catch (e) { /* ignore */ }
    try { if (hasChromeStorage()) chrome.storage.local.remove(key); } catch (e) { /* ignore */ }
  }
  function urlParam(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }

  /* Per-device profiles: all live in KEYS.profiles; the active one is mirrored to KEYS.profile
   * (the key the engine and the extension bridge read). One profile per device name. */
  function profileId(device) {
    return 'dev-' + (String(device || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'this-computer');
  }
  const idOf = (p) => p.id || profileId(p.device);
  const newestFirst = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));
  // ?profile=demo reads the demo page's example profile, so a demo never overwrites a real calibration.
  const loadProfile = () => readJSON(urlParam('profile') === 'demo' ? KEYS.profile + '.demo' : KEYS.profile);
  function profileMap() {
    const m = readJSON(KEYS.profiles) || {};
    const active = readJSON(KEYS.profile);
    if (active && !m[idOf(active)]) m[idOf(active)] = active; // a profile saved before per-device support
    return m;
  }
  const listProfiles = () => Object.values(profileMap()).map((p) => Object.assign({}, p, { id: idOf(p) })).sort(newestFirst);
  function saveProfile(p) { // saving makes it active; the same device name replaces, never duplicates
    p.id = idOf(p);
    const m = profileMap();
    m[p.id] = p;
    write(KEYS.profiles, m);
    write(KEYS.profile, p);
    return p;
  }
  function useProfile(id) {
    const p = profileMap()[id];
    if (p) write(KEYS.profile, p);
    return p || null;
  }
  function deleteProfile(id) {
    const m = profileMap();
    delete m[id];
    write(KEYS.profiles, m);
    const active = readJSON(KEYS.profile);
    if (active && idOf(active) === id) {
      const next = Object.values(m).sort(newestFirst)[0];
      if (next) write(KEYS.profile, next); else remove(KEYS.profile);
    }
  }

  function getPref(name, fallback) {
    if (name === 'condition' && ['original', 'fixed', 'personal'].includes(urlParam('cond'))) return urlParam('cond');
    const d = hostDataset();
    if (extMode() && d[dsName(name)] != null) return d[dsName(name)];
    try { const v = ls() && ls().getItem(KEYS[name]); if (v != null) return v; } catch (e) { /* ignore */ }
    return fallback;
  }
  function setPref(name, v) {
    if (extMode()) {
      hostDataset()[dsName(name)] = String(v);
      document.dispatchEvent(new CustomEvent('steady:pref', { detail: JSON.stringify({ key: KEYS[name], value: String(v) }) }));
      return;
    }
    write(KEYS[name], String(v));
  }
  function clearAll() {
    try { Object.values(KEYS).concat(['steady.sessions', KEYS.profile + '.demo']).forEach((k) => ls() && ls().removeItem(k)); } catch (e) { /* ignore */ }
    try { if (hasChromeStorage()) chrome.storage.local.clear(); } catch (e) { /* ignore */ }
  }

  /* ---------- synthetic data (engineering tests only — never user evidence) ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function synthTrials({ sigma = 5, slip = 1, n = 14, seed = 7, repeatEvery = 0 }) {
    const r = rng(seed);
    const gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
    const out = [];
    for (let i = 0; i < n; i++) {
      const ang = (i * 7 * 2 * Math.PI) / 13, prev = ((i - 1) * 7 * 2 * Math.PI) / 13;
      const tx = 300 + 220 * Math.cos(ang), ty = 300 + 220 * Math.sin(ang);
      const downX = tx + gauss() * sigma, downY = ty + gauss() * sigma;
      const s = Math.abs(gauss()) * slip, sa = r() * 2 * Math.PI;
      out.push({ tx, ty, fromX: 300 + 220 * Math.cos(prev), fromY: 300 + 220 * Math.sin(prev), downX, downY,
        upX: downX + s * Math.cos(sa), upY: downY + s * Math.sin(sa), mt: 900 + r() * 400, repeat: repeatEvery > 0 && i % repeatEvery === 0 });
    }
    return out;
  }

  return { LEVELS, PRIOR, FIXED, POLICY, KEYS, STEPS, quantile, pointingFeatures, tremorFeatures, dragFeatures, measuredSteps, recommend, sizeFor, isOn,
    buildProfile, settingsFor, profileId, loadProfile, saveProfile, listProfiles, useProfile, deleteProfile, getPref, setPref, clearAll,
    esc, csvCell, synthTrials, evalNode };
});
