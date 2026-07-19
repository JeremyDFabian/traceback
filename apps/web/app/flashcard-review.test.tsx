import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FlashcardReview, type ReviewFlashcard } from "./flashcard-review";

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
          card(
            "2",
            "What does ATP store?",
            "ATP stores usable chemical energy.",
          ),
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
