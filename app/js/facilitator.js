/* Facilitator view: live counts over BroadcastChannel (same browser, same computer). */
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ERR = ['miss', 'wrong', 'slip', 'repeat', 'dragfail'];
  const NAMES = { miss: 'Misses', wrong: 'Wrong choices', slip: 'Slips', repeat: 'Repeats', dragfail: 'Failed drags', slip_rescued: 'Slips caught', repeat_blocked: 'Repeats blocked', correct: 'Correct choices' };
  const COND = { original: 'Original', fixed: 'Fixed accessible', personal: 'Fitted to you' };
  const grid = document.getElementById('grid'), feed = document.getElementById('feed'), btn = document.getElementById('assist');
  let cur = null, timer = 0;
  let chan;
  try { chan = new BroadcastChannel('steady-live'); } catch (e) { document.getElementById('what').textContent = 'This browser blocks live updates for local files. Serve the folder over http://localhost instead.'; return; }

  function render() {
    const s = cur, c = s.counts || {};
    document.getElementById('who').textContent = `${s.participant} · ${s.flow === 'book' ? 'Book an appointment' : 'Plan the medicine week'}`;
    document.getElementById('what').textContent = `${COND[s.condition] || s.condition} · variant ${s.meta && s.meta.variant || '1'}${s.endedAt ? (s.completed ? ' · finished correctly' : ' · finished with mistakes') : ' · in progress'}${s.assisted ? ' · helped' : ''}`;
    const elapsed = ((s.endedAt || Date.now()) - (s.firstAt || s.startedAt)) / 1000;
    const cells = [['Errors', s.errors, 'err'], ['Time', (s.firstAt ? elapsed : 0).toFixed(1) + ' s', '']]
      .concat(ERR.map((k) => [NAMES[k], c[k] || 0, 'err']))
      .concat(['slip_rescued', 'repeat_blocked', 'correct'].map((k) => [NAMES[k], c[k] || 0, '']));
    grid.innerHTML = cells.map(([k, v, cls]) => `<div class="${cls}"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const evs = (s.last || []).slice().reverse();
    if (evs.length) feed.innerHTML = evs.map((e) => `<li><span>${(e.t / 1000).toFixed(1)} s</span><span class="${ERR.includes(e.outcome) ? 'tag-err' : 'tag-ok'}">${NAMES[e.outcome] ? NAMES[e.outcome].replace(/s$/, '') : e.outcome}</span><span>${esc(e.target)}</span></li>`).join('');
    btn.disabled = !!s.endedAt;
  }
  chan.onmessage = (m) => {
    if (!m.data || !m.data.session) return;
    cur = m.data.session;
    render();
    clearInterval(timer);
    if (!cur.endedAt) timer = setInterval(render, 500);
  };
  btn.addEventListener('click', () => { chan.postMessage({ kind: 'assist' }); document.getElementById('note').textContent = 'Marked as helped.'; });
})();
