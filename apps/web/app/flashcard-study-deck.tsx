/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

export type StudyCard = {
  id: string;
  question: string;
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  source_phrase?: string;
  studySetId?: string;
};

export type SavedStudyNote = {
  id: string;
  title: string;
  typedText: string;
  imageDataUrl?: string;
  regions?: unknown[];
};

export type StudySetInput = {
  id: string;
  title: string;
  pages: SavedStudyNote[];
};

type RecallResult = "again" | "known";
export type SavedStudySet = StudySetInput & { savedAt: string };
type SavedDeck = {
  cards: StudyCard[];
  results: Record<string, RecallResult>;
  studySets: SavedStudySet[];
};
const storageKey = "traceback-study-deck-v2";
const legacyStorageKey = "traceback-study-deck-v1";

function loadDeck(): SavedDeck {
  if (typeof window === "undefined") {
    return { cards: [], results: {}, studySets: [] };
  }

  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (
      saved &&
      Array.isArray(saved.cards) &&
      typeof saved.results === "object"
    ) {
      return {
        cards: saved.cards,
        results: saved.results,
        studySets: Array.isArray(saved.studySets) ? saved.studySets : [],
      };
    }

    const legacy = JSON.parse(
      window.localStorage.getItem(legacyStorageKey) ?? "{}",
    );
    if (Array.isArray(legacy.cards) && typeof legacy.results === "object") {
      return { cards: legacy.cards, results: legacy.results, studySets: [] };
    }
  } catch {
    // A malformed local value should never stop a learner from opening the app.
  }

  return { cards: [], results: {}, studySets: [] };
}

export function FlashcardStudyDeck({
  cards,
  studySet,
  onClose,
  onOpenStudySet,
  onShareStudySet,
  initialMode = "library",
}: {
  cards: StudyCard[];
  studySet?: StudySetInput;
  onClose: () => void;
  onOpenStudySet?: (studySet: SavedStudySet, cards: StudyCard[]) => void;
  onShareStudySet?: (
    studySet: SavedStudySet,
    cards: StudyCard[],
  ) => Promise<string>;
  initialMode?: "library" | "review";
}) {
  const [deck, setDeck] = useState<SavedDeck>(loadDeck);
  const [activeSetId, setActiveSetId] = useState<string | undefined>(
    studySet?.id,
  );
  const [isReviewing, setIsReviewing] = useState(initialMode === "review");
  const [isFlipped, setIsFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [sessionResults, setSessionResults] = useState<RecallResult[]>([]);
  const [sharingSetId, setSharingSetId] = useState<string>();
  const [sharedSetId, setSharedSetId] = useState<string>();
  const [shareMessage, setShareMessage] = useState<string>();
  const [shareUrl, setShareUrl] = useState<string>();
  const dragStart = useRef<number | undefined>(undefined);
  const hasSwiped = useRef(false);
  const savedIncoming = useRef("");
  const incoming = useMemo(
    () =>
      cards.map(({ id, question, answer, difficulty, source_phrase }) => ({
        id,
        question,
        answer,
        difficulty,
        source_phrase,
        studySetId: studySet?.id,
      })),
    [cards, studySet?.id],
  );

  useEffect(() => {
    const signature = JSON.stringify({ incoming, studySet });
    if (signature === savedIncoming.current) return;
    savedIncoming.current = signature;
    if (!incoming.length && !studySet) return;

    // Persisting a newly generated set is the deliberate synchronization point
    // between incoming analysis results and the learner's local study deck.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeck((current) => {
      const existing = new Map(current.cards.map((card) => [card.id, card]));
      const incomingIds = new Set(incoming.map((card) => card.id));
      const nextCards = incoming.map((card) => existing.get(card.id) ?? card);
      const retainedCards = current.cards.filter(
        (card) => !incomingIds.has(card.id),
      );
      const nextStudySets = studySet
        ? [
            { ...studySet, savedAt: new Date().toISOString() },
            ...current.studySets.filter((saved) => saved.id !== studySet.id),
          ]
        : current.studySets;

      return {
        ...current,
        cards: [...nextCards, ...retainedCards],
        studySets: nextStudySets,
      };
    });
  }, [incoming, studySet]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(deck));
  }, [deck]);

  const activeSet =
    deck.studySets.find((set) => set.id === activeSetId) ?? deck.studySets[0];
  const setCards = activeSet
    ? deck.cards.filter((card) => card.studySetId === activeSet.id)
    : deck.cards;
  const dueCards = setCards.filter((card) => deck.results[card.id] !== "known");
  const active = dueCards[0];
  const remaining = dueCards.length;
  const known = setCards.length - remaining;

  function chooseSet(id: string) {
    setActiveSetId(id);
    setIsFlipped(false);
    setDragX(0);
  }

  function openStudySet(studySetToOpen: SavedStudySet) {
    const cardsForSet = deck.cards.filter(
      (card) => card.studySetId === studySetToOpen.id,
    );
    onOpenStudySet?.(studySetToOpen, cardsForSet);
  }

  function deleteStudySet(studySetToDelete: SavedStudySet) {
    if (
      !window.confirm(
        `Delete "${studySetToDelete.title}" and its saved flashcards from this device?`,
      )
    ) {
      return;
    }
    setDeck((current) => {
      const deletedCardIds = new Set(
        current.cards
          .filter((card) => card.studySetId === studySetToDelete.id)
          .map((card) => card.id),
      );
      return {
        cards: current.cards.filter(
          (card) => card.studySetId !== studySetToDelete.id,
        ),
        studySets: current.studySets.filter(
          (studySet) => studySet.id !== studySetToDelete.id,
        ),
        results: Object.fromEntries(
          Object.entries(current.results).filter(
            ([cardId]) => !deletedCardIds.has(cardId),
          ),
        ),
      };
    });
    setActiveSetId((current) =>
      current === studySetToDelete.id ? undefined : current,
    );
    setShareUrl(undefined);
    if (sharedSetId === studySetToDelete.id) setSharedSetId(undefined);
    setShareMessage("Study set deleted");
  }

  async function shareStudySet(studySetToShare: SavedStudySet) {
    if (!onShareStudySet) return;
    setSharingSetId(studySetToShare.id);
    setShareMessage(undefined);
    try {
      const cardsForSet = deck.cards.filter(
        (card) => card.studySetId === studySetToShare.id,
      );
      const link = await onShareStudySet(studySetToShare, cardsForSet);
      setSharedSetId(studySetToShare.id);
      setShareUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setShareMessage("Share link copied");
      } catch {
        setShareMessage("Share link ready to copy");
      }
    } catch {
      setShareMessage("Could not create a share link. Try again.");
    } finally {
      setSharingSetId(undefined);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Share link copied");
    } catch {
      setShareMessage("Select the link below and copy it");
    }
  }

  function record(result: RecallResult) {
    if (!active) return;
    setDeck((current) => {
      const nextCards =
        result === "again"
          ? [
              ...current.cards.filter((card) => card.id !== active.id),
              current.cards.find((card) => card.id === active.id)!,
            ]
          : current.cards;
      return {
        ...current,
        cards: nextCards,
        results: { ...current.results, [active.id]: result },
      };
    });
    setSessionResults((current) => [...current, result]);
    setIsFlipped(false);
    setDragX(0);
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (dragStart.current === undefined) return;
    setDragX(Math.max(-140, Math.min(140, event.clientX - dragStart.current)));
  }

  function onPointerUp() {
    const distance = dragX;
    dragStart.current = undefined;
    if (distance > 88) {
      hasSwiped.current = true;
      record("again");
      return;
    }
    if (distance < -88) {
      hasSwiped.current = true;
      record("known");
      return;
    }
    setDragX(0);
  }

  function resetDeck() {
    const cardIds = new Set(setCards.map((card) => card.id));
    setDeck((current) => ({
      ...current,
      results: Object.fromEntries(
        Object.entries(current.results).filter(([id]) => !cardIds.has(id)),
      ),
    }));
    setSessionResults([]);
    setIsFlipped(false);
  }

  return (
    <div
      className="flashcard-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Study deck"
    >
      <section className="flashcard-drawer study-deck">
        <header>
          <div>
            <p className="eyebrow">Saved study sets</p>
            <h2>Learn it. Recall it.</h2>
          </div>
          <button className="text-button" onClick={onClose}>
            Close
          </button>
        </header>
        {!isReviewing ? (
          deck.studySets.length ? (
            <div className="study-set-library">
              <p className="eyebrow">Pick up where you left off</p>
              {deck.studySets.map((savedSet) => {
                const savedCards = deck.cards.filter(
                  (card) => card.studySetId === savedSet.id,
                );
                return (
                  <article key={savedSet.id} className="study-set-card">
                    <div className="study-set-summary">
                      <p>
                        {savedSet.pages.length}{" "}
                        {savedSet.pages.length === 1 ? "page" : "pages"} ·{" "}
                        {savedCards.length} cards
                      </p>
                      <h3>{savedSet.title}</h3>
                      <small>
                        Notes, original pages, and flashcards saved together ·{" "}
                        {new Date(savedSet.savedAt).toLocaleDateString()}
                      </small>
                    </div>
                    <div className="study-set-actions">
                      <button
                        type="button"
                        onClick={() => openStudySet(savedSet)}
                      >
                        Open notes →
                      </button>
                      {savedCards.length ? (
                        <button
                          type="button"
                          className="review-set-button"
                          onClick={() => {
                            chooseSet(savedSet.id);
                            setIsReviewing(true);
                          }}
                        >
                          Review cards
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="share-set-button"
                        disabled={sharingSetId === savedSet.id}
                        onClick={() => void shareStudySet(savedSet)}
                      >
                        {sharingSetId === savedSet.id
                          ? "Creating link…"
                          : "Share set"}
                      </button>
                    </div>
                    {sharedSetId === savedSet.id && shareUrl ? (
                      <div className="share-link-box">
                        <input
                          aria-label={`Shareable link for ${savedSet.title}`}
                          readOnly
                          value={shareUrl}
                          onFocus={(event) => event.currentTarget.select()}
                        />
                        <button
                          type="button"
                          onClick={() => void copyShareLink()}
                        >
                          Copy link
                        </button>
                      </div>
                    ) : null}
                    {sharedSetId === savedSet.id && shareMessage ? (
                      <p className="share-status" role="status">
                        {shareMessage}
                      </p>
                    ) : null}
                    <div className="study-set-delete-row">
                      <button
                        type="button"
                        className="delete-set-button"
                        onClick={() => deleteStudySet(savedSet)}
                      >
                        Delete set
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="study-empty">
              <p className="eyebrow">No study sets yet</p>
              <h3>Scan notes, then make them yours.</h3>
              <p>
                Each generated set keeps its interactive notes, uploaded pages,
                and flashcards together.
              </p>
            </div>
          )
        ) : !setCards.length ? (
          <div className="study-empty">
            <p className="eyebrow">Nothing saved yet</p>
            <h3>Generate cards from your notes first.</h3>
            <p>
              Your notes and flashcards will stay together on this device for
              your next review.
            </p>
          </div>
        ) : active ? (
          <>
            <div className="study-deck-status" aria-live="polite">
              <span>{remaining} to review</span>
              <span>{known} learned</span>
            </div>
            <div className="study-card-stack" aria-label="Flashcard stack">
              {dueCards
                .slice(1, 3)
                .reverse()
                .map((card, index) => (
                  <div
                    className={`study-card-shadow shadow-${index + 1}`}
                    key={card.id}
                  />
                ))}
              <button
                className={`study-card ${isFlipped ? "is-flipped" : ""}`}
                type="button"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                  dragStart.current = undefined;
                  setDragX(0);
                }}
                onClick={() => {
                  if (hasSwiped.current) {
                    hasSwiped.current = false;
                    return;
                  }
                  setIsFlipped((current) => !current);
                }}
                style={{
                  transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)`,
                }}
                aria-label={
                  isFlipped
                    ? "Flashcard answer. Tap to show question."
                    : "Flashcard question. Tap to reveal answer."
                }
              >
                <span className="study-card-index">
                  {known + 1} / {setCards.length}
                </span>
                <span className="study-card-kicker">
                  {isFlipped ? "Answer" : "Question"}
                </span>
                <strong>{isFlipped ? active.answer : active.question}</strong>
                <small>
                  {isFlipped
                    ? "Tap to see the question again"
                    : "Tap to reveal the answer"}
                </small>
                {active.source_phrase ? (
                  <em>From "{active.source_phrase}"</em>
                ) : null}
              </button>
            </div>
            <p className="study-swipe-hint">
              Swipe right to review again · Swipe left when you got it
            </p>
            <div className="study-actions">
              <button
                type="button"
                className="study-again"
                onClick={() => record("again")}
              >
                ↺ Review again
              </button>
              <button
                type="button"
                className="study-known"
                onClick={() => record("known")}
              >
                Got it →
              </button>
            </div>
          </>
        ) : (
          <div className="study-complete" aria-live="polite">
            <p className="eyebrow">Session complete</p>
            <h3>You recalled every card.</h3>
            <p>
              {sessionResults.filter((result) => result === "known").length}{" "}
              cards marked as known this session.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={resetDeck}
            >
              Review this deck again
            </button>
          </div>
        )}{" "}
      </section>
    </div>
  );
}
