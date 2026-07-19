"use client";

import { useState } from "react";

import type { components } from "@traceback/api-client";

import demoFixture from "../../../sample-data/mitochondria-atp/expected.json";

import { FlashcardReview, type ReviewFlashcard } from "./flashcard-review";

type GenerateRequest = components["schemas"]["GenerateFlashcardsRequest"];
type GenerateResponse = components["schemas"]["GenerateFlashcardsResponse"];

const region = demoFixture.approved_analysis.regions[0];
const slidePassage = demoFixture.expected_match.passage;
const demoRequest: GenerateRequest = {
  source: {
    session_id: demoFixture.session_id,
    region_id: region.id,
    slide_number: demoFixture.expected_match.slide_number,
    note_text: region.transcription,
    slide_text: slidePassage,
    highlight_boxes: demoFixture.expected_match.highlight_boxes,
  },
  count: demoFixture.flashcard_count,
};

export default function Page() {
  const [confirmed, setConfirmed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<ReviewFlashcard[]>();
  const [error, setError] = useState("");
  const [approvedCount, setApprovedCount] = useState<number>();

  async function generate() {
    if (!confirmed || generating) return;

    setGenerating(true);
    setError("");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/flashcards/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(demoRequest),
        },
      );
      if (!response.ok) throw new Error("generation failed");

      const result = (await response.json()) as GenerateResponse;
      if (!Array.isArray(result.flashcards))
        throw new Error("invalid response");
      setCards(result.flashcards);
    } catch {
      setError("Flashcard generation failed. Check the API and try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main>
      <header className="site-intro">
        <p className="site-kicker">Trace View</p>
        <h1>Traceback</h1>
        <p>
          Confirm a marked notebook region and its lecture source before
          generating study cards.
        </p>
      </header>

      {cards ? (
        <FlashcardReview
          cards={cards}
          onComplete={(approvedCards) => setApprovedCount(approvedCards.length)}
        />
      ) : (
        <section className="region-confirmation" aria-labelledby="region-title">
          <p className="review-eyebrow">Starred notebook region</p>
          <h2 id="region-title">Mitochondria and ATP</h2>
          <p>{demoRequest.source.note_text}</p>
          <aside className="review-source" aria-label="Matched lecture source">
            <p>Slide {demoRequest.source.slide_number}</p>
            <blockquote>{slidePassage}</blockquote>
          </aside>
          <label className="region-consent">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm this starred region and lecture source
          </label>
          <button
            type="button"
            disabled={!confirmed || generating}
            onClick={generate}
          >
            {generating ? "Generating…" : "Generate flashcards"}
          </button>
          {error ? (
            <p className="review-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      )}

      {approvedCount === undefined ? null : (
        <p className="completion-message" role="status">
          Review complete: {approvedCount} approved ·{" "}
          {(cards?.length ?? 0) - approvedCount} rejected
        </p>
      )}
    </main>
  );
}
