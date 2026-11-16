/* Research study hub (hub.html): device profiles, condition switcher, participant and variant, session list, CSV export. */
(function () {
  const S = window.Steady;

  // Profile line + device switcher (one saved profile per device; the pressed one is active).
  function renderProfile() {
    const prof = S.loadProfile(), all = S.listProfiles();
    const line = document.getElementById('profile-line'), b = document.getElementById('cal-btn');
    if (prof) {
      const s = S.settingsFor('personal', prof, false);
      line.textContent = `Fitted for “${prof.device}”: buttons ${s.target} px, gaps ${s.gap} px, text ${s.text} px${s.slipGuard ? ', slip guard on' : ''}.`;
      b.textContent = 'Check again';
      b.classList.remove('primary');
    }
    const wrap = document.getElementById('devices-wrap'), g = document.getElementById('devices');
    wrap.hidden = all.length < 2;
    g.innerHTML = all.map((p) => `<button class="btn" type="button" data-id="${S.esc(p.id)}" aria-pressed="${!!prof && p.id === (prof.id || S.profileId(prof.device))}">${S.esc(p.device)}</button>`).join('');
    g.querySelectorAll('button').forEach((x) => x.addEventListener('click', () => { S.useProfile(x.dataset.id); renderProfile(); }));
  }
  renderProfile();

  function segmented(id, pref, fallback, onChange) {
    const g = document.getElementById(id);
    const cur = S.getPref(pref, fallback);
    g.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.v === cur));
      b.addEventListener('click', () => {
        g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        S.setPref(pref, b.dataset.v);
        onChange && onChange(b.dataset.v);
      });
    });
  }
  segmented('cond', 'condition', 'personal');
  segmented('variant', 'variant', '1', links);
  const pid = document.getElementById('pid');
  pid.value = S.getPref('participant', 'P01');
  pid.addEventListener('input', () => S.setPref('participant', pid.value.trim() || 'P00'));
  function links() {
    const v = S.getPref('variant', '1');
    document.getElementById('go-book').href = 'book.html?v=' + v;
    document.getElementById('go-week').href = 'week.html?v=' + v;
  }
  links();

  function renderSessions() {
    const list = S.metrics.all().slice(-8).reverse();
    const el = document.getElementById('sessions');
    if (!list.length) { el.innerHTML = '<p class="empty">No sessions yet. Run a task and it appears here.</p>'; return; }
    const label = { original: 'Original', fixed: 'Fixed', personal: 'Fitted' };
    el.innerHTML = `<table class="sessions"><thead><tr><th>Who</th><th>Task</th><th>Condition</th><th>Errors</th><th>Time</th><th>Done</th></tr></thead><tbody>${
      list.map((s) => {
        const c = s.counts || {};
        const errs = S.metrics.ERRORS.reduce((n, k) => n + (c[k] || 0), 0);
        return `<tr><td>${S.esc(s.participant)}</td><td>${s.flow === 'book' ? 'Book' : 'Week'}</td><td>${S.esc(label[s.condition] || s.condition)}</td><td>${errs}</td><td>${s.timeMs ? (s.timeMs / 1000).toFixed(1) + ' s' : '–'}</td><td>${s.endedAt ? (s.completed ? (s.assisted ? 'helped' : 'yes') : 'no') : '…'}</td></tr>`;
      }).join('')}</tbody></table>`;
  }
  renderSessions();

  document.getElementById('export').addEventListener('click', () => {
    const blob = new Blob([S.metrics.toCSV()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `steady-sessions-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('wipe').addEventListener('click', () => {
    if (confirm('Delete your Steady profile and every logged session on this computer?')) { S.clearAll(); location.reload(); }
  });
})();
