# Product

<!-- impeccable:product-schema 1 -->

> Inferred from the STEADY proposal brief. The user asked to skip the interview ("be quick"), so anything marked *(inferred)* is unconfirmed.

## Platform

web

## Stack

Delegated: vanilla ES2020 JavaScript with no build step, so the demo opens from a folder and the same files load as a Chrome MV3 extension. Framework-free because the engine runs inside other people's pages. *(inferred — chosen for a 20–25 min mid-way demo)*

## Users

People with tremor or impaired fine-motor control, including Parkinson's disease and essential tremor, who use an ordinary laptop or desktop with a mouse or trackpad for everyday web tasks such as booking appointments and organising lists. Many are older adults whose ability changes through the day (medication cycles, fatigue). *(inferred: age profile and fluctuation, from the literature)*

Secondary: the four-person research team and their study facilitators, who run comparative sessions.

## Product Purpose

Make small, precise web controls usable without a steady hand. A short, optional exercise estimates how precisely this person points and clicks; STEADY then turns fiddly controls on supported pages into larger, separated, forgiving ones. Success means fewer incorrect selection attempts, more tasks completed without help, and acceptable completion time compared with both the original page and a one-size-fits-all accessible version.

## Positioning

STEADY changes the targets, not the cursor, on existing web pages, and sizes them to one person's measured scatter instead of a fixed accessibility preset. It does not guess where the user meant to click; it makes misses land in harmless gaps.

## Operating Context

- Home use, daytime, laptop with trackpad or a USB mouse, often with reading glasses. *(inferred)*
- Lab sessions: a facilitator sits beside the participant and watches live counts on a second window.
- The two study tasks: booking a clinic appointment (date, time, reminder slider, confirm) and planning a medicine week (drag medicines into time-of-day slots).

## Capabilities and Constraints

- Software only, no special hardware.
- Calibration is optional and must finish in about 60 seconds.
- Controls never move while the user is working; adaptation happens before a task, or when the user asks.
- The user controls adaptation (on/off, "Steadier today") and confirms the final action.
- Motion and pointing data can reveal a health condition, so it stays on the device by default.
- Supported now: native date inputs, native range sliders, HTML5 drag-and-drop, and generic buttons, links and labels. Library-specific widgets are not supported yet.

## Evidence on Hand

- The proposal text only. There are no user survey results, interview notes, or study data yet, and no future work may present any as real until the team collects them.
- Published research is cited in Implementation.md. It is secondary evidence, not this team's findings.

## Product Principles

1. Nothing moves under your hand.
2. Misses are harmless: gaps catch errors, so a missed click never becomes a wrong click.
3. Say what will happen before it happens, and make it undoable.
4. Never depend on hover, speed, or holding still.
5. Dignified and neutral: no "tremor mode", no patient labels.

## Accessibility & Inclusion

- WCAG 2.2 AA is the floor. STEADY's own controls meet 2.5.5 (44×44 CSS px) and provide a single-pointer alternative to every drag (2.5.7).
- Body text meets AAA contrast (7:1) where possible, because many users also have age-related vision changes.
- Every STEADY control works by keyboard, and `prefers-reduced-motion` is respected.
