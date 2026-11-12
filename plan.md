# STEADY — Delivery Plan

> **How to turn this into slides:** each `##` is one slide. **Key message** is the headline, **Visual** is what to draw, **Say** is the speaker notes, and `---` separates slides (Marp/Slidev compatible). Companion to `Implementation.md`.
>
> **Timeline assumption (A):** the mid-way demo is built now (about 25 minutes) as MVP 1 + 2. "Later" means Stages 1–3 over about 10 weeks. Adjust the week numbers to your real calendar.

---

## 1. STEADY delivery plan

**Key message:** Four MVPs around one loop. Two are built now and demonstrable; two come later to close the loop.

**Visual:** The loop diagram (Calibrate → Recommend → Adapt → Measure → Learn), with MVP 1 + 2 filled in and MVP 3 + 4 outlined.

---

## 2. Plan at a glance

| | MVP | Question it answers | Status |
|---|---|---|---|
| **1** | **Calibrate & Recommend** | "What settings fit *this* hand?" | **Built now** |
| **2** | **Adapt: two full flows** | "Does the page actually become usable?" | **Built now** |
| 3 | Measure: study console | "Is personalisation better than a fixed accessible UI?" | Later (Stage 2) |
| 4 | Learn: closed loop | "Does STEADY keep fitting as the hand changes?" | Later (Stage 3) |

- MVP 1 + 2 already run the **three-condition comparison** on one machine, with local metrics and CSV export. The study doesn't wait for MVP 3.
- MVP 3 scales the study (remote, live, many sessions). MVP 4 makes the system improve itself.

---

## 3. MVP 1 — Calibrate & Recommend (built now)

**Key message:** 60 seconds in, an explained profile out.

**User stories**
- As a user, I can do a short, friendly exercise (or skip it) and see which settings STEADY picked, and why, in plain words.
- As a user, I can override any setting and save a profile for each device ("Laptop trackpad").
- As a researcher, I can see the raw features behind the profile.

**Scope**
- The three calibration moments: Tap the dots, Hold steady, Move it.
- Feature extraction using coalesced pointer events.
- A Bayesian σ estimator with a population prior.
- The policy tree, stored as JSON.
- Explanation strings and overrides.
- Storage in `localStorage` and `chrome.storage`.

**Acceptance criteria**
- [ ] Finishes in ≤ 60 s; every step is skippable; skipping all three still yields a valid profile.
- [ ] The recommended target size increases **monotonically** with synthetic scatter (unit test).
- [ ] Repeat calibrations by the same person on the same day land within ±1 size level (pilot check).
- [ ] Every setting shows a human-readable reason.

---

## 4. MVP 2 — Adapt: two full flows (built now)

**Key message:** Two real tasks, three conditions, nothing moves under your hand.

**Flow A — Book an appointment:** a native date input, small time-slot buttons, a reminder slider and a submit button.
**Flow B — Plan the medicine week:** drag four medicines into Morning / Midday / Evening / Night.

**Scope**
- Date input → day list.
- Range slider → stepper.
- HTML5 drag-and-drop → pick, then place, with drop zones found by a listener hook.
- Target size and gap from the profile.
- Slip guard and ignore-repeat.
- Final-action confirm.
- The STEADY panel: Original / Fixed / Personal, "Steadier today", "Show original".
- A condition switcher, local metrics, a BroadcastChannel facilitator view, and CSV export.
- Packaged as a Chrome MV3 extension that applies the same engine to other pages.

**Acceptance criteria**
- [ ] Both flows can be completed **with clicks only**: no drag, no precise thumb.
- [ ] The site's own logic receives the correct values (the form summary matches).
- [ ] No layout shift after the first interaction.
- [ ] Every STEADY control is ≥ the profile's target size, keyboard-operable and focus-visible.
- [ ] Metrics log misses, wrong values, slips, repeats, failed drags and time; the CSV exports.

---

## 5. What the mid-way demo shows, and what it doesn't

**Key message:** We say exactly what is real today.

| Real and working | Simplified or stubbed | Not yet |
|---|---|---|
| Calibration → features → profile with reasons | The policy tree uses our own starting thresholds, not trained ones | A trained model (needs pilot data and a dataset) |
| Steady really rewrites real HTML controls and passes values back | The two task sites (clinic, pillbox) are pages we built for testing, not real websites | Testing the extension on real third-party sites |
| Unit tests and scripted browser runs | The "example hands" on the demo page are synthetic, and their numbers were chosen to show the range | Any real-user data or dataset |
| WCAG 2.2 sizes used as the floor | — | A WCAG audit of Steady's own UI (not run yet) |
| Four transformations on two flows | Drop-zone detection covers HTML5 drag-and-drop only | Pointer-event drag libraries, canvas widgets |
| Three conditions and live counts on the same machine | The facilitator view is local (BroadcastChannel) | Remote SSE console |
| Extension injects the engine into pages | Profile sync is through the extension's own storage | Chrome Web Store build, auto-update |
| Unit tests for the estimator and policy | — | User study results (no participants yet) |

---

## 6. MVP 3 — Measure (later, Stage 2)

**Key message:** Run the comparative study at scale, live, without spreadsheets.

**Scope**
- An ingest API: `POST /v1/events`, batched and idempotent; `sendBeacon` on page hide.
- A study console:
  - Participant roster and Latin-square order generator.
  - Live session view over **SSE**, resuming with `Last-Event-ID`.
  - Facilitator buttons: assisted, skip, note.
- Analysis pipeline: an R `lme4` script with GLMM, LMM and planned contrasts; plots; a CSV/Parquet export.
- Screen-cost capture: page height and scroll distance.

**Stack:** Node + Hono, SQLite (Postgres if multi-site), the same event schema as MVP 2.

**Exit criteria:** a full study session runs from the console, the dashboard survives a Wi-Fi drop without losing events, and the analysis script reproduces the tables from raw events.

---

## 7. MVP 4 — Learn (later, Stage 3): closing the loop

**Key message:** STEADY keeps fitting as the hand changes, and the model improves from evidence.

**Scope**
- **Passive recalibration:** estimate σ from everyday clicks, filtered to deliberate movements (after Gajos et al., CHI 2012). Updates are proposed, never imposed ("Today looks harder. Use steadier settings?").
- **Automatic good-day / hard-day profiles,** learned from time-of-day patterns. The user confirms.
- **Training:** a scikit-learn tree trained on pilot plus study data, labelled with the best technique per participant, cross-validated by participant, and exported to the same JSON.
- **Webhooks:** `session.completed` triggers analysis and retraining; `model.published` sends a signed model manifest that extensions fetch with `chrome.alarms` + ETag.
- **Library adapters:** react-datepicker, MUI, dnd-kit (keyboard sensor), SortableJS.

**Exit criteria:** the trained policy beats the literature thresholds on held-out participants, and nothing changes for a user without their explicit "yes".

---

## 8. Timeline

| Stage | Weeks (A) | Output |
|---|---|---|
| **Now** | Mid-way demo | MVP 1 + 2 working; Implementation + plan decks |
| **Stage 1: Validate** | 1–3 | Survey (15+) and 6 interviews; ethics submission; hardened MVP 1 + 2; pilot with 2–3 people |
| **Stage 2: Measure** | 4–6 | MVP 3; main study (target n = 12–16) |
| **Stage 3: Learn** | 7–10 | Analysis and write-up; MVP 4; trained policy; real-site adapters |

**Visual:** A Gantt chart with four lanes (Research, Engine, ML, Study) and a diamond milestone at the ethics approval.
**Say:** Ethics approval is the critical path. Submit in week 1, or the study slips.

---

## 9. Team of four: roles

| Role | Owns | Also helps with |
|---|---|---|
| **1. ML & calibration lead** | MVP 1: features, estimator, policy, training (MVP 4) | Analysis scripts |
| **2. Engine & extension lead** | MVP 2: transformations, hook, extension, adapters | MVP 3 ingest |
| **3. Design & research lead** | Survey, interviews, personas, the design system, accessibility audit | Calibration copy and flows |
| **4. Study & evaluation lead** | Protocol, ethics, recruitment, MVP 3 console, statistics | Demo flows |

**Rule:** every feature has one owner and one reviewer from a different role.

---

## 10. Stage 1, week by week

| Week | Research | Build | Study |
|---|---|---|---|
| 1 | Survey live; recruit interviewees | Fix demo feedback; per-device profiles | Ethics application submitted |
| 2 | 6 interviews; rewrite personas | Calibration test-retest check; slip-guard tuning | Protocol and consent forms (large print) |
| 3 | Synthesise; adjust the design | Accessibility audit (WCAG 2.2) and fixes; tests | Pilot with 2–3 participants |

---

## 11. User research plan

**Key message:** Real users shape the design before it is frozen.

- **Recruitment:** movement-disorder clinics, Parkinson's support groups, essential-tremor communities, and family networks. Always with consent, never cold-messaged through health records.
- **Survey:** Implementation.md, Appendix A. Accessible online form: large text, one question per screen, no time limit. A phone or read-aloud option is offered.
- **Interviews and observation:** Appendix B. In person or remote, 30 minutes, with compensation for their time.
- **Synthesis:** an affinity map of needs → confirm or kill H-U1 to H-U5 → update personas and the needs-to-features table.
- **Ethics:** institutional approval before any data collection; consent recorded; the right to stop at any time; contact details stored separately from answers.

---

## 12. Study session script (45 min)

| Min | Step |
|---|---|
| 0–5 | Welcome, consent, medication timing, on/off self-rating |
| 5–8 | Calibration (MVP 1), which also serves as warm-up |
| 8–10 | Practice run (Original condition, a different task) |
| 10–35 | Three conditions × two flows in Latin-square order; SEQ after each task; NASA-RTLX after each condition; a break offered |
| 35–40 | Preference ranking, "I felt in control", open comments |
| 40–45 | Debrief, compensation, delete-data option explained |

---

## 13. Quality gates (definition of done)

- **Tests:** unit tests on the estimator and policy (`node --test`); a synthetic-scatter monotonicity test; a manual test script for each flow and condition.
- **Accessibility:** WCAG 2.2 AA automated scan plus manual keyboard and screen-reader checks of STEADY's controls.
- **Steadiness:** no layout shift after the first interaction (measured with `PerformanceObserver` for `layout-shift`).
- **Performance:** engine under 30 KB unminified, adaptation done in under 50 ms on a typical page.
- **Privacy:** no network requests outside study mode (verified in the DevTools network panel).

---

## 14. Risk register

| Risk | Owner | Trigger | Response |
|---|---|---|---|
| Ethics approval delayed | Study lead | No decision by week 3 | Run engineering-only pilots with team members; label them as non-user data |
| Recruitment below 12 | Research lead | Fewer than 8 confirmed by week 4 | Add remote sessions; report as a pilot with effect sizes |
| Host sites break with synthetic events | Engine lead | Support-matrix test fails | Adapter registry; narrow the support claim |
| Profile identical to fixed for many users | ML lead | Pilot σ mostly under 6 px | Stratify by severity; emphasise screen cost |
| Team bandwidth | All | A sprint goal slips twice | Cut MVP 4 adapters first, never the study |

---

## 15. Demo script (3 minutes)

1. **The problem (20 s):** open `demo.html`. The left side is the clinic page as published: a tiny calendar, 24 px time slots and a thin slider.
2. **Calibrate (40 s):** run Tap the dots → Hold steady → Move it. The bubble settles, and the reasons appear.
3. **Adapt (60 s):** back in `demo.html`, switch Hand to "Your calibration", then flip Precise → Moderate → Strong. The right side refits 44 → 72 → 120 px. A precise hand gets *no* swaps, which is the giant-button problem avoided. Book an appointment on the right, then *Plan the week* with pick-then-place.
4. **Control (20 s):** toggle "Steadier today" and "Show original".
5. **Measure (30 s):** the facilitator window has been counting misses and time live the whole way; export the CSV.
6. **Close (10 s):** MVP 3 + 4 close the loop.

---

## 16. Decisions needed from the team

- [ ] The study region, which decides the ethics body and the law (DPDP or GDPR).
- [ ] The real stage deadlines, so the week numbers in slide 8 can be updated.
- [ ] A clinic or support-group partner for recruitment.
- [ ] Whether severity is rated by a clinician (MDS-UPDRS) or self-reported only.

---

# Appendix

## A. Repository layout (as built)

```
steady/
  PRODUCT.md  Implementation.md  plan.md  README.md
  app/                     ← open index.html, or "Load unpacked" as a Chrome extension
    manifest.json          MV3: hook (MAIN, document_start), bridge (isolated), engine (MAIN)
    index.html             hub: condition switcher, profile summary, sessions export
    calibrate.html         MVP 1 (with a click-scatter chart at actual size)
    demo.html              side by side: Original | Steady, with example hands
    book.html              MVP 2, Flow A
    week.html              MVP 2, Flow B
    facilitator.html       live counts over BroadcastChannel
    css/steady.css         design system (parametric tokens)
    css/site.css           the "ordinary website" look of the host pages
    js/core.js             features, estimator, policy tree, profile storage (also loads in Node)
    js/hook.js             marks drop zones by wrapping addEventListener
    js/adapt.js            transformations, slip guard, ignore-repeat, confirm, panel
    js/metrics.js          event log, BroadcastChannel, CSV export
    js/calibrate.js        calibration UI
    js/bridge.js           extension: chrome.storage → page
  tests/core.test.js       node --test
```

## B. Backlog (epics → next stories)

- **E1 Calibration:** per-device profiles UI · test-retest check · trackpad-specific copy
- **E2 Engine:** custom-calendar adapters · `role=slider` support · undo stack for pick-then-place
- **E3 Study:** Latin-square generator · screen-cost capture · RTLX form
- **E4 Platform (MVP 3):** ingest API · SSE console · R analysis
- **E5 Loop (MVP 4):** passive σ estimator · webhook bus · trained-policy export · model manifest
