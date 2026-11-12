/* Flow B, "Plan the medicine week": HTML5 drag-and-drop. Steady turns it into pick, then place. */
(function () {
  const S = window.Steady;
  const MEDS = [
    { id: 'm-levo', name: 'Levodopa 100 mg' },
    { id: 'm-vitd', name: 'Vitamin D 1000 IU' },
    { id: 'm-calc', name: 'Calcium 500 mg' },
    { id: 'm-mela', name: 'Melatonin 2 mg' },
  ];
  const SLOTS = ['Morning', 'Midday', 'Evening', 'Night'];
  const VARIANTS = {
    1: { 'm-levo': 'Morning', 'm-vitd': 'Midday', 'm-calc': 'Evening', 'm-mela': 'Night' },
    2: { 'm-levo': 'Midday', 'm-vitd': 'Morning', 'm-calc': 'Night', 'm-mela': 'Evening' },
    3: { 'm-levo': 'Evening', 'm-vitd': 'Night', 'm-calc': 'Morning', 'm-mela': 'Midday' },
  };
  const vKey = new URLSearchParams(location.search).get('v') || '1';
  const want = VARIANTS[vKey] || VARIANTS[1];
  document.getElementById('want').textContent = MEDS.map((m) => `${m.name.split(' ')[0]} → ${want[m.id]}`).join(', ');
  const labels = { original: 'Original', fixed: 'Fixed accessible', personal: 'Fitted to you' };
  document.getElementById('cond').textContent = `${S.getPref('participant', 'P00')} · ${labels[S.getPref('condition', 'personal')]} · variant ${vKey}`;

  const tray = document.getElementById('tray');
  tray.innerHTML = MEDS.map((m) => `<div class="med" id="${m.id}" draggable="true" data-name="${m.name}">${m.name}</div>`).join('');
  document.getElementById('week').innerHTML = SLOTS.map((s) => `<div><h3>${s}</h3><div class="slotbox" data-slot="${s}" data-name="${s}" data-task-step="slot"></div></div>`).join('');

  S.metrics.start('week', { variant: vKey, want });

  let dropped = false;
  MEDS.forEach((m) => {
    const el = document.getElementById(m.id);
    el.addEventListener('dragstart', (e) => { dropped = false; e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', () => { if (!dropped) S.metrics.log('dragfail', m.id); });
  });
  const zones = [tray, ...document.querySelectorAll('.slotbox')];
  zones.forEach((z) => {
    z.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; z.classList.add('over'); });
    z.addEventListener('dragleave', () => z.classList.remove('over'));
    z.addEventListener('drop', (e) => {
      e.preventDefault();
      z.classList.remove('over');
      const el = document.getElementById(e.dataTransfer.getData('text/plain'));
      if (!el) return;
      dropped = true;
      z.appendChild(el);
      if (z.dataset.slot) {
        const ok = want[el.id] === z.dataset.slot;
        el.dataset.ok = ok ? '1' : '0';
        S.metrics.log(ok ? 'correct' : 'wrong', el.id);
      } else delete el.dataset.ok;
      summary();
    });
  });

  const form = document.getElementById('f');
  function summary() {
    form.dataset.steadySummary = SLOTS.map((s) => {
      const names = [...document.querySelectorAll(`.slotbox[data-slot="${s}"] .med`)].map((m) => m.dataset.name.split(' ')[0]);
      return `${s}: ${names.join(', ') || 'nothing'}`;
    }).join(' · ');
  }
  summary();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = document.getElementById('err');
    if (tray.querySelector('.med')) { err.textContent = 'Some medicines are still unsorted.'; return; }
    err.textContent = '';
    const ok = MEDS.every((m) => document.getElementById(m.id).parentElement.dataset.slot === want[m.id]);
    const done = document.getElementById('done');
    done.innerHTML = `<strong>Plan saved.</strong> ${form.dataset.steadySummary}. <a href="index.html">Back to the study hub</a>`;
    done.classList.add('show');
    form.querySelector('.submit').disabled = true;
    S.metrics.end({ completed: ok, meta: { finalCorrect: ok } });
  });
})();
