/* STEADY agent core: the pure, testable part of the AI agent (no DOM, no network).
 * Loads in the extension (self.Steady.agent) and in Node (module.exports).
 *
 *   classifyField   - which fields are private (Aadhaar, OTP, captcha, consent, final submit, personal)
 *   maskText        - removes numbers, emails, phone numbers and known personal values before anything leaves the device
 *   maskSnapshot    - builds the only page description the language model ever sees
 *   validateAction  - guardrails: the model can click or choose only safe things, never fill private fields
 *   struggleFeatures / struggleScore - the on-device struggle detector (logistic model)
 *   autonomy        - adaptive autonomy: when to offer more help, always asking first
 *   explainError    - turns portal errors into a plain explanation, a next step and a recovery action
 *   t               - English and Hindi strings
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Steady = root.Steady || {}; root.Steady.agent = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- field privacy ---------- */
  // Order matters: the first rule that matches wins.
  const RULES = [
    ['captcha', /captcha|security\s*code|enter the (letters|characters)/i],
    ['otp', /\botp\b|one[\s-]*time|verification code/i],
    ['aadhaar', /aadhaa?r|\buid\b|\bvid\b/i],
    ['consent', /consent|i agree|i give my|authori[sz]e/i],
    ['final', /declar|submit application|final submit/i],
    ['personal', /mobile|phone|name|dob|date of birth|birth|address|email|pin\s*code|gender/i],
  ];
  function classifyField(meta) {
    const m = meta || {};
    const text = [m.id, m.name, m.label, m.placeholder, m.autocomplete].filter(Boolean).join(' ');
    if (m.type === 'password') return 'secret';
    for (const [kind, re] of RULES) if (re.test(text)) return kind;
    return 'safe';
  }
  const PRIVATE = new Set(['secret', 'captcha', 'otp', 'aadhaar', 'consent', 'final', 'personal']);
  const isPrivate = (kind) => PRIVATE.has(kind);

  /* ---------- masking ---------- */
  function maskText(text, known) {
    let s = String(text == null ? '' : text);
    for (const v of (known || []).filter((x) => x && String(x).trim().length >= 3).sort((a, b) => String(b).length - String(a).length)) {
      s = s.split(String(v)).join('[private]');
    }
    return s
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
      .replace(/(?:x{2,}|\*{2,})[\s-]*\d{2,}/gi, '[number]') // masked numbers like XXXXXX1234 still reveal digits
      .replace(/\d[\d\s-]{2,}\d/g, (m) => (m.replace(/\D/g, '').length >= 4 ? '[number]' : m))
      .slice(0, 600);
  }

  // raw: { url, step, title, headings[], texts[], errors[], elements: [{ ref, tag, type, id, name, label, placeholder,
  //        options[], checked, disabled, hasValue, selectedText }] }
  // Returns the masked description: no field values at all, only "filled"/"empty" and non-private option lists.
  function maskSnapshot(raw, known) {
    const r = raw || {};
    let path = '';
    try { path = new URL(r.url).pathname; } catch (e) { path = ''; }
    return {
      path,
      step: maskText(r.step, known),
      title: maskText(r.title, known),
      headings: (r.headings || []).slice(0, 8).map((h) => maskText(h, known)),
      texts: (r.texts || []).slice(0, 12).map((h) => maskText(h, known)),
      errors: (r.errors || []).slice(0, 4).map((h) => maskText(h, known)),
      elements: (r.elements || []).slice(0, 60).map((e) => {
        const kind = classifyField(e);
        const out = { ref: e.ref, tag: e.tag, type: e.type || '', label: maskText(e.label || e.placeholder || '', known), privacy: kind };
        if (e.tag === 'input' || e.tag === 'select' || e.tag === 'textarea') out.state = e.hasValue ? 'filled' : 'empty';
        if (e.type === 'checkbox' || e.type === 'radio') out.checked = !!e.checked;
        if (e.disabled) out.disabled = true;
        if (e.tag === 'select' && !isPrivate(kind)) out.options = (e.options || []).slice(0, 40).map((o) => maskText(o, known));
        return out;
      }),
    };
  }

  /* ---------- guardrails ---------- */
  const ACTIONS = ['click', 'select', 'fill_from_vault', 'ask_user', 'explain', 'wait', 'handoff', 'done'];
  const SAFE_VAULT_KEYS = new Set(['state', 'district', 'ward', 'scheme']);
  const FINAL_WORDS = /submit|confirm|pay|declare|agree|consent|delete|cancel application|send otp to aadhaar/i;

  // action: { action, elementId, value, say, reason } from the planner (model output: untrusted).
  // snapshot: the masked snapshot the planner saw. Returns { ok, why }.
  function validateAction(action, snapshot) {
    const a = action || {};
    if (!ACTIONS.includes(a.action)) return { ok: false, why: 'unknown action' };
    if (['ask_user', 'explain', 'wait', 'handoff', 'done'].includes(a.action)) return { ok: true, why: 'no page change' };
    const el = ((snapshot && snapshot.elements) || []).find((e) => e.ref === a.elementId);
    if (!el) return { ok: false, why: 'element not on this page' };
    if (el.disabled) return { ok: false, why: 'element is disabled' };
    if (a.action === 'click') {
      if (el.tag === 'input' && (el.type === 'checkbox' || el.type === 'radio') && isPrivate(el.privacy)) return { ok: false, why: 'consent and declarations are for the person to tick' };
      if (FINAL_WORDS.test(el.label)) return { ok: false, why: `"${el.label}" is a final or consent action: the person must press it` };
      if (el.tag === 'a' && /^https?:/i.test(el.href || '')) return { ok: false, why: 'links that leave the portal are not allowed' };
      if (el.tag === 'input' && !['button', 'submit', 'radio', 'checkbox'].includes(el.type)) return { ok: false, why: 'typing is not a click' };
      return { ok: true, why: 'safe click' };
    }
    if (a.action === 'select') {
      if (el.tag !== 'select') return { ok: false, why: 'not a list' };
      if (isPrivate(el.privacy)) return { ok: false, why: 'private list' };
      if (!(el.options || []).includes(a.value)) return { ok: false, why: 'option not in the list' };
      return { ok: true, why: 'safe choice' };
    }
    if (a.action === 'fill_from_vault') {
      if (!SAFE_VAULT_KEYS.has(a.value)) return { ok: false, why: 'the AI may only reuse saved non-private answers' };
      if (isPrivate(el.privacy)) return { ok: false, why: 'private field' };
      return { ok: true, why: 'saved answer' };
    }
    return { ok: false, why: 'not allowed' };
  }

  /* ---------- struggle detector ---------- */
  // events: [{ t (ms), type: 'down'|'miss'|'repeat'|'correction'|'char'|'error'|'zoom'|'progress'|'back' }]
  // Window features (per 20 s). All are cheap to compute on the device; none needs the page content.
  const FEATURES = ['missRate', 'repeats', 'correctionRate', 'errors', 'zooms', 'idleSec', 'backs'];
  function struggleFeatures(events, now, windowMs) {
    const W = windowMs || 20000, from = now - W;
    const win = (events || []).filter((e) => e.t >= from && e.t <= now);
    const count = (type) => win.filter((e) => e.type === type).length;
    const downs = count('down') + count('miss');
    const chars = count('char'), corr = count('correction');
    const lastProgress = Math.max(from - 30000, ...(events || []).filter((e) => e.type === 'progress' && e.t <= now).map((e) => e.t));
    return {
      missRate: downs ? count('miss') / downs : 0,
      repeats: count('repeat'),
      correctionRate: chars + corr ? corr / (chars + corr) : 0,
      errors: count('error'),
      zooms: count('zoom'),
      idleSec: Math.min(120, (now - lastProgress) / 1000),
      backs: count('back'),
    };
  }
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));
  function struggleScore(features, model) {
    const m = model || { bias: -3, weights: { missRate: 3, repeats: 0.6, correctionRate: 3, errors: 0.8, zooms: 0.5, idleSec: 0.03, backs: 0.5 } };
    let z = m.bias;
    for (const k of FEATURES) z += (m.weights[k] || 0) * ((features && features[k]) || 0);
    return sigmoid(z);
  }

  /* ---------- adaptive autonomy ---------- */
  const LEVELS = ['assist', 'copilot', 'autopilot'];
  // Decide whether to OFFER more help now. Never raises the level by itself: the person says yes first.
  // state: { level, score, scoreStreak, liveTremor, baseTremor, lastOfferAt, now, declined }
  function autonomyOffer(state) {
    const s = state || {};
    const idx = LEVELS.indexOf(s.level);
    if (idx < 0 || idx >= LEVELS.length - 1) return null;
    if (s.now - (s.lastOfferAt || -Infinity) < (s.declined ? 180000 : 60000)) return null;
    const hardTremor = s.liveTremor > 2 && s.liveTremor > 1.5 * Math.max(0.5, s.baseTremor || 0);
    if ((s.score >= 0.65 && (s.scoreStreak || 0) >= 2) || hardTremor) {
      return { to: LEVELS[idx + 1], because: hardTremor ? 'tremor' : 'struggle' };
    }
    return null;
  }

  /* ---------- errors ---------- */
  function explainError(text, flowmap, lang) {
    const L = lang === 'hi' ? 'hi' : 'en';
    for (const e of (flowmap && flowmap.errors) || []) {
      if (new RegExp(e.match, 'i').test(text || '')) {
        return { kind: e.kind, recover: e.recover, title: e.title[L], explain: e.explain[L], next: e.next[L], known: true };
      }
    }
    return { kind: 'unknown', recover: 'ask', title: t('unknownErrTitle', L), explain: t('unknownErr', L), next: t('unknownErrNext', L), known: false };
  }

  /* ---------- languages ---------- */
  const LANGS = ['en', 'hi', 'kn'];
  const LANG_LABEL = { en: 'English', hi: 'हिन्दी', kn: 'ಕನ್ನಡ' };
  const nextLang = (l) => LANGS[(LANGS.indexOf(l) + 1) % LANGS.length];

  /* ---------- speech ---------- */
  // Page labels are written, not spoken: "Account No." must be said "Account number", "OTP" letter by letter.
  const NO_NOUNS = /^(account|a\/c|mobile|phone|contact|consumer|customer|bill|rr|roll|ref|reference|registration|reg|application|card|house|flat|door|serial|sl|policy|vehicle|receipt|connection|meter|aadhaar|ticket|token|order|case|service|ca)$/i;
  function speakable(text) {
    let s = String(text == null ? '' : text).replace(/\s*\*+\s*/g, ' ');
    s = s.replace(/\b(?:a\/c|acc|acct)\.?\s*No\b\.?/gi, 'account number')
      .replace(/\b([A-Za-z/]+)\s+No\b([.:#])?/g, (m, w, p) => (p || NO_NOUNS.test(w) ? `${w} number${p === ':' ? ':' : ''}` : m))
      .replace(/^No\.(?=\s*\d)/, 'Number')
      .replace(/\bNos\b\.?/g, 'numbers')
      .replace(/\bD\.?O\.?B\b\.?/g, 'date of birth')
      .replace(/\be-?KYC\b/gi, 'e K Y C')
      .replace(/\b(OTP|ID|IFSC|UPI|RR|KYC|SMS|ATM|PAN|ABHA)\b/g, (m) => (m === 'ABHA' ? 'Aabha' : m.split('').join(' ')))
      .replace(/\bRs\b\.?/g, 'rupees').replace(/₹\s*/g, 'rupees ')
      .replace(/\bGovt\b\.?/gi, 'government').replace(/\bDept\b\.?/gi, 'department')
      .replace(/\bAmt\b\.?/gi, 'amount').replace(/\bAddr\b\.?/gi, 'address').replace(/\bQty\b\.?/gi, 'quantity');
    return s.replace(/\s+/g, ' ').trim();
  }

  // Choose a voice for the language, or null. Never return an English voice for Hindi or Kannada: an English voice
  // reading Devanagari or Kannada script is what came out as "random words".
  const MALE_VOICE = /ravi|prabhat|madhur|gagan|hemant|aarav|kunal|rehaan/i; // the helper speaks like a son
  function pickVoice(voices, lang) {
    const want = ({ en: 'en-in', hi: 'hi-in', kn: 'kn-in' })[lang] || String(lang || 'en').toLowerCase();
    const base = want.split('-')[0];
    const norm = (l) => String(l || '').replace('_', '-').toLowerCase();
    const list = (voices || []).filter((v) => norm(v.lang).split('-')[0] === base);
    if (!list.length) return null;
    const score = (v) => (norm(v.lang) === want ? 4 : 0) + (/natural|neural|online|google|premium|enhanced/i.test(v.name) ? 2 : 0) + (MALE_VOICE.test(v.name) ? 1 : 0);
    return list.slice().sort((a, b) => score(b) - score(a))[0];
  }

  /* ---------- son persona: what a box means, said the way a patient son would say it ---------- */
  // First match wins, so secrets come before PIN codes and accounts before generic numbers.
  const GLOSSARY = [
    { id: 'secret', match: /password|passcode|pass\s*word|\bm?pin\b(?!\s*code)/i,
      name: { en: 'Secret PIN or password', hi: 'गुप्त पिन या पासवर्ड', kn: 'ರಹಸ್ಯ ಪಿನ್ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್' },
      explain: {
        en: 'This is your secret word or number. Only you should type it. Do not say it out loud, and never tell it to anyone who phones you. I do not keep it.',
        hi: 'यह आपका गुप्त शब्द या नंबर है। इसे सिर्फ़ आप लिखिए। इसे ज़ोर से मत बोलिए, और फ़ोन करके माँगने वाले को कभी मत बताइए। मैं इसे अपने पास नहीं रखता।',
        kn: 'ಇದು ನಿಮ್ಮ ರಹಸ್ಯ ಪದ ಅಥವಾ ಸಂಖ್ಯೆ. ಇದನ್ನು ನೀವು ಮಾತ್ರ ಬರೆಯಬೇಕು. ಜೋರಾಗಿ ಹೇಳಬೇಡಿ, ಫೋನ್ ಮಾಡಿ ಕೇಳುವವರಿಗೆ ಎಂದಿಗೂ ಹೇಳಬೇಡಿ. ನಾನು ಇದನ್ನು ಇಟ್ಟುಕೊಳ್ಳುವುದಿಲ್ಲ.' } },
    { id: 'otp', match: /\botp\b|one[\s-]*time|verification code/i,
      name: { en: 'One-time code (OTP)', hi: 'एक बार का कोड (OTP)', kn: 'ಒಂದು ಬಾರಿಯ ಕೋಡ್ (OTP)' },
      explain: {
        en: 'The website has just sent a short code, usually 6 digits, by SMS to the registered mobile. It works only once, and only for a few minutes. Read it from the SMS and type it here. Never tell this code to anyone who phones you asking for it.',
        hi: 'वेबसाइट ने अभी रजिस्टर्ड मोबाइल पर SMS से एक छोटा कोड भेजा है, आमतौर पर 6 अंकों का। यह सिर्फ़ एक बार और कुछ ही मिनट चलता है। SMS से पढ़कर यहाँ लिखिए। कोई फ़ोन करके यह कोड माँगे, तो कभी मत बताइए।',
        kn: 'ವೆಬ್‌ಸೈಟ್ ಈಗ ನೋಂದಾಯಿತ ಮೊಬೈಲ್‌ಗೆ SMS ಮೂಲಕ ಒಂದು ಚಿಕ್ಕ ಕೋಡ್ ಕಳುಹಿಸಿದೆ, ಸಾಮಾನ್ಯವಾಗಿ 6 ಅಂಕಿಗಳು. ಇದು ಒಂದೇ ಬಾರಿ, ಕೆಲವೇ ನಿಮಿಷ ಕೆಲಸ ಮಾಡುತ್ತದೆ. SMS ನೋಡಿ ಇಲ್ಲಿ ಬರೆಯಿರಿ. ಯಾರಾದರೂ ಫೋನ್ ಮಾಡಿ ಈ ಕೋಡ್ ಕೇಳಿದರೆ ಎಂದಿಗೂ ಹೇಳಬೇಡಿ.' } },
    { id: 'captcha', match: /captcha|security\s*code|enter the (letters|characters)|image code/i,
      name: { en: 'Captcha (letters in the picture)', hi: 'कैप्चा (चित्र वाले अक्षर)', kn: 'ಕ್ಯಾಪ್ಚಾ (ಚಿತ್ರದ ಅಕ್ಷರಗಳು)' },
      explain: {
        en: 'This is a small test to check that a real person is using the website, not a computer program. Type the letters and numbers exactly as you see them in the picture. If it is hard to read, ask for a new picture. Nothing is lost if you get it wrong; you just try again.',
        hi: 'यह एक छोटी जाँच है, यह देखने के लिए कि वेबसाइट कोई असली इंसान चला रहा है, कोई कंप्यूटर प्रोग्राम नहीं। चित्र में जो अक्षर और अंक दिख रहे हैं, ठीक वही लिखिए। पढ़ना मुश्किल हो तो नया चित्र माँग लीजिए। गलत हो जाए तो कुछ नहीं बिगड़ता, बस फिर से कोशिश कीजिए।',
        kn: 'ಇದು ಒಂದು ಸಣ್ಣ ಪರೀಕ್ಷೆ: ವೆಬ್‌ಸೈಟ್ ಬಳಸುತ್ತಿರುವವರು ನಿಜವಾದ ವ್ಯಕ್ತಿ, ಕಂಪ್ಯೂಟರ್ ಪ್ರೋಗ್ರಾಂ ಅಲ್ಲ ಎಂದು ನೋಡಲು. ಚಿತ್ರದಲ್ಲಿ ಕಾಣುವ ಅಕ್ಷರ ಮತ್ತು ಅಂಕಿಗಳನ್ನು ಅದೇ ರೀತಿ ಬರೆಯಿರಿ. ಓದಲು ಕಷ್ಟವಾದರೆ ಹೊಸ ಚಿತ್ರ ಕೇಳಿ. ತಪ್ಪಾದರೂ ಏನೂ ಹಾಳಾಗುವುದಿಲ್ಲ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' } },
    { id: 'aadhaar', match: /aadhaa?r|\buid\b|\bvid\b/i,
      name: { en: 'Aadhaar number', hi: 'आधार नंबर', kn: 'ಆಧಾರ್ ಸಂಖ್ಯೆ' },
      explain: {
        en: 'The 12-digit number printed on the Aadhaar card, in groups of four. Keep the card in front of you and type it slowly. It is private, so type it only on the official website.',
        hi: 'आधार कार्ड पर छपा 12 अंकों का नंबर, चार-चार के समूह में। कार्ड सामने रखकर धीरे-धीरे लिखिए। यह निजी है, इसलिए इसे सिर्फ़ असली सरकारी वेबसाइट पर ही लिखिए।',
        kn: 'ಆಧಾರ್ ಕಾರ್ಡಿನ ಮೇಲೆ ನಾಲ್ಕು-ನಾಲ್ಕರ ಗುಂಪಿನಲ್ಲಿ ಮುದ್ರಿತವಾಗಿರುವ 12 ಅಂಕಿಯ ಸಂಖ್ಯೆ. ಕಾರ್ಡ್ ಎದುರಿಗಿಟ್ಟುಕೊಂಡು ನಿಧಾನವಾಗಿ ಬರೆಯಿರಿ. ಇದು ಖಾಸಗಿ, ಆದ್ದರಿಂದ ಅಧಿಕೃತ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಮಾತ್ರ ಬರೆಯಿರಿ.' } },
    { id: 'abha', match: /\babha\b|health\s*id/i,
      name: { en: 'ABHA health ID', hi: 'आभा हेल्थ आईडी', kn: 'ಆಭಾ ಆರೋಗ್ಯ ಐಡಿ' },
      explain: {
        en: 'ABHA is your digital health ID from the government. It is a 14-digit number, or an address that looks like name@abdm. It links your health records from different hospitals.',
        hi: 'आभा सरकार की ओर से आपकी डिजिटल हेल्थ आईडी है। यह 14 अंकों का नंबर होता है, या name@abdm जैसा पता। इससे अलग-अलग अस्पतालों के आपके रिकॉर्ड जुड़ते हैं।',
        kn: 'ಆಭಾ ಸರ್ಕಾರ ಕೊಡುವ ನಿಮ್ಮ ಡಿಜಿಟಲ್ ಆರೋಗ್ಯ ಐಡಿ. ಇದು 14 ಅಂಕಿಯ ಸಂಖ್ಯೆ, ಅಥವಾ name@abdm ತರಹದ ವಿಳಾಸ. ಬೇರೆ ಬೇರೆ ಆಸ್ಪತ್ರೆಗಳ ನಿಮ್ಮ ದಾಖಲೆಗಳನ್ನು ಇದು ಜೋಡಿಸುತ್ತದೆ.' } },
    { id: 'account', match: /\b(account|a\/c|acc|acct)\.?\s*(no|number|num|id|#)|consumer\s*(no|number|id)|customer\s*(no|number|id)|connection\s*(no|number|id)|\brr\s*(no|number)|\bca\s*(no|number)/i,
      name: { en: 'Account number', hi: 'खाता नंबर', kn: 'ಖಾತೆ ಸಂಖ್ಯೆ' },
      explain: {
        en: 'This box wants your account number. When your account was first created, for example when your electricity connection was set up or you opened a bank account, the company made a record for you and gave it its own number. That number is your account number. It is printed on every bill, or for a bank, in your passbook. Keep it next to you and type the number exactly as it is written.',
        hi: 'यह खाना आपका खाता नंबर माँग रहा है। जब आपका खाता पहली बार बना था, जैसे बिजली का कनेक्शन लगते समय या बैंक खाता खुलते समय, तब कंपनी ने आपका एक रिकॉर्ड बनाया और उसे अपना एक नंबर दिया। वही आपका खाता नंबर है। यह हर बिल पर छपा होता है, बैंक के लिए पासबुक में। उसे पास रखिए और नंबर ठीक वैसा ही लिखिए जैसा छपा है।',
        kn: 'ಈ ಬಾಕ್ಸ್ ನಿಮ್ಮ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಕೇಳುತ್ತಿದೆ. ನಿಮ್ಮ ಖಾತೆ ಮೊದಲ ಬಾರಿಗೆ ಶುರುವಾದಾಗ, ಉದಾಹರಣೆಗೆ ವಿದ್ಯುತ್ ಸಂಪರ್ಕ ಹಾಕಿದಾಗ ಅಥವಾ ಬ್ಯಾಂಕ್ ಖಾತೆ ತೆರೆದಾಗ, ಕಂಪನಿ ನಿಮಗಾಗಿ ಒಂದು ದಾಖಲೆ ಮಾಡಿ ಅದಕ್ಕೆ ಒಂದು ಸಂಖ್ಯೆ ಕೊಟ್ಟಿತು. ಅದೇ ನಿಮ್ಮ ಖಾತೆ ಸಂಖ್ಯೆ. ಅದು ಪ್ರತಿ ಬಿಲ್ಲಿನ ಮೇಲೆ, ಬ್ಯಾಂಕ್ ಆದರೆ ಪಾಸ್‌ಬುಕ್‌ನಲ್ಲಿ ಮುದ್ರಿತವಾಗಿರುತ್ತದೆ. ಅದನ್ನು ಹತ್ತಿರ ಇಟ್ಟುಕೊಂಡು ಅದರಲ್ಲಿರುವಂತೆಯೇ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ.' },
      // The page labels this box "Account ID" and shows "Call 1912 for Help!" (bescom.co.in quick-payment, checked 2026-11-16).
      sites: [{ host: /(^|\.)bescom\.co\.in$/i, hint: {
        en: 'On BESCOM bills it is called “Account ID”. If you can’t find it, the “To Find out Account ID” link under the box helps, or call BESCOM on 1912.',
        hi: 'BESCOM के बिल पर इसे “Account ID” कहते हैं। न मिले तो खाने के नीचे वाला “To Find out Account ID” लिंक मदद करेगा, या BESCOM को 1912 पर फ़ोन कीजिए।',
        kn: 'BESCOM ಬಿಲ್ಲಿನಲ್ಲಿ ಇದನ್ನು “Account ID” ಎನ್ನುತ್ತಾರೆ. ಸಿಗದಿದ್ದರೆ, ಬಾಕ್ಸ್ ಕೆಳಗಿನ “To Find out Account ID” ಲಿಂಕ್ ಸಹಾಯ ಮಾಡುತ್ತದೆ, ಅಥವಾ BESCOM ಗೆ 1912 ಕ್ಕೆ ಕರೆ ಮಾಡಿ.' } }] },
    { id: 'ifsc', match: /\bifsc\b/i,
      name: { en: 'IFSC code', hi: 'IFSC कोड', kn: 'IFSC ಕೋಡ್' },
      explain: {
        en: 'An 11-character code for your bank branch, like SBIN0001234. It is printed on your cheque book and passbook.',
        hi: 'आपकी बैंक शाखा का 11 अक्षरों का कोड, जैसे SBIN0001234। यह चेकबुक और पासबुक पर छपा होता है।',
        kn: 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಶಾಖೆಯ 11 ಅಕ್ಷರಗಳ ಕೋಡ್, ಉದಾಹರಣೆಗೆ SBIN0001234. ಇದು ಚೆಕ್‌ಬುಕ್ ಮತ್ತು ಪಾಸ್‌ಬುಕ್ ಮೇಲೆ ಮುದ್ರಿತವಾಗಿರುತ್ತದೆ.' } },
    { id: 'upi', match: /\bupi\b|\bvpa\b/i,
      name: { en: 'UPI ID', hi: 'UPI आईडी', kn: 'UPI ಐಡಿ' },
      explain: {
        en: 'Your UPI ID looks like yourname@bank. It is the address that payment apps such as Google Pay or PhonePe use. Open the app and look at your profile to see it.',
        hi: 'आपकी UPI आईडी yourname@bank जैसी दिखती है। Google Pay या PhonePe जैसे ऐप इसी पते से पैसे भेजते हैं। ऐप खोलकर अपनी प्रोफ़ाइल में देखिए।',
        kn: 'ನಿಮ್ಮ UPI ಐಡಿ yourname@bank ತರಹ ಇರುತ್ತದೆ. Google Pay ಅಥವಾ PhonePe ತರಹದ ಆ್ಯಪ್‌ಗಳು ಇದೇ ವಿಳಾಸ ಬಳಸುತ್ತವೆ. ಆ್ಯಪ್ ತೆರೆದು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನಲ್ಲಿ ನೋಡಿ.' } },
    { id: 'pincode', match: /pin\s*code|pincode|postal\s*code|\bzip\b/i,
      name: { en: 'PIN code', hi: 'पिन कोड', kn: 'ಪಿನ್ ಕೋಡ್' },
      explain: {
        en: 'The 6-digit post office code of your area. It is written on letters you receive and in the address on your Aadhaar card.',
        hi: 'आपके इलाके के डाकघर का 6 अंकों का कोड। यह आपको आने वाली चिट्ठियों पर और आधार कार्ड के पते में लिखा होता है।',
        kn: 'ನಿಮ್ಮ ಪ್ರದೇಶದ ಅಂಚೆ ಕಚೇರಿಯ 6 ಅಂಕಿಯ ಕೋಡ್. ನಿಮಗೆ ಬರುವ ಪತ್ರಗಳ ಮೇಲೆ ಮತ್ತು ಆಧಾರ್ ಕಾರ್ಡಿನ ವಿಳಾಸದಲ್ಲಿ ಇದು ಇರುತ್ತದೆ.' } },
    { id: 'mobile', match: /mobile|phone|contact\s*(no|number)/i,
      name: { en: 'Mobile number', hi: 'मोबाइल नंबर', kn: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ' },
      explain: {
        en: 'Your 10-digit mobile number, without +91 or 0 in front. Give the number of the phone that gets the SMS codes; often that is your son’s or daughter’s phone.',
        hi: 'आपका 10 अंकों का मोबाइल नंबर, आगे +91 या 0 लगाए बिना। वही नंबर दीजिए जिस फ़ोन पर SMS कोड आते हैं; अक्सर वह बेटे या बेटी का फ़ोन होता है।',
        kn: 'ನಿಮ್ಮ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ, ಮುಂದೆ +91 ಅಥವಾ 0 ಇಲ್ಲದೆ. SMS ಕೋಡ್ ಬರುವ ಫೋನಿನ ಸಂಖ್ಯೆಯನ್ನೇ ಕೊಡಿ; ಅದು ಹಲವು ಬಾರಿ ಮಗ ಅಥವಾ ಮಗಳ ಫೋನ್ ಆಗಿರುತ್ತದೆ.' } },
    { id: 'email', match: /e-?mail/i,
      name: { en: 'Email address', hi: 'ईमेल पता', kn: 'ಇಮೇಲ್ ವಿಳಾಸ' },
      explain: {
        en: 'An email address looks like name@gmail.com. If you don’t use email, ask a family member whether you can give theirs.',
        hi: 'ईमेल पता name@gmail.com जैसा दिखता है। अगर आप ईमेल नहीं चलाते, तो परिवार के किसी सदस्य से पूछिए कि क्या उनका दे सकते हैं।',
        kn: 'ಇಮೇಲ್ ವಿಳಾಸ name@gmail.com ತರಹ ಇರುತ್ತದೆ. ನೀವು ಇಮೇಲ್ ಬಳಸದಿದ್ದರೆ, ಮನೆಯವರ ಇಮೇಲ್ ಕೊಡಬಹುದೇ ಎಂದು ಅವರನ್ನು ಕೇಳಿ.' } },
    { id: 'dob', match: /\bdob\b|date of birth|birth\s*date|d\.o\.b/i,
      name: { en: 'Date of birth', hi: 'जन्म तिथि', kn: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ' },
      explain: {
        en: 'The date you were born, the same as on your Aadhaar card: day, then month, then year.',
        hi: 'आपके जन्म की तारीख, वही जो आधार कार्ड पर है: पहले दिन, फिर महीना, फिर साल।',
        kn: 'ನೀವು ಹುಟ್ಟಿದ ದಿನಾಂಕ, ಆಧಾರ್ ಕಾರ್ಡಿನಲ್ಲಿರುವಂತೆಯೇ: ಮೊದಲು ದಿನ, ನಂತರ ತಿಂಗಳು, ನಂತರ ವರ್ಷ.' } },
    { id: 'amount', match: /amount|\bamt\b|\brs\b|rupees|₹/i,
      name: { en: 'Amount', hi: 'रकम', kn: 'ಮೊತ್ತ' },
      explain: {
        en: 'How much money to pay, in rupees. Check it against your bill before you go on. Money leaves your account only when you confirm on the bank or UPI page.',
        hi: 'कितने रुपये भरने हैं। आगे बढ़ने से पहले बिल से मिला लीजिए। पैसे तभी कटते हैं जब आप बैंक या UPI वाले पेज पर पक्का करते हैं।',
        kn: 'ಎಷ್ಟು ರೂಪಾಯಿ ಕಟ್ಟಬೇಕು ಎಂಬುದು. ಮುಂದೆ ಹೋಗುವ ಮೊದಲು ಬಿಲ್ಲಿನೊಂದಿಗೆ ಹೋಲಿಸಿ ನೋಡಿ. ಬ್ಯಾಂಕ್ ಅಥವಾ UPI ಪುಟದಲ್ಲಿ ನೀವು ಖಚಿತಪಡಿಸಿದಾಗ ಮಾತ್ರ ಹಣ ಹೋಗುತ್ತದೆ.' } },
    { id: 'name', match: /\bname\b/i,
      name: { en: 'Name', hi: 'नाम', kn: 'ಹೆಸರು' },
      explain: {
        en: 'Your name, spelt exactly as on your Aadhaar card or bill.',
        hi: 'आपका नाम, ठीक उसी स्पेलिंग में जैसा आधार कार्ड या बिल पर है।',
        kn: 'ನಿಮ್ಮ ಹೆಸರು, ಆಧಾರ್ ಕಾರ್ಡ್ ಅಥವಾ ಬಿಲ್ಲಿನಲ್ಲಿರುವ ಅದೇ ಕಾಗುಣಿತದಲ್ಲಿ.' } },
    { id: 'address', match: /address|\baddr\b/i,
      name: { en: 'Address', hi: 'पता', kn: 'ವಿಳಾಸ' },
      explain: {
        en: 'Where you live: house number, street, area and city, as on your bill or Aadhaar card.',
        hi: 'आप कहाँ रहते हैं: मकान नंबर, गली, इलाका और शहर, जैसा बिल या आधार कार्ड पर है।',
        kn: 'ನೀವು ಎಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ: ಮನೆ ಸಂಖ್ಯೆ, ರಸ್ತೆ, ಪ್ರದೇಶ ಮತ್ತು ಊರು, ಬಿಲ್ ಅಥವಾ ಆಧಾರ್ ಕಾರ್ಡಿನಲ್ಲಿರುವಂತೆ.' } },
    { id: 'place', match: /\bstate\b|district|taluk|tehsil|\bward\b|village|\bcity\b|\btown\b/i,
      name: { en: 'Where you live', hi: 'आप कहाँ रहते हैं', kn: 'ನೀವು ಎಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ' },
      explain: {
        en: 'Choose where you live from the list. Start with the state; the next list then shows only the places in it.',
        hi: 'सूची में से चुनिए कि आप कहाँ रहते हैं। पहले राज्य चुनिए; फिर अगली सूची में सिर्फ़ उसी की जगहें आएँगी।',
        kn: 'ಪಟ್ಟಿಯಿಂದ ನೀವು ಎಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ ಎಂದು ಆಯ್ಕೆಮಾಡಿ. ಮೊದಲು ರಾಜ್ಯ ಆಯ್ಕೆಮಾಡಿ; ನಂತರದ ಪಟ್ಟಿಯಲ್ಲಿ ಅದರ ಊರುಗಳು ಮಾತ್ರ ಬರುತ್ತವೆ.' } },
  ];
  // meta: { label, placeholder, name, id, host }. Returns { id, known, name, explain } in the person's language.
  function explainField(meta, lang) {
    const L = LANGS.includes(lang) ? lang : 'en';
    const m = meta || {};
    const text = [m.label, m.placeholder, m.name, m.id].filter(Boolean).join(' ');
    for (const g of GLOSSARY) {
      if (!g.match.test(text)) continue;
      const site = (g.sites || []).find((s) => s.host.test(m.host || ''));
      return { id: g.id, known: true, name: g.name[L], explain: g.explain[L] + (site ? ' ' + site.hint[L] : '') };
    }
    return { id: 'unknown', known: false, name: String(m.label || m.placeholder || '').trim(), explain: t('unknownField', L) };
  }

  /* ---------- captcha helpers ---------- */
  // Every letter and digit: real captchas use them all (BESCOM's alphabet is 0-9 A-Z, case-sensitive, upper case).
  const CAPTCHA_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  // c: { text, title, alt, aria, onclick } of a control next to a captcha.
  function isRefreshControl(c) {
    const o = c || {};
    if (/captcha/i.test(o.onclick || '')) return true;
    return /refresh|reload|regenerate|new (picture|image|captcha|code)|change (picture|image|captcha)|↻|⟳|🔄|\bloop\b|autorenew|\bcached\b|\bsync\b|replay/i
      .test([o.text, o.title, o.alt, o.aria].filter(Boolean).join(' '));
  }

  /* ---------- strings (English, Hindi, Kannada) ---------- */
  const STR = {
    en: {
      helper: 'Steady helper', stop: 'Stop', stopped: 'Stopped. Nothing more will happen until you press Continue.', resume: 'Continue',
      readAloud: 'Read aloud', yesDoIt: 'Yes, do it', illDoIt: 'I’ll do it myself', doForMe: 'Do this for me', done: 'Done', clear: 'Clear', back: 'Delete',
      newPicture: 'New picture', cantRead: 'I can’t read it', zoom: 'Bigger picture',
      stepOf: 'Step {n} of {total}', working: 'Working…', waiting: 'Waiting for the portal…',
      captchaTitle: 'Type the letters in the picture', captchaBody: 'This is a small test to check that a real person is using the website, not a computer program. Type the letters and numbers exactly as you see them. It is a security check, so you type it, not me. Take your time; if it is hard to read, ask for a new picture.',
      otpTitleHelper: 'Ask {name} for the code', otpBodyHelper: 'A 6-digit code was sent to {name}’s phone ending {end}. Ask them to read it out, then type it here.',
      otpTitleSelf: 'Type the code from your phone', otpBodySelf: 'A 6-digit code was sent to the phone ending {end}.',
      timeLeft: 'Time left: {time}', codeExpired: 'The code ran out of time. Ask for a new code.', newCode: 'Send a new code',
      aadhaarTitle: 'Type the Aadhaar number', aadhaarBody: 'The 12 digits on the Aadhaar card. This stays on this computer and is never sent to the AI.',
      rememberAadhaar: 'Remember it on this computer for 7 days, so a timeout does not make me start again',
      mobileTitle: 'Type the mobile number', mobileBody: 'The 10-digit mobile number used to log in.',
      chooseTitle: 'Choose {what}', saved: 'Saved answer: {v}',
      consentTitle: 'Your permission is needed', consentBody: 'The portal asks permission to check the Aadhaar details for this application. Only you can give it.', agree: 'I agree', notNow: 'Not now',
      photoTitle: 'A photo of the person', photoBody: 'Look at the camera. Hold still: the picture is taken by itself when the camera is steady. You can also press the big button.',
      takePhoto: 'Take the photo', usePractice: 'Use the practice photo', retake: 'Take it again', usePhoto: 'Use this photo',
      reviewTitle: 'Check before you submit', reviewBody: 'Please check these details. The application is sent only when you press Submit.', submit: 'Submit', goBack: 'Not yet',
      doneTitle: 'Application sent', doneBody: 'Reference number {ref}. Status: pending approval. Your saved answers have been deleted from this computer.',
      offerStruggle: 'This step looks hard right now. Shall I do the safe steps for you? You will still do the private ones.',
      offerTremor: 'Your hand seems less steady right now. Shall I do the safe steps for you? You will still do the private ones.',
      offerYes: 'Yes, help more', offerNo: 'No, thanks',
      resumeTitle: 'The portal closed your session', resumeBody: 'I saved your answers. I will fill them in again. You only need to type the new codes.',
      planAsk: 'I’ll fill in: {list}. Then I’ll press “{button}”. OK?',
      planAskNoBtn: 'I’ll fill in: {list}. OK?', pressAsk: 'Shall I press “{button}”?',
      noResponse: 'The portal did not react to the button. Please try it on the page, or press Stop and ask someone to help.',
      modeAssist: 'You lead: I show each step and help when you ask', modeCopilot: 'I do the safe steps after you say yes', modeAutopilot: 'I do the safe steps and stop for the private ones',
      changeMode: 'Change', showOriginal: 'Hide helper', showHelper: 'Show helper', log: 'What I did',
      aiThinking: 'This page is new to me. Asking the AI for the next safe step…', aiSuggest: 'AI suggestion: {say}', aiOff: 'This page is not in my verified steps, and the AI fallback is off. Please continue on the page, or ask someone to help.',
      aiBlocked: 'The AI suggested something I am not allowed to do ({why}). I did not do it.',
      unknownErrTitle: 'The portal showed a message', unknownErr: 'The portal showed a message I do not recognise.', unknownErrNext: 'Read it on the page, or try again.',
      retrying: 'Trying again ({n} of 3)…', gaveUp: 'The portal is still not responding. Please try again later; your answers are saved.',
      privateNote: 'Private step: only you do this.',
      helperHere: 'I can help on this page', genericIntro: 'Tap any box on the page. I’ll show it here, big, and tell you what it is asking for and where to find it. I can also read the page aloud, or guide you step by step.',
      whatIsThis: 'What is this?', unknownField: 'I don’t know this box yet. Look at the words next to it on the page, or ask someone at home. You can also call the helpline number shown on the website.',
      explainAI: 'Asking the AI what this box means…', openHelp: 'Open: {label}',
      noVoiceTitle: 'No {lang} voice on this computer', noVoiceBody: 'I’ll show the words here, but I can’t say them in this language. Microsoft Edge usually has Hindi and Kannada voices when it is online; Chrome has Hindi. A family member can also add a voice in Windows: Settings › Time & language › Speech.',
      readEmpty: 'empty', readFilled: 'filled in', readThenPress: 'Then press “{button}”.',
      captchaLookPage: 'I can’t copy this picture. Look at the picture next to the box on the page; I have marked it.',
      guideMe: 'Guide me step by step', readPage: 'Read this page aloud', biggerText: 'Bigger page text', aiNeedsKey: 'Step-by-step guidance uses the AI. It is off: a family member can turn it on in the helper’s Options.',
      goalTitle: 'What do you want to do here?', goalBody: 'Say it in your own words, or pick one.', goalForm: 'Fill in this form', goalNext: 'Show me the next step', goalStart: 'Start',
      looking: 'Looking at the page…', continueBtn: 'Continue', aiDone: 'Done: {say}', typeFor: 'Type: {label}', tickTitle: 'Tick “{label}”?', tickYes: 'Yes, tick it',
      modePlaybook: 'Verified steps for this portal', modeAI: 'AI planner (Claude) on a masked page', modeLocal: 'On-device help only', backHome: 'Back',
    },
    hi: {
      helper: 'स्टेडी सहायक', stop: 'रोकें', stopped: 'रोक दिया। जब तक आप “जारी रखें” नहीं दबाते, कुछ नहीं होगा।', resume: 'जारी रखें',
      readAloud: 'पढ़कर सुनाएँ', yesDoIt: 'हाँ, कर दो', illDoIt: 'मैं खुद करूँगा', doForMe: 'मेरे लिए कर दो', done: 'हो गया', clear: 'मिटाएँ', back: 'हटाएँ',
      newPicture: 'नया चित्र', cantRead: 'पढ़ नहीं पा रहे', zoom: 'बड़ा चित्र',
      stepOf: 'चरण {n} / {total}', working: 'काम चल रहा है…', waiting: 'पोर्टल का इंतज़ार…',
      captchaTitle: 'चित्र में दिख रहे अक्षर लिखें', captchaBody: 'यह एक छोटी जाँच है, यह देखने के लिए कि वेबसाइट कोई असली इंसान चला रहा है, कोई कंप्यूटर प्रोग्राम नहीं। चित्र में जो अक्षर और अंक दिख रहे हैं, ठीक वही लिखिए। यह सुरक्षा जाँच है, इसलिए इसे आप लिखिए, मैं नहीं। आराम से कीजिए; पढ़ना मुश्किल हो तो नया चित्र माँग लीजिए।',
      otpTitleHelper: 'कोड के लिए {name} से पूछें', otpBodyHelper: '{end} पर खत्म होने वाले {name} के फ़ोन पर 6 अंकों का कोड भेजा गया है। उनसे कोड पूछकर यहाँ लिखें।',
      otpTitleSelf: 'अपने फ़ोन से कोड लिखें', otpBodySelf: '{end} पर खत्म होने वाले फ़ोन पर 6 अंकों का कोड भेजा गया है।',
      timeLeft: 'बचा समय: {time}', codeExpired: 'कोड का समय खत्म हो गया। नया कोड माँगें।', newCode: 'नया कोड भेजें',
      aadhaarTitle: 'आधार नंबर लिखें', aadhaarBody: 'आधार कार्ड के 12 अंक। यह इसी कंप्यूटर पर रहता है और AI को कभी नहीं भेजा जाता।',
      rememberAadhaar: 'इसे 7 दिन तक इस कंप्यूटर पर याद रखें, ताकि टाइमआउट पर फिर से शुरू न करना पड़े',
      mobileTitle: 'मोबाइल नंबर लिखें', mobileBody: 'लॉग इन वाला 10 अंकों का मोबाइल नंबर।',
      chooseTitle: '{what} चुनें', saved: 'सहेजा गया जवाब: {v}',
      consentTitle: 'आपकी अनुमति चाहिए', consentBody: 'पोर्टल इस आवेदन के लिए आधार की जानकारी जाँचने की अनुमति माँग रहा है। यह अनुमति केवल आप दे सकते हैं।', agree: 'मैं सहमत हूँ', notNow: 'अभी नहीं',
      photoTitle: 'व्यक्ति की फ़ोटो', photoBody: 'कैमरे की ओर देखें। स्थिर रहें: कैमरा स्थिर होते ही फ़ोटो अपने आप खिंच जाएगी। आप बड़ा बटन भी दबा सकते हैं।',
      takePhoto: 'फ़ोटो लें', usePractice: 'अभ्यास वाली फ़ोटो लें', retake: 'फिर से लें', usePhoto: 'यही फ़ोटो लें',
      reviewTitle: 'जमा करने से पहले जाँच लें', reviewBody: 'कृपया ये जानकारी जाँच लें। आवेदन तभी जाएगा जब आप “जमा करें” दबाएँगे।', submit: 'जमा करें', goBack: 'अभी नहीं',
      doneTitle: 'आवेदन भेज दिया गया', doneBody: 'संदर्भ संख्या {ref}। स्थिति: मंज़ूरी बाकी। आपके सहेजे जवाब इस कंप्यूटर से मिटा दिए गए हैं।',
      offerStruggle: 'यह चरण अभी मुश्किल लग रहा है। क्या मैं सुरक्षित चरण आपके लिए कर दूँ? निजी चरण आप ही करेंगे।',
      offerTremor: 'लगता है अभी हाथ कम स्थिर है। क्या मैं सुरक्षित चरण आपके लिए कर दूँ? निजी चरण आप ही करेंगे।',
      offerYes: 'हाँ, और मदद करें', offerNo: 'नहीं, धन्यवाद',
      resumeTitle: 'पोर्टल ने आपका सत्र बंद कर दिया', resumeBody: 'मैंने आपके जवाब सहेज लिए हैं। मैं उन्हें फिर से भर दूँगा। आपको केवल नए कोड लिखने हैं।',
      planAsk: 'मैं ये भर दूँगा: {list}। फिर “{button}” दबाऊँगा। ठीक है?',
      planAskNoBtn: 'मैं ये भर दूँगा: {list}। ठीक है?', pressAsk: 'क्या मैं “{button}” दबा दूँ?',
      noResponse: 'पोर्टल ने बटन पर कोई जवाब नहीं दिया। कृपया पेज पर खुद दबाकर देखें, या “रोकें” दबाकर किसी से मदद लें।',
      modeAssist: 'आप आगे: मैं हर चरण दिखाता हूँ और कहने पर मदद करता हूँ', modeCopilot: 'आपके “हाँ” कहने पर मैं सुरक्षित चरण करता हूँ', modeAutopilot: 'मैं सुरक्षित चरण करता हूँ और निजी चरणों पर रुकता हूँ',
      changeMode: 'बदलें', showOriginal: 'सहायक छिपाएँ', showHelper: 'सहायक दिखाएँ', log: 'मैंने क्या किया',
      aiThinking: 'यह पेज मेरे लिए नया है। अगला सुरक्षित चरण AI से पूछ रहा हूँ…', aiSuggest: 'AI का सुझाव: {say}', aiOff: 'यह पेज मेरे जाँचे हुए चरणों में नहीं है, और AI बंद है। कृपया पेज पर आगे बढ़ें या किसी से मदद लें।',
      aiBlocked: 'AI ने ऐसा कुछ सुझाया जिसकी मुझे अनुमति नहीं है ({why})। मैंने वह नहीं किया।',
      unknownErrTitle: 'पोर्टल ने एक संदेश दिखाया', unknownErr: 'पोर्टल ने ऐसा संदेश दिखाया जिसे मैं नहीं पहचानता।', unknownErrNext: 'इसे पेज पर पढ़ें, या फिर से कोशिश करें।',
      retrying: 'फिर से कोशिश ({n} / 3)…', gaveUp: 'पोर्टल अभी भी जवाब नहीं दे रहा। बाद में कोशिश करें; आपके जवाब सहेजे हुए हैं।',
      privateNote: 'निजी चरण: इसे केवल आप करें।',
      helperHere: 'मैं इस पेज पर मदद कर सकता हूँ', genericIntro: 'पेज पर किसी भी खाने को छुइए। मैं उसे यहाँ बड़ा करके दिखाऊँगा, और बताऊँगा कि वह क्या माँग रहा है और वह कहाँ मिलेगा। मैं पेज पढ़कर सुना सकता हूँ, या चरण-दर-चरण बता सकता हूँ।',
      whatIsThis: 'यह क्या है?', unknownField: 'यह खाना मुझे अभी पता नहीं। पेज पर इसके पास लिखे शब्द देखिए, या घर में किसी से पूछिए। वेबसाइट पर दिए हेल्पलाइन नंबर पर भी फ़ोन कर सकते हैं।',
      explainAI: 'इस खाने का मतलब AI से पूछ रहा हूँ…', openHelp: 'खोलें: {label}',
      noVoiceTitle: 'इस कंप्यूटर पर {lang} आवाज़ नहीं है', noVoiceBody: 'मैं शब्द यहाँ दिखाऊँगा, पर इस भाषा में बोल नहीं पाऊँगा। Microsoft Edge में इंटरनेट चालू हो तो आमतौर पर हिंदी और कन्नड़ आवाज़ें होती हैं; Chrome में हिंदी है। परिवार का कोई सदस्य Windows में आवाज़ जोड़ सकता है: Settings › Time & language › Speech.',
      readEmpty: 'खाली', readFilled: 'भरा हुआ', readThenPress: 'फिर “{button}” दबाइए।',
      captchaLookPage: 'मैं यह चित्र कॉपी नहीं कर पा रहा। पेज पर खाने के पास वाला चित्र देखिए; मैंने उस पर निशान लगा दिया है।',
      guideMe: 'चरण-दर-चरण बताओ', readPage: 'यह पेज पढ़कर सुनाओ', biggerText: 'पेज का अक्षर बड़ा करो', aiNeedsKey: 'चरण-दर-चरण मदद AI से होती है। यह बंद है: परिवार का कोई सदस्य इसे सहायक के विकल्पों (Options) में चालू कर सकता है।',
      goalTitle: 'आप यहाँ क्या करना चाहते हैं?', goalBody: 'अपने शब्दों में लिखें, या एक चुनें।', goalForm: 'यह फ़ॉर्म भरना है', goalNext: 'अगला चरण दिखाओ', goalStart: 'शुरू करें',
      looking: 'पेज देख रहा हूँ…', continueBtn: 'आगे बढ़ें', aiDone: 'हो गया: {say}', typeFor: 'लिखें: {label}', tickTitle: '“{label}” पर सही का निशान लगाएँ?', tickYes: 'हाँ, लगा दो',
      modePlaybook: 'इस पोर्टल के जाँचे हुए चरण', modeAI: 'AI योजनाकार (Claude), छिपाई गई जानकारी वाले पेज पर', modeLocal: 'केवल इसी डिवाइस पर मदद', backHome: 'वापस',
    },
    // Kannada: written for this build; have a native speaker review before real users see it.
    kn: {
      helper: 'ಸ್ಟೆಡಿ ಸಹಾಯಕ', stop: 'ನಿಲ್ಲಿಸಿ', stopped: 'ನಿಲ್ಲಿಸಲಾಗಿದೆ. ನೀವು “ಮುಂದುವರಿಸಿ” ಒತ್ತುವವರೆಗೂ ಏನೂ ಆಗುವುದಿಲ್ಲ.', resume: 'ಮುಂದುವರಿಸಿ',
      readAloud: 'ಓದಿ ಹೇಳು', yesDoIt: 'ಹೌದು, ಮಾಡು', illDoIt: 'ನಾನೇ ಮಾಡುತ್ತೇನೆ', doForMe: 'ನನಗಾಗಿ ಮಾಡು', done: 'ಆಯಿತು', clear: 'ಅಳಿಸು', back: 'ತೆಗೆ',
      newPicture: 'ಹೊಸ ಚಿತ್ರ', cantRead: 'ಓದಲು ಆಗುತ್ತಿಲ್ಲ', zoom: 'ದೊಡ್ಡ ಚಿತ್ರ',
      stepOf: 'ಹಂತ {n} / {total}', working: 'ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ…', waiting: 'ಪೋರ್ಟಲ್‌ಗಾಗಿ ಕಾಯುತ್ತಿದ್ದೇನೆ…',
      captchaTitle: 'ಚಿತ್ರದಲ್ಲಿರುವ ಅಕ್ಷರಗಳನ್ನು ಬರೆಯಿರಿ', captchaBody: 'ಇದು ಒಂದು ಸಣ್ಣ ಪರೀಕ್ಷೆ: ವೆಬ್‌ಸೈಟ್ ಬಳಸುತ್ತಿರುವವರು ನಿಜವಾದ ವ್ಯಕ್ತಿ, ಕಂಪ್ಯೂಟರ್ ಪ್ರೋಗ್ರಾಂ ಅಲ್ಲ ಎಂದು ನೋಡಲು. ಚಿತ್ರದಲ್ಲಿರುವ ಅಕ್ಷರ ಮತ್ತು ಅಂಕಿಗಳನ್ನು ಅದೇ ರೀತಿ ಬರೆಯಿರಿ. ಇದು ಸುರಕ್ಷತಾ ಪರೀಕ್ಷೆ, ಆದ್ದರಿಂದ ನೀವೇ ಬರೆಯಬೇಕು, ನಾನಲ್ಲ. ನಿಧಾನವಾಗಿ ಮಾಡಿ; ಓದಲು ಕಷ್ಟವಾದರೆ ಹೊಸ ಚಿತ್ರ ಕೇಳಿ.',
      otpTitleHelper: 'ಕೋಡ್‌ಗಾಗಿ {name} ಅವರನ್ನು ಕೇಳಿ', otpBodyHelper: '{end} ರಲ್ಲಿ ಮುಗಿಯುವ {name} ಅವರ ಫೋನಿಗೆ 6 ಅಂಕಿಯ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ. ಅವರಿಂದ ಕೋಡ್ ಕೇಳಿ ಇಲ್ಲಿ ಬರೆಯಿರಿ.',
      otpTitleSelf: 'ನಿಮ್ಮ ಫೋನಿನಲ್ಲಿರುವ ಕೋಡ್ ಬರೆಯಿರಿ', otpBodySelf: '{end} ರಲ್ಲಿ ಮುಗಿಯುವ ಫೋನಿಗೆ 6 ಅಂಕಿಯ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ.',
      timeLeft: 'ಉಳಿದ ಸಮಯ: {time}', codeExpired: 'ಕೋಡಿನ ಸಮಯ ಮುಗಿಯಿತು. ಹೊಸ ಕೋಡ್ ಕೇಳಿ.', newCode: 'ಹೊಸ ಕೋಡ್ ಕಳುಹಿಸಿ',
      aadhaarTitle: 'ಆಧಾರ್ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ', aadhaarBody: 'ಆಧಾರ್ ಕಾರ್ಡಿನ 12 ಅಂಕಿಗಳು. ಇದು ಈ ಕಂಪ್ಯೂಟರಿನಲ್ಲೇ ಇರುತ್ತದೆ, AI ಗೆ ಎಂದಿಗೂ ಕಳುಹಿಸುವುದಿಲ್ಲ.',
      rememberAadhaar: '7 ದಿನಗಳವರೆಗೆ ಈ ಕಂಪ್ಯೂಟರಿನಲ್ಲಿ ನೆನಪಿಡು, ಸಮಯ ಮುಗಿದರೆ ಮತ್ತೆ ಮೊದಲಿನಿಂದ ಶುರು ಮಾಡಬೇಕಾಗಿಲ್ಲ',
      mobileTitle: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ', mobileBody: 'ಲಾಗಿನ್‌ಗೆ ಬಳಸುವ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ.',
      chooseTitle: '{what} ಆಯ್ಕೆಮಾಡಿ', saved: 'ಉಳಿಸಿದ ಉತ್ತರ: {v}',
      consentTitle: 'ನಿಮ್ಮ ಅನುಮತಿ ಬೇಕು', consentBody: 'ಈ ಅರ್ಜಿಗಾಗಿ ಆಧಾರ್ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಪೋರ್ಟಲ್ ಅನುಮತಿ ಕೇಳುತ್ತಿದೆ. ಈ ಅನುಮತಿಯನ್ನು ನೀವು ಮಾತ್ರ ಕೊಡಬಹುದು.', agree: 'ನಾನು ಒಪ್ಪುತ್ತೇನೆ', notNow: 'ಈಗ ಬೇಡ',
      photoTitle: 'ವ್ಯಕ್ತಿಯ ಫೋಟೋ', photoBody: 'ಕ್ಯಾಮೆರಾ ಕಡೆ ನೋಡಿ. ಅಲುಗಾಡದೆ ಇರಿ: ಕ್ಯಾಮೆರಾ ಸ್ಥಿರವಾದಾಗ ಫೋಟೋ ತಾನಾಗಿಯೇ ತೆಗೆಯುತ್ತದೆ. ದೊಡ್ಡ ಬಟನ್ ಕೂಡ ಒತ್ತಬಹುದು.',
      takePhoto: 'ಫೋಟೋ ತೆಗೆಯಿರಿ', usePractice: 'ಅಭ್ಯಾಸದ ಫೋಟೋ ಬಳಸಿ', retake: 'ಮತ್ತೆ ತೆಗೆಯಿರಿ', usePhoto: 'ಈ ಫೋಟೋ ಬಳಸಿ',
      reviewTitle: 'ಸಲ್ಲಿಸುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ', reviewBody: 'ದಯವಿಟ್ಟು ಈ ವಿವರಗಳನ್ನು ನೋಡಿ. ನೀವು “ಸಲ್ಲಿಸಿ” ಒತ್ತಿದಾಗ ಮಾತ್ರ ಅರ್ಜಿ ಹೋಗುತ್ತದೆ.', submit: 'ಸಲ್ಲಿಸಿ', goBack: 'ಇನ್ನೂ ಬೇಡ',
      doneTitle: 'ಅರ್ಜಿ ಕಳುಹಿಸಲಾಗಿದೆ', doneBody: 'ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ {ref}. ಸ್ಥಿತಿ: ಅನುಮೋದನೆ ಬಾಕಿ ಇದೆ. ನಿಮ್ಮ ಉಳಿಸಿದ ಉತ್ತರಗಳನ್ನು ಈ ಕಂಪ್ಯೂಟರಿನಿಂದ ಅಳಿಸಲಾಗಿದೆ.',
      offerStruggle: 'ಈ ಹಂತ ಈಗ ಕಷ್ಟವಾಗುತ್ತಿರುವಂತೆ ಕಾಣುತ್ತಿದೆ. ಸುರಕ್ಷಿತ ಹಂತಗಳನ್ನು ನಾನು ಮಾಡಲೇ? ಖಾಸಗಿ ಹಂತಗಳನ್ನು ನೀವೇ ಮಾಡುತ್ತೀರಿ.',
      offerTremor: 'ಈಗ ಕೈ ಸ್ವಲ್ಪ ಅಲುಗಾಡುತ್ತಿರುವಂತೆ ಕಾಣುತ್ತಿದೆ. ಸುರಕ್ಷಿತ ಹಂತಗಳನ್ನು ನಾನು ಮಾಡಲೇ? ಖಾಸಗಿ ಹಂತಗಳನ್ನು ನೀವೇ ಮಾಡುತ್ತೀರಿ.',
      offerYes: 'ಹೌದು, ಇನ್ನಷ್ಟು ಸಹಾಯ ಮಾಡು', offerNo: 'ಬೇಡ, ಧನ್ಯವಾದ',
      resumeTitle: 'ಪೋರ್ಟಲ್ ನಿಮ್ಮ ಸೆಷನ್ ಮುಚ್ಚಿದೆ', resumeBody: 'ನಿಮ್ಮ ಉತ್ತರಗಳನ್ನು ನಾನು ಉಳಿಸಿದ್ದೇನೆ. ಅವುಗಳನ್ನು ಮತ್ತೆ ತುಂಬುತ್ತೇನೆ. ನೀವು ಹೊಸ ಕೋಡ್‌ಗಳನ್ನು ಮಾತ್ರ ಬರೆಯಬೇಕು.',
      planAsk: 'ನಾನು ಇವುಗಳನ್ನು ತುಂಬುತ್ತೇನೆ: {list}. ನಂತರ “{button}” ಒತ್ತುತ್ತೇನೆ. ಸರಿಯೇ?',
      planAskNoBtn: 'ನಾನು ಇವುಗಳನ್ನು ತುಂಬುತ್ತೇನೆ: {list}. ಸರಿಯೇ?', pressAsk: '“{button}” ಒತ್ತಲೇ?',
      noResponse: 'ಬಟನ್‌ಗೆ ಪೋರ್ಟಲ್ ಪ್ರತಿಕ್ರಿಯಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪುಟದಲ್ಲಿ ನೀವೇ ಒತ್ತಿ ನೋಡಿ, ಅಥವಾ “ನಿಲ್ಲಿಸಿ” ಒತ್ತಿ ಯಾರಾದರೂ ಸಹಾಯ ಕೇಳಿ.',
      modeAssist: 'ನೀವು ಮುಂದೆ: ಪ್ರತಿ ಹಂತ ತೋರಿಸುತ್ತೇನೆ, ಕೇಳಿದಾಗ ಸಹಾಯ ಮಾಡುತ್ತೇನೆ', modeCopilot: 'ನೀವು “ಹೌದು” ಎಂದ ನಂತರ ಸುರಕ್ಷಿತ ಹಂತಗಳನ್ನು ನಾನು ಮಾಡುತ್ತೇನೆ', modeAutopilot: 'ಸುರಕ್ಷಿತ ಹಂತಗಳನ್ನು ನಾನು ಮಾಡುತ್ತೇನೆ, ಖಾಸಗಿ ಹಂತಗಳಲ್ಲಿ ನಿಲ್ಲುತ್ತೇನೆ',
      changeMode: 'ಬದಲಿಸಿ', showOriginal: 'ಸಹಾಯಕ ಮರೆಮಾಡಿ', showHelper: 'ಸಹಾಯಕ ತೋರಿಸಿ', log: 'ನಾನು ಏನು ಮಾಡಿದೆ',
      aiThinking: 'ಈ ಪುಟ ನನಗೆ ಹೊಸದು. ಮುಂದಿನ ಸುರಕ್ಷಿತ ಹಂತವನ್ನು AI ಬಳಿ ಕೇಳುತ್ತಿದ್ದೇನೆ…', aiSuggest: 'AI ಸಲಹೆ: {say}', aiOff: 'ಈ ಪುಟ ನನ್ನ ಪರಿಶೀಲಿತ ಹಂತಗಳಲ್ಲಿ ಇಲ್ಲ, ಮತ್ತು AI ಆಫ್ ಆಗಿದೆ. ದಯವಿಟ್ಟು ಪುಟದಲ್ಲಿ ಮುಂದುವರಿಯಿರಿ ಅಥವಾ ಯಾರಾದರೂ ಸಹಾಯ ಕೇಳಿ.',
      aiBlocked: 'AI ನನಗೆ ಅನುಮತಿ ಇಲ್ಲದ ಕೆಲಸವನ್ನು ಸೂಚಿಸಿತು ({why}). ನಾನು ಅದನ್ನು ಮಾಡಲಿಲ್ಲ.',
      unknownErrTitle: 'ಪೋರ್ಟಲ್ ಒಂದು ಸಂದೇಶ ತೋರಿಸಿತು', unknownErr: 'ಪೋರ್ಟಲ್ ನನಗೆ ಗೊತ್ತಿಲ್ಲದ ಸಂದೇಶ ತೋರಿಸಿತು.', unknownErrNext: 'ಅದನ್ನು ಪುಟದಲ್ಲಿ ಓದಿ, ಅಥವಾ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      retrying: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸುತ್ತಿದ್ದೇನೆ ({n} / 3)…', gaveUp: 'ಪೋರ್ಟಲ್ ಇನ್ನೂ ಪ್ರತಿಕ್ರಿಯಿಸುತ್ತಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಪ್ರಯತ್ನಿಸಿ; ನಿಮ್ಮ ಉತ್ತರಗಳು ಉಳಿದಿವೆ.',
      privateNote: 'ಖಾಸಗಿ ಹಂತ: ಇದನ್ನು ನೀವು ಮಾತ್ರ ಮಾಡಿ.',
      helperHere: 'ಈ ಪುಟದಲ್ಲಿ ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ', genericIntro: 'ಪುಟದಲ್ಲಿ ಯಾವುದೇ ಬಾಕ್ಸ್ ಒತ್ತಿ. ಅದನ್ನು ಇಲ್ಲಿ ದೊಡ್ಡದಾಗಿ ತೋರಿಸಿ, ಅದು ಏನು ಕೇಳುತ್ತಿದೆ ಮತ್ತು ಅದು ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ ಎಂದು ಹೇಳುತ್ತೇನೆ. ಪುಟವನ್ನು ಓದಿ ಹೇಳಬಲ್ಲೆ, ಅಥವಾ ಹಂತ ಹಂತವಾಗಿ ತೋರಿಸಬಲ್ಲೆ.',
      guideMe: 'ಹಂತ ಹಂತವಾಗಿ ತೋರಿಸು', readPage: 'ಈ ಪುಟವನ್ನು ಓದಿ ಹೇಳು', biggerText: 'ಪುಟದ ಅಕ್ಷರ ದೊಡ್ಡದು ಮಾಡು', aiNeedsKey: 'ಹಂತ ಹಂತದ ಸಹಾಯ AI ಮೂಲಕ ಆಗುತ್ತದೆ. ಅದು ಆಫ್ ಆಗಿದೆ: ಮನೆಯವರು ಯಾರಾದರೂ ಸಹಾಯಕದ ಆಯ್ಕೆಗಳಲ್ಲಿ (Options) ಆನ್ ಮಾಡಬಹುದು.',
      goalTitle: 'ನೀವು ಇಲ್ಲಿ ಏನು ಮಾಡಬೇಕು?', goalBody: 'ನಿಮ್ಮ ಮಾತಿನಲ್ಲಿ ಬರೆಯಿರಿ, ಅಥವಾ ಒಂದನ್ನು ಆಯ್ಕೆಮಾಡಿ.', goalForm: 'ಈ ಫಾರ್ಮ್ ತುಂಬಬೇಕು', goalNext: 'ಮುಂದಿನ ಹಂತ ತೋರಿಸು', goalStart: 'ಶುರು ಮಾಡಿ',
      looking: 'ಪುಟ ನೋಡುತ್ತಿದ್ದೇನೆ…', continueBtn: 'ಮುಂದೆ', aiDone: 'ಆಯಿತು: {say}', typeFor: 'ಬರೆಯಿರಿ: {label}', tickTitle: '“{label}” ಗುರುತು ಹಾಕಲೇ?', tickYes: 'ಹೌದು, ಗುರುತು ಹಾಕು',
      modePlaybook: 'ಈ ಪೋರ್ಟಲ್‌ನ ಪರಿಶೀಲಿತ ಹಂತಗಳು', modeAI: 'AI ಯೋಜಕ (Claude), ಮರೆಮಾಡಿದ ಮಾಹಿತಿಯ ಪುಟದ ಮೇಲೆ', modeLocal: 'ಈ ಸಾಧನದಲ್ಲೇ ಸಹಾಯ ಮಾತ್ರ', backHome: 'ಹಿಂದೆ',
      whatIsThis: 'ಇದು ಏನು?', unknownField: 'ಈ ಬಾಕ್ಸ್ ಬಗ್ಗೆ ನನಗೆ ಇನ್ನೂ ಗೊತ್ತಿಲ್ಲ. ಪುಟದಲ್ಲಿ ಅದರ ಪಕ್ಕದ ಪದಗಳನ್ನು ನೋಡಿ, ಅಥವಾ ಮನೆಯವರನ್ನು ಕೇಳಿ. ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿರುವ ಸಹಾಯವಾಣಿ ಸಂಖ್ಯೆಗೂ ಕರೆ ಮಾಡಬಹುದು.',
      explainAI: 'ಈ ಬಾಕ್ಸ್ ಅರ್ಥವನ್ನು AI ಬಳಿ ಕೇಳುತ್ತಿದ್ದೇನೆ…', openHelp: 'ತೆರೆಯಿರಿ: {label}',
      noVoiceTitle: 'ಈ ಕಂಪ್ಯೂಟರಿನಲ್ಲಿ {lang} ಧ್ವನಿ ಇಲ್ಲ', noVoiceBody: 'ಪದಗಳನ್ನು ಇಲ್ಲಿ ತೋರಿಸುತ್ತೇನೆ, ಆದರೆ ಈ ಭಾಷೆಯಲ್ಲಿ ಹೇಳಲು ಆಗುವುದಿಲ್ಲ. Microsoft Edge ಇಂಟರ್ನೆಟ್‌ನಲ್ಲಿದ್ದಾಗ ಸಾಮಾನ್ಯವಾಗಿ ಹಿಂದಿ ಮತ್ತು ಕನ್ನಡ ಧ್ವನಿಗಳನ್ನು ಹೊಂದಿರುತ್ತದೆ; Chrome ನಲ್ಲಿ ಹಿಂದಿ ಇದೆ. ಮನೆಯವರು Windows ನಲ್ಲಿ ಧ್ವನಿ ಸೇರಿಸಬಹುದು: Settings › Time & language › Speech.',
      readEmpty: 'ಖಾಲಿ', readFilled: 'ತುಂಬಿದೆ', readThenPress: 'ನಂತರ “{button}” ಒತ್ತಿ.',
      captchaLookPage: 'ಈ ಚಿತ್ರವನ್ನು ನಾನು ನಕಲು ಮಾಡಲು ಆಗುತ್ತಿಲ್ಲ. ಪುಟದಲ್ಲಿ ಬಾಕ್ಸ್ ಪಕ್ಕದ ಚಿತ್ರ ನೋಡಿ; ಅದನ್ನು ಗುರುತಿಸಿದ್ದೇನೆ.',
    },
  };
  function t(key, lang, vars) {
    const L = STR[lang] ? lang : 'en';
    let s = STR[L][key] != null ? STR[L][key] : STR.en[key] != null ? STR.en[key] : key;
    for (const [k, v] of Object.entries(vars || {})) s = s.split('{' + k + '}').join(String(v));
    return s;
  }

  return { classifyField, isPrivate, maskText, maskSnapshot, validateAction, ACTIONS, SAFE_VAULT_KEYS,
    FEATURES, struggleFeatures, struggleScore, sigmoid, LEVELS, autonomyOffer, explainError, STR, t,
    LANGS, LANG_LABEL, nextLang, speakable, pickVoice, GLOSSARY, explainField, CAPTCHA_KEYS, isRefreshControl };
});
