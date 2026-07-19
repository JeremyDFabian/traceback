# Member 4 Progress

**Last checked:** 2026-07-19

`[x]` means the repository contains working code, tests, or documentation for
the item. Update this file as work lands.

**Latest verification:** API tests: 40 passed; web tests: 6 passed; web
typecheck and lint passed.

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
- [x] Connect the review UI to live generated cards; the homepage posts a
  confirmed demo region to FastAPI ([homepage](../apps/web/app/page.tsx)).
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
  controls, empty state, and homepage integration
  ([UI tests](../apps/web/app/flashcard-review.test.tsx)).
- [ ] Add an end-to-end acceptance test for the complete MVP student flow.
- [x] Verify generation cannot start before region confirmation.
- [ ] Verify every slide match exposes its source passage and highlight
  coordinates.
- [ ] Verify low-confidence results remain visibly distinct.
- [ ] Verify keyboard navigation, readable contrast, phone-camera input, and the
  manual upload fallback.
- [ ] Run and pass the complete merge gate with `make check`.

## Demo data

- [x] Provide a non-private flashcard review batch for the homepage demo.
- [ ] Add a non-private sample notebook page under
  `sample-data/notebook-pages/`.
- [ ] Add a matching lecture PDF under `sample-data/lecture-decks/`.
- [ ] Add expected detections, slide matches, and flashcard outputs for the
  sample pair.

## Documentation

- [x] Document local setup, project commands, and API-first flashcard testing
  ([README](../README.md)).
- [ ] Document how to run the complete Member 4 demo flow.
- [ ] Document known demo limitations and recovery steps.
- [ ] Document the concept-graph workflow when that post-MVP feature begins.

## Demo preparation

- [ ] Choose and validate the final notebook-page and lecture-deck demo pair.
- [ ] Prepare a short end-to-end demo script.
- [ ] Configure and smoke-test the separate final-demo environment.
- [ ] Rehearse the happy path and manual fallback.
- [ ] Record and review the demo video.
