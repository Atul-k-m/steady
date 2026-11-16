/* Extension bridge on STEADY's own website (not on portals). Runs at document_start.
 * - Tells the website the helper is installed: <html data-steady-ext-installed="1">.
 * - Copies the profile made by the one-minute check from the site's localStorage into the extension's storage,
 *   on load and whenever the site says it saved one (event "steady:saved"). Then sets data-steady-synced="1"
 *   and fires "steady:ext" so get.html can show the status.
 * Nothing is read from the extension back into the website.
 */
(function () {
  const de = document.documentElement;
  de.dataset.steadyExtInstalled = '1';
  const KEYS = ['steady.profile.v1', 'steady.profiles.v1'];
  function sync() {
    let items = {};
    try { for (const k of KEYS) { const v = localStorage.getItem(k); if (v) items[k] = v; } } catch (e) { items = {}; }
    const done = (ok) => { de.dataset.steadySynced = ok ? '1' : '0'; document.dispatchEvent(new CustomEvent('steady:ext')); };
    if (!items['steady.profile.v1']) return done(false);
    try { chrome.storage.local.set(items, () => done(!chrome.runtime.lastError)); } catch (e) { done(false); }
  }
  document.addEventListener('steady:saved', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
