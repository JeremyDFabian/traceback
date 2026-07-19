"use client";

import { useState } from "react";

import type { components } from "@traceback/api-client";

type Flashcard = components["schemas"]["Flashcard"];
type ReviewDecision = "pending" | "approved" | "rejected";
type ValidationErrors = Partial<Record<"question" | "answer", string>>;

export type ReviewFlashcard = Flashcard;

export type FlashcardReviewProps = {
  cards: ReviewFlashcard[];
  onComplete: (approvedCards: ReviewFlashcard[]) => void;
};

type ReviewItem = {
  card: ReviewFlashcard;
  decision: ReviewDecision;
};

export function FlashcardReview({ cards, onComplete }: FlashcardReviewProps) {
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
        <p className="review-status">Status: {active.decision}</p>

        <label htmlFor={`flashcard-${active.card.id}-question`}>Question</label>
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
              difficulty: event.target.value as ReviewFlashcard["difficulty"],
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
          <blockquote>{active.card.source.slide_text}</blockquote>
          <ul aria-label="Highlight coordinates">
            {active.card.source.highlight_boxes.map((box, index) => (
              <li key={index}>
                x {Math.round(box.x * 100)}% · y {Math.round(box.y * 100)}% ·
                width {Math.round(box.width * 100)}% · height{" "}
                {Math.round(box.height * 100)}%
              </li>
            ))}
          </ul>
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
