/* STEADY listener hook — runs first (MAIN world, document_start).
 * Content scripts can't see a page's event listeners, so we mark every element that gets a `drop` handler,
 * whether through addEventListener or the `el.ondrop = fn` property. adapt.js treats those elements as drop
 * zones, and also picks up inline `ondrop="…"` attributes itself.
 * Limitation: delegated handlers on document/window and pointer-event drag libraries are not detected.
 */
(function () {
  if (window.__steadyHook) return;
  window.__steadyHook = true;
  const mark = (el) => { try { if (el instanceof Element) el.setAttribute('data-steady-drop', ''); } catch (e) { /* never break the host page */ } };
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (type === 'drop') mark(this);
    return orig.call(this, type, fn, opts);
  };
  try {
    const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'ondrop');
    if (d && d.set && d.configurable) {
      Object.defineProperty(HTMLElement.prototype, 'ondrop', Object.assign({}, d, {
        set(fn) { if (fn) mark(this); return d.set.call(this, fn); },
      }));
    }
  } catch (e) { /* ignore */ }
})();
