/* Extension bridge (isolated world, with core.js). The MAIN-world engine can't call chrome.* APIs, and the two
 * worlds share only the DOM. Pointing and tremor features can reveal a health condition, so the profile never
 * enters the website's page: the bridge works out the settings here and hands the page only those, as
 * <html data-steady-settings>. Everything the page could read is what it could measure anyway: button sizes. */
(function () {
  const S = self.Steady;
  const de = document.documentElement;
  const K = S.KEYS;
  de.dataset.steadyExt = '1'; // tells core.js on the page: don't write to this site's storage

  function push(all) {
    let profile = null;
    try { profile = all[K.profile] ? JSON.parse(all[K.profile]) : null; } catch (e) { /* ignore */ }
    const condition = ['original', 'fixed', 'personal'].includes(all[K.condition]) ? all[K.condition] : 'personal';
    const steadier = all[K.steadier] === '1';
    const settings = S.settingsFor(condition, profile, steadier && condition === 'personal');
    de.dataset.steadySettings = JSON.stringify(settings);
    de.dataset.steadyCondition = condition;
    de.dataset.steadySteadier = steadier ? '1' : '0';
    de.dataset.steadyCalibrated = profile ? '1' : '0';
    de.dataset.steadyCalibrateUrl = chrome.runtime.getURL('calibrate.html');
    document.dispatchEvent(new CustomEvent('steady:profile'));
  }
  chrome.storage.local.get(null, push);
  chrome.storage.onChanged.addListener(() => chrome.storage.local.get(null, push));

  // The in-page panel can only change "Steadier today". Any other key from the page is ignored,
  // so a website can't switch Steady off or read anything back.
  document.addEventListener('steady:pref', (e) => {
    try {
      const { key, value } = JSON.parse(e.detail);
      if (key === K.steadier && (value === '0' || value === '1')) chrome.storage.local.set({ [key]: value });
    } catch (err) { /* ignore */ }
  });
})();
