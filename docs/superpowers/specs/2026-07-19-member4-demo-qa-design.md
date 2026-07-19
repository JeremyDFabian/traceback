# Member 4 Demo and QA Design

**Date:** 2026-07-19

## Goal

Add a deterministic, non-private demo fixture and acceptance path that verifies
an approved notebook region can be matched to a real lecture PDF, converted to
a grounded flashcard request, and rendered in the existing review interface.

## Scope

This work adds:

- One synthetic notebook-page PNG.
- One matching lecture-deck PDF.
- One shared JSON file containing the approved analysis, expected slide match,
  normalized highlight boxes, and generated flashcards.
- A normalized-coordinate bridge in the slide-match API contract.
- A backend acceptance test using real PDF extraction and matching.
- Frontend tests that consume the same expected fixture.
- Demo instructions, limitations, recovery steps, and a short presentation
  script.
- A verified Member 4 progress update.

This work does not add Playwright, production OpenAI calls in tests, live camera
automation, a final-demo deployment, video recording, or concept-graph work.

## Fixture Structure

Store the fixture in:

```text
sample-data/mitochondria-atp/
  notebook-page.png
  lecture-deck.pdf
  expected.json
```

The notebook page and lecture deck contain synthetic mitochondria and ATP
content. `expected.json` is the single source of truth shared by backend and
frontend tests. It contains:

- The fixed session identifier used by tests.
- The approved `AnalysisResult`, including one starred region.
- The expected slide number, passage, match status, and similarity range.
- The expected normalized highlight boxes.
- The deterministic generated flashcards and their grounded source reference.

The JSON contains no private data and is safe to commit.

## Match Contract

`MatchResponse` retains its existing passage and extracted `highlights`. It also
adds `highlight_boxes`, using the existing flashcard `HighlightBox` schema.

Each box is normalized from the matched slide:

```text
x      = span.x / slide.width
y      = span.y / slide.height
width  = span.width / slide.width
height = span.height / slide.height
```

Values are constrained to the valid 0–1 range accepted by `HighlightBox`.
Keeping both fields preserves the exact extracted source text while giving the
flashcard endpoint coordinates it can consume directly.

`ExtractedSlide.width` and `ExtractedSlide.height` become positive-only
Pydantic fields, so normalization cannot divide by zero.

The match endpoint reads confirmed analysis rather than proposed analysis.
Requests made before student confirmation return `404` with
`Confirmed analysis not found`.

## Acceptance Data Flow

The backend acceptance test:

1. Loads `expected.json`.
2. Provides a fake database connection for the fixed session.
3. Posts the approved analysis to the confirmation endpoint.
4. Points the session lecture path at the committed PDF.
5. Calls the region-match endpoint.
6. Verifies the real extractor and matcher return the expected passage, slide,
   status, and normalized boxes.
7. Builds `GenerateFlashcardsRequest` from the confirmed region and match.
8. Overrides the OpenAI generator with a deterministic fake.
9. Calls `/api/flashcards/generate`.
10. Verifies each returned card retains the expected passage and boxes.

The frontend tests import the same JSON fixture and verify that:

- Generation remains disabled before confirmation.
- The posted request matches the approved region and slide source.
- The generated source passage and coordinates are visible during review.
- Editing, approval, rejection, and batch confirmation continue to work.

The backend and frontend run separately but share the same contract fixture.
No new test framework or server orchestration is added.

## Validation and Failure Handling

- The fixture is parsed through existing Pydantic and generated TypeScript
  contracts where applicable.
- Backend tests compare extracted PDF coordinates with a small floating-point
  tolerance.
- Zero or negative slide dimensions fail `ExtractedSlide` validation.
- Match requests before confirmation fail explicitly.
- Tests replace database and OpenAI boundaries; they never require credentials
  or spend API credits.
- The committed notebook image is visually inspectable. Automated tests start
  from its approved analysis because live multimodal detection is outside this
  deterministic QA boundary.

## Documentation

Add one Member 4 demo guide containing:

- Required local setup.
- The fixture paths.
- Commands for the focused acceptance tests and full merge gate.
- The happy-path presentation sequence.
- Manual fallback steps.
- Known limitations and recovery actions.
- A short demo script.

Update `docs/member-4-progress.md` only for items supported by committed
fixtures, tests, documentation, and fresh command output. External deployment,
rehearsal, recording, and concept-graph items remain incomplete.

## Verification

Run the repository merge gate:

```bash
make check
```

On Windows systems without `make`, run the commands represented by the
Makefile targets directly: formatting checks, linting, type checks, tests,
API-client generation with a clean contract diff, and builds.

## Acceptance Criteria

- The repository contains a non-private notebook PNG, lecture PDF, and shared
  expected-output JSON.
- Matching is unavailable before analysis confirmation.
- The real PDF extractor and matcher select the expected slide and passage.
- Match responses expose validated normalized highlight boxes.
- Grounded flashcard responses preserve the matched passage and boxes.
- Frontend tests use the same expected fixture and cover confirmation and
  review.
- Demo instructions, limitations, fallback steps, and script are documented.
- The complete merge gate passes without requiring OpenAI or database
  credentials.
