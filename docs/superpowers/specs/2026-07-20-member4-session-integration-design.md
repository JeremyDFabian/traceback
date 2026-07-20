# Member 4 Session Integration Design

- **Date:** 2026-07-20
- **Owner:** Member 4 — Learning Features, Integration & QA
- **Branch:** `codex/member4-integration-qa`

## Summary

Connect the existing student interface to the session-backed work already
implemented by the other team members. The completed path requires one lecture
PDF and one notebook image, preserves student edits, matches only marked regions,
generates source-grounded flashcards, and reuses the existing flashcard review
component.

The branch preserves the current visual design. It adds integration behavior,
status communication, accessibility, tests, and progress documentation only.

## Problem

The repository contains the required backend routes and an independently tested
flashcard review component, but the homepage bypasses the session workflow. It
calls standalone notebook-analysis and notebook-flashcard endpoints, renders a
second review drawer, and never creates a session, confirms edited analysis,
extracts the uploaded deck, or matches marked notebook regions to slides.

As a result, the current browser flow does not demonstrate the team integration
or complete these Member 4 progress items:

- Connect the existing review UI to the integrated student flow.
- Complete approved region → slide match → flashcard generation → review.
- Verify low-confidence results remain visibly distinct.

## Goals

- Require exactly one lecture PDF and one notebook image before processing.
- Use the existing session, upload, analysis, confirmation, deck extraction,
  matching, and grounded flashcard endpoints.
- Preserve normalized bounding boxes, markers, relationships, confidence, and
  student edits when analysis moves between the vision and session contracts.
- Match only regions marked with a star or question mark.
- Generate one grounded flashcard for each eligible marked region.
- Require explicit student approval before using an uncertain match.
- Block flashcard generation for a region with no match.
- Reuse `FlashcardReview` and remove the duplicate inline review drawer.
- Preserve completed work when a retryable phase fails.
- Meet WCAG 2.2 AA for all changed controls and status communication.

## Non-goals

- Redesigning the existing interface or changing its visual language.
- Supporting multiple notebook pages in one backend session.
- Adding a new backend orchestration endpoint.
- Adding dependencies, state-management libraries, or generic API abstractions.
- Adding or changing the concept graph.
- Rendering the lecture PDF with PDF.js or replacing the overlay editor with
  React Konva.
- Using `expected.json` or other fixture data as a runtime fallback.
- Deployment, phone-device rehearsal, or demo-video production.

## Architecture

Add one thin module at `apps/web/app/session-api.ts`. It exposes typed functions
that call the existing FastAPI routes and a mapper that converts notebook vision
output into the persisted analysis contract.

`apps/web/app/page.tsx` remains responsible for the current screens and user
interaction. It stores the active session ID, phase status, match results,
uncertain-match approvals, generated cards, and errors. It does not gain a
general state machine or another component framework.

`apps/web/app/flashcard-review.tsx` remains the sole flashcard review experience.
The duplicate notebook-flashcard drawer and its parallel card type are removed
from `page.tsx`.

## Existing API Flow

The browser calls the existing routes in this order:

1. `POST /api/sessions`
2. `POST /api/sessions/{session_id}/deck`
3. `POST /api/sessions/{session_id}/notebook-page`
4. `POST /api/notebook-analysis`
5. `POST /api/sessions/{session_id}/analysis`
6. Student edits the analysis in the current editor.
7. `POST /api/sessions/{session_id}/confirm`
8. `POST /api/sessions/{session_id}/extract-deck`
9. `POST /api/sessions/{session_id}/regions/{region_id}/match` for each starred
   or questioned region.
10. The student explicitly approves each uncertain match.
11. `POST /api/flashcards/generate` with `count: 1` for every matched or
    student-approved uncertain region.
12. The aggregated response cards are passed to `FlashcardReview`.

The application never generates cards before analysis confirmation.

## Contract Mapping

The notebook-analysis response is richer than the persisted `AnalysisResult`.
The mapper explicitly produces the persisted shape rather than relying on
Pydantic to ignore extra fields.

For each region it preserves:

- `id`
- `label`
- `transcription`
- `type`
- normalized `bbox` values in the `0..1` range
- `markers`
- `confidence`

For each relationship it preserves:

- `id`
- `source_region_id`
- `target_region_id`
- `label`
- `confidence`

Vision-only fields such as `highlight_text`, explanations, trusted-source
queries, warnings, top-level markers, and uncertainty notes remain available to
the current interface but are not sent to the narrower session-analysis
contract.

When the student edits a region, the confirmation payload converts percentage
coordinates used by the current UI back to normalized `0..1` values. It uses
the edited label, transcription, type, marker, and position while retaining the
vision relationships.

## UI Behavior

The existing setup, processing, editor, trace, and cards screens remain.

### Setup

- The lecture input accepts one PDF.
- The notebook input accepts one image.
- The primary action remains disabled until both valid files are selected.
- Existing styling and file-selection affordances are retained.

### Processing

The existing processing surface announces these real phases:

- Creating session
- Uploading lecture
- Uploading notebook
- Analyzing notebook
- Saving analysis

Failures are announced with `role="alert"` and retain selected files.

### Editor confirmation

The existing editor remains the only place students edit detected regions.
Confirming:

- sends the edited normalized analysis to `/confirm`;
- extracts the uploaded lecture deck;
- requests matches for starred and questioned regions;
- moves to Trace View when match results are available.

If there are no marked regions, Trace View explains that a star or question
marker is required before cards can be generated.

### Match states

Every marked region displays a visible text status, reason, and similarity
score:

- `matched`: eligible for generation.
- `uncertain`: ineligible until the student activates “Use this match.”
- `no_match`: ineligible, with no approval override.

Color may reinforce these states but cannot be the only indicator. Uncertain
approval is stored per region and resets if a new match is requested.

### Flashcard generation and review

The generate action is enabled when at least one marked region is eligible.
Each eligible region produces one API request with its confirmed note text,
matched slide number, matched passage, and normalized highlight boxes.

Successful cards are aggregated and displayed through `FlashcardReview` on the
existing cards screen. The component continues to support editing, difficulty,
approve/reject decisions, source passage display, source coordinates, and final
batch confirmation.

## Error Handling and Retry

- Session creation failure leaves the user on setup with both files selected.
- Upload, analysis, or initial-save failure retries the processing sequence
  using the existing session when available.
- Confirmation, extraction, or matching failure keeps the edited analysis and
  offers retry without rerunning vision analysis.
- Flashcard generation failure keeps approved match results and retries
  generation only.
- An HTTP error displays a safe phase-specific message. Server details and
  credentials are never exposed.
- The runtime never substitutes fixture data or silently returns to the seeded
  demo path.

## Accessibility

Changed UI must:

- support keyboard-only selection, confirmation, match approval, generation,
  review, and retry;
- retain visible focus indicators;
- use native buttons, inputs, labels, and headings;
- announce phase changes, errors, and generated-card availability;
- express match status in text, not color alone;
- preserve logical focus when moving between screens;
- avoid introducing a modal for flashcard review.

## Testing

### Backend

Add one focused retrieval test whose lexical overlap produces a non-zero score
below `0.2`. Assert `status == "uncertain"`, the best slide and passage are
returned, and highlight boxes remain normalized.

Keep the existing deterministic acceptance test for the confirmed-region →
real-PDF match → grounded-card contract. Fixtures remain test-only.

### Frontend API module

Test:

- vision output maps to the persisted analysis shape without presentation-only
  fields;
- edited percentage coordinates normalize back to `0..1`;
- route methods, URLs, multipart field name `file`, and JSON request bodies
  match the generated API contract;
- non-success responses reject with safe phase-specific errors.

### Frontend integration

Add one Testing Library flow that:

1. selects a PDF and image;
2. receives mocked responses for the real endpoint sequence;
3. confirms an edited marked region;
4. sees an uncertain state and approves it;
5. generates a grounded card;
6. reaches `FlashcardReview` with the source passage and coordinates.

Existing homepage, interactive-text, and flashcard-review tests must continue to
pass.

### Merge gate

Run the repository’s complete `make check` equivalent, including backend tests,
frontend tests, formatting, lint, type checking, generated API-client
verification, and production builds.

## Progress Documentation

After verification, update `docs/member-4-progress.md` to check:

- Connect the existing review UI to the frontend team's integrated student flow.
- Complete the full approved-region → slide match → flashcard generation →
  review flow.
- Verify low-confidence results remain visibly distinct.

Update `docs/build-week-checklist.md` to check the real end-to-end session item.
Do not check the combined phone-camera QA item, concept-graph items, deployment,
rehearsal, or video tasks.

Update `docs/member-4-demo.md` so its primary path describes the live team
integration. Keep deterministic fixtures documented only as automated test
inputs, not as a runtime fallback.

## Acceptance Criteria

- A user cannot begin without one PDF and one image.
- The browser uses the existing session-backed API sequence.
- Student edits are confirmed before any matching or generation request.
- Only starred and questioned regions are matched.
- Uncertain matches require explicit approval.
- No-match regions cannot generate cards.
- Each eligible region yields one source-grounded card.
- `FlashcardReview` is the only card-review UI.
- Changed states are keyboard accessible and understandable without color.
- No runtime request reads fixture or seeded demo data.
- The targeted Member 4 and Build Week progress items are checked only after the
  full merge gate passes.
