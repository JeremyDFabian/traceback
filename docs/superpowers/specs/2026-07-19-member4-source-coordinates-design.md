# Member 4 Source Coordinates Design

**Date:** 2026-07-19

## Goal

Make every flashcard's matched slide source independently verifiable by carrying
the exact source passage and its highlight coordinates through the API and
showing both during review.

## Design

- Add a normalized `HighlightBox` with `x`, `y`, `width`, and `height`. Origins
  use the inclusive `0..1` range, dimensions must be positive, and each box
  must stay within the slide.
- Require `slide_text` and one or more highlight boxes in the flashcard source
  input and returned source reference.
- Copy the validated passage and boxes into every generated flashcard. The
  language model does not create or alter this source metadata.
- Render the returned passage and a readable coordinate summary in the existing
  flashcard review source panel.
- Remove the homepage's separately maintained `sourcePassage`; the API response
  becomes the single source of truth.

## Error Handling

FastAPI rejects missing, empty, out-of-range, or unexpected coordinate data
before generation. Existing provider and network errors remain unchanged.

## Verification

- API tests prove valid coordinates are preserved and invalid coordinates are
  rejected before the generator runs.
- Web tests prove the review UI displays the passage and coordinates returned by
  FastAPI.
- Regenerate the TypeScript client after the Pydantic contract changes.

## Scope

This slice does not implement PDF extraction, slide ranking, or a graphical PDF
highlight overlay. Those belong to the retrieval and frontend owners. It
provides the validated contract and review surface they can integrate with.
