/* STEADY helper agent (extension content script, isolated world, runs only on supported portals).
 *
 * It walks the person through the portal one step at a time in a large-text panel, reads each step aloud
 * (Hindi or English), does the SAFE steps (choosing from lists, pressing Next, retrying a busy server,
 * refilling saved answers after a session reset) and hands every PRIVATE step to the person: Aadhaar, OTP,
 * captcha, consent and the final submit.
 *
 *   Playbook first: a verified flow map (flowmap-portal.js) says what each step is.
 *   AI fallback:    on a page the map doesn't know, the service worker asks Claude for ONE next action, from a
 *                   masked snapshot (no values, numbers removed). Guardrails (agent-core.validateAction) decide.
 *   Adaptive:       sizes and text come from the person's one-minute check; an on-device struggle detector and
 *                   live tremor estimate decide when to OFFER more help. More help always needs a yes.
 *   Private data:   a progress vault on this device (AES-GCM). Aadhaar is kept only if the person agrees.
 */
(function () {
  const S = self.Steady || {};
  const A = S.agent;
  if (!A || window.__steadyAgent) return;
  const FM = Object.values(S.FLOWMAPS || {}).find((f) => { try { return f.matches(location); } catch (e) { return false; } });
  window.__steadyAgent = true;
  const de = document.documentElement;
  de.dataset.steadyAgent = '1';

  /* ---------- state ---------- */
  const store = {
    get: (keys) => new Promise((res) => chrome.storage.local.get(keys, (v) => res(v || {}))),
    set: (obj) => new Promise((res) => chrome.storage.local.set(obj, () => res())),
    remove: (keys) => new Promise((res) => chrome.storage.local.remove(keys, () => res())),
  };
  let profile = null, settings = Object.assign({}, S.FIXED || { target: 56, gap: 12, text: 22, slipGuard: true, ignoreRepeatMs: 400, autonomy: 'assist' });
  let prefs = { lang: 'en', voice: true, helperName: '', helperPhoneEnd: '' };
  let opts = { aiFallback: false, hasKey: false };
  let level = 'assist', stopped = false, hidden = false;
  let vault = freshVault();
  const events = [], actions = [];
  let liveTremor = 0, baseTremor = 0, scoreStreak = 0, lastOfferAt = -Infinity, offerDeclined = false, lastScore = 0;
  const L = () => prefs.lang;
  const tr = (key, vars) => A.t(key, L(), vars);
  const txt = (o) => (o && typeof o === 'object' ? o[L()] || o.en : o || '');
  function freshVault() { return { answers: {}, aadhaar: '', keepAadhaar: false, stepReached: null, captchaSrc: {}, expires: 0 }; }

  /* ---------- vault (AES-GCM, key kept in this extension's storage) ----------
   * Protects against casual reading of the browser's storage files. It is not protection against someone who controls
   * this computer and this browser profile: we say so in the privacy page. */
  const b64 = (u8) => btoa(String.fromCharCode(...u8));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function vaultKey() {
    let { 'steady.vaultKey': jwk } = await store.get('steady.vaultKey');
    if (!jwk) {
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      jwk = await crypto.subtle.exportKey('jwk', k);
      await store.set({ 'steady.vaultKey': jwk });
    }
    return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function saveVault() {
    try {
      if (!vault.expires) vault.expires = Date.now() + 7 * 864e5;
      const v = Object.assign({}, vault, { aadhaar: vault.keepAadhaar ? vault.aadhaar : '' });
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(), new TextEncoder().encode(JSON.stringify(v))));
      await store.set({ 'steady.vault.v1': { iv: b64(iv), ct: b64(ct) } });
    } catch (e) { note('vault save failed: ' + e.message); }
  }
  async function loadVault() {
    try {
      const { 'steady.vault.v1': box } = await store.get('steady.vault.v1');
      if (!box) return;
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await vaultKey(), unb64(box.ct));
      const v = JSON.parse(new TextDecoder().decode(pt));
      if (v.expires && v.expires < Date.now()) { await wipeVault(); return; }
      vault = Object.assign(freshVault(), v);
    } catch (e) { await wipeVault(); }
  }
  async function wipeVault() { vault = freshVault(); await store.remove('steady.vault.v1'); }
  const known = () => [vault.answers.mobile, vault.answers.address, vault.aadhaar, prefs.helperName, ...[...document.querySelectorAll('input, output, textarea')].map((i) => i.value)].filter(Boolean);

  /* ---------- page helpers ---------- */
  const $ = (sel) => (sel ? document.querySelector(sel) : null);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const stepNow = () => (FM ? FM.stepOf(document) : null);
  const errorText = () => { const e = FM && $(FM.errorSelector); return visible(e) ? e.textContent.trim() : ''; };
  const loading = () => visible($('#loading'));
  function setValue(el, v) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function highlight(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const old = el.style.outline, oldOff = el.style.outlineOffset;
    el.style.outline = '4px solid #DDF26A'; el.style.outlineOffset = '3px';
    await sleep(450);
    setTimeout(() => { el.style.outline = old; el.style.outlineOffset = oldOff; }, 700);
  }
  // Marks the click as the helper's, so the page-side double-press guard (adapt.js) lets it through.
  function agentClick(el) {
    de.setAttribute('data-steady-agent-act', '');
    try { el.click(); } finally { setTimeout(() => de.removeAttribute('data-steady-agent-act'), 0); }
  }
  async function waitFor(pred, ms) {
    const end = Date.now() + (ms || 8000);
    while (Date.now() < end) { if (pred()) return true; await sleep(120); }
    return pred();
  }
  // After a click: wait for the portal to answer (new step, an error, or a result appearing).
  async function outcomeOf(fn, extraDone) {
    const before = stepNow();
    await fn();
    await sleep(150);
    await waitFor(() => !loading(), 10000);
    await waitFor(() => stepNow() !== before || errorText() || (extraDone && extraDone()), 6000);
    await waitFor(() => !loading(), 10000);
    return { step: stepNow(), changed: stepNow() !== before, error: errorText() };
  }

  /* ---------- panel (shadow root, so the page can't restyle it) ---------- */
  const host = document.createElement('div');
  host.id = 'steady-agent-host';
  // Open shadow root: assistive technology and tests can reach it. The panel never shows health numbers (tremor,
  // struggle score), so the page learns nothing it doesn't already get: the answers the person types into it.
  const root = host.attachShadow({ mode: 'open' });
  const PANEL_W = () => Math.round(Math.min(560, Math.max(380, innerWidth * 0.36)));
  function css() {
    const s = settings, T = Math.max(20, s.text || 22), tgt = Math.max(56, s.target || 56), g = Math.max(10, s.gap || 10);
    return `
:host{all:initial}
*{box-sizing:border-box}
[hidden]{display:none!important}
.panel{position:fixed;top:0;right:0;bottom:0;width:${PANEL_W()}px;z-index:2147483646;background:#FFFFFF;color:#0E1A3A;border-left:3px solid #0E1A3A;
  font-family:"Atkinson Hyperlegible Next","Atkinson Hyperlegible",Verdana,system-ui,sans-serif;font-size:${T}px;line-height:1.4;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
header{display:flex;flex-wrap:wrap;align-items:center;gap:8px ${g}px;padding:12px 16px;background:#0E1A3A;color:#fff}
.brand{font-weight:700;font-size:${Math.round(T * 0.85)}px;display:flex;align-items:center;gap:8px;flex:1 1 auto}
.brand i{width:14px;height:14px;border-radius:50%;background:#DDF26A;display:inline-block}
.stepline{flex:1 0 100%;font-size:${Math.round(T * 0.8)}px;opacity:.9}
button{font:inherit;color:inherit;cursor:pointer;min-height:${tgt}px;min-width:${tgt}px;padding:6px 18px;border-radius:14px;border:2px solid #C9D3E4;background:#fff;font-weight:700;margin:0;touch-action:manipulation}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:4px solid #2F5BAA;outline-offset:3px}
button:disabled{opacity:.45;cursor:not-allowed}
header button{min-height:${Math.max(44, Math.round(tgt * 0.75))}px;min-width:${Math.max(44, Math.round(tgt * 0.75))}px;font-size:${Math.round(T * 0.75)}px;background:transparent;color:#fff;border-color:#5A6A92}
header .stop{background:#FFE1DC;color:#7A1606;border-color:#FFE1DC}
.primary{background:#0E1A3A;color:#fff;border-color:#0E1A3A}
.accent{background:#DDF26A;border-color:#0E1A3A}
.scroll{flex:1;overflow:auto;padding:18px 18px 8px}
.banner{border-radius:16px;padding:14px 16px;margin:0 0 16px;border:2px solid #0E1A3A;background:#FFF7D6}
.banner.err{background:#FFE9E4;border-color:#B42318}
.banner.offer{background:#E3ECFA;border-color:#2F5BAA}
.banner h3{margin:0 0 6px;font-size:1em}
.banner p{margin:0 0 8px}
h2{font-size:${Math.round(T * 1.25)}px;line-height:1.2;margin:0 0 10px}
p{margin:0 0 12px}
.note{color:#3E4A66;font-size:${Math.round(T * 0.8)}px}
.private{display:inline-block;background:#0E1A3A;color:#DDF26A;border-radius:999px;padding:2px 12px;font-size:${Math.round(T * 0.72)}px;font-weight:700;margin-bottom:10px}
.row{display:flex;flex-wrap:wrap;gap:${g}px;margin:12px 0}
.row > button{flex:1 1 auto}
.display{width:100%;font:inherit;font-size:${Math.round(T * 1.5)}px;letter-spacing:.12em;text-align:center;padding:10px;border:3px solid #0E1A3A;border-radius:14px;margin:6px 0 10px;background:#F6F8FC;color:#0E1A3A}
textarea.display{letter-spacing:0;text-align:left;font-size:${T}px;min-height:${tgt * 2}px}
.keys{display:grid;grid-template-columns:repeat(var(--cols,3),1fr);gap:${g}px;margin:8px 0}
.keys button{font-size:${Math.round(T * 1.2)}px;padding:0}
.choices{display:grid;gap:${g}px;margin:8px 0}
.choices button{text-align:left;justify-content:flex-start}
.captcha{width:100%;border:3px solid #0E1A3A;border-radius:12px;background:#fff;image-rendering:pixelated;filter:grayscale(1) contrast(1.6);margin:4px 0 8px}
.captcha.big{transform:scale(1.25);transform-origin:top left}
video,canvas.preview,img.preview{width:100%;border-radius:12px;border:3px solid #0E1A3A;background:#000}
.still{height:14px;border-radius:7px;background:#E3ECFA;overflow:hidden;margin:8px 0}.still i{display:block;height:100%;width:0;background:#0E1A3A;transition:width .1s}
dl.review{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:8px 0 12px}dl.review dt{color:#3E4A66}dl.review dd{margin:0;font-weight:700;word-break:break-word}
footer{border-top:2px solid #E3ECFA;padding:10px 16px 14px;font-size:${Math.round(T * 0.75)}px}
footer .mode{display:flex;align-items:center;gap:10px;justify-content:space-between}
footer button{min-height:44px;min-width:44px;font-size:${Math.round(T * 0.75)}px;padding:4px 12px}
details{margin-top:8px}summary{cursor:pointer;min-height:44px;display:flex;align-items:center}
ol.log{margin:4px 0 0;padding-left:1.2em;max-height:160px;overflow:auto}ol.log li{margin:2px 0}
.meta{color:#3E4A66;margin:6px 0 0}
.pill{position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#0E1A3A;color:#fff;border:3px solid #DDF26A;border-radius:999px;font-family:inherit;font-size:${T}px;padding:8px 22px;min-height:${tgt}px}
.live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}`;
  }
  function mountPanel() {
    root.innerHTML = `<style>${css()}</style>
      <div class="panel" role="complementary" aria-label="${tr('helper')}">
        <header>
          <span class="brand"><i aria-hidden="true"></i>${tr('helper')}</span>
          <button type="button" data-act="lang" aria-label="Language / भाषा / ಭಾಷೆ" lang="${A.nextLang(L())}">${A.LANG_LABEL[A.nextLang(L())]}</button>
          <button type="button" data-act="speak">${tr('readAloud')}</button>
          <button type="button" data-act="hide">${tr('showOriginal')}</button>
          <button type="button" class="stop" data-act="stop">${stopped ? tr('resume') : tr('stop')}</button>
          <span class="stepline" id="stepline"></span>
        </header>
        <div class="scroll">
          <div id="banner"></div>
          <main id="card" tabindex="-1"></main>
        </div>
        <footer>
          <div class="mode"><span id="mode"></span><button type="button" data-act="mode">${tr('changeMode')}</button></div>
          <details><summary>${tr('log')}</summary><ol class="log" id="log"></ol></details>
          <p class="meta" id="meta"></p>
        </footer>
        <div class="live" aria-live="polite" id="live"></div>
      </div>
      <button class="pill" type="button" data-act="show" hidden>${tr('showHelper')}</button>`;
    renderChrome();
  }
  const R = (id) => root.getElementById(id);
  function renderChrome() {
    const panel = root.querySelector('.panel'), pill = root.querySelector('.pill');
    if (!panel) return;
    panel.hidden = hidden; pill.hidden = !hidden;
    de.style.setProperty('padding-right', hidden ? '' : PANEL_W() + 'px', hidden ? '' : 'important');
    const step = stepNow(), order = FM ? FM.order : [], i = order.indexOf(step);
    const def = FM && FM.steps[step];
    R('stepline').textContent = def ? `${i >= 0 && step !== 'done' ? tr('stepOf', { n: i + 1, total: order.length - 1 }) + ' · ' : ''}${txt(def.title)}` : '';
    R('mode').textContent = tr(level === 'assist' ? 'modeAssist' : level === 'copilot' ? 'modeCopilot' : 'modeAutopilot');
    const m = S.MODELS && S.MODELS.struggle;
    const brain = FM ? tr('modePlaybook') : opts.aiFallback && opts.hasKey ? tr('modeAI') : tr('modeLocal');
    R('meta').textContent = `${brain} · ${FM ? FM.id + ' v' + FM.version + ' · ' : ''}${m ? m.id : 'struggle model: built-in'} · AI ${opts.aiFallback && opts.hasKey ? 'on (Claude, masked page only)' : 'off'}`;
    R('log').innerHTML = actions.slice(-30).map((a) => `<li>${a.who === 'you' ? '✋' : a.who === 'ai' ? '✦' : '✓'} ${S.esc ? S.esc(a.text) : a.text}</li>`).join('');
  }
  // Chromium loads voices late: wait once, so a Hindi or Kannada voice isn't missed on the first sentence.
  const voicesReady = new Promise((res) => {
    if (!('speechSynthesis' in self) || speechSynthesis.getVoices().length) return res();
    speechSynthesis.addEventListener('voiceschanged', () => res(), { once: true });
    setTimeout(res, 1500);
  });
  const voiceWarned = {};
  function say(text) {
    const live = R('live'); if (live) live.textContent = text;
    if (!prefs.voice || !('speechSynthesis' in self) || !text) return;
    const lang = L();
    voicesReady.then(() => {
      if (L() !== lang) return;
      try {
        speechSynthesis.cancel();
        const v = A.pickVoice(speechSynthesis.getVoices(), lang);
        // No voice for this language: show the words, but never hand Hindi or Kannada to an English voice
        // (that is what came out as random words on a PC with only English voices).
        if (!v && lang !== 'en') { noVoice(lang); return; }
        const u = new SpeechSynthesisUtterance(A.speakable(text)); // "Account No." is said "Account number"
        u.lang = v ? v.lang : 'en-IN';
        if (v) u.voice = v;
        u.rate = 0.9;
        speechSynthesis.speak(u);
      } catch (e) { /* voices unavailable */ }
    });
  }
  function noVoice(lang) {
    if (voiceWarned[lang]) return;
    voiceWarned[lang] = true;
    note(`No ${A.LANG_LABEL[lang]} voice in this browser: showing text only`);
    banner('offer', tr('noVoiceTitle', { lang: A.LANG_LABEL[lang] }), tr('noVoiceBody'));
  }
  let lastSpoken = '';
  function card(html, speakText) {
    const c = R('card'); if (!c) return;
    c.innerHTML = html;
    if (speakText && speakText !== lastSpoken) { lastSpoken = speakText; say(speakText); }
    renderChrome();
  }
  function banner(kind, title, body, buttons) {
    const b = R('banner'); if (!b) return;
    if (!kind) { b.innerHTML = ''; return; }
    b.innerHTML = `<div class="banner ${kind}" role="${kind === 'err' ? 'alert' : 'status'}"><h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}${buttons ? `<div class="row">${buttons}</div>` : ''}</div>`;
    say([title, body].filter(Boolean).join('. '));
  }
  const esc = (v) => (S.esc ? S.esc(v) : String(v));
  function note(text, who) { actions.push({ t: Date.now(), who: who || 'helper', text }); renderChrome(); }

  /* ---------- presses: slip guard + ignore double presses, sized for the person ---------- */
  let downBtn = null, downAt = null, lastFire = -Infinity;
  const handlers = new Map(); // data-act -> fn (set per screen)
  function on(act, fn) { handlers.set(act, fn); }
  root.addEventListener('pointerdown', (e) => {
    const b = e.composedPath()[0] instanceof Element ? e.composedPath()[0].closest('button') : null;
    if (e.isTrusted) logEvent(b ? 'down' : 'miss', e);
    downBtn = b; downAt = { x: e.clientX, y: e.clientY };
  });
  root.addEventListener('pointerup', (e) => {
    const b = downBtn; downBtn = null;
    if (!b || b.disabled) return;
    const over = e.composedPath()[0] instanceof Element ? e.composedPath()[0].closest('button') : null;
    // Slip guard: the press counts where it started, unless the pointer travelled more than one target away.
    if (over !== b && !(settings.slipGuard && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) <= (settings.target || 56))) return;
    fire(b);
  });
  root.addEventListener('click', (e) => { // keyboard and assistive technology activation (no pointer)
    const b = e.composedPath()[0] instanceof Element ? e.composedPath()[0].closest('button') : null;
    if (b && e.detail === 0 && !b.disabled) fire(b);
  });
  function fire(b) {
    const now = performance.now();
    if (now - lastFire < Math.max(250, settings.ignoreRepeatMs || 0)) { logEvent('repeat'); return; }
    lastFire = now;
    const act = b.dataset.act;
    const fn = handlers.get(act) || GLOBAL[act];
    if (fn) fn(b);
  }
  const GLOBAL = {
    // Redraw the panel first, then write the message: the other way round left an empty panel after Stop.
    stop: () => { stopped = !stopped; mountPanel(); if (stopped) { cancelRun(); if ('speechSynthesis' in self) speechSynthesis.cancel(); card(`<h2>${tr('stopped')}</h2>`); } else schedule(true); },
    hide: () => { hidden = true; cancelRun(); renderChrome(); },
    show: () => { hidden = false; renderChrome(); schedule(true); },
    // Read the words on the card, not its keys: reading a captcha keypad aloud ("A, B, C, D…") sounded like random words.
    speak: () => { lastSpoken = ''; const c = R('card'); say(c ? [...c.querySelectorAll('h2, h3, p, .private')].map((x) => x.innerText.trim()).filter(Boolean).join('. ') : ''); },
    lang: async () => { prefs.lang = A.nextLang(L()); if ('speechSynthesis' in self) speechSynthesis.cancel(); await savePrefs(); mountPanel(); schedule(true); },
    mode: () => modePicker(),
  };
  async function savePrefs() {
    if (!profile) return;
    profile.prefs = Object.assign({}, profile.prefs || {}, { lang: prefs.lang });
    await store.set({ 'steady.profile.v1': JSON.stringify(profile) });
  }

  /* ---------- prompts: each screen resolves a promise; a new page state aborts it ---------- */
  let active = null;
  const ABORT = Symbol('abort');
  function prompt(html, speakText, setup) {
    if (active) active.resolve(ABORT);
    handlers.clear();
    return new Promise((resolve) => {
      active = { resolve: (v) => { active = null; handlers.clear(); resolve(v); } };
      card(html, speakText);
      setup && setup(active.resolve);
      const focusable = R('card').querySelector('input,textarea,button');
      R('card').focus({ preventScroll: true });
      if (focusable && focusable.matches('input,textarea')) focusable.focus({ preventScroll: true });
    });
  }
  function cancelRun() { gen++; if (active) active.resolve(ABORT); }

  function modePicker() {
    const opt = (lv, key) => `<button type="button" data-act="lv-${lv}" class="${level === lv ? 'primary' : ''}" aria-pressed="${level === lv}">${tr(key)}</button>`;
    cancelRun();
    prompt(`<h2>${tr('changeMode')}</h2><div class="choices">${opt('assist', 'modeAssist')}${opt('copilot', 'modeCopilot')}${opt('autopilot', 'modeAutopilot')}</div>`, '', (done) => {
      for (const lv of A.LEVELS) on('lv-' + lv, () => { if (lv !== level) note(`Mode: ${tr(lv === 'assist' ? 'modeAssist' : lv === 'copilot' ? 'modeCopilot' : 'modeAutopilot')}`, 'you'); level = lv; done(lv); renderChrome(); schedule(true); });
    });
  }

  /* ---------- widgets ---------- */
  function groupDigits(v, len) {
    const g = len === 12 ? 4 : len === 10 ? 5 : 3;
    return v.replace(new RegExp(`(\\d{${g}})(?=\\d)`, 'g'), '$1 ');
  }
  function keypad({ title, body, len, privateStep, extra, exact }) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'clr'];
    return prompt(`${privateStep ? `<span class="private">${tr('privateNote')}</span>` : ''}<h2>${esc(title)}</h2><p>${esc(body)}</p>
      <input class="display" id="kp" inputmode="numeric" autocomplete="off" aria-label="${esc(title)}" maxlength="${len + Math.floor(len / 3)}">
      <div class="keys" style="--cols:3">${keys.map((k) => `<button type="button" data-act="k-${k}" aria-label="${k === 'del' ? tr('back') : k === 'clr' ? tr('clear') : k}">${k === 'del' ? '⌫' : k === 'clr' ? tr('clear') : k}</button>`).join('')}</div>
      ${extra || ''}
      <div class="row"><button type="button" class="primary" data-act="ok" disabled>${tr('done')}</button></div>`, `${title}. ${body}`, (done) => {
      const kp = R('kp'), ok = root.querySelector('[data-act="ok"]');
      let v = '';
      const ready = () => (exact === false ? v.length > 0 : v.length === len);
      const draw = () => { kp.value = groupDigits(v, len); ok.disabled = !ready(); };
      kp.addEventListener('input', (e) => { const d = kp.value.replace(/\D/g, '').slice(0, len); logEvent(d.length < v.length ? 'correction' : 'char'); v = d; draw(); });
      kp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && ready()) done(v); });
      for (const k of keys) on('k-' + k, () => { if (k === 'del') { v = v.slice(0, -1); logEvent('correction'); } else if (k === 'clr') { v = ''; logEvent('correction'); } else if (v.length < len) { v += k; logEvent('char'); } draw(); });
      on('ok', () => done(v));
      wireExtra(done);
    });
  }
  let wireExtra = () => {};
  function choices({ title, body, list, saved }) {
    return prompt(`<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}${saved ? `<p class="note">${esc(tr('saved', { v: saved }))}</p>` : ''}
      <div class="choices">${list.map((o, i) => `<button type="button" data-act="c-${i}" class="${o === saved ? 'accent' : ''}">${esc(o)}</button>`).join('')}</div>`, title, (done) => {
      list.forEach((o, i) => on('c-' + i, () => done(o)));
    });
  }
  function yesNo({ title, body, yes, no, privateStep, extraHtml }) {
    return prompt(`${privateStep ? `<span class="private">${tr('privateNote')}</span>` : ''}<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}${extraHtml || ''}
      <div class="row"><button type="button" class="primary" data-act="yes">${esc(yes || tr('yesDoIt'))}</button>${no === null ? '' : `<button type="button" data-act="no">${esc(no || tr('illDoIt'))}</button>`}</div>`, [title, body].filter(Boolean).join('. '), (done) => {
      on('yes', () => done(true)); on('no', () => done(false));
    });
  }
  function textEntry({ title, body, value }) {
    return prompt(`<span class="private">${tr('privateNote')}</span><h2>${esc(title)}</h2><p>${esc(body || '')}</p>
      <textarea class="display" id="tx" rows="3" aria-label="${esc(title)}">${esc(value || '')}</textarea>
      <div class="row"><button type="button" class="primary" data-act="ok">${tr('done')}</button></div>`, [title, body].filter(Boolean).join('. '), (done) => {
      const tx = R('tx');
      tx.addEventListener('input', (e) => logEvent(e.inputType && e.inputType.startsWith('delete') ? 'correction' : 'char'));
      on('ok', () => { if (tx.value.trim()) done(tx.value.trim()); });
    });
  }
  const LETTERS = A.CAPTCHA_KEYS; // all of A-Z and 0-9: BESCOM's captchas use 0, 1, I and O too
  // The picture as a URL the panel can show. Canvas captchas (BESCOM) have no src; SVG ones are serialised.
  function imageSrc(el) {
    if (!el) return '';
    if (el.tagName === 'CANVAS') { try { return el.toDataURL('image/png'); } catch (e) { return ''; } }
    if (el.tagName && el.tagName.toLowerCase() === 'svg') { try { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(el)); } catch (e) { return ''; } }
    return el.currentSrc || el.src || '';
  }
  function captchaEntry(task) {
    // Find the picture again every time: some sites (BESCOM) replace the whole canvas when they make a new captcha.
    const imgOf = () => (task.field && task.field.isConnected ? nearbyImage(task.field) : null) || (task.imgEl && task.imgEl.isConnected ? task.imgEl : null) || $(task.img);
    const img = imgOf(), src = imageSrc(img);
    if (img && !src) highlight(img);
    return prompt(`<span class="private">${tr('privateNote')}</span><h2>${tr('captchaTitle')}</h2><p>${tr('captchaBody')}</p>
      <img class="captcha" id="cap" alt="${tr('captchaTitle')}" src="${src}" ${src ? '' : 'hidden'}>${src ? '' : `<p class="note" id="caplook">${tr('captchaLookPage')}</p>`}
      <div class="row"><button type="button" data-act="newpic">${tr('newPicture')}</button><button type="button" data-act="zoom">${tr('zoom')}</button></div>
      <input class="display" id="cx" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${tr('captchaTitle')}" maxlength="8">
      <div class="keys" style="--cols:6">${LETTERS.map((k) => `<button type="button" data-act="l-${k}">${k}</button>`).join('')}<button type="button" data-act="l-del" aria-label="${tr('back')}">⌫</button></div>
      <div class="row"><button type="button" class="primary" data-act="ok" disabled>${tr('done')}</button></div>`, `${tr('captchaTitle')}. ${tr('captchaBody')}`, (done) => {
      const cx = R('cx'), ok = root.querySelector('[data-act="ok"]'), cap = R('cap');
      const draw = () => { ok.disabled = cx.value.trim().length < 4; };
      cx.addEventListener('input', (e) => { cx.value = cx.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); logEvent(e.inputType && e.inputType.startsWith('delete') ? 'correction' : 'char'); draw(); });
      cx.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !ok.disabled) done(cx.value); });
      for (const k of LETTERS) on('l-' + k, () => { if (cx.value.length < 8) { cx.value += k; logEvent('char'); draw(); } });
      on('l-del', () => { cx.value = cx.value.slice(0, -1); logEvent('correction'); draw(); });
      on('zoom', () => cap.classList.toggle('big'));
      on('newpic', async () => {
        const old = imageSrc(imgOf());
        const ref = (task.refreshEl && task.refreshEl.isConnected ? task.refreshEl : null) || (task.field ? nearbyRefresh(task.field) : null) || $(task.refresh);
        if (ref) agentClick(ref);
        await waitFor(() => imageSrc(imgOf()) !== old, 3000);
        const now = imageSrc(imgOf());
        cap.src = now; cap.hidden = !now;
        cx.value = ''; draw();
        note('New captcha picture', 'you');
      });
      on('ok', () => done(cx.value.trim()));
    });
  }

  /* ---------- the run loop ---------- */
  let gen = 0, running = false, again = false;
  function schedule(force) {
    if (force) cancelRun();
    if (running) { again = true; return; }
    running = true;
    const g = ++gen;
    tick(g).catch((e) => note('internal: ' + e.message)).finally(() => { running = false; if (again) { again = false; schedule(); } });
  }
  const live = (g) => g === gen && !stopped && !hidden;

  async function tick(g) {
    if (!live(g)) return;
    await waitFor(() => !loading(), 10000);
    if (!live(g)) return;
    if (FM && visible($(FM.sessionModal))) return sessionExpired(g);
    const err = errorText();
    if (err && err !== handledError) {
      handledError = err;
      const r = await handleError(err, g);
      if (r !== 'stop' && live(g)) again = true;
      return;
    }
    const step = stepNow();
    if (!FM) return generic(g);
    if (!FM.steps[step]) return aiFallback(g);
    banner('', '');
    const r = await runStep(step, g);
    if (r === 'outcome' && live(g)) again = true;
  }

  let handledError = '', retries = {}, clicked = {}, noProgress = {};
  const hash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h >>> 0); };
  async function runStep(step, g) {
    const def = FM.steps[step];
    if (vault.stepReached !== step && FM.order.indexOf(step) > FM.order.indexOf(vault.stepReached || 'login')) { vault.stepReached = step; saveVault(); }
    logEvent('progress');
    // Safe tasks that come in a row are grouped, so the person says yes once, not five times.
    const tasks = def.tasks.filter((t) => !t.when || visible($(t.when.replace(':not([hidden])', ''))));
    for (let i = 0; i < tasks.length; i++) {
      if (!live(g)) return;
      const task = tasks[i];
      if (isDone(task)) continue;
      if (isSafe(task)) {
        const group = [];
        for (let j = i; j < tasks.length && isSafe(tasks[j]) && !isDone(tasks[j]); j++) group.push(tasks[j]);
        const go = await approveGroup(group, g);
        if (go === ABORT && live(g) && group.every(isDone)) { i += group.length - 1; continue; }
        if (go === ABORT || !live(g)) return;
        if (go === false) { await waitUserDoes(group, g); return; }
        for (const tk of group) {
          if (!live(g)) return;
          const r = await doSafe(tk, g);
          if (r === 'outcome') return 'outcome'; // a click moved the portal on, or showed an error: the next tick takes over
          if (r === 'stuck') return;
        }
        i += group.length - 1;
        continue;
      }
      const r = await doHuman(task, g);
      if (r === ABORT || !live(g)) return;
    }
  }

  const isSafe = (t) => t.kind === 'click' || t.kind === 'pick' || (t.kind === 'choose' && savedChoice(t)) || (t.kind === 'fill' && t.privacy === 'personal' && vault.answers[t.vaultKey]);
  function savedChoice(t) { const sel = $(t.field), v = vault.answers[t.vaultKey]; return sel && v && [...sel.options].some((o) => o.text === v) ? v : null; }
  function isDone(t) {
    switch (t.kind) {
      case 'fill': { const el = $(t.field); if (!el) return true; const v = el.value.trim(); return t.input === 'digits' ? v.replace(/\D/g, '').length === t.len : v.length > 0; }
      case 'choose': { const el = $(t.field); return !el || !!el.value; }
      case 'pick': { const el = $(t.target); return !el || el.checked; }
      case 'captcha': { const el = $(t.field), img = $(t.img); return !!el && !!el.value && !!img && vault.captchaSrc[t.field] === hash(img.src); }
      case 'otp': { const el = $(t.field); return !!el && el.value.replace(/\D/g, '').length === 6; }
      case 'consent': return false;
      case 'photo': { const p = $(t.preview), inp = $(t.input); return !!(p && p.getAttribute('src')) || !!(inp && inp.files && inp.files.length); }
      case 'click': return !!clicked[stepNow() + t.target];
      default: return false;
    }
  }
  function describe(t) {
    if (t.kind === 'click') return `“${txt(t.label)}”`;
    if (t.kind === 'pick') return txt(t.label);
    if (t.kind === 'choose') return `${txt(t.what)}: ${savedChoice(t)}`;
    if (t.kind === 'fill') return txt(t.title);
    return t.kind;
  }
  async function approveGroup(group, g) {
    if (level === 'autopilot') return true;
    const click = group.find((t) => t.kind === 'click');
    const fills = group.filter((t) => t.kind !== 'click');
    const list = fills.map(describe).join(', ');
    const question = fills.length && click ? tr('planAsk', { list, button: txt(click.label) }) : fills.length ? tr('planAskNoBtn', { list }) : tr('pressAsk', { button: txt(click.label) });
    if (level === 'copilot') return yesNo({ title: question, yes: tr('yesDoIt'), no: tr('illDoIt') });
    // assist: offer, and also notice if the person does it on the page themselves
    return Promise.race([yesNo({ title: question, body: tr('modeAssist'), yes: tr('doForMe'), no: tr('illDoIt') }), waitUntil(() => group.every(isDone) || stepNow() !== currentStepAt(g), g)]);
  }
  const stepAt = new Map();
  function currentStepAt(g) { if (!stepAt.has(g)) stepAt.set(g, stepNow()); return stepAt.get(g); }
  async function waitUntil(pred, g) { while (live(g)) { if (pred()) { if (active) active.resolve(ABORT); return ABORT; } await sleep(300); } return ABORT; }
  async function waitUserDoes(group, g) {
    card(`<h2>${esc(tr('illDoIt'))}</h2><p>${esc(group.map(describe).join(', '))}</p>`, '');
    note('You chose to do this step on the page', 'you');
    // nothing else: page changes re-run the loop
  }
  async function doSafe(t, g) {
    await sleep(level === 'autopilot' ? 500 : 250);
    if (!live(g)) return;
    if (t.kind === 'pick') { const el = $(t.target); await highlight(el); agentClick(el); vault.answers[t.vaultKey] = t.value; saveVault(); note(`Chose ${txt(t.label)}`); return; }
    if (t.kind === 'choose') { const el = $(t.field), v = savedChoice(t); await highlight(el); const o = [...el.options].find((x) => x.text === v); setValue(el, o.value); note(`Chose ${v} for ${txt(t.what)}`); await sleep(300); return; }
    if (t.kind === 'fill') { const el = $(t.field); await highlight(el); setValue(el, vault.answers[t.vaultKey]); note(`Filled ${describe(t)} from your saved answers`); return; }
    if (t.kind === 'click') {
      const el = $(t.target);
      if (!el || !visible(el)) return;
      await highlight(el);
      card(`<h2>${tr('working')}</h2><p>${esc(txt(t.label))}</p>`, '');
      handledError = '';
      const stepBefore = stepNow();
      const appeared = () => FM.steps[stepNow()] && FM.steps[stepNow()].tasks.some((x) => x.when && visible($(x.when.replace(':not([hidden])', ''))));
      const before = appeared();
      const out = await outcomeOf(() => agentClick(el), () => !before && appeared());
      note(`Pressed “${txt(t.label)}”`);
      if (out.error) { handledError = out.error; const r = await handleError(out.error, g, t); return r === 'stop' ? 'stuck' : 'outcome'; }
      if (!out.changed && !(!before && appeared())) {
        noProgress[stepBefore] = (noProgress[stepBefore] || 0) + 1;
        if (noProgress[stepBefore] >= 2) { card(`<h2>${tr('helper')}</h2><p>${esc(tr('noResponse'))}</p>`, tr('noResponse')); return 'stuck'; }
      } else clicked[stepBefore + t.target] = true;
      return 'outcome';
    }
  }

  async function doHuman(t, g) {
    switch (t.kind) {
      case 'fill': return humanFill(t, g);
      case 'choose': {
        const el = $(t.field);
        await waitFor(() => el && !el.disabled && el.options.length > 1, 4000);
        if (savedChoice(t) && level !== 'assist') { await doSafe(t, g); return true; }
        const list = [...el.options].filter((o) => o.value).map((o) => o.text);
        const v = await choices({ title: tr('chooseTitle', { what: txt(t.what) }), list, saved: vault.answers[t.vaultKey] });
        if (v === ABORT) return ABORT;
        setValue(el, [...el.options].find((o) => o.text === v).value);
        vault.answers[t.vaultKey] = v; saveVault();
        note(`You chose ${v}`, 'you');
        return true;
      }
      case 'captcha': {
        const v = await captchaEntry(t);
        if (v === ABORT) return ABORT;
        setValue($(t.field), v);
        vault.captchaSrc[t.field] = hash($(t.img).src);
        note('You typed the captcha', 'you');
        return true;
      }
      case 'otp': return humanOtp(t, g);
      case 'consent': {
        const ok = await yesNo({ title: tr('consentTitle'), body: tr('consentBody'), yes: tr('agree'), no: tr('notNow'), privateStep: true });
        if (ok === ABORT) return ABORT;
        if (!ok) { card(`<h2>${tr('stopped')}</h2>`, ''); note('You did not give permission yet', 'you'); return ABORT; }
        const box = $(t.field); await highlight(box); if (!box.checked) agentClick(box);
        note('You gave permission (consent ticked after your yes)', 'you');
        const out = await outcomeOf(() => agentClick($(t.then)));
        if (out.error) { handledError = out.error; await handleError(out.error, g); }
        return ABORT; // the portal moved on
      }
      case 'photo': return humanPhoto(t, g);
      case 'review': return humanReview(t, g);
      case 'finish': {
        const ref = ($(t.ref) || {}).textContent || '';
        await wipeVault();
        note(`Application sent: ${ref}`);
        card(`<h2>${tr('doneTitle')}</h2><p>${esc(tr('doneBody', { ref }))}</p>`, `${tr('doneTitle')}. ${tr('doneBody', { ref: ref.split('').join(' ') })}`);
        return ABORT;
      }
      default: return true;
    }
  }

  async function humanFill(t, g) {
    const el = $(t.field);
    if (t.privacy === 'aadhaar' && vault.keepAadhaar && vault.aadhaar) {
      const use = await yesNo({ title: tr('aadhaarTitle'), body: `XXXX XXXX ${vault.aadhaar.slice(-4)}`, yes: tr('yesDoIt'), no: tr('clear'), privateStep: true });
      if (use === ABORT) return ABORT;
      if (use) { await highlight(el); setValue(el, vault.aadhaar); note('Used the saved Aadhaar number after your yes', 'you'); return true; }
      vault.aadhaar = ''; vault.keepAadhaar = false; saveVault();
    }
    if (t.input === 'text') {
      const v = await textEntry({ title: txt(t.title), value: el.value || vault.answers[t.vaultKey] || '' });
      if (v === ABORT) return ABORT;
      setValue(el, v); vault.answers[t.vaultKey] = v; saveVault(); note(`You typed ${txt(t.title).toLowerCase()}`, 'you');
      return true;
    }
    let keep = vault.keepAadhaar;
    wireExtra = (done) => { const cb = R('keep'); if (cb) cb.addEventListener('change', () => { keep = cb.checked; }); };
    const isA = t.privacy === 'aadhaar';
    const v = await keypad({ title: isA ? tr('aadhaarTitle') : tr('mobileTitle'), body: isA ? tr('aadhaarBody') : tr('mobileBody'), len: t.len, privateStep: true,
      extra: isA ? `<label style="display:flex;gap:12px;align-items:flex-start;margin:8px 0"><input type="checkbox" id="keep" style="width:28px;height:28px;flex:none" ${keep ? 'checked' : ''}><span class="note">${tr('rememberAadhaar')}</span></label>` : '' });
    wireExtra = () => {};
    if (v === ABORT) return ABORT;
    await highlight(el); setValue(el, v);
    if (isA) { vault.keepAadhaar = !!keep; vault.aadhaar = keep ? v : ''; } else vault.answers[t.vaultKey] = v;
    saveVault();
    note(isA ? 'You typed the Aadhaar number' : 'You typed the mobile number', 'you');
    return true;
  }

  async function humanOtp(t, g) {
    const sentTo = ((($(t.sentTo) || {}).textContent || '').match(/(\d{4})\D*$/) || [])[1];
    const end = sentTo || (t.to === 'login' ? String(vault.answers.mobile || ($('#mobile') || {}).value || '').slice(-4) : prefs.helperPhoneEnd);
    const isHelper = prefs.helperPhoneEnd ? end === prefs.helperPhoneEnd : t.to === 'helper';
    const name = prefs.helperName || (L() === 'hi' ? 'परिवार के सदस्य' : 'your family member');
    const title = isHelper ? tr('otpTitleHelper', { name }) : tr('otpTitleSelf');
    const body = isHelper ? tr('otpBodyHelper', { name, end }) : tr('otpBodySelf', { end });
    let timerI = null;
    wireExtra = () => {
      const tl = R('otptime');
      const upd = () => {
        const el = $(t.timer); if (!tl || !el) return;
        const m = el.textContent.match(/(\d{1,2}):(\d{2})/);
        const expired = !m || (m[1] === '00' || m[1] === '0') && m[2] === '00' || /expired/i.test(el.textContent);
        tl.textContent = expired ? tr('codeExpired') : tr('timeLeft', { time: `${m[1]}:${m[2]}` });
      };
      upd(); timerI = setInterval(upd, 1000);
      on('resend', async () => { const r = $(t.resend); if (r) { agentClick(r); note('Asked the portal for a new code'); } });
    };
    const v = await keypad({ title, body, len: 6, privateStep: true,
      extra: `<p class="note" id="otptime" aria-live="off"></p><div class="row"><button type="button" data-act="resend">${tr('newCode')}</button></div>` });
    clearInterval(timerI); wireExtra = () => {};
    if (v === ABORT) return ABORT;
    setValue($(t.field), v);
    note('You typed the code', 'you');
    return true;
  }

  async function humanPhoto(t, g) {
    let stream = null, raf = 0;
    const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null; };
    const choice = await prompt(`<h2>${tr('photoTitle')}</h2><p>${tr('photoBody')}</p>
      <video id="vid" playsinline muted aria-label="${tr('photoTitle')}"></video>
      <div class="still" aria-hidden="true"><i id="stillbar"></i></div>
      <div class="row"><button type="button" class="primary" data-act="snap">${tr('takePhoto')}</button></div>
      <div class="row"><button type="button" data-act="practice">${tr('usePractice')}</button></div><p class="note" id="camnote"></p>`, `${tr('photoTitle')}. ${tr('photoBody')}`, async (done) => {
      on('practice', () => { stop(); done('practice'); });
      const vid = R('vid');
      const snap = () => {
        const c = document.createElement('canvas'); c.width = vid.videoWidth || 640; c.height = vid.videoHeight || 480;
        c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
        stop();
        c.toBlob((blob) => done(blob), 'image/jpeg', 0.9);
      };
      on('snap', () => { if (stream) snap(); });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        vid.srcObject = stream; await vid.play();
        // Steady capture: compare tiny frames; when the picture stops moving for 1.2 s, take it.
        const sm = document.createElement('canvas'); sm.width = 48; sm.height = 36;
        const sx = sm.getContext('2d', { willReadFrequently: true });
        let prev = null, stillSince = 0, last = 0;
        const loop = (ts) => {
          if (!stream) return;
          if (ts - last > 100) {
            last = ts;
            sx.drawImage(vid, 0, 0, 48, 36);
            const d = sx.getImageData(0, 0, 48, 36).data, gray = new Float32Array(48 * 36);
            for (let i = 0; i < gray.length; i++) gray[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
            if (prev) {
              let diff = 0; for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - prev[i]);
              diff /= gray.length;
              if (diff < 3.5) { stillSince = stillSince || ts; } else stillSince = 0;
              const pct = stillSince ? Math.min(100, ((ts - stillSince) / 1200) * 100) : 0;
              const bar = R('stillbar'); if (bar) bar.style.width = pct + '%';
              if (pct >= 100) return snap();
            }
            prev = gray;
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        const n = R('camnote'); if (n) n.textContent = 'Camera not available (' + e.name + '). Use the practice photo, or ask for help.';
      }
    });
    stop();
    if (choice === ABORT) return ABORT;
    if (choice === 'practice') { const b = $(t.sample); await highlight(b); agentClick(b); note('Used the practice photo', 'you'); await sleep(300); return true; }
    const file = new File([choice], 'photo.jpg', { type: 'image/jpeg' });
    const ok = await yesNo({ title: tr('usePhoto') + '?', yes: tr('usePhoto'), no: tr('retake'), extraHtml: `<img class="preview" alt="" src="${URL.createObjectURL(file)}">` });
    if (ok === ABORT) return ABORT;
    if (!ok) return humanPhoto(t, g);
    const inp = $(t.input), dt = new DataTransfer(); dt.items.add(file);
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    note('You took the photo (auto-captured when steady)', 'you');
    await waitFor(() => isDone(t), 3000);
    return true;
  }

  async function humanReview(t, g) {
    const dl = $(t.summary);
    const rows = dl ? [...dl.querySelectorAll('dt')].map((dt) => [dt.textContent.trim(), (dt.nextElementSibling || {}).textContent || '']) : [];
    const ok = await yesNo({ title: tr('reviewTitle'), body: tr('reviewBody'), yes: tr('submit'), no: tr('goBack'), privateStep: true,
      extraHtml: `<dl class="review">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` });
    if (ok === ABORT) return ABORT;
    if (!ok) { note('You chose not to submit yet', 'you'); card(`<h2>${tr('goBack')}</h2><p>${tr('reviewBody')}</p>`, ''); return ABORT; }
    const box = $(t.declare); await highlight(box); if (!box.checked) agentClick(box);
    note('You pressed Submit (declaration ticked after your yes)', 'you');
    const out = await outcomeOf(() => agentClick($(t.submit)));
    if (out.error) { handledError = out.error; await handleError(out.error, g); }
    return ABORT;
  }

  /* ---------- errors, retries, session expiry ---------- */
  async function handleError(text, g, clickTask) {
    logEvent('error');
    const e = A.explainError(text, FM, L());
    let exp = e;
    if (!e.known && opts.aiFallback && opts.hasKey) {
      const ai = await ask({ type: 'steady:explain', text: A.maskText(text, known()), lang: L() });
      if (ai && ai.ok) exp = Object.assign({}, e, { title: ai.result.title, explain: ai.result.explanation, next: ai.result.next_step });
    }
    note(`Portal said: ${A.maskText(text, known())}`);
    const step = stepNow(), def = FM && FM.steps[step];
    const retryTask = clickTask && clickTask.retryable ? clickTask : def && def.tasks.find((x) => x.retryable && visible($(x.target)));
    if (exp.recover === 'retry' && retryTask) {
      retries[step] = (retries[step] || 0) + 1;
      if (retries[step] > 3) { banner('err', exp.title, tr('gaveUp')); retries[step] = 0; return 'stop'; }
      banner('err', exp.title, `${exp.explain} ${tr('retrying', { n: retries[step] })}`);
      if (level === 'assist') {
        const go = await yesNo({ title: exp.title, body: exp.next, yes: tr('doForMe'), no: tr('illDoIt') });
        if (go !== true) return 'stop';
      }
      await sleep(1200 * retries[step]);
      if (!live(g)) return;
      handledError = '';
      const out = await outcomeOf(() => agentClick($(retryTask.target)));
      note(`Tried “${txt(retryTask.label)}” again`);
      if (out.error) { handledError = out.error; return handleError(out.error, g, retryTask); }
      retries[step] = 0; clicked[step + retryTask.target] = true; banner('', '');
      return;
    }
    banner('err', exp.title, `${exp.explain} ${exp.next}`);
    if (exp.recover === 'captcha') { vault.captchaSrc = {}; }
    if (exp.recover === 'resend') { const otp = def && def.tasks.find((x) => x.kind === 'otp'); if (otp) { const r = $(otp.resend); if (r) agentClick(r); setValue($(otp.field), ''); note('Asked for a new code'); } }
    if (exp.recover === 'otp') { const otp = def && def.tasks.find((x) => x.kind === 'otp'); if (otp) setValue($(otp.field), ''); }
    if (exp.recover === 'refill' && e.kind) { const f = (FM.errors.find((x) => x.kind === e.kind) || {}).field; if (f && $(f)) { setValue($(f), ''); if (f === '#mobile') delete vault.answers.mobile; saveVault(); } }
    if (exp.recover === 'stop') {
      const v = await yesNo({ title: exp.title, body: `${exp.explain} ${exp.next}`, yes: L() === 'hi' ? 'नंबर बदलें' : 'Change the number', no: null });
      if (v === true) { const a = $('#aadhaar-input'); if (a) setValue(a, ''); vault.aadhaar = ''; vault.keepAadhaar = false; vault.captchaSrc = {}; saveVault(); handledError = ''; banner('', ''); return; }
      return 'stop';
    }
    // redo / captcha / otp / refill: the next tick asks again for what is missing
    await sleep(900);
  }

  async function sessionExpired(g) {
    note('The portal ended the session after inactivity');
    banner('offer', tr('resumeTitle'), tr('resumeBody'));
    await sleep(1200);
    const ok = $(FM.sessionOk);
    if (ok && visible(ok)) agentClick(ok);
    vault.captchaSrc = {};
    await sleep(500);
  }

  /* ---------- any website: on-device help, plus AI guidance when it is turned on ---------- */
  const aiOn = () => opts.aiFallback && opts.hasKey;
  let zoomI = 0, fieldBusy = false, lastField = null;
  function labelOf(el) {
    const l = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || siblingLabel(el) || el.getAttribute('placeholder') || el.getAttribute('title') || el.name || '';
    if (l.trim()) return l.trim().replace(/\s*\*\s*$/, '').slice(0, 80);
    const prev = el.closest('td, div, p, li') && el.closest('td, div, p, li').previousElementSibling;
    return prev ? prev.textContent.trim().slice(0, 80) : ({ hi: 'यह खाना', kn: 'ಈ ಬಾಕ್ಸ್' })[L()] || 'this box';
  }
  // A <label> without for= sitting next to the box (BESCOM: <label>Account ID</label><input placeholder="Account No.">).
  function siblingLabel(el) {
    for (let p = el.previousElementSibling, i = 0; p && i < 3; p = p.previousElementSibling, i++) if (p.tagName === 'LABEL') return p.textContent;
    const box = el.parentElement;
    if (box && box.querySelectorAll('input, select, textarea').length === 1) { const l = box.querySelector('label'); if (l) return l.textContent; }
    return '';
  }
  // The captcha picture near a box: captcha-sized, not the logo or an icon; one named "captcha" wins, then a canvas.
  function nearbyImage(el) {
    let box = el;
    for (let i = 0; i < 5 && box; i++, box = box.parentElement) {
      if (!box.querySelectorAll) continue;
      const sized = [...box.querySelectorAll('img, canvas, svg')].filter((x) => {
        if (host.contains(x) || !visible(x)) return false;
        const r = x.getBoundingClientRect();
        return r.width >= 50 && r.width <= 420 && r.height >= 18 && r.height <= 160;
      });
      const cls = (x) => (x.className && x.className.baseVal != null ? x.className.baseVal : x.className) || '';
      const named = sized.find((x) => /captcha/i.test([x.id, cls(x), x.alt, x.getAttribute('src'), x.parentElement && x.parentElement.id, x.parentElement && cls(x.parentElement)].join(' ')));
      const pick = named || sized.find((x) => x.tagName === 'CANVAS') || sized[0];
      if (pick) return pick;
    }
    return null;
  }
  function nearbyRefresh(el) {
    let box = el;
    for (let i = 0; i < 5 && box; i++, box = box.parentElement) {
      const r = box.querySelectorAll && [...box.querySelectorAll('a, button, [role="button"], img[onclick], span[onclick], i[onclick]')].find((x) => !host.contains(x) &&
        A.isRefreshControl({ text: x.textContent, title: x.title, alt: x.alt, aria: x.getAttribute('aria-label'), onclick: x.getAttribute('onclick') }));
      if (r) return r;
    }
    return null;
  }
  // A "find your account number" style link next to the box, on this same site (BESCOM: "To Find out Account ID? Please Click Here").
  const STOPW = new Set(['the', 'and', 'for', 'you', 'your', 'please', 'click', 'here', 'enter', 'find', 'out', 'to', 'of', 'in', 'on', 'is', 'it', 'my', 'this', 'an', 'or', 'no', 'know', 'how', 'get', 'what', 'where', 'forgot', 'help', 'type', 'image']);
  const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOPW.has(w));
  function helpLink(el, label) {
    const want = new Set(words(label + ' ' + (el.placeholder || '')));
    const scope = el.closest('form') || (el.parentElement && el.parentElement.parentElement);
    if (!scope || !want.size) return null;
    for (const a of scope.querySelectorAll('a, button, [role="button"]')) {
      if (host.contains(a) || !visible(a) || a.type === 'submit') continue;
      const ctx = ((a.closest('p, li, small, label') || a).textContent || '').replace(/\s+/g, ' ').trim();
      if (!/find|forgot|know|where|don.?t have|how to/i.test(ctx)) continue;
      try { if (a.href && /^https?:/i.test(a.href) && new URL(a.href).host !== location.host) continue; } catch (e) { continue; }
      if (words(ctx).some((w) => want.has(w))) return { el: a, text: ctx.replace(/please\s+click\s+here\.?/i, '').trim().slice(0, 60) || ctx.slice(0, 60) };
    }
    return null;
  }
  // Under every box: "What is this?" (says it again, or asks the AI when the box is new to me), a same-site
  // "find it" link when the page has one, and Back, so a box tapped by mistake doesn't trap the person.
  function addHelpRow(el, label, info) {
    const c = R('card'); if (!c) return;
    const link = helpLink(el, label);
    c.insertAdjacentHTML('beforeend', `<div class="row"><button type="button" data-act="why">${tr('whatIsThis')}</button>${link ? `<button type="button" data-act="helplink">${esc(tr('openHelp', { label: link.text }))}</button>` : ''}<button type="button" data-act="cancel">${tr('backHome')}</button></div><p class="note" id="why-out" hidden></p>`);
    on('why', () => explainBox(el, label, info));
    on('cancel', () => active && active.resolve(ABORT));
    if (link) on('helplink', async () => { await highlight(link.el); note(`Opened “${link.text}”`, 'you'); agentClick(link.el); if (active) active.resolve(ABORT); });
  }
  async function explainBox(el, label, info) {
    const out = R('why-out');
    const show = (text) => { if (out) { out.hidden = false; out.textContent = text; } lastSpoken = ''; say(text); };
    if (info.known) return show(`${info.name}. ${info.explain}`);
    if (!aiOn()) return show(info.explain);
    show(tr('explainAI'));
    const near = ((el.closest('p, div, td, li') || el).textContent || '').replace(/\s+/g, ' ').slice(0, 200);
    const res = await ask({ type: 'steady:explainField', lang: L(), host: location.hostname, label: A.maskText(label, known()), placeholder: A.maskText(el.placeholder || '', known()), near: A.maskText(near, known()) });
    if (!out || !out.isConnected) return;
    show(res && res.ok ? [res.result.explanation, res.result.where_to_find, res.result.next_step].filter(Boolean).join(' ') : info.explain);
  }
  // Show any field on the page big, with the right widget, then put the answer back into the page.
  async function fieldPrompt(el) {
    if (fieldBusy) return ABORT;
    fieldBusy = true;
    try {
      const meta = { id: el.id, name: el.name, label: labelOf(el), placeholder: el.placeholder, autocomplete: el.autocomplete, type: el.type };
      const kind = A.classifyField(meta), label = meta.label;
      lastField = el;
      // Son persona: say what the box is, where the answer comes from and where to find it, not just its label.
      const info = A.explainField({ label, placeholder: el.placeholder, name: el.name, id: el.id, host: location.hostname }, L());
      const shown = info.known ? info.name : label, why = info.known ? info.explain : '';
      await highlight(el);
      let v, p;
      if (el instanceof HTMLSelectElement) {
        const list = [...el.options].filter((o) => o.value !== '' && !o.disabled).map((o) => o.text.trim());
        p = choices({ title: tr('chooseTitle', { what: shown }), body: why, list }); addHelpRow(el, label, info); v = await p;
        if (v === ABORT) return ABORT;
        setValue(el, [...el.options].find((o) => o.text.trim() === v).value);
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        v = await yesNo({ title: tr('tickTitle', { label }), body: why, yes: tr('tickYes'), no: tr('backHome'), privateStep: A.isPrivate(kind) });
        if (v !== true) return ABORT;
        if (!el.checked) agentClick(el);
      } else if (kind === 'captcha') {
        p = captchaEntry({ field: el, imgEl: nearbyImage(el), refreshEl: nearbyRefresh(el) }); addHelpRow(el, label, info); v = await p;
        if (v === ABORT) return ABORT;
        setValue(el, v);
      } else if (['otp', 'aadhaar'].includes(kind) || ['tel', 'number'].includes(el.type) || el.inputMode === 'numeric' || /pin|mobile|phone/i.test(label)) {
        const max = el.maxLength > 0 ? el.maxLength : kind === 'otp' ? 6 : kind === 'aadhaar' ? 12 : /mobile|phone/i.test(label) ? 10 : 16;
        p = keypad({ title: tr('typeFor', { label: shown }), body: why || (kind === 'aadhaar' ? tr('aadhaarBody') : ''), len: max, exact: kind === 'otp' || kind === 'aadhaar' ? true : false, privateStep: A.isPrivate(kind) });
        addHelpRow(el, label, info); v = await p;
        if (v === ABORT) return ABORT;
        setValue(el, v);
      } else {
        p = textEntry({ title: tr('typeFor', { label: shown }), body: why, value: el.value }); addHelpRow(el, label, info); v = await p;
        if (v === ABORT) return ABORT;
        setValue(el, v);
      }
      note(`You filled “${label}”`, 'you');
      return true;
    } finally { fieldBusy = false; }
  }
  // Read the form the person is working on: its title, each box by its plain name with "empty" or "filled in"
  // (never the value), and the button to press. Reading the whole page read menus and footers: random words.
  function readPage() {
    const forms = [...document.forms].filter((f) => visible(f) && !host.contains(f));
    const count = (f) => f.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
    const form = (lastField && lastField.isConnected && lastField.closest('form')) || forms.sort((a, b) => count(b) - count(a))[0];
    if (!form || !count(form)) {
      const heads = [...document.querySelectorAll('h1, h2')].filter(visible).map((h) => h.textContent.trim()).slice(0, 4);
      lastSpoken = ''; say([document.title, ...heads].filter(Boolean).join('. ')); return;
    }
    const head = form.querySelector('h1, h2, h3, legend');
    const parts = [(head && head.textContent.trim()) || document.title];
    for (const f of form.querySelectorAll('input, select, textarea')) {
      if (!visible(f) || ['hidden', 'button', 'submit', 'reset', 'image'].includes(f.type)) continue;
      const lab = labelOf(f);
      const info = A.explainField({ label: lab, placeholder: f.placeholder, name: f.name, id: f.id, host: location.hostname }, L());
      parts.push(`${info.known ? info.name : lab}: ${f.value ? tr('readFilled') : tr('readEmpty')}`);
    }
    const btn = [...form.querySelectorAll('button, input[type="submit"]')].filter(visible).map((b) => (b.textContent || b.value || '').trim()).find(Boolean);
    if (btn) parts.push(tr('readThenPress', { button: btn }));
    lastSpoken = ''; say(parts.join('. '));
  }
  async function generic(g) {
    const r = await prompt(`<h2>${tr('helperHere')}</h2><p>${tr('genericIntro')}</p>
      <div class="choices">
        <button type="button" class="primary" data-act="guide" ${aiOn() ? '' : 'disabled'}>${tr('guideMe')}</button>
        <button type="button" data-act="read">${tr('readPage')}</button>
        <button type="button" data-act="zoomin">${tr('biggerText')}</button>
      </div>${aiOn() ? '' : `<p class="note">${tr('aiNeedsKey')}</p>`}`, `${tr('helperHere')}. ${tr('genericIntro')}`, (done) => {
      on('guide', () => done('guide'));
      on('read', () => readPage());
      on('zoomin', () => { zoomI = (zoomI + 1) % 3; de.style.zoom = ['', '1.25', '1.5'][zoomI]; note(`Page text ${['100', '125', '150'][zoomI]}%`, 'you'); });
    });
    if (r !== 'guide' || !live(g)) return;
    const goal = await prompt(`<h2>${tr('goalTitle')}</h2><p>${tr('goalBody')}</p>
      <textarea class="display" id="goal" rows="2" aria-label="${tr('goalTitle')}"></textarea>
      <div class="choices"><button type="button" data-act="g1">${tr('goalForm')}</button><button type="button" data-act="g2">${tr('goalNext')}</button></div>
      <div class="row"><button type="button" class="primary" data-act="ok">${tr('goalStart')}</button><button type="button" data-act="back">${tr('backHome')}</button></div>`, tr('goalTitle'), (done) => {
      on('g1', () => done(tr('goalForm'))); on('g2', () => done(tr('goalNext')));
      on('ok', () => done(R('goal').value.trim() || tr('goalNext'))); on('back', () => done(ABORT));
    });
    if (goal === ABORT || !live(g)) { if (live(g)) again = true; return; }
    note(`Goal: ${goal}`, 'you');
    await aiLoop(goal, g);
    if (live(g)) again = true;
  }
  // AI-led loop on an unfamiliar site: Claude proposes ONE step from the masked page, guardrails check it,
  // the helper does safe steps (after a yes unless the person chose autopilot), and private fields go to the person.
  async function aiLoop(goal, g) {
    const history = [];
    for (let i = 0; i < 15 && live(g); i++) {
      card(`<h2>${tr('working')}</h2><p>${tr('looking')}</p>`, i === 0 ? tr('looking') : '');
      const snap = A.maskSnapshot(rawSnapshot(), known());
      const res = await ask({ type: 'steady:plan', snapshot: snap, goal: A.maskText(goal, known()), lang: L(), history });
      if (!live(g)) return;
      if (!res || !res.ok) { await yesNo({ title: tr('helper'), body: (res && res.error) || 'AI unavailable', yes: tr('backHome'), no: null }); return; }
      const act = res.result, v = A.validateAction(act, snap);
      const el = act.elementId ? document.querySelector(`[data-steady-ref="${CSS.escape(act.elementId)}"]`) : null;
      if (!v.ok) {
        note(tr('aiBlocked', { why: v.why }), 'ai');
        history.push(`BLOCKED: ${act.action} ${act.elementId} (${v.why})`);
        // A blocked private step is handed to the person instead.
        if (el && /private|consent|final|typing/.test(v.why) && (el.matches('input, select, textarea'))) { const r2 = await fieldPrompt(el); if (r2 === ABORT && !live(g)) return; history.push(`person filled ${act.elementId}`); }
        else if (el && /final|consent/.test(v.why)) {
          // Submit / agree buttons: the person decides. The helper presses it only after their explicit yes.
          const lab = (el.textContent || el.value || '').trim().slice(0, 60);
          const yes = await yesNo({ title: `“${lab}”`, body: tr('reviewBody'), yes: lab || tr('submit'), no: tr('goBack'), privateStep: true });
          if (yes === ABORT && !live(g)) return;
          if (yes === true) { await highlight(el); agentClick(el); note(`You pressed “${lab}”`, 'you'); history.push(`person pressed ${act.elementId}`); await sleep(1200); }
          else { history.push(`person declined ${act.elementId}`); return; }
        }
        continue;
      }
      note(`${act.action}: ${act.say}`, 'ai');
      if (act.action === 'done') { await yesNo({ title: tr('aiDone', { say: act.say }), yes: tr('backHome'), no: null }); return; }
      if (act.action === 'handoff' && el && el.matches('input, select, textarea')) {
        const r2 = await fieldPrompt(el);
        if (r2 === ABORT) { if (!live(g)) return; history.push(`person skipped ${act.elementId}`); } else history.push(`person filled ${act.elementId}`);
        continue;
      }
      if (['ask_user', 'explain', 'wait', 'handoff'].includes(act.action)) {
        const go = await yesNo({ title: act.say, body: act.reason, yes: tr('continueBtn'), no: tr('stop') });
        if (go !== true) return;
        history.push(`${act.action}: person continued`);
        if (act.action === 'wait') await sleep(1500);
        continue;
      }
      if (level !== 'autopilot') {
        const ok = await yesNo({ title: tr('aiSuggest', { say: act.say }), body: act.reason, yes: tr('yesDoIt'), no: tr('illDoIt') });
        if (ok === ABORT || !live(g)) return;
        if (!ok) { history.push(`person declined ${act.action} ${act.elementId}`); continue; }
      }
      await highlight(el);
      if (act.action === 'click') agentClick(el);
      if (act.action === 'select') setValue(el, [...el.options].find((o) => o.text === act.value).value);
      if (act.action === 'fill_from_vault') setValue(el, vault.answers[act.value] || '');
      history.push(`${act.action} ${act.elementId}${act.value ? ' = ' + act.value : ''}`);
      await sleep(1200);
      await waitFor(() => document.readyState === 'complete', 6000);
    }
  }
  // Tap any box on the page: show it big in the helper (only on sites without verified steps).
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (FM || stopped || hidden || fieldBusy || host.contains(el) || !e.isTrusted) return;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
    if (['button', 'submit', 'reset', 'hidden', 'file', 'range', 'color', 'image'].includes(el.type)) return;
    const prev = active;
    fieldPrompt(el).then(() => { if (!active || active === prev) again = true; if (!running) schedule(); });
  }, true);

  /* ---------- AI fallback (unknown page) ---------- */
  function rawSnapshot() {
    let n = 0;
    const els = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]')]
      .filter((el) => visible(el) && !host.contains(el))
      .slice(0, 60)
      .map((el) => {
        const ref = el.dataset.steadyRef || (el.dataset.steadyRef = 'e' + (++n) + '-' + Math.random().toString(36).slice(2, 6));
        const lab = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || (el.tagName === 'BUTTON' || el.tagName === 'A' ? el.textContent : '') || el.placeholder || '';
        return { ref, tag: el.tagName.toLowerCase(), type: el.type || '', id: el.id, name: el.name, label: lab.trim().slice(0, 80), placeholder: el.placeholder || '',
          href: el.tagName === 'A' ? el.href : '', options: el.tagName === 'SELECT' ? [...el.options].map((o) => o.text) : undefined,
          checked: el.checked, disabled: el.disabled, hasValue: !!(el.value && el.type !== 'button' && el.type !== 'submit') };
      });
    return { url: location.href, step: stepNow() || '', title: document.title,
      headings: [...document.querySelectorAll('h1,h2,h3,legend')].filter(visible).map((h) => h.textContent.trim()),
      texts: [...document.querySelectorAll('p,label,td,th,li')].filter(visible).map((p) => p.textContent.trim()).filter(Boolean).slice(0, 12),
      errors: errorText() ? [errorText()] : [], elements: els };
  }
  function ask(msg) { return new Promise((res) => { try { chrome.runtime.sendMessage(msg, (r) => res(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : r)); } catch (e) { res({ ok: false, error: e.message }); } }); }
  let aiSteps = 0;
  async function aiFallback(g) {
    if (!(opts.aiFallback && opts.hasKey)) { card(`<h2>${tr('helper')}</h2><p>${tr('aiOff')}</p>`, tr('aiOff')); return; }
    if (aiSteps >= 6) { card(`<h2>${tr('helper')}</h2><p>${tr('aiOff')}</p>`, ''); return; }
    card(`<h2>${tr('working')}</h2><p>${tr('aiThinking')}</p>`, tr('aiThinking'));
    const snap = A.maskSnapshot(rawSnapshot(), known());
    const res = await ask({ type: 'steady:plan', snapshot: snap, lang: L(), history: actions.slice(-6).map((a) => a.text) });
    if (!live(g)) return;
    if (!res || !res.ok) { card(`<h2>${tr('helper')}</h2><p>${esc(tr('aiOff'))}</p><p class="note">${esc((res && res.error) || '')}</p>`, ''); return; }
    const act = res.result;
    const v = A.validateAction(act, snap);
    if (!v.ok) { note(tr('aiBlocked', { why: v.why }), 'ai'); card(`<h2>${tr('helper')}</h2><p>${esc(tr('aiBlocked', { why: v.why }))}</p><p>${esc(act.say || '')}</p>`, act.say); return; }
    aiSteps++;
    if (['ask_user', 'explain', 'handoff', 'done', 'wait'].includes(act.action)) { note(tr('aiSuggest', { say: act.say }), 'ai'); card(`<h2>${tr('helper')}</h2><p>${esc(act.say)}</p>`, act.say); return; }
    const el = document.querySelector(`[data-steady-ref="${CSS.escape(act.elementId)}"]`);
    if (level !== 'autopilot') {
      const ok = await yesNo({ title: tr('aiSuggest', { say: act.say }), body: act.reason, yes: tr('yesDoIt'), no: tr('illDoIt') });
      if (ok !== true || !live(g)) return;
    }
    await highlight(el);
    if (act.action === 'click') agentClick(el);
    if (act.action === 'select') setValue(el, [...el.options].find((o) => o.text === act.value).value);
    if (act.action === 'fill_from_vault') setValue(el, vault.answers[act.value] || '');
    note(`AI step: ${act.say}`, 'ai');
    await sleep(800);
  }

  /* ---------- struggle sensing + live tremor (on device; nothing leaves) ---------- */
  let lastDown = null;
  function logEvent(type, e) {
    const now = performance.now();
    if ((type === 'down' || type === 'miss') && e) {
      if (lastDown && now - lastDown.t < 350 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 30) { events.push({ t: now, type: 'repeat' }); }
      lastDown = { t: now, x: e.clientX, y: e.clientY };
    }
    events.push({ t: now, type });
    if (events.length > 600) events.splice(0, events.length - 600);
  }
  const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [onclick]';
  document.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted || host.contains(e.target)) return;
    logEvent(e.target instanceof Element && e.target.closest(INTERACTIVE) ? 'down' : 'miss', e);
  }, true);
  document.addEventListener('input', (e) => { if (!e.isTrusted) return; logEvent(e.inputType && e.inputType.startsWith('delete') ? 'correction' : 'char'); }, true);
  document.addEventListener('wheel', (e) => { if (e.ctrlKey) logEvent('zoom'); }, { capture: true, passive: true });
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '=', '-'].includes(e.key)) logEvent('zoom'); }, true);
  let moves = [], lastTremorAt = 0;
  document.addEventListener('pointermove', (e) => {
    if (!e.isTrusted || e.pointerType === 'touch') return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const c of evs.length ? evs : [e]) moves.push({ t: c.timeStamp, x: c.clientX, y: c.clientY });
    const now = e.timeStamp;
    moves = moves.filter((m) => now - m.t < 1500);
    if (now - lastTremorAt < 1000 || moves.length < 24 || !S.tremorFeatures) return;
    const xs = moves.map((m) => m.x), ys = moves.map((m) => m.y);
    if (Math.max(...xs) - Math.min(...xs) > 40 || Math.max(...ys) - Math.min(...ys) > 40) return; // moving on purpose, not resting
    lastTremorAt = now;
    const f = S.tremorFeatures(moves, now - moves[0].t);
    liveTremor = liveTremor ? 0.7 * liveTremor + 0.3 * f.tremorRms : f.tremorRms;
  }, { capture: true, passive: true });

  setInterval(() => {
    if (stopped || hidden) return;
    const now = performance.now();
    const f = A.struggleFeatures(events, now);
    lastScore = A.struggleScore(f, S.MODELS && S.MODELS.struggle);
    scoreStreak = lastScore >= 0.65 ? scoreStreak + 1 : 0;
    const offer = A.autonomyOffer({ level, score: lastScore, scoreStreak, liveTremor, baseTremor, lastOfferAt, now, declined: offerDeclined });
    if (offer && R('banner') && !R('banner').querySelector('.offer')) {
      lastOfferAt = now;
      note(offer.because === 'tremor' ? 'Offered more help: the hand seemed less steady' : 'Offered more help: this step looked hard');
      banner('offer', offer.because === 'tremor' ? tr('offerTremor') : tr('offerStruggle'), '', `<button type="button" class="primary" data-act="offer-yes">${tr('offerYes')}</button><button type="button" data-act="offer-no">${tr('offerNo')}</button>`);
      GLOBAL['offer-yes'] = () => { level = offer.to; offerDeclined = false; note(`You said yes: ${tr(level === 'copilot' ? 'modeCopilot' : 'modeAutopilot')}`, 'you'); banner('', ''); schedule(true); };
      GLOBAL['offer-no'] = () => { offerDeclined = true; note('You said no to more help', 'you'); banner('', ''); };
    }
  }, 2000);

  /* ---------- boot ---------- */
  async function loadSettings() {
    const all = await store.get(['steady.profile.v1', 'steady.steadier', 'steady.agent.opts']);
    try { profile = all['steady.profile.v1'] ? JSON.parse(all['steady.profile.v1']) : null; } catch (e) { profile = null; }
    const rec = S.recommend ? S.recommend(profile && profile.features, { steadier: all['steady.steadier'] === '1', overrides: profile && profile.overrides }) : null;
    if (rec) settings = rec.settings;
    prefs = Object.assign(prefs, (profile && profile.prefs) || {});
    baseTremor = (profile && profile.features && profile.features.tremorRms) || 0;
    const o = all['steady.agent.opts'] || {};
    opts = { aiFallback: !!o.aiFallback, hasKey: !!o.apiKey };
    level = o.defaultLevel && A.LEVELS.includes(o.defaultLevel) ? o.defaultLevel : settings.autonomy || 'assist';
  }
  async function boot() {
    await loadSettings();
    await loadVault();
    (document.body || de).appendChild(host);
    mountPanel();
    if (!profile) banner('offer', L() === 'hi' ? 'अभी कोई जाँच नहीं हुई' : 'No one-minute check yet', L() === 'hi' ? 'सामान्य बड़े आकार इस्तेमाल हो रहे हैं।' : 'Standard large sizes are used. The check on the Steady website fits them to you.');
    if (vault.stepReached && vault.stepReached !== 'login' && stepNow() === 'login') { banner('offer', tr('resumeTitle'), tr('resumeBody')); note('Resuming with saved answers'); }
    let sig = '';
    const watch = () => {
      const s = [stepNow(), errorText(), FM && visible($(FM.sessionModal)), visible($('#search-result')), loading()].join('|');
      if (s !== sig) { const stepChanged = sig.split('|')[0] !== String(stepNow()); sig = s; if (stepChanged) { retries = {}; clicked = {}; noProgress = {}; aiSteps = 0; } if (!running || stepChanged) schedule(stepChanged); }
    };
    new MutationObserver(() => { clearTimeout(watch.t); watch.t = setTimeout(watch, 120); }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-step', 'class', 'style'] });
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'steady:show') { hidden = false; if (stopped) { stopped = false; mountPanel(); } renderChrome(); schedule(true); sendResponse({ ok: true }); }
    });
    chrome.storage.onChanged.addListener((ch) => { if (ch['steady.profile.v1'] || ch['steady.agent.opts'] || ch['steady.steadier']) loadSettings().then(() => { mountPanel(); }); });
    addEventListener('resize', () => { const p = root.querySelector('.panel'); if (p) p.style.width = PANEL_W() + 'px'; renderChrome(); });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
