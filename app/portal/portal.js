// Mock enrolment portal (practice copy). Contract: docs/build/phase-1-2-contracts.md, section "Mock portal".
// Reproduces the friction older users report: small text, captchas, OTP countdowns, session expiry that wipes
// everything, and random server errors. Everything stays in this page; nothing is sent anywhere.
(function () {
  'use strict';

  /* ---------- query parameters ---------- */
  var params = new URLSearchParams(location.search);
  function numParam(name, def, ok) {
    var raw = params.get(name);
    if (raw === null || raw === '') return def;
    var n = Number(raw);
    return ok(n) ? n : def;
  }
  var CHAOS = numParam('chaos', 1, function (n) { return n === 0 || n === 1 || n === 2; });
  var TIMEOUT_S = numParam('timeout', 180, function (n) { return isFinite(n) && n > 0; });
  var PHONE = /^\d{4}$/.test(params.get('phone') || '') ? params.get('phone') : '4321';
  var TEST = params.get('test') === '1';
  var FIXED_OTP = params.get('fixedotp') === '1';

  var OTP_SECONDS = 120;
  var SMS_MS = 60000;
  var WAIT_MIN = 800, WAIT_MAX = 3000;
  var CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  var MSG = {
    mobile: 'Please enter a valid 10-digit mobile number.',
    captcha: 'Invalid Captcha. Please try again.',
    otpInvalid: 'Invalid OTP. Please try again.',
    otpExpired: 'OTP has expired. Please click Resend OTP.',
    scheme: 'Please select a scheme.',
    aadhaar: 'Please enter a valid 12-digit Aadhaar number.',
    noBeneficiary: 'No beneficiary found in the given search.',
    noPmjay: 'No PM-JAY record found. If you are 70 or older, choose Senior citizen 70+ card.',
    server: 'Server not responding. Please try again later.',
    consent: 'Please accept the consent to proceed.',
    state: 'Please select State.',
    district: 'Please select District.',
    ward: 'Please select Ward/Village.',
    address: 'Please enter address.',
    photo: 'Please choose a photo.',
    upload: 'Upload failed. Please try again.',
    declare: 'Please accept the declaration.'
  };

  var BENEFICIARY = { name: 'Ramesh Kumar', masked: 'R***** K****', age: '74' };

  var PLACES = {
    'Bihar': ['Patna', 'Gaya', 'Muzaffarpur'],
    'Delhi': ['New Delhi', 'North West Delhi', 'South Delhi'],
    'Karnataka': ['Bengaluru Urban', 'Mysuru', 'Belagavi'],
    'Maharashtra': ['Mumbai Suburban', 'Pune', 'Nagpur'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
    'Uttar Pradesh': ['Lucknow', 'Varanasi', 'Kanpur Nagar'],
    'West Bengal': ['Kolkata', 'Darjeeling', 'Howrah']
  };
  var WARDS = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5', 'Ward 6', 'Ward 7', 'Ward 8'];

  // Progress strip: index of each step.
  var STEP_INDEX = { login: 0, otp: 1, search: 2, ekyc: 3, 'ekyc-otp': 3, details: 4, photo: 5, review: 6, done: 7 };

  function $(id) { return document.getElementById(id); }
  function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function noSpaces(v) { return String(v || '').replace(/\s+/g, ''); }
  function maskMobile(m) { return 'XXXXXX' + String(m).slice(-4); }
  function maskAadhaar(a) { return 'XXXX XXXX ' + String(a).slice(-4); }
  function mmss(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }

  /* ---------- state (closure only) ---------- */
  function freshState() {
    return {
      mobile: '', otp: null, otpDeadline: 0, aotp: null, aotpDeadline: 0,
      scheme: '', aadhaar: '', searchOk: false, details: null,
      photo: null, photoIsBlob: false, ref: '', busy: false,
      searchCalls: 0, uploadCalls: 0
    };
  }
  var state = freshState();
  var cap1 = '', cap2 = '';      // captcha answers: never written to the DOM
  var gen = 0;                   // bumps on every reset so late server callbacks are dropped
  var modalOpen = false;
  var timers = { otp: null, aotp: null, sms: null, idle: null, wait: null };

  /* ---------- captcha: stroke-font glyphs drawn as SVG paths (no <text>, so the answer is not in the markup) ---------- */
  function arc(cx, cy, rx, ry, a0, a1) {
    var n = Math.max(6, Math.round(Math.abs(a1 - a0) / 12)), pts = [];
    for (var i = 0; i <= n; i++) {
      var t = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    return pts;
  }
  function cat() { var out = []; for (var i = 0; i < arguments.length; i++) out = out.concat(arguments[i]); return out; }
  // Glyph box: x 0..10, y 0..14 (y grows downwards). Each glyph is a list of polylines.
  var P_BOWL = cat([[1, 14], [1, 0], [5.5, 0]], arc(5.5, 3.75, 3.5, 3.75, -90, 90), [[1, 7.5]]);
  var GLYPHS = {
    A: [[[0, 14], [5, 0], [10, 14]], [[2.2, 8.6], [7.8, 8.6]]],
    B: [[[1, 14], [1, 0]], cat([[1, 0], [5.5, 0]], arc(5.5, 3.5, 3.5, 3.5, -90, 90), [[1, 7]]), cat([[1, 7], [6, 7]], arc(6, 10.5, 3.5, 3.5, -90, 90), [[1, 14]])],
    C: [arc(5.5, 7, 4.5, 7, -40, -320)],
    D: [[[1, 0], [1, 14]], cat([[1, 0], [4, 0]], arc(4, 7, 5, 7, -90, 90), [[1, 14]])],
    E: [[[9, 0], [1, 0], [1, 14], [9, 14]], [[1, 7], [7, 7]]],
    F: [[[9, 0], [1, 0], [1, 14]], [[1, 7], [7, 7]]],
    G: [cat(arc(5.5, 7, 4.5, 7, -40, -360), [[6, 7]])],
    H: [[[1, 0], [1, 14]], [[9, 0], [9, 14]], [[1, 7], [9, 7]]],
    J: [[[3, 0], [9.5, 0]], cat([[7, 0]], arc(4, 10, 3, 4, 0, 180))],
    K: [[[1, 0], [1, 14]], [[9, 0], [1, 8.5]], [[3.8, 5.8], [9.5, 14]]],
    L: [[[1, 0], [1, 14], [9, 14]]],
    M: [[[1, 14], [1, 0], [5, 9], [9, 0], [9, 14]]],
    N: [[[1, 14], [1, 0], [9, 14], [9, 0]]],
    P: [P_BOWL],
    Q: [arc(5, 7, 4.5, 7, 0, 360), [[6, 10], [10, 15]]],
    R: [P_BOWL, [[5, 7.5], [9.5, 14]]],
    S: [cat(arc(5, 3.75, 4, 3.75, -20, -270), arc(5, 10.75, 4, 3.25, -90, 160))],
    T: [[[0, 0], [10, 0]], [[5, 0], [5, 14]]],
    U: [cat([[1, 0]], arc(5, 9.5, 4, 4.5, 180, 0), [[9, 0]])],
    V: [[[0, 0], [5, 14], [10, 0]]],
    W: [[[0, 0], [2.5, 14], [5, 4], [7.5, 14], [10, 0]]],
    X: [[[1, 0], [9, 14]], [[9, 0], [1, 14]]],
    Y: [[[0, 0], [5, 7], [10, 0]], [[5, 7], [5, 14]]],
    Z: [[[1, 0], [9, 0], [1, 14], [9, 14]]],
    2: [cat(arc(5, 4, 4, 4, -165, 25), [[1, 14], [9.5, 14]])],
    3: [cat(arc(5, 3.5, 4, 3.5, -160, 90), arc(5, 10.5, 4, 3.5, -90, 160))],
    4: [[[7, 14], [7, 0], [0, 10], [10, 10]]],
    5: [cat([[9, 0], [2, 0], [1.6, 6.6]], arc(5, 9.8, 4.2, 4.2, -140, 150))],
    6: [cat(arc(6.5, 10, 5.5, 9.5, 280, 180), arc(5, 10, 4, 4, 180, 540))],
    7: [[[1, 0], [9, 0], [4, 14]]],
    8: [arc(5, 3.5, 3.5, 3.5, 90, 450), arc(5, 10.5, 4, 3.5, -90, 270)],
    9: [arc(5, 4, 4, 4, 0, 360), arc(3.5, 4, 5.5, 9.5, 0, 100)]
  };
  var INK = ['#1a237e', '#4a148c', '#8e1b1b', '#1b5e20', '#263238', '#4e342e', '#0d47a1', '#5d1049'];
  var NOISE = ['#7f8c9a', '#a1887f', '#90a4ae', '#9575cd', '#81c784', '#e57373', '#64b5f6', '#ffb74d'];

  function subdivide(line, step) {
    var out = [line[0]];
    for (var i = 1; i < line.length; i++) {
      var a = line[i - 1], b = line[i];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / step));
      for (var k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  }
  function f1(n) { return Math.round(n * 10) / 10; }

  function makeCaptcha() {
    var W = 156, H = 44, answer = '';
    for (var i = 0; i < 6; i++) answer += CAPTCHA_CHARS.charAt(Math.floor(Math.random() * CAPTCHA_CHARS.length));
    var wave = { ay: 1.6 + Math.random() * 1.2, fy: (Math.PI * 2) / (48 + Math.random() * 30), py: Math.random() * 6.3,
      ax: 1 + Math.random(), fx: (Math.PI * 2) / (30 + Math.random() * 20), px: Math.random() * 6.3 };
    function warp(x, y) { return [x + wave.ax * Math.sin(y * wave.fx + wave.px), y + wave.ay * Math.sin(x * wave.fy + wave.py)]; }

    var bg1 = 'hsl(' + rand(0, 360) + ',45%,93%)', bg2 = 'hsl(' + rand(0, 360) + ',40%,88%)';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + bg1 + '"/><stop offset="1" stop-color="' + bg2 + '"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#g)"/>';
    // faint background speckle and short scratches
    for (var s = 0; s < 10; s++) {
      svg += '<path d="M' + rand(0, W) + ' ' + rand(0, H) + 'l' + rand(-14, 14) + ' ' + rand(-8, 8) + '" stroke="' + pick(NOISE) + '" stroke-width="0.8" opacity="0.6"/>';
    }
    // characters
    var spacing = 23.5, x0 = 19;
    for (var c = 0; c < answer.length; c++) {
      var lines = GLYPHS[answer.charAt(c)];
      var scale = 1.4 + Math.random() * 0.25, rot = (Math.random() * 36 - 18) * Math.PI / 180, shear = Math.random() * 0.4 - 0.2;
      var cx = x0 + c * spacing + (Math.random() * 4 - 2), cy = H / 2 + (Math.random() * 6 - 3);
      var cos = Math.cos(rot), sin = Math.sin(rot), d = '';
      for (var l = 0; l < lines.length; l++) {
        var pts = subdivide(lines[l], 1.2);
        for (var p = 0; p < pts.length; p++) {
          var lx = pts[p][0] - 5 + (Math.random() * 0.5 - 0.25), ly = pts[p][1] - 7 + (Math.random() * 0.5 - 0.25);
          lx += shear * ly;
          var gx = cx + scale * (lx * cos - ly * sin), gy = cy + scale * (lx * sin + ly * cos);
          var w = warp(gx, gy);
          d += (p === 0 ? 'M' : 'L') + f1(w[0]) + ' ' + f1(w[1]);
        }
      }
      svg += '<path d="' + d + '" fill="none" stroke="' + pick(INK) + '" stroke-width="' + (1.8 + Math.random() * 0.5).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    // crossing curves: two light, one dark through the text band
    for (var q = 0; q < 3; q++) {
      var dark = q === 2;
      svg += '<path d="M0 ' + rand(6, H - 6) + 'C' + rand(30, 60) + ' ' + rand(0, H) + ' ' + rand(90, 120) + ' ' + rand(0, H) + ' ' + W + ' ' + rand(6, H - 6) + '"' +
        ' fill="none" stroke="' + (dark ? pick(INK) : pick(NOISE)) + '" stroke-width="' + (dark ? 0.9 : 1.3) + '" opacity="' + (dark ? 0.6 : 0.65) + '"/>';
    }
    // dots
    for (var k = 0; k < 55; k++) {
      svg += '<circle cx="' + rand(0, W) + '" cy="' + rand(0, H) + '" r="' + (0.5 + Math.random() * 0.9).toFixed(1) + '" fill="' + pick(Math.random() < 0.25 ? INK : NOISE) + '" opacity="0.8"/>';
    }
    svg += '</svg>';
    return { answer: answer, url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) };
  }

  function newCaptcha(which) {
    var c = makeCaptcha();
    if (which === 1) { cap1 = c.answer; $('captcha-img').src = c.url; $('captcha-input').value = ''; }
    else { cap2 = c.answer; $('captcha2-img').src = c.url; $('captcha2-input').value = ''; }
  }
  function captchaOk(which) {
    var typed = noSpaces($(which === 1 ? 'captcha-input' : 'captcha2-input').value).toUpperCase();
    var answer = which === 1 ? cap1 : cap2;
    return !!answer && typed === answer;
  }

  /* ---------- sample photo (inline SVG silhouette) ---------- */
  function samplePhotoUrl() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="180" viewBox="0 0 140 180">' +
      '<rect width="140" height="180" fill="#e3ebf3"/>' +
      '<path d="M10 180c3-38 26-56 60-56s57 18 60 56z" fill="#56677a"/>' +
      '<path d="M56 104h28v22c-4 6-24 6-28 0z" fill="#c7987a"/>' +
      '<ellipse cx="70" cy="74" rx="27" ry="33" fill="#d8aa88"/>' +
      '<path d="M43 70c-2-26 12-38 27-38s30 11 27 38c-4-11-14-17-27-17s-23 6-27 17z" fill="#ececec"/>' +
      '<path d="M54 76h12M74 76h12" stroke="#5a4636" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M62 94c5 3 11 3 16 0" stroke="#8b5e4a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function setPhoto(url, isBlob) {
    dropPhoto();
    state.photo = url; state.photoIsBlob = !!isBlob;
    var img = $('photo-preview');
    img.src = url; img.hidden = false;
    $('photo-empty').hidden = true;
  }
  function dropPhoto() {
    if (state.photo && state.photoIsBlob) { try { URL.revokeObjectURL(state.photo); } catch (e) { /* ignore */ } }
    state.photo = null; state.photoIsBlob = false;
    var img = $('photo-preview');
    img.removeAttribute('src'); img.hidden = true;
    $('photo-empty').hidden = false;
  }

  /* ---------- page-wide helpers ---------- */
  function showError(msg) { var el = $('error-msg'); el.textContent = msg; el.hidden = false; }
  function clearError() { var el = $('error-msg'); el.textContent = ''; el.hidden = true; }

  function sms(text) {
    var el = $('demo-sms');
    el.textContent = text; el.hidden = false;
    clearTimeout(timers.sms);
    timers.sms = setTimeout(hideSms, SMS_MS);
  }
  function hideSms() {
    clearTimeout(timers.sms); timers.sms = null;
    var el = $('demo-sms'); el.hidden = true; el.textContent = '';
  }

  function serverWait(fn, min, max) {
    var mine = gen;
    state.busy = true;
    $('loading').hidden = false;
    timers.wait = setTimeout(function () {
      timers.wait = null;
      if (mine !== gen) return;
      $('loading').hidden = true;
      state.busy = false;
      fn();
    }, rand(min || WAIT_MIN, max || WAIT_MAX));
  }
  function chaosFails(nth) {
    if (CHAOS === 2) return nth === 1;
    if (CHAOS === 1) return Math.random() < 0.2;
    return false;
  }

  function show(name) {
    var secs = document.querySelectorAll('section.pstep');
    for (var i = 0; i < secs.length; i++) secs[i].hidden = secs[i].getAttribute('data-step') !== name;
    document.body.dataset.step = name;
    clearError();
    var idx = STEP_INDEX[name], items = document.querySelectorAll('#pstepper li');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('cur', j === idx);
      items[j].classList.toggle('past', j < idx);
      if (j === idx) items[j].setAttribute('aria-current', 'step'); else items[j].removeAttribute('aria-current');
    }
    if (ENTER[name]) ENTER[name]();
    window.scrollTo(0, 0);
  }

  /* ---------- OTP ---------- */
  function otpValue() { return FIXED_OTP ? '123456' : String(rand(0, 999999)).padStart(6, '0'); }
  function startTimer(kind) {
    var el = $(kind + '-timer'), deadline = Date.now() + OTP_SECONDS * 1000;
    state[kind + 'Deadline'] = deadline;
    clearInterval(timers[kind]);
    function tick() {
      var left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      el.textContent = 'Time remaining: ' + mmss(left);
      el.classList.toggle('expired', left === 0);
      if (left === 0) { clearInterval(timers[kind]); timers[kind] = null; }
    }
    tick();
    timers[kind] = setInterval(tick, 1000);
  }
  function stopTimer(kind) { clearInterval(timers[kind]); timers[kind] = null; }
  function resetTimerText(kind) { var el = $(kind + '-timer'); el.textContent = 'Time remaining: ' + mmss(OTP_SECONDS); el.classList.remove('expired'); }

  function issueOtp(kind) {
    var code = otpValue();
    if (kind === 'otp') {
      state.otp = code;
      $('otp-sent-to').textContent = 'OTP sent to ' + maskMobile(state.mobile);
      sms('SMS to +91 ' + maskMobile(state.mobile) + ': ' + code + ' is your OTP for Senior Health Cover login.');
    } else {
      state.aotp = code;
      $('aotp-sent-to').textContent = 'OTP sent to Aadhaar-linked mobile ' + maskMobile(PHONE);
      sms('SMS to phone ending ' + PHONE + ': ' + code + ' is your Aadhaar OTP.');
    }
    startTimer(kind);
  }
  // Shared verify logic for the login OTP and the Aadhaar OTP.
  function verifyOtp(kind, next) {
    clearError();
    var input = $(kind + '-input'), typed = noSpaces(input.value);
    var expired = Date.now() >= state[kind + 'Deadline'];
    if (!/^\d{6}$/.test(typed) && !expired) { input.value = ''; return showError(MSG.otpInvalid); }
    serverWait(function () {
      if (expired) return showError(MSG.otpExpired);
      if (typed !== state[kind]) { input.value = ''; return showError(MSG.otpInvalid); }
      stopTimer(kind);
      next();
    });
  }
  function resendOtp(kind) {
    clearError();
    $(kind + '-input').value = '';
    serverWait(function () { issueOtp(kind); });
  }

  /* ---------- selects ---------- */
  function fillSelect(sel, placeholder, values) {
    sel.textContent = '';
    var first = document.createElement('option');
    first.value = ''; first.textContent = placeholder;
    sel.appendChild(first);
    for (var i = 0; i < values.length; i++) {
      var o = document.createElement('option');
      o.value = values[i]; o.textContent = values[i];
      sel.appendChild(o);
    }
    sel.value = '';
  }
  function resetDistrictAndWard(districts) {
    var d = $('d-district'), w = $('d-ward');
    fillSelect(d, '-- Select District --', districts || []);
    d.disabled = !districts;
    fillSelect(w, '-- Select Ward/Village --', []);
    w.disabled = true;
  }

  /* ---------- step entry hooks ---------- */
  var ENTER = {
    ekyc: function () { $('ek-aadhaar').textContent = maskAadhaar(state.aadhaar); },
    details: function () { $('d-mobile').value = state.mobile; },
    review: function () {
      var dl = $('review-summary'), d = state.details || {};
      dl.textContent = '';
      [['Name', BENEFICIARY.name], ['Aadhaar Number', maskAadhaar(state.aadhaar)], ['Mobile Number', d.mobile],
        ['State', d.state], ['District', d.district], ['Ward/Village', d.ward], ['Address', d.address]].forEach(function (row) {
        var dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = row[0]; dd.textContent = row[1] || '';
        dl.appendChild(dt); dl.appendChild(dd);
      });
      var img = $('review-photo');
      if (state.photo) { img.src = state.photo; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
    }
  };

  /* ---------- full reset: every field and all state ---------- */
  function fullReset() {
    gen++;
    clearTimeout(timers.wait); timers.wait = null;
    stopTimer('otp'); stopTimer('aotp');
    hideSms();
    dropPhoto();
    state = freshState();
    var inputs = document.querySelectorAll('#main input');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    }
    $('d-state').value = '';
    resetDistrictAndWard(null);
    $('search-result').hidden = true;
    $('sr-aadhaar').textContent = '';
    $('ek-aadhaar').textContent = '';
    $('review-summary').textContent = '';
    $('review-photo').removeAttribute('src'); $('review-photo').hidden = true;
    $('ref-no').textContent = '';
    $('otp-sent-to').textContent = ''; $('aotp-sent-to').textContent = '';
    resetTimerText('otp'); resetTimerText('aotp');
    $('loading').hidden = true;
    clearError();
    newCaptcha(1); newCaptcha(2);
  }

  /* ---------- idle timer and session expiry ---------- */
  function resetIdle() {
    if (modalOpen) return;
    clearTimeout(timers.idle);
    timers.idle = setTimeout(expire, TIMEOUT_S * 1000);
  }
  function expire() {
    timers.idle = null;
    fullReset();
    modalOpen = true;
    $('page').inert = true;
    $('session-modal').hidden = false;
    $('session-ok').focus();
  }
  ['input', 'change', 'click', 'keydown'].forEach(function (t) { document.addEventListener(t, resetIdle, true); });

  /* ---------- wiring ---------- */
  function on(id, fn) {
    $(id).addEventListener('click', function (e) {
      if (e.currentTarget.tagName === 'A') e.preventDefault();
      if (state.busy || modalOpen) return;
      fn(e);
    });
  }
  // Digits-only fields: strip anything else as it is typed (or set by script plus an input event).
  ['mobile', 'otp-input', 'aotp-input', 'aadhaar-input', 'd-mobile'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      var v = this.value.replace(/\D+/g, '');
      if (v !== this.value) this.value = v;
    });
  });

  // 1. login
  on('captcha-refresh', function () { newCaptcha(1); });
  on('btn-get-otp', function () {
    clearError();
    var mobile = noSpaces($('mobile').value);
    if (!/^\d{10}$/.test(mobile)) return showError(MSG.mobile);
    if (!captchaOk(1)) { showError(MSG.captcha); newCaptcha(1); return; }
    serverWait(function () {
      state.mobile = mobile;
      issueOtp('otp');
      show('otp');
    });
  });

  // 2. otp
  on('otp-resend', function () { resendOtp('otp'); });
  on('btn-verify-otp', function () { verifyOtp('otp', function () { show('search'); }); });

  // 3. search
  on('captcha2-refresh', function () { newCaptcha(2); });
  on('btn-search', function () {
    clearError();
    $('search-result').hidden = true;
    state.searchOk = false;
    var schemeEl = document.querySelector('input[name="scheme"]:checked');
    var aadhaar = noSpaces($('aadhaar-input').value);
    if (!schemeEl) return showError(MSG.scheme);
    if (!/^\d{12}$/.test(aadhaar)) return showError(MSG.aadhaar);
    if (!captchaOk(2)) { showError(MSG.captcha); newCaptcha(2); return; }
    var scheme = schemeEl.value;
    serverWait(function () {
      state.searchCalls++;
      if (chaosFails(state.searchCalls)) return showError(MSG.server);
      if (aadhaar.indexOf('9999') === 0) return showError(MSG.noBeneficiary);
      if (scheme === 'pmjay') return showError(MSG.noPmjay);
      state.scheme = scheme; state.aadhaar = aadhaar; state.searchOk = true;
      $('sr-aadhaar').textContent = maskAadhaar(aadhaar);
      $('search-result').hidden = false;
    });
  });
  on('btn-proceed-ekyc', function () {
    if (!state.searchOk) return;
    clearError();
    serverWait(function () { show('ekyc'); });
  });

  // 4. ekyc
  on('btn-send-aadhaar-otp', function () {
    clearError();
    if (!$('consent-check').checked) return showError(MSG.consent);
    serverWait(function () {
      issueOtp('aotp');
      show('ekyc-otp');
    });
  });

  // 5. ekyc-otp
  on('aotp-resend', function () { resendOtp('aotp'); });
  on('btn-verify-aotp', function () { verifyOtp('aotp', function () { show('details'); }); });

  // 6. details
  $('d-state').addEventListener('change', function () {
    resetDistrictAndWard(this.value ? (PLACES[this.value] || null) : null);
  });
  $('d-district').addEventListener('change', function () {
    var w = $('d-ward');
    fillSelect(w, '-- Select Ward/Village --', this.value ? WARDS : []);
    w.disabled = !this.value;
  });
  on('btn-save-details', function () {
    clearError();
    var st = $('d-state').value, di = $('d-district').value, wa = $('d-ward').value;
    var addr = $('d-address').value.trim(), mob = noSpaces($('d-mobile').value);
    if (!st) return showError(MSG.state);
    if (!di) return showError(MSG.district);
    if (!wa) return showError(MSG.ward);
    if (!addr) return showError(MSG.address);
    if (!/^\d{10}$/.test(mob)) return showError(MSG.mobile);
    serverWait(function () {
      state.details = { mobile: mob, state: st, district: di, ward: wa, address: addr };
      show('photo');
    });
  });

  // 7. photo
  $('photo-input').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (f) setPhoto(URL.createObjectURL(f), true); else dropPhoto();
  });
  on('btn-sample-photo', function () {
    clearError();
    $('photo-input').value = '';
    setPhoto(samplePhotoUrl(), false);
  });
  on('btn-upload-photo', function () {
    clearError();
    var f = $('photo-input').files && $('photo-input').files[0];
    if (!state.photo && f) setPhoto(URL.createObjectURL(f), true);
    if (!state.photo) return showError(MSG.photo);
    serverWait(function () {
      state.uploadCalls++;
      if (chaosFails(state.uploadCalls)) return showError(MSG.upload);
      show('review');
    }, 1500, WAIT_MAX);
  });

  // 8. review
  on('btn-submit', function () {
    clearError();
    if (!$('declare-check').checked) return showError(MSG.declare);
    serverWait(function () {
      state.ref = 'SHC-2026-' + String(rand(0, 999999)).padStart(6, '0');
      $('ref-no').textContent = state.ref;
      show('done');
    });
  });

  // 9. done
  on('btn-new', function () { fullReset(); show('login'); });

  // session modal
  $('session-ok').addEventListener('click', function () {
    $('session-modal').hidden = true;
    $('page').inert = false;
    modalOpen = false;
    fullReset();
    show('login');
    resetIdle();
  });

  /* ---------- start ---------- */
  var now = new Date();
  $('today').textContent = String(now.getDate()).padStart(2, '0') + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + now.getFullYear();
  $('idle-note').textContent = TIMEOUT_S >= 120 ? Math.round(TIMEOUT_S / 60) + ' minutes' : TIMEOUT_S + ' seconds';
  fullReset();
  show('login');
  resetIdle();

  if (TEST) {
    window.__portalTest = Object.freeze({
      captcha: function () { return cap1; },
      captcha2: function () { return cap2; },
      otp: function () { return state.otp; },
      aotp: function () { return state.aotp; },
      step: function () { return document.body.dataset.step; }
    });
  }
})();

// Opened as chrome-extension:// or file://? The helper extension can't run there: point to the localhost copy.
(function () {
  if (/^https?:$/.test(location.protocol)) return;
  var b = document.getElementById('mock-banner');
  if (!b) return;
  var a = document.createElement('a');
  a.href = 'https://steady-helper-phi.vercel.app/portal/index.html';
  a.textContent = 'Open the live practice portal to get the helper';
  a.style.cssText = 'margin-left:8px;font-weight:700;color:#7A1606';
  b.appendChild(document.createTextNode(' The Steady helper cannot run on this copy.'));
  b.appendChild(a);
})();
