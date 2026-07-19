# Flashcard Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, accessible flashcard-review component that lets a student edit and approve or reject every generated card, then returns only the approved cards.

**Architecture:** A client-side React component consumes the generated API client's `Flashcard` schema plus parent-supplied source passages. It owns the editable batch and decisions in local state, while the homepage provides demo cards and displays the completion result.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, Tailwind CSS 4/global CSS, Vitest 4, React Testing Library 16

## Global Constraints

- Do not add dependencies.
- Reuse `components["schemas"]["Flashcard"]` from `@traceback/api-client`.
- Keep all review state in memory; do not add API, Supabase, or browser-storage persistence.
- Do not call the flashcard-generation API from the review component.
- Require an explicit approve or reject decision for every card before confirmation.
- Editing an approved or rejected card returns it to pending.
- Return approved edited cards in their original batch order; omit rejected cards.
- Keep the interface keyboard operable and usable at phone widths.
- Leave `apps/api/` and `packages/api-client/` unchanged.

---

## File Map

- `apps/web/app/flashcard-review.tsx` — review contract, local state, validation, navigation, decisions, and completion callback
- `apps/web/app/flashcard-review.test.tsx` — component behavior, validation, and empty-state coverage
- `apps/web/app/page.tsx` — demo batch and completion summary
- `apps/web/app/page.test.tsx` — homepage integration smoke test
- `apps/web/app/globals.css` — single-column layout, decision states, responsive rules, and focus styles

## Task 1: Build the Reusable Review Component

**Files:**

- Create: `apps/web/app/flashcard-review.tsx`
- Create: `apps/web/app/flashcard-review.test.tsx`

**Interfaces:**

- Consumes: `components["schemas"]["Flashcard"]` from `@traceback/api-client`
- Produces: `ReviewFlashcard`, `FlashcardReviewProps`, and `FlashcardReview`
- Callback: `onComplete(approvedCards: ReviewFlashcard[]): void`

- [ ] **Step 1: Write the failing component tests**

Create `apps/web/app/flashcard-review.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  FlashcardReview,
  type ReviewFlashcard,
} from "./flashcard-review";

function card(
  id: string,
  question: string,
  sourcePassage = "The mitochondrion is the main site of aerobic ATP production.",
): ReviewFlashcard {
  return {
    id,
    question,
    answer: "The mitochondrion.",
    difficulty: "easy",
    source: {
      session_id: "00000000-0000-4000-8000-000000000001",
      region_id: `region-${id}`,
      slide_number: 7,
    },
    sourcePassage,
  };
}

describe("FlashcardReview", () => {
  it("renders the active card and its grounded source", () => {
    render(
      <FlashcardReview
        cards={[card("1", "Where is aerobic ATP produced?")]}
        onComplete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Review flashcards" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Question")).toHaveValue(
      "Where is aerobic ATP produced?",
    );
    expect(screen.getByText("Slide 7 · region-1")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The mitochondrion is the main site of aerobic ATP production.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Card 1 of 1 · 0 reviewed")).toBeInTheDocument();
  });

  it("blocks approval when editable content is blank", () => {
    render(
      <FlashcardReview
        cards={[card("1", "Where is aerobic ATP produced?")]}
        onComplete={vi.fn()}
      />,
    );

    const question = screen.getByLabelText("Question");
    fireEvent.change(question, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(screen.getByText("Question is required.")).toBeInTheDocument();
    expect(question).toHaveAttribute(
      "aria-describedby",
      "flashcard-1-question-error",
    );
    expect(screen.getByText("Card 1 of 1 · 0 reviewed")).toBeInTheDocument();
  });

  it("resets edited decisions and returns only approved edited cards", () => {
    const onComplete = vi.fn();
    render(
      <FlashcardReview
        cards={[
          card("1", "Where is aerobic ATP produced?"),
          card("2", "What does ATP store?", "ATP stores usable chemical energy."),
        ]}
        onComplete={onComplete}
      />,
    );

    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Which organelle produces aerobic ATP?" },
    });
    fireEvent.change(screen.getByLabelText("Difficulty"), {
      target: { value: "medium" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(screen.getByLabelText("Question")).toHaveValue(
      "What does ATP store?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    const confirm = screen.getByRole("button", { name: "Confirm batch" });
    expect(confirm).toBeEnabled();
    expect(screen.getByText("1 approved · 1 rejected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous card" }));
    expect(screen.getByLabelText("Question")).toHaveValue(
      "Which organelle produces aerobic ATP?",
    );

    fireEvent.change(screen.getByLabelText("Answer"), {
      target: { value: "Mitochondria produce aerobic ATP." },
    });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "1",
        question: "Which organelle produces aerobic ATP?",
        answer: "Mitochondria produce aerobic ATP.",
        difficulty: "medium",
      }),
    ]);
  });

  it("renders an empty state without review controls", () => {
    render(<FlashcardReview cards={[]} onComplete={vi.fn()} />);

    expect(screen.getByText("No flashcards to review.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm batch" }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
corepack pnpm --filter @traceback/web test -- app/flashcard-review.test.tsx
```

Expected: FAIL because `./flashcard-review` does not exist.

- [ ] **Step 3: Implement the minimal review component**

Create `apps/web/app/flashcard-review.tsx`:

```tsx
"use client";

import { useState } from "react";

import type { components } from "@traceback/api-client";

type Flashcard = components["schemas"]["Flashcard"];
type ReviewDecision = "pending" | "approved" | "rejected";
type ValidationErrors = Partial<Record<"question" | "answer", string>>;

export type ReviewFlashcard = Flashcard & {
  sourcePassage: string;
};

export type FlashcardReviewProps = {
  cards: ReviewFlashcard[];
  onComplete: (approvedCards: ReviewFlashcard[]) => void;
};

type ReviewItem = {
  card: ReviewFlashcard;
  decision: ReviewDecision;
};

export function FlashcardReview({
  cards,
  onComplete,
}: FlashcardReviewProps) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    cards.map((card) => ({
      card: { ...card, source: { ...card.source } },
      decision: "pending",
    })),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});

  if (items.length === 0) {
    return <p className="review-empty">No flashcards to review.</p>;
  }

  const active = items[activeIndex];
  const reviewed = items.filter(
    ({ decision }) => decision !== "pending",
  ).length;
  const approved = items.filter(
    ({ decision }) => decision === "approved",
  ).length;
  const rejected = items.filter(
    ({ decision }) => decision === "rejected",
  ).length;
  const allReviewed = reviewed === items.length;
  const errorId = (field: "question" | "answer") =>
    `flashcard-${active.card.id}-${field}-error`;

  function updateCard(
    changes: Partial<
      Pick<ReviewFlashcard, "question" | "answer" | "difficulty">
    >,
    clearedError?: "question" | "answer",
  ) {
    setItems((current) =>
      current.map((item, index) =>
        index === activeIndex
          ? {
              card: { ...item.card, ...changes },
              decision: "pending",
            }
          : item,
      ),
    );
    if (clearedError) {
      setErrors((current) => ({ ...current, [clearedError]: undefined }));
    }
  }

  function advance() {
    if (activeIndex < items.length - 1) {
      setActiveIndex(activeIndex + 1);
      setErrors({});
    }
  }

  function approve() {
    const nextErrors: ValidationErrors = {};
    if (!active.card.question.trim()) {
      nextErrors.question = "Question is required.";
    }
    if (!active.card.answer.trim()) {
      nextErrors.answer = "Answer is required.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setItems((current) =>
      current.map((item, index) =>
        index === activeIndex ? { ...item, decision: "approved" } : item,
      ),
    );
    advance();
  }

  function reject() {
    setItems((current) =>
      current.map((item, index) =>
        index === activeIndex ? { ...item, decision: "rejected" } : item,
      ),
    );
    advance();
  }

  return (
    <section className="review" aria-labelledby="review-title">
      <div className="review-heading">
        <div>
          <p className="review-eyebrow">Suggested study cards</p>
          <h2 id="review-title">Review flashcards</h2>
        </div>
        <p className="review-progress-text" aria-live="polite">
          Card {activeIndex + 1} of {items.length} · {reviewed} reviewed
        </p>
      </div>

      <progress
        className="review-progress"
        max={items.length}
        value={reviewed}
        aria-label={`${reviewed} of ${items.length} cards reviewed`}
      />

      <article
        className="review-card"
        data-decision={active.decision}
        aria-label={`Flashcard ${activeIndex + 1}`}
      >
        <p className="review-status">
          Status: {active.decision}
        </p>

        <label htmlFor={`flashcard-${active.card.id}-question`}>
          Question
        </label>
        <textarea
          id={`flashcard-${active.card.id}-question`}
          value={active.card.question}
          onChange={(event) =>
            updateCard({ question: event.target.value }, "question")
          }
          aria-invalid={Boolean(errors.question)}
          aria-describedby={errors.question ? errorId("question") : undefined}
        />
        {errors.question ? (
          <p className="review-error" id={errorId("question")}>
            {errors.question}
          </p>
        ) : null}

        <label htmlFor={`flashcard-${active.card.id}-answer`}>Answer</label>
        <textarea
          id={`flashcard-${active.card.id}-answer`}
          value={active.card.answer}
          onChange={(event) =>
            updateCard({ answer: event.target.value }, "answer")
          }
          aria-invalid={Boolean(errors.answer)}
          aria-describedby={errors.answer ? errorId("answer") : undefined}
        />
        {errors.answer ? (
          <p className="review-error" id={errorId("answer")}>
            {errors.answer}
          </p>
        ) : null}

        <label htmlFor={`flashcard-${active.card.id}-difficulty`}>
          Difficulty
        </label>
        <select
          id={`flashcard-${active.card.id}-difficulty`}
          value={active.card.difficulty}
          onChange={(event) =>
            updateCard({
              difficulty: event.target
                .value as ReviewFlashcard["difficulty"],
            })
          }
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <aside className="review-source" aria-label="Flashcard source">
          <p>
            Slide {active.card.source.slide_number} ·{" "}
            {active.card.source.region_id}
          </p>
          <blockquote>{active.card.sourcePassage}</blockquote>
        </aside>

        <div className="review-decisions">
          <button type="button" className="review-reject" onClick={reject}>
            Reject
          </button>
          <button type="button" className="review-approve" onClick={approve}>
            Approve
          </button>
        </div>
      </article>

      <div className="review-navigation">
        <button
          type="button"
          onClick={() => {
            setActiveIndex(activeIndex - 1);
            setErrors({});
          }}
          disabled={activeIndex === 0}
          aria-label="Previous card"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveIndex(activeIndex + 1);
            setErrors({});
          }}
          disabled={activeIndex === items.length - 1}
          aria-label="Next card"
        >
          Next
        </button>
      </div>

      <div className="review-summary">
        <p>
          {approved} approved · {rejected} rejected
        </p>
        <button
          type="button"
          disabled={!allReviewed}
          onClick={() =>
            onComplete(
              items
                .filter(({ decision }) => decision === "approved")
                .map(({ card }) => card),
            )
          }
        >
          Confirm batch
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the component tests**

Run:

```bash
corepack pnpm --filter @traceback/web test -- app/flashcard-review.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run focused static checks**

Run:

```bash
corepack pnpm --filter @traceback/web typecheck
corepack pnpm --filter @traceback/web lint
```

Expected: both commands exit 0 with no TypeScript or ESLint errors.

- [ ] **Step 6: Commit the reusable component**

```bash
git add apps/web/app/flashcard-review.tsx apps/web/app/flashcard-review.test.tsx
git commit -m "feat: add flashcard review component"
```

## Task 2: Integrate the Demo Review Flow

**Files:**

- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: `FlashcardReview` and `ReviewFlashcard` from Task 1
- Produces: a homepage demo workflow and an approved/rejected completion summary

- [ ] **Step 1: Replace the homepage test with a failing integration test**

Replace `apps/web/app/page.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("reviews the demo batch and reports the completion result", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Traceback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Review flashcards" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm batch" }));

    expect(
      screen.getByText("Review complete: 0 approved · 2 rejected"),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the homepage test to verify it fails**

Run:

```bash
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
```

Expected: FAIL because the homepage still renders only the scaffold.

- [ ] **Step 3: Add the demo cards and completion summary**

Replace `apps/web/app/page.tsx` with:

```tsx
"use client";

import { useState } from "react";

import {
  FlashcardReview,
  type ReviewFlashcard,
} from "./flashcard-review";

const demoCards: ReviewFlashcard[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    question: "What is the main site of aerobic ATP production?",
    answer: "The mitochondrion.",
    difficulty: "easy",
    source: {
      session_id: "00000000-0000-4000-8000-000000000001",
      region_id: "region-mitochondria",
      slide_number: 7,
    },
    sourcePassage:
      "The mitochondrion is the main site of aerobic ATP production.",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    question: "What form of energy does ATP provide to cells?",
    answer: "ATP provides readily usable chemical energy.",
    difficulty: "medium",
    source: {
      session_id: "00000000-0000-4000-8000-000000000001",
      region_id: "region-atp",
      slide_number: 8,
    },
    sourcePassage:
      "ATP transfers readily usable chemical energy to cellular processes.",
  },
];

export default function Page() {
  const [approvedCount, setApprovedCount] = useState<number>();

  return (
    <main>
      <header className="site-intro">
        <p className="site-kicker">Trace View</p>
        <h1>Traceback</h1>
        <p>
          Check each suggested card against its lecture source before it joins
          your study set.
        </p>
      </header>

      <FlashcardReview
        cards={demoCards}
        onComplete={(approvedCards) =>
          setApprovedCount(approvedCards.length)
        }
      />

      {approvedCount === undefined ? null : (
        <p className="completion-message" role="status">
          Review complete: {approvedCount} approved ·{" "}
          {demoCards.length - approvedCount} rejected
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Add the responsive and accessible review styles**

Replace `apps/web/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  color-scheme: light;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  color: #1d2a27;
  background: #f3f0e8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
textarea,
select {
  font: inherit;
}

button:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 3px solid #18765b;
  outline-offset: 3px;
}

button {
  min-height: 2.75rem;
  border: 1px solid #a9b3ae;
  border-radius: 0.75rem;
  padding: 0.65rem 1rem;
  background: #fff;
  color: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

main {
  margin-inline: auto;
  max-width: 48rem;
  padding: 2rem 1rem 4rem;
}

h1,
h2,
p {
  margin-top: 0;
}

.site-intro {
  margin-bottom: 2rem;
}

.site-intro h1 {
  margin-bottom: 0.5rem;
  font-size: clamp(2.5rem, 9vw, 4.5rem);
  letter-spacing: -0.055em;
}

.site-intro > p:last-child {
  max-width: 42rem;
  color: #4f5d58;
  font-size: 1.1rem;
}

.site-kicker,
.review-eyebrow {
  margin-bottom: 0.4rem;
  color: #376657;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.review {
  border: 1px solid #cbd2ce;
  border-radius: 1.25rem;
  padding: clamp(1rem, 4vw, 2rem);
  background: #fcfbf7;
  box-shadow: 0 1rem 3rem rgb(35 54 48 / 10%);
}

.review-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.review-heading h2 {
  margin-bottom: 0;
  font-size: clamp(1.65rem, 6vw, 2.25rem);
}

.review-progress-text,
.review-status {
  color: #53605c;
}

.review-progress {
  width: 100%;
  height: 0.55rem;
  margin: 1rem 0;
  accent-color: #18765b;
}

.review-card {
  border: 1px solid #ccd3cf;
  border-radius: 1rem;
  padding: clamp(1rem, 4vw, 1.5rem);
  background: #fff;
}

.review-card[data-decision="approved"] {
  border-color: #368268;
}

.review-card[data-decision="rejected"] {
  border-color: #a76b6b;
}

.review-card label {
  display: block;
  margin: 1rem 0 0.4rem;
  font-weight: 750;
}

.review-card textarea,
.review-card select {
  width: 100%;
  border: 1px solid #a9b3ae;
  border-radius: 0.65rem;
  padding: 0.75rem;
  background: #fff;
  color: inherit;
}

.review-card textarea {
  min-height: 6rem;
  resize: vertical;
}

.review-card [aria-invalid="true"] {
  border-color: #a52d2d;
}

.review-error {
  margin: 0.35rem 0 0;
  color: #8d1f1f;
  font-size: 0.9rem;
}

.review-source {
  margin-top: 1.25rem;
  border-left: 0.3rem solid #4d8270;
  border-radius: 0.5rem;
  padding: 0.9rem 1rem;
  background: #edf4f1;
}

.review-source p {
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
  font-weight: 750;
}

.review-source blockquote {
  margin: 0;
  color: #34443f;
}

.review-decisions,
.review-navigation,
.review-summary {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.review-decisions button,
.review-navigation button {
  flex: 1;
}

.review-reject {
  border-color: #ae7070;
  color: #852f2f;
}

.review-approve,
.review-summary button {
  border-color: #175e49;
  background: #175e49;
  color: #fff;
}

.review-summary {
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #d8dedb;
  padding-top: 1rem;
}

.review-summary p {
  margin-bottom: 0;
  font-weight: 700;
}

.review-empty,
.completion-message {
  border: 1px solid #cbd2ce;
  border-radius: 1rem;
  padding: 1rem;
  background: #fcfbf7;
}

.completion-message {
  margin-top: 1rem;
  border-color: #368268;
}

@media (max-width: 36rem) {
  .review-heading,
  .review-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .review-progress-text {
    margin-bottom: 0;
  }
}
```

- [ ] **Step 5: Run the frontend tests**

Run:

```bash
corepack pnpm --filter @traceback/web test
```

Expected: all component and homepage tests PASS.

- [ ] **Step 6: Format the changed frontend files**

Run:

```bash
corepack pnpm --filter @traceback/web format
```

Expected: Prettier exits 0 and only formats frontend files.

- [ ] **Step 7: Run the frontend merge checks**

Run:

```bash
corepack pnpm --filter @traceback/web format:check
corepack pnpm --filter @traceback/web lint
corepack pnpm --filter @traceback/web typecheck
corepack pnpm --filter @traceback/web test
corepack pnpm --filter @traceback/web build
```

Expected: all five commands exit 0.

- [ ] **Step 8: Commit the demo integration**

```bash
git add apps/web/app/page.tsx apps/web/app/page.test.tsx apps/web/app/globals.css
git commit -m "feat: demo flashcard review flow"
```

- [ ] **Step 9: Run the repository merge gate**

Run:

```bash
make check
```

Expected: frontend and backend format, lint, typecheck, tests, generated-client
check, and production build all pass; `git diff --exit-code` reports no
generated API-client change.

## Plan Self-Review

- Every design acceptance criterion maps to Task 1 component behavior or Task 2
  integration and styling.
- The `ReviewFlashcard`, `FlashcardReviewProps`, and callback types are identical
  across both tasks.
- The plan adds no dependency, API route, persistence layer, or generated
  contract change.
- Every implementation step includes exact code, commands, and expected output.
