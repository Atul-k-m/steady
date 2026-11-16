# Deploy Runbook — STEADY v0.2.0 (mid-way demo: MVP 1 + 2)

Release owner: **OPEN** (suggest the Engine & extension lead) · Go/no-go owner: **OPEN** (suggest the Study & evaluation lead) · Target date: **OPEN**
Release commit: **OPEN**. The baseline is `0f6f80c` on `main`; this hardening pass is uncommitted on top of it.

Two different launches, with different bars:

| Launch | Who uses it | Verdict |
|---|---|---|
| **A. Demo deploy**: hosted web build plus the unpacked extension, for the mid-way review | The team, reviewers, invited testers | **Ready.** No engineering blockers. |
| **B. Study pilot**: real participants with tremor | Recruited participants, with consent | **Not yet.** The blockers below are ethics and process, not code. |

## 1. Readiness

| # | Area | Status | Evidence | Owner |
|---|---|---|---|---|
| 1 | Integration | Green | One tree, four sessions coordinated. `node --test tests/core.test.js tests/adapt.browser.test.js` → 37/37. `tests/demo.e2e.js` → 35/35. `tests/extension.e2e.js` → 14/14. | Engine lead |
| 2 | Data | Green (N/A server-side) | No server or database. Profiles and session logs live in each browser (`localStorage`, `chrome.storage`). Deleting them: hub → "Delete everything". | ML lead |
| 3 | Env & secrets | Green (N/A) | No env vars, keys or third-party services. `grep -r "fetch\|XMLHttpRequest\|sendBeacon" app/js` finds nothing that sends data. | Engine lead |
| 4 | Security | Green | CSP on every page (`script-src 'self'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`). `_headers` adds `frame-ancestors`, `nosniff`, `no-referrer`, `noindex`. No inline scripts (MV3-compatible). User text is HTML-escaped (participant ID, device name, feed). CSV cells are quoted and formula-neutralised. Websites can only toggle "Steadier today" through the bridge; other keys are refused (extension test). | Engine lead |
| 5 | Email | N/A | Nothing is sent. | — |
| 6 | Observability | Amber (by design) | No telemetry, which is deliberate for health-adjacent data. Errors surface only in the browser console. For the pilot, the facilitator watches the live view; MVP 3 adds a study console. | Study lead |
| 7 | Legal & trust | **Demo: Green · Pilot: Red** | `privacy.html` describes what is measured, where it is kept and how to delete it. For the pilot: ethics approval, consent forms and the study region/law decision (DPDP or GDPR, `plan.md` §16) are open, as is a handling procedure for exported CSV files. | Study lead |
| 8 | Platform limits | Green | Any static host works. Netlify and Cloudflare Pages read `_headers`; GitHub Pages ignores it (meta CSP still applies), and Pages on a private repo needs a paid plan. Vercel Hobby is non-commercial only, which fits a research demo. | Release owner |
| 9 | Rollback | Green | Re-deploy the previous `dist/web/`, or use the host's "restore deploy". Nothing persistent lives server-side. Extension rollback: load the previous folder. | Release owner |

## 2. Blockers

**Launch A (demo):** none.

**Launch B (study pilot):**

| Blocker | Area | Owner | Due | Status |
|---|---|---|---|---|
| Institutional ethics approval | Legal | Study lead | Week 1 submission (`plan.md` §8) | OPEN |
| Consent and information sheets (large print), including what the CSV contains and who sees it | Legal | Study lead | Week 2 | OPEN |
| Decide the study region and law (DPDP Act 2023 or GDPR). Pointing data may count as health data. | Legal | Team | Week 1 | OPEN |
| CSV handling: where exported files are stored, who can access them, how long they are kept, what happens if a laptop is lost | Data | Study lead | Before the first participant | OPEN |
| Manual screen-reader pass of STEADY's own controls (NVDA plus Chrome). Keyboard-only flows are covered by `adapt.browser.test.js`. | Accessibility | Design lead | Week 3 | OPEN |

## 3. Post-launch backlog

| Item | Area | Why it can wait |
|---|---|---|
| `adapt.js` is about 32.8 KB, over the plan's "engine under 30 KB unminified" gate | Performance | Loads once from local files. Minify or split for the Web Store build. |
| Calibration ≤ 60 s with real users | MVP 1 | The step budgets (25 s tap, 12 s hold, 20 s move) cap it by design, and the profile records `seconds` per step. The pilot confirms it. |
| Test–retest within ±1 size level | MVP 1 | Needs people (pilot check, `plan.md` §3). |
| jQuery UI datepicker and other custom widgets | Engine | Native controls work; adapters are MVP 4. `tests/REAL-SITES.md`: 5 of 6 real sites work. |
| Facilitator view works only in the same browser | Study | Fine for a lab session at one machine. Remote observation is MVP 3. |
| Chrome Web Store build | Platform | Needs a hosted privacy policy URL and a justification for host permissions. Unpacked loading works for the study. |
| Steady panel can overlap the bottom-right of a page at large sizes | UX | Space is reserved under the page, so any control can be scrolled clear (74 px² overlap at load, 0 after scrolling, at 96 px and 1280 px wide). A collapsible panel would be better. |

## 4. Infrastructure

- Hosting: **OPEN**. Recommended: Netlify or Cloudflare Pages from the private repo, deploying `dist/web/`.
- Database: none. Email: none. Schedulers: none. Monitoring: none (by design, see area 6).
- Domain: host subdomain is fine. Keep `noindex`. The clinic pages are mock-ups.

## 5. Launch-day steps (demo)

| Step | Command / action | Done |
|---|---|---|
| Run the tests | `node --test tests/core.test.js tests/adapt.browser.test.js`, plus the two e2e scripts | |
| Build | `node tools/build-web.mjs` | |
| Deploy | Upload `dist/web/` | |
| Smoke test (below) on the deployed URL | | |
| Load the extension on the demo laptop | `chrome://extensions` → Load unpacked → `app/` | |
| Calibrate the demo laptop the day before, and keep a synthetic hand ready in `demo.html` | | |

## 6. Smoke tests (deployed URL)

- [ ] `index.html`, `calibrate.html`, `demo.html`, `book.html`, `week.html`, `facilitator.html` and `privacy.html` load with no console errors.
- [ ] `curl -sI <url>/index.html` shows `content-security-policy`, `x-content-type-options`, `referrer-policy` and `x-robots-tag`.
- [ ] DevTools → Network while doing a full calibration and one task: every request is same-origin.
- [ ] Calibrate → hub shows "Fitted for …" → Book in "Fitted to you" shows the day list, stepper and confirm.
- [ ] Facilitator view in a second window of the same browser counts live. Export CSV downloads.
- [ ] `demo.html`: Precise → Moderate → Strong refits to 44 → 72 → 120 px.

## 7. Rollback triggers

Any network request leaving the page · a console error on a core page · a task that can't be finished in "Fitted to you" · the profile or measurements visible to a website through the extension. Response: restore the previous deploy and reload the previous extension folder.

## 8. Go/no-go

| Role | Name | Decision | Time |
|---|---|---|---|
| Release owner | | | |
| Study & evaluation lead | | | |
