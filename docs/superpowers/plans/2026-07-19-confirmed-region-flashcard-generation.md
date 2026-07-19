# Confirmed-Region Flashcard Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require explicit confirmation of a demo notebook region before the homepage requests grounded flashcards and opens the existing review flow.

**Architecture:** Keep the single demo source and its state in the homepage. Post the generated API-client request type directly to FastAPI, minimally validate the response shape, attach the known source passage, and reuse `FlashcardReview`.

**Tech Stack:** Next.js 16, React 19, TypeScript, generated OpenAPI types, Vitest, Testing Library, CSS

## Global Constraints

- Keep the original notebook image as the primary interface when notebook capture is added; this increment uses only a non-private demo region.
- Require student confirmation before flashcard generation.
- Every reviewed card must show its slide number and exact source passage.
- Do not add dependencies, persistence, upload, detection, matching, or session infrastructure.
- The browser communicates only with FastAPI.

---

### Task 1: Gate live generation behind region confirmation

**Files:**
- Modify: `apps/web/app/page.test.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `components["schemas"]["GenerateFlashcardsRequest"]`,
  `components["schemas"]["GenerateFlashcardsResponse"]`, and
  `FlashcardReview`.
- Produces: a homepage flow that posts to
  `${NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/flashcards/generate`
  only after explicit confirmation.

- [ ] **Step 1: Replace the homepage test with failing confirmation, success, and failure coverage**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "./page";

const generatedCards = {
  flashcards: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      question: "What is the main site of aerobic ATP production?",
      answer: "The mitochondrion.",
      difficulty: "easy" as const,
      source: {
        session_id: "00000000-0000-4000-8000-000000000001",
        region_id: "region-mitochondria",
        slide_number: 7,
      },
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("home page", () => {
  it("generates cards only after the student confirms the region", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(generatedCards)));

    render(<Page />);

    const generate = screen.getByRole("button", {
      name: "Generate flashcards",
    });
    expect(generate).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I confirm this starred region and lecture source",
      }),
    );
    expect(generate).toBeEnabled();
    fireEvent.click(generate);

    await screen.findByRole("heading", { name: "Review flashcards" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/flashcards/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          source: {
            session_id: "00000000-0000-4000-8000-000000000001",
            region_id: "region-mitochondria",
            slide_number: 7,
            note_text: "Mitochondria make ATP during aerobic respiration.",
            slide_text:
              "The mitochondrion is the main site of aerobic ATP production.",
          },
          count: 2,
        }),
      }),
    );
    expect(
      screen.getByText(
        "The mitochondrion is the main site of aerobic ATP production.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a retryable error when generation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 502 }),
    );

    render(<Page />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Generate flashcards" }),
    );

    expect(
      await screen.findByText(
        "Flashcard generation failed. Check the API and try again.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate flashcards" }),
      ).toBeEnabled(),
    );
  });
});
```

- [ ] **Step 2: Run the homepage test and verify it fails**

Run:

```bash
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
```

Expected: FAIL because the current page has no confirmation control and renders
hard-coded cards without calling `fetch`.

- [ ] **Step 3: Replace the homepage with the minimal confirmation and generation flow**

```tsx
"use client";

import { useState } from "react";

import type { components } from "@traceback/api-client";

import { FlashcardReview, type ReviewFlashcard } from "./flashcard-review";

type GenerateRequest = components["schemas"]["GenerateFlashcardsRequest"];
type GenerateResponse = components["schemas"]["GenerateFlashcardsResponse"];

const slidePassage =
  "The mitochondrion is the main site of aerobic ATP production.";
const demoRequest: GenerateRequest = {
  source: {
    session_id: "00000000-0000-4000-8000-000000000001",
    region_id: "region-mitochondria",
    slide_number: 7,
    note_text: "Mitochondria make ATP during aerobic respiration.",
    slide_text: slidePassage,
  },
  count: 2,
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
      if (!Array.isArray(result.flashcards)) throw new Error("invalid response");
      setCards(
        result.flashcards.map((card) => ({
          ...card,
          sourcePassage: slidePassage,
        })),
      );
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
          onComplete={(approvedCards) =>
            setApprovedCount(approvedCards.length)
          }
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
```

- [ ] **Step 4: Add only the layout rules needed by the new native controls**

Append to `apps/web/app/globals.css`:

```css
.region-confirmation {
  border: 1px solid oklch(0.83 0.018 155);
  border-radius: 1rem;
  padding: 1.5rem;
  background: oklch(0.99 0.006 90);
}

.region-consent {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 1.25rem 0;
  font-weight: 700;
}

.region-consent input {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: oklch(0.45 0.09 155);
}

.region-consent input:focus-visible {
  outline: 3px solid oklch(0.55 0.12 155);
  outline-offset: 3px;
}
```

- [ ] **Step 5: Run the focused tests and checks**

Run:

```bash
corepack pnpm --filter @traceback/web test -- app/page.test.tsx app/flashcard-review.test.tsx
corepack pnpm --filter @traceback/web typecheck
corepack pnpm --filter @traceback/web lint
```

Expected: 7 tests pass, type checking exits 0, and lint exits 0.

- [ ] **Step 6: Commit the feature**

```bash
git add apps/web/app/page.tsx apps/web/app/page.test.tsx apps/web/app/globals.css
git commit -m "feat: gate flashcards on region confirmation"
```

### Task 2: Record progress and run the merge gate

**Files:**
- Modify: `docs/member-4-progress.md`

**Interfaces:**
- Consumes: the verified homepage confirmation and live generation flow.
- Produces: an accurate Member 4 checklist.

- [ ] **Step 1: Mark the two completed checklist items**

Change these entries to checked:

```markdown
- [x] Request generation only after the student confirms a starred or questioned
  notebook region.
- [x] Connect the review UI to live generated cards; the homepage posts the
  confirmed demo region to FastAPI.
```

Update the verification line to:

```markdown
**Latest verification:** API flashcard tests: 38 passed; web tests: 7 passed;
web typecheck and lint passed.
```

- [ ] **Step 2: Run the complete merge gate**

Run:

```bash
make check
```

Expected: all repository formatting, lint, type-check, build, and test commands
exit 0. If the repository does not expose `make` on Windows, run the command
behind its `check` target without changing the Makefile.

- [ ] **Step 3: Commit the progress update**

```bash
git add docs/member-4-progress.md
git commit -m "docs: update member 4 progress"
```
