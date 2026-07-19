# Member 4 Progress

**Last checked:** 2026-07-19

`[x]` means the repository contains working code, tests, or documentation for
the item. Update this file as work lands.

**Latest Member 4 verification:** API tests: 73 passed; web tests: 5 passed;
lint, type checks, API-client regeneration, and production builds passed.
After the vision-analysis merge, the expanded API suite requires Python 3.12
or 3.13 because PaddlePaddle does not provide a Python 3.14 wheel.

## Flashcards — MVP

- [x] Define grounded flashcard API contracts with note-region and slide-source
      references ([schemas](../apps/api/app/schemas/flashcards.py)).
- [x] Generate validated flashcards with the server-side OpenAI Responses API
      ([service](../apps/api/app/services/flashcards.py)).
- [x] Expose the FastAPI generation endpoint with safe configuration and error
      handling ([route](../apps/api/app/api/flashcards.py)).
- [x] Generate the TypeScript API contract
      ([client](../packages/api-client/src/schema.d.ts)).
- [x] Let students edit, approve, reject, navigate, and confirm suggested cards
      ([review UI](../apps/web/app/flashcard-review.tsx)).
- [x] Show each card's slide and exact source passage during review.
- [x] Request generation only after the student confirms a starred or questioned
      notebook region.
- [ ] Connect the existing review UI to the frontend team's integrated student
      flow after its API handoff is ready.
- [ ] Complete the full approved-region → slide match → flashcard generation →
      review flow.

## Concept graph — after the MVP path works

- [ ] Generate graph nodes only from student-approved notebook regions.
- [ ] Generate relationships grounded in approved detections and slide sources.
- [ ] Require student confirmation before graph generation.
- [ ] Display the optional concept graph.
- [ ] Let students correct graph nodes and relationships.

## Integration and QA

- [x] Cover flashcard validation, generation, provider failures, and API behavior
      without real OpenAI calls
      ([API tests](../apps/api/tests/test_flashcards.py)).
- [x] Cover flashcard editing, decisions, validation, keyboard-accessible
      controls, and empty state
      ([UI tests](../apps/web/app/flashcard-review.test.tsx)).
- [x] Add a deterministic acceptance test for the confirmed-region → real slide
      match → grounded flashcard path
      ([acceptance test](../apps/api/tests/test_member4_demo_flow.py)).
- [x] Verify generation cannot start before region confirmation.
- [x] Verify every generated flashcard exposes its source passage and highlight
      coordinates through the API and review UI.
- [x] Verify every slide match exposes its source passage and normalized
      highlight coordinates.
- [ ] Verify low-confidence results remain visibly distinct.
- [ ] Verify keyboard navigation, readable contrast, phone-camera input, and the
      manual upload fallback.
- [x] Run and pass the complete merge gate using the Windows equivalents of
      `make check`.

## Demo data

- [x] Provide a non-private flashcard review batch for the deterministic demo.
- [x] Add a non-private sample notebook page
      ([demo fixture](../sample-data/mitochondria-atp/)).
- [x] Add a matching lecture PDF.
- [x] Add expected detections, slide matches, and flashcard outputs for the
      sample pair.

## Documentation

- [x] Document local setup, project commands, and API-first flashcard testing
      ([README](../README.md)).
- [x] Document how to run the deterministic Member 4 demo flow
      ([demo guide](member-4-demo.md)).
- [x] Document known demo limitations and recovery steps.
- [ ] Document the concept-graph workflow when that post-MVP feature begins.

## Demo preparation

- [x] Choose and validate the notebook-page and lecture-deck demo pair.
- [x] Prepare a short end-to-end demo script.
- [ ] Configure and smoke-test the separate final-demo environment.
- [ ] Rehearse the happy path and manual fallback.
- [ ] Record and review the demo video.
