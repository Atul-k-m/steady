# STEADY — the interface adjusts to your hand

This is the mid-way demo build: MVP 1 (calibrate and recommend) and MVP 2 (adapt two full task flows, under three study conditions, with live metrics). The design and research write-up is in `Implementation.md`; delivery is in `plan.md`. Both are structured one slide per `##` heading.

## Run it (no install)

```bash
# any static server works; BroadcastChannel and localStorage behave best over http://
python -m http.server 8080 -d app
# open http://localhost:8080
```

Opening `app/index.html` directly also works in Chrome.

**Fastest demo:** open `http://localhost:8080/demo.html`. It shows the same clinic page twice: Original on the left, Steady on the right. Switch the hand (your calibration, or the synthetic Precise / Moderate / Strong examples) and the right side refits: 44 → 72 → 120 px, with day list, stepper, pick-then-place, slip guard and confirm switching on as needed. Demo frames are never logged.

Full study flow:

1. **Calibrate** (`calibrate.html`): tap the dots, hold steady, move a card. You get an explained profile you can adjust.
2. **Choose a condition** in the hub: Original, Fixed accessible or Fitted to you.
3. **Open the facilitator view** in a second window, then run *Book an appointment* or *Plan the medicine week*. Misses, wrong choices, slips, repeats and failed drags are counted live.
4. **Export CSV** from the hub for analysis.

## Use it on other websites (Chrome extension)

1. Go to `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and choose the `app/` folder.
2. Click the Steady toolbar button to open the hub, then calibrate. The profile is saved to `chrome.storage`.
3. On any page, native date inputs, range sliders, HTML5 drag-and-drop, buttons and radio labels are adapted.

Pointer-event drag libraries, canvas widgets and custom calendars need adapters; they are on the MVP 4 list.

## Tests

```bash
node --test tests/core.test.js
```

## Layout

| Path | What it is |
|---|---|
| `app/js/core.js` | Features, Bayesian σ estimator, JSON policy tree, profile and storage (loads in Node too) |
| `app/js/adapt.js` | Engine: day list, stepper, pick-then-place, size and gap, slip guard, ignore-repeat, confirm, panel |
| `app/js/hook.js` | Finds drop zones by wrapping `addEventListener` |
| `app/js/metrics.js` | Study logging, the BroadcastChannel live feed, CSV |
| `app/js/calibrate.js` | The one-minute check |
| `app/js/bridge.js`, `app/js/sw.js`, `app/manifest.json` | Chrome MV3 wrapper |
| `app/book.html`, `app/week.html` | The two host task flows ("ordinary website" styling on purpose) |
| `app/index.html`, `app/facilitator.html`, `app/calibrate.html` | STEADY's own UI |
