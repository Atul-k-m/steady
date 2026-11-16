# Phase 1 + 2 build contracts

Phase 1 is the website: calibrate, then get the extension. Phase 2 is the extension: an AI agent plus an adaptive UI that work on a practice copy of a government enrolment portal. This file fixes the interfaces between the pieces, so they can be built in parallel. If you change an ID or event here, change it everywhere.

## File ownership

| Area | Files | Owner |
|---|---|---|
| Core model | `app/js/core.js` | agent build (main session) |
| AI agent + extension | `app/js/agent-core.js`, `app/js/agent.js`, `app/js/flowmap-portal.js`, `app/js/model-struggle.js`, `app/js/site-bridge.js`, `app/js/sw.js`, `app/js/bridge.js`, `app/manifest.json`, `app/options.html`, `app/js/options.js`, `tools/train-struggle.mjs`, `tools/flowmap-draft.mjs`, `tests/agent*.js` | agent build (main session) |
| Mock portal | `app/portal/index.html`, `app/portal/portal.css`, `app/portal/portal.js`, `tests/portal.smoke.e2e.js` | portal builder |
| Website | `app/index.html`, `app/hub.html`, `app/get.html`, `app/calibrate.html`, `app/js/calibrate.js`, `app/js/hub.js`, `app/js/get.js`, `app/privacy.html`, `app/css/steady.css`, nav in `app/demo.html`, `app/facilitator.html`, `app/book.html`, `app/week.html`, `tools/build-web.mjs`, `tests/demo.e2e.js` | website builder |

## Core model API (`window.Steady`, also `require('./app/js/core.js')`)

- `buildProfile({ pointing, tremor, drag, reading, device, timing, prefs })`. `reading` is `[{ px, correct }]` from the "Read it" step.
- `readingFeatures(trials)` returns `{ readPx, readTrials }`, or `{}` when no trials.
- `recommend(features, { steadier, overrides })` returns settings that now include `text` (px, 18–40) and `autonomy` (`'assist' | 'copilot'`). The reasons include `reasons.text` and `reasons.autonomy`. `overrides.text` and `overrides.autonomy` are honoured.
- `STEPS` is now `[['tap','Tap the dots'],['hold','Hold steady'],['read','Read it']]`.
- `profile.prefs = { lang: 'en' | 'hi', voice: true | false, helperName: '', helperPhoneEnd: '' }`. `helperPhoneEnd` is the last 4 digits of the phone that receives OTPs (usually a son or daughter).
- Storage keys are unchanged: `steady.profile.v1` (active profile, JSON) and `steady.profiles.v1`.

## Website ⇄ extension handoff

- The extension's `site-bridge.js` runs on STEADY's own website pages, i.e. any non-`/portal/` path on `http://localhost` / `http://127.0.0.1` at `document_start`.
  - It sets `document.documentElement.dataset.steadyExtInstalled = '1'`.
  - It copies `localStorage['steady.profile.v1']` and `['steady.profiles.v1']` into `chrome.storage.local` on load, and again whenever the page dispatches `steady:saved`.
  - After copying it sets `dataset.steadySynced = '1'` and dispatches `steady:ext` on `document`.
- The website dispatches `document.dispatchEvent(new CustomEvent('steady:saved'))` straight after saving a profile.
- `get.html` reads `dataset.steadyExtInstalled` and `dataset.steadySynced`, and refreshes on `steady:ext`.

## Mock portal (`app/portal/index.html`)

It's a practice copy of a government-style "70+ senior health card" enrolment flow, built to reproduce the failures older users report in app-store reviews (`docs/research/research_notes/Indian elders healthcare voices/app_store_reviews.md`, APP-83 to APP-120).

**Never** use a government emblem, ministry name, scheme logo or the word "Ayushman". The header reads "Senior Health Cover · Beneficiary Portal (practice copy)".

### Query parameters

| Param | Default | Meaning |
|---|---|---|
| `chaos` | `1` | `1`: 20% random "Server not responding" on search and photo upload. `0`: never. `2`: the **first** search and the **first** upload always fail, later attempts succeed (deterministic, for tests and demos of recovery) |
| `timeout` | `180` | Idle seconds before the session expires and **everything** is cleared |
| `phone` | `4321` | Last 4 digits of the Aadhaar-linked phone (the son's) |
| `test` | absent | `1` exposes `window.__portalTest = { captcha(), captcha2(), otp(), aotp() }` for automated tests only |
| `fixedotp` | absent | `1` makes both OTPs `123456` |

### Page-wide elements

- `#mock-banner`: "Practice copy for testing. Not a government website. Nothing you type leaves this computer."
- `#error-msg` (`role="alert"`, class `perror`): hidden unless there's an error. Text set on error, cleared on every step change.
- `#loading`: hidden. Shown during simulated server waits (800–3000 ms).
- `#session-modal` (`role="dialog"`): "Your session has expired. Please login again." with button `#session-ok`. On OK, every field and all state are cleared and the portal returns to `login`.
- `#demo-sms` (`role="status"`): a simulated phone notification in the bottom-left. Login OTP text: `SMS to +91 XXXXXX<last4 of entered mobile>: <otp> is your OTP for Senior Health Cover login.` e-KYC OTP text: `SMS to phone ending <phone>: <otp> is your Aadhaar OTP.` It stays visible for 60 s.
- Each step is a `<section class="pstep" id="step-NAME" data-step="NAME">`. Exactly one is visible at a time; the others carry the `hidden` attribute. `document.body.dataset.step` always equals the visible step name.

### Steps, IDs and messages

1. **`login`**
   - Elements: `#mobile` (text, maxlength 10, label "Mobile Number"); `#captcha-img` (`<img>`, SVG data URL, 6 distorted chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`); `#captcha-refresh` (small link "Refresh"); `#captcha-input` (label "Enter Captcha"); `#btn-get-otp` ("Get OTP").
   - Errors: `Please enter a valid 10-digit mobile number.` · `Invalid Captcha. Please try again.` (also makes a new captcha).
2. **`otp`**
   - Elements: `#otp-sent-to` ("OTP sent to XXXXXX1234"); `#otp-input` (6 digits); `#otp-timer` ("Time remaining: 01:59", counting down from 120 s); `#otp-resend` (link "Resend OTP"); `#btn-verify-otp` ("Verify").
   - Errors: `Invalid OTP. Please try again.` · `OTP has expired. Please click Resend OTP.`
3. **`search`**
   - Elements: radio group `name="scheme"` with `#scheme-pmjay` ("PM-JAY family card") and `#scheme-senior` ("Senior citizen 70+ card"); `#aadhaar-input` (12 digits); `#captcha2-img`, `#captcha2-refresh`, `#captcha2-input`; `#btn-search` ("Search").
   - On success: `#search-result` becomes visible, showing a small table with masked name `R***** K****`, age `74`, and button `#btn-proceed-ekyc` ("Proceed to e-KYC").
   - Errors:
     - `Please select a scheme.`
     - `Please enter a valid 12-digit Aadhaar number.`
     - `Invalid Captcha. Please try again.`
     - `No beneficiary found in the given search.` (any Aadhaar starting `9999`)
     - `No PM-JAY record found. If you are 70 or older, choose Senior citizen 70+ card.` (pmjay chosen)
     - `Server not responding. Please try again later.` (chaos)
4. **`ekyc`**
   - Elements: a long consent paragraph in small text; `#consent-check` (checkbox, label "I give my consent to authenticate with Aadhaar for this application."); `#btn-send-aadhaar-otp` ("Send OTP to Aadhaar-linked mobile").
   - Error: `Please accept the consent to proceed.`
5. **`ekyc-otp`**
   - Elements: `#aotp-sent-to` ("OTP sent to Aadhaar-linked mobile XXXXXX4321"); `#aotp-input`; `#aotp-timer`; `#aotp-resend`; `#btn-verify-aotp`.
   - Errors: same as the OTP step.
6. **`details`**
   - Read-only: `#d-name` ("Ramesh Kumar"), `#d-dob` ("12-03-1951"), `#d-gender` ("Male").
   - Editable: `#d-mobile` (prefilled with the login mobile); `#d-state` (select, first option value `""` "-- Select State --"); `#d-district` (select, disabled until a state is chosen, filled on the state `change` event); `#d-ward` (select, filled on the district `change` event); `#d-address` (text); `#btn-save-details` ("Save & Continue").
   - Errors: `Please select State.` · `Please select District.` · `Please select Ward/Village.` · `Please enter address.` · `Please enter a valid 10-digit mobile number.`
   - States, with 3 districts each: Bihar, Delhi, Karnataka, Maharashtra, Tamil Nadu, Uttar Pradesh, West Bengal. Wards are `Ward 1` to `Ward 8`.
7. **`photo`**
   - Elements: `#photo-input` (`type=file accept="image/*" capture="user"`); `#photo-preview` (img); `#btn-sample-photo` (small link "Use sample photo (practice)"); `#btn-upload-photo` ("Upload Photo").
   - Errors: `Please choose a photo.` · `Upload failed. Please try again.` (chaos).
8. **`review`**
   - Elements: `#review-summary` (`<dl>`: name, Aadhaar masked as `XXXX XXXX 1234`, mobile, state, district, ward, address); `#declare-check` (checkbox, "I declare that the information given above is true."); `#btn-submit` ("Submit Application").
   - Error: `Please accept the declaration.`
9. **`done`**
   - Elements: `#ref-no` ("SHC-2026-" + 6 digits); status "Pending approval"; `#btn-new` ("Start new application").

### Behaviour rules

- Read field values at click time. Listen for `change` on selects and `input` on text fields, so values set by script plus a dispatched event work.
- The captcha answer lives only in a JS closure, **never** in the DOM.
- The idle timer resets on `input`, `change`, `click` and `keydown`.
- Look and feel: an ordinary, dense government-style form. 12–13 px text, inputs about 22 px tall, small buttons, blue header bar, grey panels. The difficulty is the point.
