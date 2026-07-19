"use client";

import { useState } from "react";

import { FlashcardReview, type ReviewFlashcard } from "./flashcard-review";

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
        onComplete={(approvedCards) => setApprovedCount(approvedCards.length)}
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
