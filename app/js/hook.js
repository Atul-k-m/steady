/* STEADY listener hook — runs first (MAIN world, document_start).
 * Content scripts can't see a page's event listeners, so we wrap addEventListener and mark every
 * element that registers a `drop` handler. adapt.js then treats those elements as drop zones.
 * Limitation: delegated handlers on document/window and pointer-event drag libraries are not detected.
 */
(function () {
  if (window.__steadyHook) return;
  window.__steadyHook = true;
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    try {
      if (type === 'drop' && this instanceof Element) this.setAttribute('data-steady-drop', '');
    } catch (e) { /* never break the host page */ }
    return orig.call(this, type, fn, opts);
  };
})();
