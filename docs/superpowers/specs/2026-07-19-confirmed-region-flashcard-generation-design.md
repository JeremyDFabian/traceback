# Confirmed-Region Flashcard Generation

**Date:** 2026-07-19  
**Status:** Approved design

## Goal

Replace the homepage's always-visible hard-coded flashcard batch with the
smallest working confirmation-to-generation flow. A student must explicitly
confirm a starred or questioned notebook region before the browser requests
flashcard generation.

## Scope

The homepage will present one non-private demo region and its matched lecture
source. This increment does not add notebook upload, automatic detection,
overlay editing, slide retrieval, persistence, or a full session model. Those
belong to later MVP increments.

## User flow

1. The student reviews the demo region's marker, note text, slide number, and
   exact slide passage.
2. Flashcard generation is unavailable until the student confirms the region.
3. After confirmation, the student requests flashcards.
4. The browser posts the confirmed region and slide source to
   `/api/flashcards/generate`.
5. While the request runs, the UI prevents duplicate requests and communicates
   progress.
6. On success, the existing flashcard review UI receives the generated cards
   with the exact source passage attached.
7. On failure, the page shows a readable error and allows another attempt.

## Components and data flow

Keep the flow in the homepage because there is only one demo source and one
consumer. Reuse the generated API-client types and the existing
`FlashcardReview` component.

The demo source contains the API request fields:

- session ID
- region ID
- marker type
- note text
- slide number
- slide passage

The marker type is UI-only. The remaining grounded fields form the generation
request. The response cards already contain source references; the homepage
adds the known slide passage required by `ReviewFlashcard`.

## States and errors

The page has four relevant states: awaiting confirmation, ready to generate,
generating, and reviewing. The generate control is disabled before
confirmation and while a request is active.

Network failures and non-success HTTP responses produce one visible status
message. No cards are shown from a failed or malformed response. A retry uses
the same confirmed source.

## Testing

A focused homepage test will verify:

- no generation request occurs before explicit confirmation;
- confirming enables generation;
- requesting generation posts the grounded demo source;
- successful cards appear in the existing review UI;
- an API failure produces a retryable error state.

Existing flashcard review and API tests remain unchanged unless the integration
reveals a contract mismatch.

## Acceptance criteria

- Flashcard generation cannot start before region confirmation.
- The homepage uses live generated cards instead of the hard-coded review batch.
- Generated cards retain their region and slide references.
- Review shows the exact matched slide passage.
- Loading and failure states are accessible and test-covered.
