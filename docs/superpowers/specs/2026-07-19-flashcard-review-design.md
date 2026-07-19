# Flashcard Review Design

**Date:** 2026-07-19
**Status:** Approved in conversation; awaiting written-spec review

## Goal

Add a reusable, stateless review interface for generated flashcards. A student
can edit every card, explicitly approve or reject it, and confirm a batch that
contains only the approved cards.

## Context

The FastAPI service already exposes `POST /api/flashcards/generate`, and the
generated TypeScript contract includes the returned `Flashcard` type. The web
application is still a one-page scaffold, while notebook-region confirmation,
slide matching, and the parent study workflow do not yet have frontend
implementations.

This feature therefore stops at a reusable review component. The homepage will
render it with non-private demo data until the upstream workflow can supply a
real generated batch.

## Scope

### Included

- A single-column, card-by-card review component
- Editable question, answer, and difficulty
- Visible slide and source-passage context
- Explicit approve and reject decisions for each card
- Previous and next navigation through the batch
- Review progress and a final confirmed-batch summary
- A completion callback containing only approved, edited cards
- A demo integration on the current homepage
- Focused component tests and responsive styling

### Excluded

- Calling the generation API from the review component
- Flashcard or decision persistence
- Supabase changes
- Backend or generated API-contract changes
- Browser-storage recovery after refresh
- Spaced-repetition scheduling
- A temporary manual source-entry form
- Integration with notebook capture, region confirmation, or slide matching

## Chosen Approach

Use one reusable React client component with local state. It receives cards
from its parent and reports the approved batch through a callback.

This is smaller than introducing a route-level state mechanism and avoids a
backend review model before sessions and persistence exist. It also gives the
future study flow a clear integration boundary without coupling the review UI
to temporary demo inputs.

## Component Contract

The component uses the generated API client's `Flashcard` schema rather than
copying the backend contract:

```ts
import type { components } from "@traceback/api-client";

type Flashcard = components["schemas"]["Flashcard"];

type ReviewFlashcard = Flashcard & {
  sourcePassage: string;
};

type FlashcardReviewProps = {
  cards: ReviewFlashcard[];
  onComplete: (approvedCards: ReviewFlashcard[]) => void;
};
```

`sourcePassage` is view data supplied by the future slide-matching parent. It
does not change the public generation API. The homepage demo supplies a
representative passage alongside each generated-card-shaped object.

The component owns one editable copy of `cards`. It never mutates the input
array. Completion returns the edited versions of approved cards in their
original batch order.

## Review State

Each card has one local decision:

```ts
type ReviewDecision = "pending" | "approved" | "rejected";
```

The component also tracks the active card index and the editable card values.
No reducer, context provider, or external state library is needed for this
bounded local workflow.

The rules are:

1. Every card starts as `pending`.
2. Approve validates the active question and answer, marks the card
   `approved`, and advances when another card exists.
3. Reject marks the card `rejected` and advances when another card exists.
4. Previous and Next allow the student to revisit any card.
5. Editing an `approved` card returns it to `pending`, requiring confirmation
   of the changed content.
6. Editing a `rejected` card also returns it to `pending`, allowing the student
   to reconsider it.
7. Confirm batch remains disabled while any card is `pending`.
8. Confirm batch calls `onComplete` with approved cards only.
9. Rejected cards remain visible and count toward the reviewed total, but are
   omitted from the confirmed batch.

Refreshing the page resets the review because persistence is outside this
feature.

## Interface

The selected layout is a focused card-by-card view:

- Header: “Review flashcards,” reviewed count, and total count
- Progress indicator: approved plus rejected cards divided by total cards
- Editable card:
  - labeled question textarea
  - labeled answer textarea
  - native difficulty select with easy, medium, and hard
  - slide number, region identifier, and supplied source passage
- Decision controls: Reject and Approve
- Navigation controls: Previous and Next
- Final action: Confirm batch
- Completion summary: approved and rejected counts

The source passage stays adjacent to the card so the student can check
grounding before approval. The component does not recreate slide highlighting;
the future slide viewer remains responsible for displaying source coordinates.

The layout stays single-column at all viewport widths. It uses the existing
Tailwind/CSS setup and adds no package.

## Validation and Error States

Question and answer are trimmed for validation. Approve is blocked when either
field is blank, and the corresponding field receives a concise inline error.
Reject remains available because rejecting an unusable card must not require
repairing it first.

An empty `cards` array renders “No flashcards to review” and no decision or
confirmation controls. The component has no network-error state because it
does not perform network requests.

## Accessibility

- Use native `textarea`, `select`, and `button` elements.
- Associate every form control with a visible label.
- Keep all actions in normal keyboard tab order.
- Provide visible focus styles and readable contrast.
- Announce the active-card position and reviewed count with `aria-live`.
- Disable Previous and Next only at their respective bounds.
- Expose validation text through `aria-describedby`.
- Do not rely on color alone to distinguish pending, approved, and rejected.

## Files

Expected implementation changes:

```text
apps/web/app/flashcard-review.tsx
    Reusable client component, local review state, and public prop types

apps/web/app/flashcard-review.test.tsx
    Focused interaction and validation tests

apps/web/app/page.tsx
    Demo cards and completion summary integration

apps/web/app/page.test.tsx
    Homepage smoke coverage for the review feature

apps/web/app/globals.css
    Responsive review layout, states, and focus styling
```

No API or generated-contract file changes are expected.

## Testing

Use the installed Vitest and React Testing Library stack. Tests will use DOM
events already provided by React Testing Library; no interaction-test
dependency is added.

Component coverage:

1. Renders the first card, its slide reference, and source passage.
2. Edits question, answer, and difficulty.
3. Blocks approval for blank question or answer and links the error to the
   invalid field.
4. Approves or rejects a card, advances, and updates progress.
5. Navigates backward and forward without losing edits or decisions.
6. Returns an edited approved card to `pending`.
7. Keeps confirmation disabled until every card has a decision.
8. Calls `onComplete` once with only approved edited cards in original order.
9. Renders the empty-batch state without review controls.

The homepage test verifies that the demo review workflow is present. Existing
API tests remain unchanged.

## Acceptance Criteria

1. A generated-card-shaped demo batch is reviewable from the homepage.
2. The student can edit question, answer, and difficulty for every card.
3. The student can inspect each card's slide reference and source passage.
4. Every card must be approved or rejected before batch confirmation.
5. Editing a decided card makes it pending again.
6. Confirming returns only approved cards with all accepted edits.
7. Rejected cards remain inspectable and are excluded from the confirmed batch.
8. Empty input and blank editable content have clear, accessible behavior.
9. The interface is keyboard operable and usable at phone widths.
10. Frontend format, lint, typecheck, tests, and build pass without adding a
    dependency.
