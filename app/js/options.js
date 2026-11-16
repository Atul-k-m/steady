/* Steady helper options (extension page). Stores { aiFallback, apiKey, defaultLevel } in chrome.storage.local. */
(function () {
  const K = 'steady.agent.opts';
  const $ = (id) => document.getElementById(id);
  const status = (id, text) => { $(id).textContent = text; };
  chrome.storage.local.get(K, (all) => {
    const o = all[K] || {};
    $('ai').checked = !!o.aiFallback;
    $('key').value = o.apiKey || '';
    $('level').value = o.defaultLevel || '';
  });
  const read = () => ({ aiFallback: $('ai').checked, apiKey: $('key').value.trim(), defaultLevel: $('level').value });
  $('save').addEventListener('click', () => {
    const o = read();
    if (o.aiFallback && !o.apiKey) { status('status', 'Add an API key, or turn the AI fallback off.'); return; }
    chrome.storage.local.set({ [K]: o }, () => status('status', o.aiFallback ? 'Saved. The AI fallback is on.' : 'Saved. The AI fallback is off.'));
  });
  $('level').addEventListener('change', () => chrome.storage.local.get(K, (all) => chrome.storage.local.set({ [K]: Object.assign({}, all[K] || {}, { defaultLevel: $('level').value }) })));
  $('test').addEventListener('click', () => {
    const apiKey = $('key').value.trim();
    if (!apiKey) { status('status', 'Type the key first.'); return; }
    status('status', 'Testing…');
    chrome.runtime.sendMessage({ type: 'steady:test', apiKey }, (r) => {
      if (chrome.runtime.lastError) return status('status', 'Could not reach the helper: ' + chrome.runtime.lastError.message);
      status('status', r && r.ok ? 'The key works.' : 'The key did not work: ' + ((r && r.error) || 'unknown error'));
    });
  });
  $('wipe').addEventListener('click', () => chrome.storage.local.remove('steady.vault.v1', () => status('wipe-status', 'Saved answers deleted.')));
})();
