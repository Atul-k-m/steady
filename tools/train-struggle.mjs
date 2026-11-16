// Train the struggle detector (logistic regression) and export it to app/js/model-struggle.js.
//
//   node tools/train-struggle.mjs                     # synthetic sessions (engineering bootstrap only)
//   node tools/train-struggle.mjs --data pilot.csv    # real pilot windows: columns = FEATURES + label (0/1)
//
// Honesty note: the synthetic generator encodes OUR assumptions about what struggling looks like
// (more misses, double presses, corrections, errors, long pauses). A model trained on it can only
// reproduce those assumptions. It exists so the on-device pipeline runs end to end before the pilot;
// the exported file says which data it was trained on, and the agent shows that in its log.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { FEATURES, sigmoid } = require(path.join(here, '..', 'app', 'js', 'agent-core.js'));

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r = rng(20261116);
const gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const poisson = (lam) => { let k = 0, p = 1; const L = Math.exp(-lam); do { k++; p *= r(); } while (p > L); return k - 1; };
const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function synthetic(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const severity = r();               // 0 = steady hands and good eyes, 1 = strong tremor or low vision
    const hardStep = r() < 0.4;         // captcha, OTP, long dropdowns
    const y = severity * 0.7 + (hardStep ? 0.45 : 0) + gauss() * 0.15 > 0.62 ? 1 : 0;
    rows.push({
      missRate: clip((y ? 0.22 + 0.2 * severity : 0.04 + 0.1 * severity) + gauss() * 0.08, 0, 1),
      repeats: poisson(y ? 1.2 + 2 * severity : 0.2 + 0.6 * severity),
      correctionRate: clip((y ? 0.28 : 0.08) + 0.1 * severity + gauss() * 0.08, 0, 1),
      errors: poisson(y ? 0.7 : 0.12),
      zooms: poisson(y ? 0.5 : 0.1),
      idleSec: clip((y ? 24 : 9) + gauss() * (y ? 10 : 6), 0, 120),
      backs: poisson(y ? 0.35 : 0.06),
      label: y,
    });
  }
  return rows;
}

function loadCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',').map((c) => c.trim());
  for (const f of [...FEATURES, 'label']) if (!cols.includes(f)) throw new Error(`missing column ${f}`);
  return lines.map((l) => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, Number(v[i])])); });
}

function train(rows, { epochs = 600, lr = 0.1, l2 = 0.001 } = {}) {
  const mean = {}, std = {};
  for (const f of FEATURES) {
    mean[f] = rows.reduce((s, x) => s + x[f], 0) / rows.length;
    std[f] = Math.sqrt(rows.reduce((s, x) => s + (x[f] - mean[f]) ** 2, 0) / rows.length) || 1;
  }
  const w = Object.fromEntries(FEATURES.map((f) => [f, 0]));
  let b = 0;
  for (let e = 0; e < epochs; e++) {
    const g = Object.fromEntries(FEATURES.map((f) => [f, 0]));
    let gb = 0;
    for (const x of rows) {
      let z = b;
      for (const f of FEATURES) z += w[f] * (x[f] - mean[f]) / std[f];
      const err = sigmoid(z) - x.label;
      gb += err;
      for (const f of FEATURES) g[f] += err * (x[f] - mean[f]) / std[f];
    }
    b -= (lr * gb) / rows.length;
    for (const f of FEATURES) w[f] -= lr * (g[f] / rows.length + l2 * w[f]);
  }
  // Fold the standardisation into raw-feature weights, so the device needs no scaler.
  const weights = {};
  let bias = b;
  for (const f of FEATURES) { weights[f] = w[f] / std[f]; bias -= (w[f] * mean[f]) / std[f]; }
  return { bias, weights };
}

function evaluate(model, rows) {
  const scored = rows.map((x) => {
    let z = model.bias;
    for (const f of FEATURES) z += model.weights[f] * x[f];
    return { p: sigmoid(z), y: x.label };
  });
  const acc = scored.filter((s) => (s.p >= 0.5 ? 1 : 0) === s.y).length / scored.length;
  const pos = scored.filter((s) => s.y === 1), neg = scored.filter((s) => s.y === 0);
  let wins = 0;
  for (const p of pos) for (const q of neg) wins += p.p > q.p ? 1 : p.p === q.p ? 0.5 : 0;
  const auc = pos.length && neg.length ? wins / (pos.length * neg.length) : NaN;
  return { accuracy: +acc.toFixed(3), auc: +auc.toFixed(3), n: rows.length, positives: pos.length };
}

const args = process.argv.slice(2);
const dataIdx = args.indexOf('--data');
const source = dataIdx >= 0 ? path.resolve(args[dataIdx + 1]) : null;
const rows = source ? loadCsv(source) : synthetic(4000);
for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
const cut = Math.floor(rows.length * 0.8);
const model = train(rows.slice(0, cut));
const test = evaluate(model, rows.slice(cut));

const out = {
  id: `struggle-logreg@${source ? 'pilot' : 'synthetic'}-${new Date().toISOString().slice(0, 10)}`,
  trainedOn: source ? `pilot windows from ${path.basename(source)}` : 'SYNTHETIC sessions (our assumptions, not user data). Retrain on pilot data before any claim.',
  features: FEATURES,
  bias: +model.bias.toFixed(4),
  weights: Object.fromEntries(Object.entries(model.weights).map(([k, v]) => [k, +v.toFixed(4)])),
  heldOut: test,
};
const js = `/* Generated by tools/train-struggle.mjs. Do not edit by hand.\n * ${out.trainedOn}\n */\n(function (root) {\n  const S = (root.Steady = root.Steady || {});\n  S.MODELS = S.MODELS || {};\n  S.MODELS.struggle = ${JSON.stringify(out, null, 2).replace(/\n/g, '\n  ')};\n})(typeof self !== 'undefined' ? self : this);\n`;
fs.writeFileSync(path.join(here, '..', 'app', 'js', 'model-struggle.js'), js);
console.log(JSON.stringify({ id: out.id, heldOut: test, weights: out.weights, bias: out.bias }, null, 2));
