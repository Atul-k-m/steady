/* STEADY metrics — study instrumentation (MVP 2: local + BroadcastChannel; MVP 3 swaps the sink for POST/SSE).
 * Outcomes that count as incorrect selection attempts: miss, wrong, slip, repeat, dragfail.
 * Informational (not errors): correct, slip_rescued, repeat_blocked, assist.
 */
(function () {
  const S = (window.Steady = window.Steady || {});
  const ERRORS = ['miss', 'wrong', 'slip', 'repeat', 'dragfail'];
  const KEY = 'steady.sessions';
  let chan = null;
  try { chan = new BroadcastChannel('steady-live'); } catch (e) { /* file:// in some browsers */ }

  let session = null, seq = 0;
  const INTERACTIVE = 'button, a[href], input, label, select, textarea, [role="button"], [draggable="true"], [data-steady-drop], [ondrop], .steady-ui';

  function all() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function persist() {
    if (!session) return;
    const list = all().filter((s) => s.id !== session.id);
    list.push(session);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* quota */ }
  }
  function post(kind, extra) {
    if (chan && session) chan.postMessage(Object.assign({ kind, session: summary(session) }, extra || {}));
  }
  function summary(s) {
    const { events, ...rest } = s;
    return Object.assign({}, rest, { errors: ERRORS.reduce((n, k) => n + (s.counts[k] || 0), 0), last: events.slice(-6) });
  }

  function start(flow, meta) {
    if (new URLSearchParams(location.search).get('demo') === '1') return null; // demo frames are never logged
    const cond = S.getPref ? S.getPref('condition', 'personal') : 'personal';
    session = {
      id: 'S-' + Date.now().toString(36),
      participant: (S.getPref && S.getPref('participant', 'P00')) || 'P00',
      condition: cond, flow, startedAt: Date.now(), firstAt: null, endedAt: null,
      completed: false, assisted: false, timeMs: null, counts: {}, events: [], meta: meta || {},
    };
    persist();
    post('start');
    return session;
  }

  function log(outcome, target, extra) {
    if (!session || session.endedAt) return;
    const now = performance.now();
    if (!session.firstAt && outcome !== 'assist') session.firstAt = Date.now();
    const ev = { id: `e_${Date.now()}_${++seq}`, type: 'attempt', outcome, target: target || '', t: Math.round(now), ...(extra || {}) };
    session.events.push(ev);
    session.counts[outcome] = (session.counts[outcome] || 0) + 1;
    persist();
    post('event', { event: ev });
  }

  function end(result) {
    if (!session || session.endedAt) return;
    session.endedAt = Date.now();
    session.completed = !!(result && result.completed);
    session.timeMs = session.endedAt - (session.firstAt || session.startedAt);
    Object.assign(session.meta, (result && result.meta) || {});
    persist();
    post('end');
  }

  // Automatic capture: misses and unrescued slips inside [data-task-area].
  let down = null;
  document.addEventListener('pointerdown', (e) => {
    if (!session || session.endedAt) return;
    const t = e.composedPath()[0];
    if (!(t instanceof Element) || !t.closest('[data-task-area]')) { down = null; return; }
    const el = t.closest(INTERACTIVE);
    if (!el) { log('miss', t.closest('[data-task-step]')?.dataset.taskStep || 'page'); down = null; return; }
    down = { el, x: e.clientX, y: e.clientY };
  }, true);
  // A slip is a release off the pressed control, including into the gap around it (the container). Releasing on the
  // label that wraps a pressed input is not a slip: the label passes the click on. The slip guard rescues a slip only
  // when the pointer moved at most one target width; a longer move cancels, as in adapt.js.
  document.addEventListener('pointerup', (e) => {
    if (!down || !session) return;
    const t = e.composedPath()[0];
    const upEl = t instanceof Element ? t.closest(INTERACTIVE) : null;
    const passedOn = upEl && upEl.tagName === 'LABEL' && upEl.contains(down.el);
    if (t instanceof Element && !down.el.contains(t) && !passedOn) {
      const s = window.__steadySettings;
      const rescued = window.__steadySlipGuard && s && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= s.target;
      log(rescued ? 'slip_rescued' : 'slip', down.el.id || down.el.textContent.trim().slice(0, 24));
    }
    down = null;
  }, true);
  // Repeats that reached the page (i.e. were not blocked by STEADY's ignore-repeat).
  let lastClick = { t: 0, el: null };
  document.addEventListener('click', (e) => {
    if (!session || window.__steadySynth) return;
    const t = e.composedPath()[0];
    if (!(t instanceof Element) || !t.closest('[data-task-area]')) return;
    const el = t.closest(INTERACTIVE);
    if (!el) return;
    const now = performance.now();
    const isLabelEcho = el.tagName === 'INPUT' && lastClick.el && lastClick.el.tagName === 'LABEL' && lastClick.el.control === el;
    if (!isLabelEcho && lastClick.el === el && now - lastClick.t < 300) log('repeat', el.id || el.textContent.trim().slice(0, 24));
    lastClick = { t: now, el };
  }, true);

  if (chan) chan.onmessage = (m) => {
    if (m.data && m.data.kind === 'assist' && session && !session.endedAt) { session.assisted = true; log('assist', 'facilitator'); }
  };

  function toCSV() {
    const rows = [['session', 'participant', 'condition', 'flow', 'completed', 'assisted', 'independent', 'time_s', ...ERRORS, 'errors_total', 'slip_rescued', 'repeat_blocked', 'correct']];
    for (const s of all()) {
      const c = s.counts || {};
      const errs = ERRORS.map((k) => c[k] || 0);
      rows.push([s.id, s.participant, s.condition, s.flow, s.completed, s.assisted, s.completed && !s.assisted,
        s.timeMs ? (s.timeMs / 1000).toFixed(1) : '', ...errs, errs.reduce((a, b) => a + b, 0), c.slip_rescued || 0, c.repeat_blocked || 0, c.correct || 0]);
    }
    return rows.map((r) => r.map(S.csvCell).join(',')).join('\n');
  }

  S.metrics = { start, log, end, all, toCSV, ERRORS, current: () => session, clear: () => { try { localStorage.removeItem(KEY); } catch (e) { /* */ } } };
})();
