// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../app/js/core.js');

const settingsForSigma = (sigma, slip = 1) =>
  S.recommend(S.pointingFeatures(S.synthTrials({ sigma, slip, n: 40, seed: 11 }))).settings;

test('target size grows monotonically with endpoint scatter', () => {
  const sigmas = [1, 3, 6, 9, 12, 16, 20, 26, 32];
  const sizes = sigmas.map((s) => settingsForSigma(s).target);
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] >= sizes[i - 1], `non-monotonic: ${sizes}`);
  assert.equal(sizes[0], 44, 'precise hands get the WCAG AAA floor');
  assert.equal(sizes.at(-1), 120, 'very large scatter gets the top level');
});

test('gap equals roughly one sigma, never below 8 px', () => {
  assert.equal(settingsForSigma(2).gap, 8);
  const g = settingsForSigma(20).gap;
  assert.ok(g >= 16 && g <= 24, `gap ${g}`);
});

test('shrinkage keeps a tiny calibration near the population prior', () => {
  const two = [{ tx: 0, ty: 0, fromX: -100, fromY: 0, downX: 0, downY: 0, upX: 0, upY: 0, mt: 900 },
               { tx: 100, ty: 0, fromX: 0, fromY: 0, downX: 100, downY: 0, upX: 100, upY: 0, mt: 900 }];
  const f = S.pointingFeatures(two);
  assert.ok(f.sigma > 3 && f.sigma < S.PRIOR.sigma, `sigma ${f.sigma}`);
});

test('click slip turns on the slip guard; a clean click does not', () => {
  assert.equal(settingsForSigma(4, 12).slipGuard, true);
  assert.equal(settingsForSigma(4, 0.5).slipGuard, false);
});

test('repeated presses turn on ignore-repeat', () => {
  const f = S.pointingFeatures(S.synthTrials({ sigma: 4, n: 20, repeatEvery: 4 }));
  assert.ok(f.repeatRate > 0);
  assert.ok(S.recommend(f).settings.ignoreRepeatMs >= 400);
});

test('skipping calibration still yields a valid, explained profile', () => {
  const p = S.buildProfile({});
  assert.equal(p.settings.target, 44);
  assert.match(p.explain[0], /No calibration yet/);
});

test('conditions: original = untouched, fixed = one-size preset', () => {
  assert.equal(S.settingsFor('original', null), null);
  const fx = S.settingsFor('fixed', null);
  assert.deepEqual([fx.target, fx.gap, fx.slipGuard], [44, 8, false]);
});

test('"Steadier today" moves one level up and turns on the guards', () => {
  const f = S.pointingFeatures(S.synthTrials({ sigma: 9, slip: 2, n: 30 }));
  const base = S.recommend(f).settings, st = S.recommend(f, { steadier: true }).settings;
  assert.equal(S.LEVELS.indexOf(st.target), Math.min(4, S.LEVELS.indexOf(base.target) + 1));
  assert.equal(st.slipGuard, true);
  assert.equal(st.confirmFinal, true);
});

test('user overrides win over the recommendation', () => {
  const p = S.buildProfile({ pointing: S.pointingFeatures(S.synthTrials({ sigma: 3 })) });
  p.overrides.target = 96;
  assert.equal(S.settingsFor('personal', p).target, 96);
});

test('tremor features find a 5 Hz oscillation and ignore a still pointer', () => {
  const samples = [];
  for (let t = 0; t <= 4000; t += 8) samples.push({ t, x: 200 + 4 * Math.sin((2 * Math.PI * 5 * t) / 1000), y: 200 });
  const tr = S.tremorFeatures(samples, 4000);
  assert.ok(Math.abs(tr.tremorHz - 5) <= 0.5, `Hz ${tr.tremorHz}`);
  assert.ok(tr.tremorRms > 1.5, `rms ${tr.tremorRms}`);
  const still = S.tremorFeatures([{ t: 0, x: 5, y: 5 }, { t: 1000, x: 5, y: 5 }, { t: 2000, x: 5, y: 5 }, { t: 4000, x: 5, y: 5 }], 4000);
  assert.equal(still.tremorRms, 0);
});

test('policy is plain JSON, so a trained export can replace it', () => {
  const copy = JSON.parse(JSON.stringify(S.POLICY));
  const f = { slipP90: 9, repeatRate: 0, dragFailRate: 0, sigma: 10, tremorRms: 1, target: 72 };
  for (const k of Object.keys(copy.outputs)) assert.deepEqual(S.evalNode(copy.outputs[k], f), S.evalNode(S.POLICY.outputs[k], f));
});

/* ---------- MVP 1 hardening ---------- */

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
};
const withStorage = (fn) => {
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: memStorage(), configurable: true, writable: true });
  try { return fn(); } finally { if (prev) Object.defineProperty(globalThis, 'localStorage', prev); else delete globalThis.localStorage; }
};
const precise = () => S.buildProfile({ pointing: S.pointingFeatures(S.synthTrials({ sigma: 3, n: 30 })), device: 'Laptop trackpad' });

test('a chosen button size feeds the policy: 96 px buttons get the day list and the confirm step', () => {
  const p = precise();
  assert.equal(S.settingsFor('personal', p).dateMode, 'native', 'precise hand, standard size: native calendar');
  p.overrides.target = 96;
  const s = S.settingsFor('personal', p);
  assert.equal(s.target, 96);
  assert.equal(s.dateMode, 'list');
  assert.equal(s.confirmFinal, true);
  p.overrides.dateMode = 'native';
  assert.equal(S.settingsFor('personal', p).dateMode, 'native', 'an explicit technique override still wins');
});

test('reasons follow the settings in use, not the bare recommendation', () => {
  const p = precise();
  p.overrides.target = 96;
  const rec = S.recommend(p.features, { overrides: p.overrides });
  assert.match(rec.explain[0], /96 px/);
  assert.match(rec.reasons.target, /You chose 96 px/);
  assert.equal(rec.suggestedTarget, 44);
});

test('every setting has a plain reason, whether it is on or off', () => {
  for (const sigma of [2, 9, 26]) {
    for (const steadier of [false, true]) {
      const rec = S.recommend(S.pointingFeatures(S.synthTrials({ sigma, n: 30 })), { steadier });
      for (const k of Object.keys(rec.settings)) assert.ok(rec.reasons[k] && rec.reasons[k].length > 10, `σ ${sigma}, steadier ${steadier}: no reason for ${k}`);
    }
  }
});

test('skipping only the dots is not reported as "no calibration"', () => {
  const p = S.buildProfile({ tremor: { tremorRms: 3, tremorHz: 5 }, drag: { attempts: 2, failures: 0, ms: 900 } });
  assert.doesNotMatch(p.explain[0], /No calibration yet/);
  assert.match(p.explain.join(' '), /skipped Tap the dots/);
  assert.equal(p.settings.sliderMode, 'stepper', 'the hold-steady measurement still counts');
});

test('a gap override is honoured', () => {
  const p = precise();
  p.overrides.gap = 24;
  assert.equal(S.settingsFor('personal', p).gap, 24);
  assert.match(S.recommend(p.features, { overrides: p.overrides }).reasons.gap, /You chose 24 px/);
});

test('"Steadier today" goes one size above a chosen size', () => {
  const p = precise();
  p.overrides.target = 72;
  assert.equal(S.settingsFor('personal', p, true).target, 96);
});

test('profiles are kept per device and one is active', () => withStorage(() => {
  const a = precise();
  const b = S.buildProfile({ pointing: S.pointingFeatures(S.synthTrials({ sigma: 14, n: 30 })), device: 'Desk mouse' });
  S.saveProfile(a);
  S.saveProfile(b);
  assert.deepEqual(S.listProfiles().map((p) => p.device).sort(), ['Desk mouse', 'Laptop trackpad']);
  assert.equal(S.loadProfile().device, 'Desk mouse', 'the last saved profile is active');
  S.useProfile(S.listProfiles().find((p) => p.device === 'Laptop trackpad').id);
  assert.equal(S.loadProfile().device, 'Laptop trackpad');
  S.saveProfile(precise()); // same device again replaces, never duplicates
  assert.equal(S.listProfiles().length, 2);
  S.deleteProfile(S.loadProfile().id);
  assert.deepEqual(S.listProfiles().map((p) => p.device), ['Desk mouse']);
  assert.equal(S.loadProfile().device, 'Desk mouse', 'deleting the active profile falls back to another');
}));

test('CSV cells are quoted and cannot become spreadsheet formulas', () => {
  assert.equal(S.csvCell('P01'), 'P01');
  assert.equal(S.csvCell('Smith, J'), '"Smith, J"');
  assert.equal(S.csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(S.csvCell(12.5), '12.5');
});

test('text is escaped before it goes into HTML', () => {
  assert.equal(S.esc('<img src=x onerror=alert(1)> & "q"'), '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;');
});
