# Steady on real websites (not built by us)

**Run:** 12 Nov 2026, Chromium (Playwright).
**Method:** the unmodified `hook.js` + `core.js` + `adapt.js` were injected into each page with a synthetic "moderate" example profile, so every swap was switched on. We then clicked Steady's controls and read back the page's own input values.
**Re-run:** `PLAYWRIGHT_PATH=<path to playwright> node tests/realsites.e2e.js` (screenshots go to `test-results/`).

| Site | Native controls found | Result |
|---|---|---|
| getbootstrap.com/docs/5.3/forms/range/ | 5 range sliders | ✅ 5 steppers; "+" moved the real slider 50 → 51 |
| w3schools.com/howto/howto_js_rangeslider.asp | 6 range sliders | ✅ 6 steppers; "+" moved the real slider 50 → 51 |
| interactive-examples.mdn.mozilla.net — input-date | 1 date input | ✅ 14 day buttons; a click set the real value (2018-07-24) |
| interactive-examples.mdn.mozilla.net — input-range | 2 range sliders | ✅ 2 steppers; "+" moved the real slider 6 → 7 |
| jqueryui.com/datepicker/ | Custom jQuery UI calendar | ❌ Not adapted. Custom widgets need an adapter (MVP 4 backlog) |
| w3schools.com/html/html5_draganddrop.asp | 2 draggables, 4 inline `ondrop=` zones | ✅ **Fixed (re-run, 12 Nov 2026).** First run was a regression: native drag was switched off but no zones were found, because the hook only saw `addEventListener`. The engine now also matches `[ondrop]` and the `el.ondrop` setter, and leaves native drag alone when no zones are found. Re-run: 2 zones offered; pick, then place moved `#img1` from `#div1` to `#div2` |

**Score:** 5 of 6 working, 1 unsupported (custom jQuery UI calendar).

**What this does not show:** whether this helps people with tremor. That needs the user pilot (plan.md, Stage 1). It also covers only 6 pages, chosen because they use native controls, so it is not a sample of "the web".
