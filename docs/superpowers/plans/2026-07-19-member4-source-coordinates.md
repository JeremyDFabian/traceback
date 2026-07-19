# Member 4 Source Coordinates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve exact normalized slide highlight boxes in generated flashcards and show them with the source passage during review.

**Architecture:** Pydantic remains the contract source of truth. FastAPI validates and copies retrieval-owned source metadata without asking the model to generate it; the existing React review component renders that returned metadata.

**Tech Stack:** FastAPI, Pydantic 2, pytest, generated OpenAPI TypeScript types, React 19, Vitest, Testing Library

## Global Constraints

- Use normalized slide coordinates; origins are in `0..1`, dimensions are positive, and boxes stay inside the slide.
- Require at least one highlight box and the exact slide passage.
- Do not implement PDF extraction, ranking, or a graphical PDF overlay.
- Add no dependencies or speculative abstractions.

---

### Task 1: Validate and preserve source coordinates

**Files:**
- Modify: `apps/api/app/schemas/flashcards.py`
- Modify: `apps/api/app/api/flashcards.py`
- Test: `apps/api/tests/test_flashcards.py`

**Interfaces:**
- Consumes: `GenerateFlashcardsRequest.source`
- Produces: `HighlightBox` and `FlashcardSourceReference.slide_text` / `highlight_boxes`

- [ ] **Step 1: Write failing API tests**

Add valid source metadata to `source_payload()`:

```python
"highlight_boxes": [{"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1}],
```

Assert the endpoint preserves `slide_text` and `highlight_boxes`, then add:

```python
@pytest.mark.parametrize(
    "box",
    [
        {"x": 0.9, "y": 0.2, "width": 0.2, "height": 0.1},
        {"x": 0.1, "y": 0.2, "width": 0, "height": 0.1},
    ],
)
def test_invalid_highlight_box_never_calls_generator(
    api_client: TestClient, box: dict[str, float]
) -> None:
    generator = FakeFlashcardGenerator()
    app.dependency_overrides[get_flashcard_generator] = lambda: generator
    payload = source_payload()
    payload["highlight_boxes"] = [box]

    response = api_client.post(
        "/api/flashcards/generate", json={"source": payload, "count": 1}
    )

    assert response.status_code == 422
    assert generator.call_count == 0
```

- [ ] **Step 2: Verify the tests fail for missing contract behavior**

Run:

```powershell
uv run pytest tests/test_flashcards.py -q
```

Expected: the traceability assertion fails because returned sources omit the new fields, and invalid boxes are accepted.

- [ ] **Step 3: Add the minimal Pydantic contract**

Add:

```python
from pydantic import BaseModel, ConfigDict, Field, model_validator


class HighlightBox(FlashcardSchema):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def stays_within_slide(self) -> "HighlightBox":
        if self.x + self.width > 1 or self.y + self.height > 1:
            raise ValueError("highlight box must stay within the slide")
        return self
```

Add this field to both source models:

```python
highlight_boxes: list[HighlightBox] = Field(min_length=1, max_length=50)
```

Add `slide_text` to `FlashcardSourceReference`, then copy both fields from the request in `generate_flashcards()`.

- [ ] **Step 4: Verify the API tests pass**

Run:

```powershell
uv run pytest tests/test_flashcards.py -q
```

Expected: all flashcard API tests pass.

- [ ] **Step 5: Commit the API contract**

```powershell
git add apps/api/app/schemas/flashcards.py apps/api/app/api/flashcards.py apps/api/tests/test_flashcards.py
git commit -m "feat: preserve slide source coordinates"
```

### Task 2: Render returned source coordinates

**Files:**
- Modify: `packages/api-client/openapi.json`
- Modify: `packages/api-client/src/schema.d.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.test.tsx`
- Modify: `apps/web/app/flashcard-review.tsx`
- Modify: `apps/web/app/flashcard-review.test.tsx`

**Interfaces:**
- Consumes: generated `components["schemas"]["Flashcard"]`
- Produces: accessible passage and coordinate text in `FlashcardReview`

- [ ] **Step 1: Regenerate the API client**

Run:

```powershell
bash scripts/generate-api-client.sh
```

Expected: generated files include `HighlightBox`, `slide_text`, and `highlight_boxes`.

- [ ] **Step 2: Write the failing web tests**

Update test cards to return:

```typescript
source: {
  session_id: "00000000-0000-4000-8000-000000000001",
  region_id: "region-1",
  slide_number: 7,
  slide_text: "The mitochondrion is the main site of aerobic ATP production.",
  highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
},
```

Assert review contains:

```typescript
expect(
  screen.getByText("x 10% · y 20% · width 30% · height 10%"),
).toBeInTheDocument();
```

- [ ] **Step 3: Verify the web test fails because coordinates are not rendered**

Run:

```powershell
corepack pnpm --filter @traceback/web test
```

Expected: the coordinate-text assertion fails.

- [ ] **Step 4: Use the API response as the single source**

Make `ReviewFlashcard` an alias:

```typescript
export type ReviewFlashcard = Flashcard;
```

Render `active.card.source.slide_text` and:

```typescript
{active.card.source.highlight_boxes.map((box, index) => (
  <li key={index}>
    x {Math.round(box.x * 100)}% · y {Math.round(box.y * 100)}% · width{" "}
    {Math.round(box.width * 100)}% · height {Math.round(box.height * 100)}%
  </li>
))}
```

In `page.tsx`, remove the response mapping and use:

```typescript
setCards(result.flashcards);
```

- [ ] **Step 5: Verify web tests and types pass**

Run:

```powershell
corepack pnpm --filter @traceback/web test
corepack pnpm typecheck
```

Expected: all web tests and TypeScript checks pass.

- [ ] **Step 6: Commit the review integration**

```powershell
git add packages/api-client/openapi.json packages/api-client/src/schema.d.ts apps/web/app/page.tsx apps/web/app/page.test.tsx apps/web/app/flashcard-review.tsx apps/web/app/flashcard-review.test.tsx
git commit -m "feat: show flashcard source coordinates"
```

### Task 3: Record progress and run the merge gate

**Files:**
- Modify: `docs/member-4-progress.md`

**Interfaces:**
- Consumes: verified API and UI behavior
- Produces: an evidence-linked completed Member 4 checklist item

- [ ] **Step 1: Mark coordinate traceability complete**

Change:

```markdown
- [ ] Verify every slide match exposes its source passage and highlight
  coordinates.
```

to:

```markdown
- [x] Verify every generated flashcard exposes its source passage and highlight
  coordinates through the API and review UI.
```

- [ ] **Step 2: Run the full merge gate**

Run:

```powershell
make check
```

Expected: formatting, lint, type checks, tests, generated-contract diff check, and builds all exit successfully.

- [ ] **Step 3: Commit verified progress**

```powershell
git add docs/member-4-progress.md
git commit -m "docs: update member 4 source progress"
```
