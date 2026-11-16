/* Install page (get.html): live status of the helper extension and of the settings on this computer.
 * The extension's site bridge sets data-steady-ext-installed and data-steady-synced on <html>, then fires "steady:ext". */
(function () {
  const S = window.Steady;
  const box = document.getElementById('ext-status');
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  const row = (ok, title, detail) => `<div class="status-row${ok ? ' ok' : ''}">
      <span class="mark">${ok ? CHECK : ''}</span>
      <p><b>${title}</b>${detail ? `<span>${detail}</span>` : ''}</p>
    </div>`;

  function render() {
    const d = document.documentElement.dataset;
    const installed = d.steadyExtInstalled === '1', synced = d.steadySynced === '1';
    const prof = S.loadProfile();
    const s = prof ? S.settingsFor('personal', prof, false) : null;
    box.innerHTML = [
      prof
        ? row(true, 'Settings from the one-minute check', `Saved for “${S.esc(prof.device)}”: buttons ${s.target} px, text ${s.text} px.`)
        : row(false, 'No settings on this computer yet', 'Without them the helper uses standard large settings. <a href="calibrate.html">Do the one-minute check</a> first, so it can copy them.'),
      installed
        ? row(true, 'Helper found ✓', 'The Steady extension is installed in this browser.')
        : row(false, 'Not found yet. After installing, reload this page.', ''),
      synced
        ? row(true, 'Your settings are on the helper ✓', 'It copies them again whenever you save the check.')
        : installed
          ? row(false, 'Settings not copied yet', prof ? 'Reload this page to copy them.' : 'Do the one-minute check, then save. The helper copies the settings straight away.')
          : row(false, 'Settings copy over once the helper is installed', ''),
    ].join('');
  }

  render();
  document.addEventListener('steady:ext', render);
  document.getElementById('reload').addEventListener('click', () => location.reload());

  // Web pages can't link to chrome:// pages, so offer to copy the address instead.
  const copyBtn = document.getElementById('copy-url'), note = document.getElementById('copy-note');
  copyBtn.addEventListener('click', async () => {
    const text = document.getElementById('ext-url').textContent;
    try {
      await navigator.clipboard.writeText(text);
      note.textContent = 'Copied. Click Chrome’s address bar, paste with Ctrl+V and press Enter.';
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('ext-url'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      note.textContent = 'Selected. Press Ctrl+C to copy it, then paste it into Chrome’s address bar.';
    }
  });
})();
