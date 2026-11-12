# STEADY — Implementation

> **How to turn this into slides:** each `##` heading is one slide. Under it, **Key message** is the slide's headline, the bullets or table are the body, **Visual** says what to draw, and **Say** is the speaker notes. Slides are separated by `---`, so this file also renders as-is in Marp or Slidev. Everything after "Appendix" is backup material.
>
> **Status (12 Nov 2026):** research below is secondary, from published studies. No user survey has been run yet; Appendix A is the survey to run. Anything marked **(A)** is an assumption to validate.

---

## 1. STEADY — the interface adjusts to your hand

**Key message:** Software that sizes web controls to one person's hand, so small buttons, calendars and drag-and-drop stop being a test of steadiness.

- A 60-second, optional exercise measures how precisely you point and click.
- A light, on-device model turns that into control size, spacing and selection technique.
- Supported pages change before you start, then stay still while you work.

**Visual:** Wordmark plus a spirit-level bubble settling to centre.
**Say:** Theme 4 — AI behind the scenes that improves interaction. The user never sees a model, only a page that fits.

---

## 2. The problem

**Key message:** The web assumes a steady hand. Millions of people don't have one.

- Over **8.5 million** people lived with Parkinson's disease in 2019, and prevalence has doubled in 25 years (WHO).
- Essential tremor affects about **0.9%** of people of all ages and **4.6%** of people over 65 (Louis & Ferreira, 2010).
- Everyday web tasks rely on the hardest movements: 24 px calendar cells, thin slider thumbs, press-hold-drag, and clicks that slip as the button goes down.
- The result is wrong dates, failed drags and abandoned tasks, which often means asking family for help and losing independence.

**Visual:** A real date picker at 1:1 scale, with a 4 mm tremor envelope drawn around the pointer.
**Say:** The difficulty is not only reaching the target. It is staying on it during the click, and controlling the release.

---

## 3. What research already tells us about these users

**Key message:** The evidence points beyond "make buttons bigger": click slips, repeats, drags and day-to-day variation matter as much as size.

| Source | Finding | What STEADY does with it |
|---|---|---|
| Keates & Trewin, ASSETS 2005 | People with PD point differently from age-matched peers; a secondary summary reports more pausing just before the click (check against the paper) | Slip guard; no time limits |
| Trewin, Keates & Moffatt, ASSETS 2006 (Steady Clicks) | Freezing the cursor during a click meant significantly fewer attempts, but individuals differed widely in who benefited | Personalise the *technique*, not just the size |
| Hurst, Mankoff & Hudson, ASSETS 2008 | Pointing performance varies widely within and across sessions (from a secondary summary) | "Steadier today" switch now; passive recalibration later |
| Gajos, Wobbrock & Weld, CHI 2008 (SUPPLE++) | Ability-based generated interfaces: motor-impaired users were **26.4% faster** and strongly preferred them | Prior evidence that personalisation pays |
| Begnum & Begnum, UAIS 2012 | Mice are particularly problematic for people with PD; off-the-shelf peripherals helped many | Separate profiles per device |
| Nunes et al., UAIS 2016 (39 people with PD) | Tested tap, multi-tap, swipe and drag; produced 12 UI guidelines | Drag and multi-step gestures need alternatives |
| Gajos et al., *Movement Disorders* 2020 | 32 mouse-trajectory features detect parkinsonism or ataxia (sensitivity ≥ 0.91) | Pointing data is health data, so keep it on the device |
| Axess Lab, "giant-button problem" | Ever-bigger buttons cost overview and scrolling; spacing matters | Right-size per person instead of maxing out |
| WCAG 2.2 — 2.5.8, 2.5.5, 2.5.7 | 24 px minimum (AA), 44 px enhanced (AAA), single-pointer alternative to dragging (AA) | 44 px floor; every drag gets a no-drag path |

**Visual:** This table, with the right-hand column highlighted.
**Say:** Each row closes a design question. We did not invent these needs, and we will re-check them with our own users.

---

## 4. Our user research: what we know vs what we'll ask

**Key message:** We start from published evidence and validate it with our own users in week 1, before the design is locked.

- **Survey** (Appendix A): 15+ respondents with PD or essential tremor, through support groups and clinics. Covers devices, the widgets that hurt most, time-of-day variation, workarounds, and attitudes to automatic adaptation.
- **Interviews and observation** (Appendix B): 6 people, 30 minutes each. Watch them book something real on a site they already use.
- **Hypotheses to confirm or kill:**
  - **H-U1 (A):** Calendars and drag-and-drop are the top two pain points.
  - **H-U2 (A):** Ability varies noticeably within a day, tied to medication timing.
  - **H-U3 (A):** Users accept automatic changes only if they can see and undo them.
  - **H-U4 (A):** "Tremor mode" style labelling is unwelcome.
  - **H-U5 (A):** Trackpad users struggle more with clicks than mouse users do.
- Results replace every (A) in this deck, and any persona that doesn't survive contact with real users gets rewritten.

**Visual:** Two columns: "What literature says" → "What we'll check".
**Say:** We're honest that no user has been surveyed yet. This is the plan and the instrument.

---

## 5. Who we design with — provisional personas

**Key message:** Three different hands, three different settings from the same system.

| | **Meera, 67** | **Arjun, 52** | **Rosa, 74** |
|---|---|---|---|
| Condition | PD, resting tremor in the right hand | Essential tremor, worse when reaching | PD with slowness; accurate but deliberate |
| Device | Laptop trackpad | Office mouse | Desktop mouse |
| Hard task | Booking her neurology follow-up online | Drag-and-drop in work tools | Accidental double clicks; gets lost when a layout shifts |
| Fluctuation | Worse late afternoon (medication wearing off) **(A)** | Worse under stress or caffeine **(A)** | Fatigue after 20 minutes **(A)** |
| Wants | To book it herself, without calling her son | Not to look slow, and no "disabled" labels | Predictability, nothing jumping |
| STEADY gives | 72 px targets, slip guard, day list | Pick-then-place, 56 px targets | Ignore-repeat window, final-action confirm |

**Visual:** Three portrait cards (illustrated, not stock photos) with the same page rendered at their three settings.
**Say:** These are hypotheses built from the literature, not real people. Week-1 interviews rewrite them.

---

## 6. How STEADY caters to each need

**Key message:** Every feature traces back to a user need. Nothing is there for show.

| User need | STEADY response | Where |
|---|---|---|
| The click slips as the button goes down | **Slip guard:** the target is locked at press, so a small slip still counts | MVP 2 |
| Accidental double or repeated activations | **Ignore-repeat** window (300–600 ms, personalised) | MVP 2 |
| Tiny calendar cells | **Date becomes a list** of large day buttons ("Fri 20 Nov") | MVP 2 |
| Thin slider thumbs | **Slider becomes a stepper:** − / + buttons and preset chips | MVP 2 |
| Press, hold and drag | **Pick, then place:** click the item, then click where it goes | MVP 2 |
| Layout surprises | Adapt once, before the task; nothing reflows while you work | MVP 2 |
| Bad days and medication cycles | **"Steadier today"**: one tap moves everything up a level | MVP 2 (manual), MVP 4 (automatic) |
| Fear of irreversible mistakes | Final-action confirm placed away from the pointer, plus undo | MVP 2 |
| Stigma | Neutral language: "Steady settings", never "tremor mode" | All |
| Fatigue | Calibration ≤ 60 s, skippable at every step | MVP 1 |

**Visual:** Need → response arrows; each response has a small before/after thumbnail.

---

## 7. Prior art, and where STEADY sits

**Key message:** Most help changes the cursor or the OS. STEADY changes the targets on the real web, sized to one person.

- **Pointer-side** (changes the cursor): tremor-filtering drivers such as SteadyMouse; Angle Mouse (Wobbrock et al., CHI 2009); Bubble Cursor (Grossman & Balakrishnan, CHI 2005); Steady Clicks.
- **OS-level settings:** iOS Touch Accommodations (hold duration, ignore repeat) and Windows ClickLock. These are global and know nothing about the widget under the pointer.
- **Generated UIs:** SUPPLE / SUPPLE++ (Gajos et al.) produce whole interfaces from abstract specifications, so they cannot retrofit an existing website.
- **Browser add-ons:** SteadySync (its store listing claims hit-area expansion and click snapping; unverified); PINATA (2018, adaptive bubble cursor).
- **STEADY:** target-side changes plus technique substitution, on existing pages, personalised, and measured against a fixed accessible baseline.
- **The deliberate difference:** we don't *snap* clicks to a guessed target, because a wrong guess is a wrong action. We make misses land in gaps, where they do nothing.

**Visual:** A 2×2 grid. X-axis: pointer-side ↔ target-side. Y-axis: one-size ↔ personalised. STEADY sits alone in the target-side, personalised corner.
**Say:** SUPPLE showed that personalisation works. STEADY brings it to pages we don't control.

---

## 8. Gaps in the original idea, and how we close them (1/2)

**Key message:** The proposal is sound. Twelve gaps would have hurt it in review; here is the fix for each.

| # | Gap | Fix |
|---|---|---|
| G1 | No prior-art positioning (SUPPLE, Steady Clicks) | Slide 7: target-side, existing pages, no snapping |
| G2 | A one-time calibration ignores day-to-day change (medication on/off, fatigue) | "Steadier today" now; passive in-situ recalibration in MVP 4 (Gajos et al., CHI 2012) |
| G3 | "Optional" calibration has no fallback | Population prior plus the fixed preset; the model updates as data arrives |
| G4 | "Supported web pages" is undefined | Support matrix: native date and range inputs, HTML5 drag-and-drop (found with a listener hook), buttons, links and labels. Library adapters come later |
| G5 | Transformed controls must drive the site's own logic | Native value setter plus `input`/`change` events (safe with React); a full synthetic DragEvent sequence. The `isTrusted=false` limits are documented |
| G6 | No training data for the "ML model" | An interpretable statistical core, plus a JSON decision tree that is retrained on pilot data. Synthetic tremor is used only in tests |

---

## 9. Gaps in the original idea, and how we close them (2/2)

| # | Gap | Fix |
|---|---|---|
| G7 | Adapting size alone misses click slips and repeats | The "selection technique" output includes slip guard, ignore-repeat and confirm |
| G8 | The evaluation is underspecified: metric definitions, order effects, sample size, medication state, ethics | Slides 22–23: operational definitions, Latin square, power estimate, medication log, ethics approval first |
| G9 | Pointing features can detect parkinsonism, so this is health data | On-device by default, no raw traces leave, and study logging is opt-in and pseudonymous |
| G10 | Browsers report trackpads and mice both as `pointerType = "mouse"` | The user names a profile per device |
| G11 | The fixed accessible baseline may already be "good enough" on errors | Also measure **screen cost** (page height, scrolling): personalisation's value is right-sizing |
| G12 | Disability simulation misleads | Synthetic tremor is an engineering test tool only, never presented as user evidence |

**Visual:** A gap → fix ladder; colour the ones closed in MVP 1–2 versus later.
**Say:** G2, G5 and G8 are the ones a judge or reviewer would catch first.

---

## 10. Solution overview — the STEADY loop

**Key message:** Calibrate, recommend, adapt, measure, learn. The first two MVPs make the loop work for one person today; the last two close it.

```
   ┌──────────── MVP 1 ────────────┐   ┌──── MVP 2 ────┐
   Calibrate  ──►  Recommend  ──►  Adapt the page
       ▲                                   │
       │                                   ▼
     Learn  ◄──────────────────────  Measure
   └─ MVP 4 ─┘                     └─ MVP 3 ─┘
```

- **MVP 1 — Calibrate and recommend:** the exercise, the model and an explained profile.
- **MVP 2 — Adapt:** the engine on two full task flows, three study conditions, and local metrics.
- **MVP 3 — Measure (later):** a study console, live SSE dashboard, telemetry ingest and the analysis pipeline.
- **MVP 4 — Learn (later):** passive recalibration, webhook-driven retraining and model updates.

---

## 11. The calibration exercise (≤ 60 s, optional)

**Key message:** Three short moments, no scores, and you can skip any of them.

| Moment | What the user does | What we measure |
|---|---|---|
| **Tap the dots** (~30 s) | Click 14 dots that appear around a ring, ISO 9241-9 style | Endpoint scatter σ (px), slip distance between press and release, repeated presses, movement time |
| **Hold steady** (~5 s) | Rest the pointer in a circle | Tremor amplitude (detrended RMS) and dominant frequency (DFT over 2–15 Hz) |
| **Move it** (~15 s) | Drag a card into a box, twice | Drag failures (early release), drag time |

- Uses `PointerEvent.getCoalescedEvents()`, which delivers every pointer sample between frames, not just one per frame.
- Measures in CSS px in the same page context as the targets, so the result stays consistent at whatever zoom the user has set.
- Copy is friendly and plain: "Let's see how your mouse feels today."

**Visual:** Three panels of the real calibration screens.

---

## 12. The model: from movement to settings

**Key message:** A small, explainable model that fits in about 10 KB and runs entirely in the browser.

```
pointer samples ─► features ─► estimator (σ, slip, tremor) ─► policy ─► profile
                   (12)        Bayesian shrinkage           tree        size, gap, technique
```

- **Features (12):** endpoint σ, σ along and across the movement axis, slip p50 and p90, repeat-press rate, movement time, tremor RMS, tremor Hz, drag-failure rate, drag time, trial count.
- **Estimator:** σ² is shrunk toward a population prior (σ₀ = 6 px, weighted as 4 virtual trials; **both values are our assumption**, to be re-estimated from pilot data). That keeps a 10-tap calibration stable, and it means a skipped calibration still yields a sensible profile.
- **Policy:** a decision tree stored as JSON. **Today its thresholds are our own starting guesses.** The literature supports the *techniques* (slip guard, ignore-repeat, pick-then-place), not these exact numbers. After the pilot they are *trained* (scikit-learn, exported to the same JSON), and the inference code doesn't change.
- **Why not deep learning:** the dataset is a few dozen people, the user deserves an explanation, and the model must run offline inside any page.

**Visual:** A pipeline diagram; the policy box is labelled "replaceable by a trained model".

---

## 13. How sizes are computed (explainable)

**Key message:** The target size comes from the user's own scatter, and the gaps catch the misses.

- **Target size:** W = 2 · 2.24 · σ + slip margin. A per-axis z of 2.24 gives about a **95% chance of a hit in 2-D**. The result snaps to five levels: **44 · 56 · 72 · 96 · 120 px**, with 44 px (WCAG 2.5.5 AAA) as the floor.
- **Gap:** G = max(8, σ). For a miss to hit a neighbour it must overshoot by 3.24σ, which happens **under 0.1%** of the time. Misses land in the gap and do nothing.
- **Example:**

| σ (scatter) | Slip p90 | Target | Gap | Plain-language explanation shown to the user |
|---|---|---|---|---|
| 3 px | 1 px | 44 px | 8 px | "Your clicks are precise. Standard large buttons." |
| 9 px | 4 px | 56 px | 9 px | "Your clicks land within about 9 px." |
| 14 px | 7 px | 72 px | 14 px | "Buttons 72 px, with 14 px gaps so near-misses do nothing." |
| 22 px | 12 px | 120 px | 22 px | "Largest size, step-by-step choices." |

**Visual:** A target with a scatter cloud of clicks; the 95% ellipse fits inside the target and the gap catches the tail.
**Say:** This rests on Fitts' law and effective width, the standard way HCI turns endpoint spread into target size. That is why we can explain every number.

---

## 14. Technique policy (the replaceable model)

**Key message:** Size isn't everything. The model also picks *how* you select.

| Output | Rule today (our starting guesses, untrained) | Trained after the pilot on |
|---|---|---|
| `slipGuard` | slip p90 > 5 px | The technique each participant did best with |
| `ignoreRepeatMs` | repeat rate > 0 → 400 ms (600 if ≥ 15%) | Repeat errors per condition |
| `dragMode: pick` | drag failure > 0 **or** σ > 8 **or** tremor RMS > 2 px | Drag success by mode |
| `dateMode: list` | target ≥ 56 **or** σ > 6 | Date errors by mode |
| `sliderMode: stepper` | tremor RMS > 1.5 **or** σ > 6 | Slider overshoot |
| `confirmFinal` | repeat rate > 0 **or** slip p90 > 8 **or** target ≥ 72 | Unintended submits |

- **"Steadier today"** moves the target one level up, adds 4 px of gap, and turns on slip guard and confirm.
- **Fixed accessible preset**, the study baseline: 44 px targets, 8 px gaps, the same widget swaps, standard clicks.

---

## 15. The adaptation engine: four transformations

**Key message:** Each swap keeps the site's own control as the source of truth, so the site keeps working.

| Original control | STEADY control | How it stays wired to the site |
|---|---|---|
| `<input type="date">` with a tiny popup calendar | **Day list:** 14 large day buttons, a week pager, and "Today/Tomorrow" first | Native value setter → `input` + `change` events (works with React's value tracking) |
| `<input type="range">` with a thin thumb | **Stepper:** − / + buttons, value readout, preset chips | Same: set the value, then fire `input` + `change` |
| HTML5 drag-and-drop | **Pick, then place:** click the item, the destinations become big targets, click one, and Esc cancels | A synthetic `dragstart → dragenter → dragover → drop → dragend` sequence with a real `DataTransfer` |
| Buttons, links, radio labels | **Size and gap** from the profile | Injected CSS sets the minimum size and gaps, once, before the task |

- **Finding drop zones on any page:** a tiny main-world hook wraps `addEventListener` and marks every element that registers a `drop` listener.
- **Limits, stated honestly:** pointer-event drag libraries (dnd-kit, SortableJS), canvas widgets and pages that check `isTrusted` need adapters, which come later.

**Visual:** Four before/after pairs from the demo.

---

## 16. Staying steady, staying in control

**Key message:** STEADY never surprises the user's hand.

- **Adapt once:** the transformations apply at page load (or when the user taps "Apply"), never mid-task. No layout shift after the first interaction.
- **Nothing animates under the pointer.** Feedback is a change of fill or a label, never movement.
- **The user is in charge:** a STEADY panel with Original / Steady, "Steadier today", "Show original control", and links to recalibrate.
- **The final action is the user's:** the confirm bar shows what will happen ("Book Fri 20 Nov, 10:30"). It appears away from the pointer after a short guard, so a repeat click can't confirm by accident.
- **Undo:** every pick-and-place can be undone, and the original control is one tap away.
- **Accessible itself:** keyboard operable, visible focus, `prefers-reduced-motion` respected, and labels announced to screen readers through `aria-live`.

---

## 17. System architecture

**Key message:** MVP 1 and 2 need no server at all; the cloud only appears for the research loop.

```
 NOW (on-device)                                        LATER
 ┌──────────────┐  profile   ┌──────────────────────┐
 │ Calibrate    │──────────►│ localStorage /       │
 │ (MVP 1)      │            │ chrome.storage.local │
 └──────────────┘            └─────────┬────────────┘
                                       │ dataset + CustomEvent
 ┌──────────── host web page ──────────▼────────────┐
 │ hook.js (MAIN world, document_start)              │
 │ adapt.js  ─ date / slider / drag / targets        │
 │ metrics.js ─ attempts, misses, time               │──► POST batches ─► Ingest API (MVP 3)
 └──────────────┬────────────────────────────────────┘                    │
                │ BroadcastChannel                                         ├─► SSE ─► Study console
                ▼                                                          └─► Webhooks ─► retrain (MVP 4)
       Facilitator view (same machine)
```

---

## 18. Tech stack, and why

| Layer | Choice | Why | Rejected |
|---|---|---|---|
| Engine | Vanilla JS (ES2020), no build, no dependencies | Runs inside any page without clashing with the host's framework; opens straight from a folder | React inside the engine: host conflicts and bundle weight |
| Delivery | Chrome MV3 extension: MAIN-world content scripts plus an isolated bridge | "Software only, ordinary computer"; the MAIN world is needed to hook listeners and set React-controlled values | Bookmarklet (no persistence, blocked by CSP); proxy (breaks HTTPS) |
| Model | Statistical estimator plus JSON tree, inference in JS; training in Python (scikit-learn) | About 10 KB, explainable, offline | TF.js or ONNX Runtime Web: megabytes, opaque |
| Profile storage | `chrome.storage.local` / `localStorage` | Health-adjacent data stays on the device | Cloud accounts |
| Live view (now) | BroadcastChannel | Zero server for same-machine lab sessions | — |
| Server (later) | Node + Hono; SQLite, then Postgres for multiple sites | Small, built-in SSE helper, shared JS schemas | A heavier framework |
| Analysis (later) | R `lme4` (or Python `statsmodels`) | Mixed-effects models for repeated measures | Plain t-tests (wrong for this design) |
| Type | Atkinson Hyperlegible Next, Literata | Legibility research plus warmth (slide 21) | Inter, Roboto, system UI |

---

## 19. Webhooks vs SSE vs WebSockets vs polling

**Key message:** Pick the channel by the direction and frequency of the data, not by habit.

| | **Webhooks** | **SSE** (Server-Sent Events) | **WebSockets** | **Polling** (with ETag) | **BroadcastChannel** |
|---|---|---|---|---|---|
| Direction | Server → server | Server → browser | Both ways | Client pulls | Tab ↔ tab, same origin |
| Transport | HTTPS POST per event | One long HTTP response (`text/event-stream`) | Upgraded TCP connection | Repeated GET | In-browser, no network |
| Reconnect and resume | The sender retries; the receiver must be idempotent | **Built in:** auto-reconnect plus `Last-Event-ID` | You build it | Not needed | Not needed |
| Proxies and firewalls | Fine | Fine (plain HTTP) | Sometimes blocked on hospital and university networks | Fine | N/A |
| Infrastructure cost | Low | Low | Higher (stateful) | Lowest | None |
| Best for | Pipeline triggers | Live dashboards | Co-editing, remote control | Rare updates | Same-machine live view |
| Weak at | Browsers can't receive them | Client → server traffic | Simple one-way feeds | Real time | Crossing devices |

**Say:** Most of STEADY's traffic is one-way, so SSE and webhooks beat WebSockets. And an MV3 extension service worker is killed after about 30 s idle, so it can't hold an SSE stream either.

---

## 20. Which task uses which channel

| Task | Channel | Why | MVP |
|---|---|---|---|
| Content script ↔ extension, profile sync across tabs | `chrome.runtime` messaging + `chrome.storage.onChanged` | No network needed | 2 |
| Profile handoff, isolated world → MAIN world | DOM `dataset` + `CustomEvent` | The two worlds share only the DOM | 2 |
| Facilitator live view on the same laptop | **BroadcastChannel** | No server, instant | 2 |
| Study telemetry upload | HTTPS POST batches; `navigator.sendBeacon` on `pagehide`; idempotent event IDs | Survives tab closes; no double counting | 3 |
| Remote researcher dashboard | **SSE** with `Last-Event-ID` | One-way, resumes after network drops, works through institutional proxies | 3 |
| Facilitator marks "assisted" or "skip" | Plain POST | Rare request/response | 3 |
| Session completed → analysis, retraining, Slack note | **Webhooks**, HMAC-SHA256 signed, retries with backoff, idempotency key | Event-driven, server-to-server | 4 |
| New model reaches installed extensions | `chrome.alarms` + conditional GET of a signed manifest (ETag) | The MV3 worker can't keep a stream open; updates are daily, not real time | 4 |
| Remote caregiver co-pilot (future) | **WebSocket** | The only case needing two-way, low-latency traffic | — |

---

## 21. Data, privacy and safety

**Key message:** Your hand's data stays on your computer.

- **Stored by default:** a profile of about 12 numbers plus the settings. No raw pointer traces are kept after calibration.
- **Study mode** is opt-in, per session, with pseudonymous participant IDs (P01…), and the user can see what is logged.
- **Legal footing:** pointing features can reveal a neurological condition (Gajos et al., 2020), so we treat them as health data: explicit consent under India's DPDP Act 2023 and GDPR Art. 9 (special category), whichever applies **(A: study region to confirm)**.
- **No medical claims:** STEADY never says "you may have Parkinson's", and the tremor features are not shown as a diagnosis. It is not a medical device.
- **"Delete everything"** sits in the panel; one tap clears the profile and logs.

---

## 22. Design direction

**Key message:** Calm, legible, dignified, with one dial: your hand.

- **Mode:** Operate. The user is completing a task, so scanability beats expression.
- **Use scene:** home, daylight, laptop, often reading glasses. A warm light theme, because the choice follows the scene, not the category.
- **Principles:** nothing moves under your hand · misses are harmless · say what happens before it happens · never rely on hover or speed · dignified language.
- **Type:**
  - **Atkinson Hyperlegible Next** for UI and body. The Braille Institute designed it so easily confused letterforms (Il1, O0) stay distinct, and it has seven weights. Base size 20 px, controls at least 20 px.
  - **Literata** for headings: warm, bookish and calm, with optical sizes.
  - **Atkinson Hyperlegible Mono** for numbers and measurements.
- **Colour:** warm paper and deep ink (body text at AAA 7:1), a spruce-green action colour, and amber for "picked". State never relies on colour alone: every state also has a label and an icon.
- **Parametric tokens:** `--steady-target` and `--steady-gap` come straight from the profile. The design system has one dial.
- **Motion:** one authored moment. When the profile is ready, the level bubble settles to centre. Nothing else moves, and `prefers-reduced-motion` removes even that.

**Visual:** Type specimen, colour chips with contrast ratios, the same button at 44 / 72 / 120.

---

## 23. Evaluation methodology — study design

**Key message:** A within-subjects comparison isolates the value of *personalisation*, not just of accessibility.

- **Conditions (3):**
  1. **Original:** the unmodified page.
  2. **Fixed accessible:** STEADY's swaps at one-size settings (44 px, 8 px, standard click).
  3. **Personalised:** the same swaps at the user's own profile and technique.
- **Flows (2):** *Book an appointment* (date, time slot, reminder slider, confirm) and *Plan the medicine week* (drag four medicines into time slots).
- **Order:** conditions counterbalanced with a Latin square; three matched task variants (different dates and medicines) so nobody repeats the same answers; one practice run.
- **Participants:** roughly **12** for a large effect (f = 0.40) or **28** for a medium one (f = 0.25). These are typical G\*Power repeated-measures figures (α = .05, power = .80, 3 levels, r = .5), **not yet computed for this design**. Run the calculation properly once pilot variance is known.
- **Inclusion:** self-reported PD or essential tremor, weekly computer use, consent. Record **time since last dose** and a self-rated on/off state, and schedule sessions in the "on" period.
- **Session:** up to 45 minutes, with breaks offered between conditions and a large-print or read-aloud consent form. **No data is collected before ethics approval.**

---

## 24. Measures and analysis

| Measure | Operational definition |
|---|---|
| **Incorrect selection attempts** (primary) | Count per task of: a **miss** (click on no interactive element in the task area), a **wrong value** (a date, time, reminder or slot other than the instructed one), a **slip** (press and release on different targets), a **repeat** (a second activation within 300 ms), a **failed drag** (released outside any drop zone) |
| **Independent completion** | The task reaches confirmation without facilitator help, within 4 minutes |
| **Completion time** | First interaction → confirmed submit (s) |
| **Screen cost** | Page height and scroll distance compared with Original |
| **Subjective** | SEQ per task; NASA-RTLX per condition; preference ranking; "I felt in control" (7-point) |

- **Analysis:**
  - Error counts: GLMM (Poisson, or negative binomial if overdispersed), `errors ~ condition + flow + order + (1 | participant)`.
  - Completion: logistic GLMM.
  - Time: LMM on log(time).
- **Planned contrasts:** Personalised vs Original and Personalised vs Fixed, Holm-corrected, reported with effect sizes and 95% CIs. If assumptions fail, fall back to Friedman plus Wilcoxon tests.
- **Hypotheses:**
  - **H1:** Personalised < Original on errors.
  - **H2:** Personalised ≤ Fixed on errors, with lower screen cost.
  - **H3:** Personalised > Original on independent completion.

---

## 25. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Too few participants with PD or ET | High | Recruit from week 1 through clinics and support groups; offer remote sessions; report as a pilot if n < 12 |
| The personalised profile equals the fixed one for mild users | Medium | Stratify by severity; report screen cost; this is a valid finding, not a failure |
| Real sites ignore synthetic events | Medium | Native setters and full event sequences; adapter registry; publish a support matrix |
| A user's ability shifts mid-session | Medium | "Steadier today"; record medication timing |
| Learning effects across conditions | Medium | Latin square, matched variants, practice run |
| Health-data exposure | Low | On-device default, opt-in study logs, delete-all |

---

## 26. Summary

**Key message:** Measured, explainable, on-device personalisation, applied to the real web, and evaluated honestly against a strong baseline.

- **Built for the mid-way demo:** MVP 1 (calibrate and recommend) and MVP 2 (adapt two full flows, three conditions, live metrics).
- **Next:** MVP 3 (study console, SSE, ingest) and MVP 4 (passive recalibration, webhooks, retraining) close the loop.
- **Our ask:** introductions to clinics or support groups for recruitment, and ethics review time.

---

# Appendix (backup slides)

## A. User survey (run in week 1, about 10 minutes, accessible form)

**Screening**
1. Do you have a condition that affects hand steadiness or fine movement? (Parkinson's / essential tremor / other / prefer not to say)
2. Which do you mainly use: laptop trackpad, mouse, touchscreen, other?
3. How often do you use a computer for tasks like booking, shopping or forms? (daily … rarely)

**Difficulty** (rate each 1 = easy … 5 = very hard; "never use" option)

4. Picking a date from a calendar
5. Moving a slider to an exact value
6. Dragging something and dropping it in the right place
7. Clicking small buttons or links
8. Double-clicking
9. Menus that open on hover

**Variation and workarounds**

10. Does your control change during the day? When is it hardest? (free text; optional "around medication times" option)
11. What do you do when a website is too fiddly? (ask someone / use the phone / give up / keyboard / other)
12. In the last month, did you give up on an online task because of the controls? (yes / no; which?)

**Attitudes**

13. If a website rearranged itself to be easier for you, what would worry you? (free text)
14. Would you prefer it to (a) change automatically, (b) suggest changes and ask first, (c) only change when you ask?
15. Which name feels right for a setting like this? ("Steady settings", "Larger controls", "Comfort mode", other)

**Close:** May we contact you for a 30-minute interview? (optional contact field, stored separately from the answers)

---

## B. Interview and observation guide (30 min)

1. **Warm-up (5 min):** your computer, what you use it for, and who helps when it's hard.
2. **Observation (15 min):** "Could you show me how you'd book an appointment on a site you use?" Note slips, repeats, missed targets, workarounds and emotional moments, without coaching.
3. **Probe (5 min):** show the STEADY day list and pick-then-place on paper or the prototype. What do you expect will happen when you press this?
4. **Control and trust (5 min):** What should never change without asking? What would make you turn it off?

**Ethics:** consent recorded first; the person can stop at any time; no video of faces unless they opt in; breaks offered.

---

## C. Data contracts

**Profile** (`steady.profile.v1`, on the device)

```json
{
  "version": 1, "device": "Laptop trackpad", "createdAt": "2026-11-12T10:00:00Z",
  "features": { "sigma": 14.2, "sigmaAlong": 16.1, "sigmaAcross": 12.0, "slipP50": 3.1, "slipP90": 7.4,
                "repeatRate": 0.07, "mtMs": 1240, "tremorRms": 2.6, "tremorHz": 5.2,
                "dragFailRate": 0.5, "dragMs": 2300, "trials": 14 },
  "settings": { "target": 72, "gap": 14, "slipGuard": true, "ignoreRepeatMs": 400,
                "dragMode": "pick", "dateMode": "list", "sliderMode": "stepper", "confirmFinal": true },
  "explain": ["Your clicks land within about 14 px, so buttons are 72 px with 14 px gaps."],
  "model": "policy-tree@0.1.0"
}
```

**Event** (metrics, the same envelope for BroadcastChannel now and HTTP/SSE later)

```json
{ "id": "e_1731400000000_12", "session": "S-20261112-1", "participant": "P07",
  "condition": "personalized", "flow": "book", "type": "attempt",
  "outcome": "miss | wrong | correct | slip | repeat | dragfail",
  "target": "date", "t": 12345.6 }
```

**MVP 3 API (later):**
- `POST /v1/events`: a batch of events, idempotent by `id`.
- `GET /v1/sessions/:id/stream`: an SSE stream of `event: metric`, resumable with `Last-Event-ID`.

**MVP 4 webhooks (later):**
- Events: `session.completed`, `study.block_completed`, `model.trained`, `model.published`.
- Each is a POST carrying the header `Steady-Signature: t=<ts>,v1=<hmac_sha256>`.
- Failed deliveries are retried at 1, 5, 30 and 120 minutes, then move to a dead-letter queue.

---

## D. References

- WHO, *Parkinson disease* fact sheet — https://www.who.int/news-room/fact-sheets/detail/parkinson-disease
- Louis & Ferreira (2010), essential tremor prevalence meta-analysis, *Movement Disorders* — https://pmc.ncbi.nlm.nih.gov/articles/PMC7427947
- Keates & Trewin (2005), *Effect of age and Parkinson's disease on cursor positioning using a mouse*, ASSETS — https://course.ccs.neu.edu/csg170/ssl/keates05.pdf
- Trewin, Keates & Moffatt (2006), *Developing Steady Clicks*, ASSETS — https://www.doi.org/10.1145/1168987.1168993
- Hurst et al. (2008), *Automatically detecting pointing performance*, IUI — https://www.academia.edu/2849117/Automatically_detecting_pointing_performance
- Hurst, Mankoff & Hudson (2008), *Understanding pointing problems in real world computing environments*, ASSETS (cited from a secondary summary; check the paper)
- Gajos, Wobbrock & Weld (2008), *Improving the performance of motor-impaired users with automatically-generated, ability-based interfaces*, CHI — https://www.eecs.harvard.edu/~kgajos/papers/2008/gajos08improving.shtml
- Gajos et al. (2010), *Automatically generating personalized user interfaces with Supple*, Artificial Intelligence — https://www.eecs.harvard.edu/~kgajos/papers/2010/gajos10automatically.shtml
- Gajos, Reinecke & Herrmann (2012), *Accurate measurements of pointing performance from in situ observations*, CHI — https://wildlab.cs.washington.edu/Publications_files/gajos-accurateMeasurements.pdf
- Begnum & Begnum (2012), *On the usefulness of off-the-shelf computer peripherals for people with Parkinson's Disease*, UAIS — https://oda.oslomet.no/oda-xmlui/handle/10642/1475
- Nunes et al. (2016), *User interface design guidelines for smartphone applications for people with Parkinson's disease*, UAIS — https://link.springer.com/content/pdf/10.1007/s10209-015-0440-1.pdf
- Gajos et al. (2020), *Computer mouse use captures ataxia and parkinsonism*, *Movement Disorders* — https://www.eecs.harvard.edu/~kgajos/papers/2019/gajos19computer.shtml
- Axess Lab, *Hand tremors and the giant-button problem* — https://axesslab.com/hand-tremors/
- W3C, *What's new in WCAG 2.2* — https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Chrome, *Extension service worker lifecycle* — https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Braille Institute, Atkinson Hyperlegible Next — https://fonts.adobe.com/fonts/atkinson-hyperlegible-next (also on Google Fonts)
