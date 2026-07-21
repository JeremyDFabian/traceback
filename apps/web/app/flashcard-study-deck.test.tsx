import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { FlashcardStudyDeck } from "./flashcard-study-deck";

const cards = [
  {
    id: "mitochondria",
    question: "What do mitochondria do?",
    answer: "They help cells produce usable energy.",
    difficulty: "easy" as const,
    source_phrase: "Mitochondria",
  },
  {
    id: "atp",
    question: "What does ATP store?",
    answer: "Usable chemical energy for cellular work.",
    difficulty: "medium" as const,
    source_phrase: "ATP",
  },
];

const studySet = {
  id: "biology-notes",
  title: "Cellular respiration",
  pages: [
    {
      id: "page-1",
      title: "Cellular respiration",
      typedText: "Mitochondria help produce ATP for cellular work.",
    },
  ],
};

beforeEach(() => window.localStorage.clear());

describe("FlashcardStudyDeck", () => {
  it("flips a card and advances after a correct recall", () => {
    render(
      <FlashcardStudyDeck
        cards={cards}
        studySet={studySet}
        initialMode="review"
        onClose={() => undefined}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /flashcard question/i }),
    );
    expect(
      screen.getByText("They help cells produce usable energy."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Got it →" }));
    expect(screen.getByText("What does ATP store?")).toBeInTheDocument();
    expect(screen.getByText("1 learned")).toBeInTheDocument();
  });

  it("keeps generated cards saved when the deck is opened again", () => {
    const first = render(
      <FlashcardStudyDeck
        cards={cards}
        studySet={studySet}
        onClose={() => undefined}
      />,
    );
    first.unmount();

    render(<FlashcardStudyDeck cards={[]} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Review cards" }));
    expect(screen.getByText("What do mitochondria do?")).toBeInTheDocument();
    expect(screen.getByText("2 to review")).toBeInTheDocument();
  });

  it("saves the generated notes with their flashcards", () => {
    const first = render(
      <FlashcardStudyDeck
        cards={cards}
        studySet={studySet}
        onClose={() => undefined}
      />,
    );
    first.unmount();

    render(<FlashcardStudyDeck cards={[]} onClose={() => undefined} />);
    expect(screen.getByText("Cellular respiration")).toBeInTheDocument();
    expect(screen.getByText("1 page · 2 cards")).toBeInTheDocument();
  });

  it("opens a saved study set from the deck library", () => {
    const first = render(
      <FlashcardStudyDeck
        cards={cards}
        studySet={studySet}
        onClose={() => undefined}
      />,
    );
    first.unmount();

    const onOpenStudySet = vi.fn();
    render(
      <FlashcardStudyDeck
        cards={[]}
        onClose={() => undefined}
        onOpenStudySet={onOpenStudySet}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open notes →" }));

    expect(onOpenStudySet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "biology-notes" }),
      expect.arrayContaining([expect.objectContaining({ id: "mitochondria" })]),
    );
  });
});
