/* Side-by-side demo: Original | Steady, with synthetic example hands. Demo frames are never logged. */
(function () {
  const S = window.Steady;
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  // Synthetic example hands, for demonstration only. They are not user data.
  const EXAMPLES = {
    precise: { sigma: 2.5, slip: 0.8, rms: 0.4, hz: 0, drag: { attempts: 2, failures: 0, ms: 900 }, seed: 3 },
    moderate: { sigma: 12, slip: 7, rms: 2.6, hz: 5, drag: { attempts: 3, failures: 1, ms: 2100 }, seed: 5 },
    strong: { sigma: 20, slip: 12, rms: 5.2, hz: 4.5, drag: { attempts: 4, failures: 3, ms: 3400 }, seed: 9, repeatEvery: 4 },
  };
  const state = { hand: S.loadProfile() ? 'mine' : 'moderate', task: 'book', cmp: 'original' };
  const mine = S.loadProfile();

  function exampleProfile(key) {
    const e = EXAMPLES[key];
    const pointing = S.pointingFeatures(S.synthTrials({ sigma: e.sigma, slip: e.slip, n: 30, seed: e.seed, repeatEvery: e.repeatEvery || 0 }));
    return S.buildProfile({ pointing, tremor: { tremorRms: e.rms, tremorHz: e.hz }, drag: e.drag, device: 'Example: ' + key });
  }

  function wire(id, key) {
    const g = document.getElementById(id);
    g.querySelectorAll('button').forEach((b) => {
      if (id === 'hand' && b.dataset.v === 'mine' && !mine) { b.disabled = true; b.title = 'Calibrate first'; }
      b.addEventListener('click', () => { state[key] = b.dataset.v; render(); });
    });
  }
  wire('hand', 'hand'); wire('task', 'task'); wire('cmp', 'cmp');

  function render() {
    for (const [id, key] of [['hand', 'hand'], ['task', 'task'], ['cmp', 'cmp']])
      document.getElementById(id).querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state[key])));

    let profile, profileParam = '';
    if (state.hand === 'mine' && mine) { profile = mine; }
    else { profile = exampleProfile(state.hand); localStorage.setItem(S.KEYS.profile + '.demo', JSON.stringify(profile)); profileParam = '&profile=demo'; }
    const s = S.settingsFor('personal', profile, false);
    const rec = S.recommend(profile.features, { overrides: profile.overrides });

    document.getElementById('note').textContent = state.hand === 'mine'
      ? `Using your calibration for “${profile.device}”.`
      : 'Example hands are synthetic profiles made for this demo. They show how the settings change; they are not anyone’s data.';
    const chips = [
      [`Buttons ${s.target} px`, true], [`Gaps ${s.gap} px`, true],
      ['Slip guard', s.slipGuard], [s.ignoreRepeatMs ? `Ignore repeats ${s.ignoreRepeatMs} ms` : 'Ignore repeats', !!s.ignoreRepeatMs],
      ['Day list', s.dateMode === 'list'], ['Stepper', s.sliderMode === 'stepper'],
      ['Pick, then place', s.dragMode === 'pick'], ['Confirm before sending', s.confirmFinal],
    ];
    document.getElementById('chips').innerHTML = chips.map(([t, on]) => `<li class="${on ? 'on' : ''}">${on ? '' : 'No '}${on ? t : t.toLowerCase()}</li>`).join('');
    document.getElementById('reasons').innerHTML = rec.explain.map((t) => `<li>${CHECK}<span>${t}</span></li>`).join('');
    document.getElementById('right-s').textContent = `Fitted to: ${state.hand === 'mine' ? 'your calibration' : state.hand + ' (example)'}`;
    document.getElementById('left-h').textContent = state.cmp === 'original' ? 'Original page' : 'Fixed accessible';
    document.getElementById('left-s').textContent = state.cmp === 'original' ? 'As published' : 'One size for everyone: 44 px';

    const page = state.task === 'book' ? 'book.html' : 'week.html';
    const bust = Date.now();
    document.getElementById('left').src = `${page}?v=1&demo=1&cond=${state.cmp}&panel=0&t=${bust}`;
    document.getElementById('right').src = `${page}?v=1&demo=1&cond=personal${profileParam}&t=${bust}`;
  }
  render();
})();
