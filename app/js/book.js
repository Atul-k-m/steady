/* Flow A, "Book a follow-up": an ordinary clinic form. Steady adapts it; this file is the site's own logic. */
(function () {
  const S = window.Steady;
  const VARIANTS = { 1: { dow: 5, time: '10:30', rem: 30 }, 2: { dow: 2, time: '14:30', rem: 15 }, 3: { dow: 4, time: '09:30', rem: 60 } };
  const vKey = new URLSearchParams(location.search).get('v') || '1';
  const want = VARIANTS[vKey] || VARIANTS[1];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(today); d.setDate(d.getDate() + 3);
  while (d.getDay() !== want.dow) d.setDate(d.getDate() + 1);
  const wantISO = iso(d);
  const nice = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); };

  document.getElementById('want-date').textContent = nice(wantISO);
  document.getElementById('want-time').textContent = want.time;
  document.getElementById('want-rem').textContent = want.rem + ' minutes';
  const labels = { original: 'Original', fixed: 'Fixed accessible', personal: 'Fitted to you' };
  document.getElementById('cond').textContent = `${S.getPref('participant', 'P00')} · ${labels[S.getPref('condition', 'personal')]} · variant ${vKey}`;

  const date = document.getElementById('date');
  const max = new Date(today); max.setDate(max.getDate() + 60);
  date.min = iso(today); date.max = iso(max);

  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00'];
  document.getElementById('slots').innerHTML = times.map((t) => `<label class="slot"><input type="radio" name="time" value="${t}" required>${t}</label>`).join('');

  const rem = document.getElementById('rem');
  const remOut = document.getElementById('remOut');
  const form = document.getElementById('f');

  S.metrics.start('book', { variant: vKey, want: { date: wantISO, time: want.time, rem: want.rem } });

  function summary() {
    const t = form.time.value;
    form.dataset.steadySummary = `${date.value ? nice(date.value) : 'No date chosen'}${t ? ' at ' + t : ''}, reminder ${rem.value} minutes before.`;
  }
  date.addEventListener('change', () => { S.metrics.log(date.value === wantISO ? 'correct' : 'wrong', 'date'); summary(); });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'time') S.metrics.log(e.target.value === want.time ? 'correct' : 'wrong', 'time');
    if (e.target === rem) S.metrics.log(Number(rem.value) === want.rem ? 'correct' : 'wrong', 'reminder');
    summary();
  });
  rem.addEventListener('input', () => { remOut.textContent = rem.value + ' min'; summary(); });
  summary();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = document.getElementById('err');
    if (!date.value || !form.time.value) { err.textContent = 'Please choose a date and a time.'; return; }
    err.textContent = '';
    const ok = date.value === wantISO && form.time.value === want.time && Number(rem.value) === want.rem;
    const done = document.getElementById('done');
    done.innerHTML = `<strong>Booked.</strong> ${form.dataset.steadySummary} <a href="hub.html">Back to the study hub</a>`;
    done.classList.add('show');
    form.querySelector('.submit').disabled = true;
    S.metrics.end({ completed: ok, meta: { finalCorrect: ok, final: { date: date.value, time: form.time.value, rem: Number(rem.value) } } });
  });
})();
