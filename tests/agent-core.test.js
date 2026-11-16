// node --test tests/agent-core.test.js : guardrails, masking, struggle model, autonomy, errors, flow map integrity.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const A = require(path.join(__dirname, '..', 'app', 'js', 'agent-core.js'));

// flowmap-portal.js and model-struggle.js attach to `self.Steady`; give them one in Node.
global.self = global.self || {};
require(path.join(__dirname, '..', 'app', 'js', 'flowmap-portal.js'));
require(path.join(__dirname, '..', 'app', 'js', 'model-struggle.js'));
const FM = self.Steady.FLOWMAPS['portal-practice'];
const MODEL = self.Steady.MODELS.struggle;

test('private fields are recognised from ids and labels', () => {
  assert.equal(A.classifyField({ id: 'aadhaar-input', label: 'Aadhaar Number' }), 'aadhaar');
  assert.equal(A.classifyField({ id: 'otp-input' }), 'otp');
  assert.equal(A.classifyField({ id: 'captcha2-input', label: 'Enter Captcha' }), 'captcha');
  assert.equal(A.classifyField({ id: 'consent-check', label: 'I give my consent to authenticate' }), 'consent');
  assert.equal(A.classifyField({ id: 'declare-check', label: 'I declare that the information is true' }), 'final');
  assert.equal(A.classifyField({ id: 'd-mobile', label: 'Mobile Number' }), 'personal');
  assert.equal(A.classifyField({ id: 'd-state', label: 'State' }), 'safe');
  assert.equal(A.classifyField({ type: 'password', id: 'x' }), 'secret');
});

test('masking removes numbers, masked numbers, emails and known personal values', () => {
  const out = A.maskText('OTP sent to XXXXXX4321 for Ramesh Kumar, Aadhaar 1234 5678 9012, mail r.k@example.in, time 01:59', ['Ramesh Kumar']);
  assert.doesNotMatch(out, /4321|1234|5678|9012|Ramesh|example/);
  assert.match(out, /\[number\]/);
  assert.match(out, /\[private\]/);
  assert.match(out, /\[email\]/);
  assert.match(out, /01:59/, 'short numbers like a countdown stay readable');
});

test('the masked snapshot never contains a field value, and private lists lose their options', () => {
  const raw = {
    url: 'http://localhost:8080/portal/index.html?test=1', step: 'details', title: 'Portal',
    headings: ['Details for Ramesh Kumar'], texts: ['Mobile 9876543210'], errors: ['Invalid OTP 123456'],
    elements: [
      { ref: 'e1', tag: 'input', type: 'text', id: 'd-mobile', label: 'Mobile Number', hasValue: true, value: '9876543210' },
      { ref: 'e2', tag: 'select', id: 'd-state', label: 'State', options: ['-- Select State --', 'Karnataka'], hasValue: false },
      { ref: 'e3', tag: 'select', id: 'aadhaar-type', label: 'Aadhaar type', options: ['1234 5678 9012'] },
      { ref: 'e4', tag: 'button', type: 'button', label: 'Save & Continue' },
    ],
  };
  const snap = A.maskSnapshot(raw, ['Ramesh Kumar']);
  const s = JSON.stringify(snap);
  assert.doesNotMatch(s, /9876543210|Ramesh|123456|1234 5678/);
  assert.equal(snap.path, '/portal/index.html', 'query string is dropped');
  assert.equal(snap.elements[0].state, 'filled');
  assert.equal(snap.elements[0].privacy, 'personal');
  assert.deepEqual(snap.elements[1].options, ['-- Select State --', 'Karnataka']);
  assert.equal(snap.elements[2].options, undefined);
});

test('guardrails: the AI can press Next and choose a state, but never submit, consent or fill private fields', () => {
  const snap = A.maskSnapshot({ url: 'http://x/portal/', elements: [
    { ref: 'n', tag: 'button', type: 'button', label: 'Save & Continue' },
    { ref: 's', tag: 'select', id: 'd-state', label: 'State', options: ['Karnataka', 'Bihar'] },
    { ref: 'sub', tag: 'button', type: 'button', label: 'Submit Application' },
    { ref: 'c', tag: 'input', type: 'checkbox', id: 'consent-check', label: 'I give my consent to authenticate with Aadhaar' },
    { ref: 'a', tag: 'input', type: 'text', id: 'aadhaar-input', label: 'Aadhaar Number' },
    { ref: 'otpbtn', tag: 'button', type: 'button', label: 'Send OTP to Aadhaar-linked mobile' },
    { ref: 'off', tag: 'a', label: 'Other site', href: 'https://elsewhere.example/' },
    { ref: 'dis', tag: 'button', type: 'button', label: 'Next', disabled: true },
  ] }, []);
  const v = (a) => A.validateAction(Object.assign({ elementId: '', value: '', say: '', reason: '' }, a), snap).ok;
  assert.equal(v({ action: 'click', elementId: 'n' }), true);
  assert.equal(v({ action: 'select', elementId: 's', value: 'Karnataka' }), true);
  assert.equal(v({ action: 'select', elementId: 's', value: 'Atlantis' }), false, 'option must exist');
  assert.equal(v({ action: 'click', elementId: 'sub' }), false, 'final submit is for the person');
  assert.equal(v({ action: 'click', elementId: 'c' }), false, 'consent is for the person');
  assert.equal(v({ action: 'click', elementId: 'otpbtn' }), false, 'starting Aadhaar authentication is for the person');
  assert.equal(v({ action: 'click', elementId: 'a' }), false, 'typing fields are not clicks');
  assert.equal(v({ action: 'fill_from_vault', elementId: 'a', value: 'aadhaar' }), false, 'no private refill by the AI');
  assert.equal(v({ action: 'fill_from_vault', elementId: 's', value: 'state' }), true);
  assert.equal(v({ action: 'click', elementId: 'off' }), false, 'no leaving the site');
  assert.equal(v({ action: 'click', elementId: 'dis' }), false);
  assert.equal(v({ action: 'click', elementId: 'ghost' }), false, 'unknown element');
  assert.equal(v({ action: 'type_text', elementId: 'a' }), false, 'unknown action');
  assert.equal(v({ action: 'handoff' }), true);
});

test('struggle score rises with misses, double presses, corrections and long pauses', () => {
  const now = 100000;
  const calm = [{ t: now - 15000, type: 'progress' }, ...Array.from({ length: 6 }, (_, i) => ({ t: now - 9000 + i * 1000, type: 'down' })), ...Array.from({ length: 10 }, (_, i) => ({ t: now - 8000 + i * 500, type: 'char' }))];
  const hard = [{ t: now - 70000, type: 'progress' }, ...Array.from({ length: 6 }, (_, i) => ({ t: now - 9000 + i * 1000, type: i % 2 ? 'miss' : 'down' })),
    { t: now - 3000, type: 'repeat' }, { t: now - 2000, type: 'repeat' }, ...Array.from({ length: 6 }, (_, i) => ({ t: now - 8000 + i * 500, type: i % 2 ? 'correction' : 'char' })), { t: now - 1000, type: 'error' }];
  for (const model of [undefined, MODEL]) {
    const pCalm = A.struggleScore(A.struggleFeatures(calm, now), model), pHard = A.struggleScore(A.struggleFeatures(hard, now), model);
    assert.ok(pCalm < 0.35, `calm ${pCalm}`);
    assert.ok(pHard > 0.8, `hard ${pHard}`);
  }
  assert.match(MODEL.trainedOn, /SYNTHETIC|pilot/, 'the exported model says what it was trained on');
});

test('adaptive autonomy only offers, waits between offers, and never goes past autopilot', () => {
  const base = { level: 'assist', score: 0.8, scoreStreak: 2, liveTremor: 0, baseTremor: 0, lastOfferAt: -Infinity, now: 1e6 };
  assert.deepEqual(A.autonomyOffer(base), { to: 'copilot', because: 'struggle' });
  assert.equal(A.autonomyOffer(Object.assign({}, base, { scoreStreak: 1 })), null, 'one bad moment is not enough');
  assert.equal(A.autonomyOffer(Object.assign({}, base, { lastOfferAt: 1e6 - 30000 })), null, 'no nagging');
  assert.equal(A.autonomyOffer(Object.assign({}, base, { lastOfferAt: 1e6 - 90000, declined: true })), null, 'longer wait after a no');
  assert.deepEqual(A.autonomyOffer(Object.assign({}, base, { score: 0.1, liveTremor: 3.2, baseTremor: 1 })), { to: 'copilot', because: 'tremor' });
  assert.equal(A.autonomyOffer(Object.assign({}, base, { level: 'autopilot' })), null);
});

test('portal errors get a plain explanation and a recovery, in Hindi too', () => {
  const e = A.explainError('Server not responding. Please try again later.', FM, 'en');
  assert.equal(e.recover, 'retry');
  assert.match(e.explain, /not your mistake/);
  const h = A.explainError('No beneficiary found in the given search.', FM, 'hi');
  assert.equal(h.recover, 'stop');
  assert.match(h.next, /CSC/);
  assert.equal(A.explainError('Something odd happened', FM, 'en').known, false);
});

test('strings exist in both languages and substitute variables', () => {
  for (const k of Object.keys(A.STR.en)) assert.ok(A.STR.hi[k], `missing Hindi for ${k}`);
  assert.equal(A.t('otpTitleHelper', 'en', { name: 'Rahul' }), 'Ask Rahul for the code');
  assert.match(A.t('otpBodyHelper', 'hi', { name: 'राहुल', end: '4321' }), /4321.*राहुल/);
});

test('flow map: every step is defined, private steps are human kinds, and no click targets a final action', () => {
  for (const step of FM.order) assert.ok(FM.steps[step], `step ${step}`);
  const humanKinds = new Set(['captcha', 'otp', 'consent', 'review', 'photo']);
  for (const [name, def] of Object.entries(FM.steps)) {
    for (const t of def.tasks) {
      if (t.kind === 'click') assert.doesNotMatch(t.label.en, /submit|consent|declar/i, `${name}: click ${t.label.en}`);
      if (t.kind === 'fill' && t.privacy === 'aadhaar') assert.equal(t.vaultKey, 'aadhaar');
      if (/captcha|otp/.test(t.field || '')) assert.ok(humanKinds.has(t.kind), `${name}: ${t.field} must be a human step`);
    }
  }
  assert.ok(FM.steps.review.tasks.some((t) => t.kind === 'review'), 'final submit is a review step for the person');
});
