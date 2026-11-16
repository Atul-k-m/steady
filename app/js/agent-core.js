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

  /* ---------- strings (English, Hindi) ---------- */
  const STR = {
    en: {
      helper: 'Steady helper', stop: 'Stop', stopped: 'Stopped. Nothing more will happen until you press Continue.', resume: 'Continue',
      readAloud: 'Read aloud', yesDoIt: 'Yes, do it', illDoIt: 'I’ll do it myself', doForMe: 'Do this for me', done: 'Done', clear: 'Clear', back: 'Delete',
      newPicture: 'New picture', cantRead: 'I can’t read it', zoom: 'Bigger picture',
      stepOf: 'Step {n} of {total}', working: 'Working…', waiting: 'Waiting for the portal…',
      captchaTitle: 'Type the letters in the picture', captchaBody: 'This is a security check, so you type it, not the helper. Take your time. If it is hard to read, ask for a new picture.',
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
      helperHere: 'I can help on this page', genericIntro: 'Tap any box on the page and I’ll show it here, big, with a keypad. I can also read the page aloud, or guide you step by step.',
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
      captchaTitle: 'चित्र में दिख रहे अक्षर लिखें', captchaBody: 'यह सुरक्षा जाँच है, इसलिए इसे आप लिखें, सहायक नहीं। आराम से करें। पढ़ना मुश्किल हो तो नया चित्र माँगें।',
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
      helperHere: 'मैं इस पेज पर मदद कर सकता हूँ', genericIntro: 'पेज पर किसी भी खाने को छुएँ, मैं उसे यहाँ बड़ा करके कीपैड के साथ दिखाऊँगा। मैं पेज पढ़कर सुना सकता हूँ, या चरण-दर-चरण बता सकता हूँ।',
      guideMe: 'चरण-दर-चरण बताओ', readPage: 'यह पेज पढ़कर सुनाओ', biggerText: 'पेज का अक्षर बड़ा करो', aiNeedsKey: 'चरण-दर-चरण मदद AI से होती है। यह बंद है: परिवार का कोई सदस्य इसे सहायक के विकल्पों (Options) में चालू कर सकता है।',
      goalTitle: 'आप यहाँ क्या करना चाहते हैं?', goalBody: 'अपने शब्दों में लिखें, या एक चुनें।', goalForm: 'यह फ़ॉर्म भरना है', goalNext: 'अगला चरण दिखाओ', goalStart: 'शुरू करें',
      looking: 'पेज देख रहा हूँ…', continueBtn: 'आगे बढ़ें', aiDone: 'हो गया: {say}', typeFor: 'लिखें: {label}', tickTitle: '“{label}” पर सही का निशान लगाएँ?', tickYes: 'हाँ, लगा दो',
      modePlaybook: 'इस पोर्टल के जाँचे हुए चरण', modeAI: 'AI योजनाकार (Claude), छिपाई गई जानकारी वाले पेज पर', modeLocal: 'केवल इसी डिवाइस पर मदद', backHome: 'वापस',
    },
  };
  function t(key, lang, vars) {
    const L = STR[lang] ? lang : 'en';
    let s = STR[L][key] != null ? STR[L][key] : STR.en[key] != null ? STR.en[key] : key;
    for (const [k, v] of Object.entries(vars || {})) s = s.split('{' + k + '}').join(String(v));
    return s;
  }

  return { classifyField, isPrivate, maskText, maskSnapshot, validateAction, ACTIONS, SAFE_VAULT_KEYS,
    FEATURES, struggleFeatures, struggleScore, sigmoid, LEVELS, autonomyOffer, explainError, STR, t };
});
