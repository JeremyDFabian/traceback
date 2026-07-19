# Member 4 Demo and QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic sample notebook/deck pair and verify the confirmed-region → real slide match → grounded flashcard → review contract without live OpenAI, database, or browser orchestration.

**Architecture:** A committed `expected.json` is the shared contract for the synthetic assets, FastAPI acceptance test, and Vitest review-flow test. The match API keeps extracted source spans and adds normalized `HighlightBox` values that can be passed directly to the existing grounded flashcard endpoint. Tests override only database and OpenAI boundaries.

**Tech Stack:** PNG, PDF, JSON, FastAPI, Pydantic, PyMuPDF, pytest, Next.js, TypeScript, Vitest

## Global Constraints

- Keep the original notebook image as the primary demo artifact.
- Require student confirmation before slide retrieval and flashcard generation.
- Every slide match must include its source passage and highlight coordinates.
- Tests must not require OpenAI or database credentials.
- Do not add Playwright or any other dependency.
- Do not add concept-graph work, live camera automation, deployment, or video recording.
- Use `feature/`, `fix/`, or `docs/` branch prefixes; never create `codex/` branches.

---

### Task 1: Add the Shared Synthetic Demo Fixture

**Files:**
- Create: `sample-data/mitochondria-atp/notebook-page.png`
- Create: `sample-data/mitochondria-atp/lecture-deck.pdf`
- Create: `sample-data/mitochondria-atp/expected.json`

**Interfaces:**
- Consumes: `AnalysisResult`, `GenerateFlashcardsRequest`, and `Flashcard` field names from the generated API contract.
- Produces: `sample-data/mitochondria-atp/expected.json`, the single fixture imported by Tasks 3 and 4.

- [ ] **Step 0: Install the locked development dependencies**

Run from the repository root:

```powershell
corepack pnpm install --frozen-lockfile
Push-Location apps/api
uv sync --all-groups
Pop-Location
```

Expected: installation succeeds without modifying `pnpm-lock.yaml` or
`apps/api/uv.lock`.

- [ ] **Step 1: Generate the notebook-page PNG**

Use the `imagegen` skill to create a legible portrait notebook page with this exact content and composition:

```text
White ruled notebook paper photographed from directly above in soft daylight.
Blue handwritten heading: "Cellular Respiration".
Main starred note: "Mitochondria produce ATP during aerobic respiration."
Secondary note: "ATP stores usable chemical energy."
Draw a blue box around the starred mitochondria sentence.
Add one small question mark beside "Why is oxygen needed?"
No hands, desk clutter, logos, personal names, or unrelated writing.
Ordinary phone-camera realism, readable handwriting, portrait orientation.
```

Save the selected result as:

```text
sample-data/mitochondria-atp/notebook-page.png
```

- [ ] **Step 2: Inspect the PNG**

Open the image with `view_image` and verify:

```text
- portrait notebook page is fully visible
- starred mitochondria sentence is readable
- box and question mark are visible
- no private or identifying content appears
```

Expected: all four checks pass. Regenerate once with the same wording plus a correction if any check fails.

- [ ] **Step 3: Create the deterministic two-slide lecture PDF**

Use the `pdf` skill and PyMuPDF to create a 600 × 800 point PDF with these pages:

```text
Slide 1
Title at (72, 90), 24 pt: "Cell Energy Overview"
Body at (72, 180), 18 pt: "Cells transfer chemical energy through metabolic pathways."

Slide 2
Title at (72, 90), 24 pt: "Cellular Respiration"
Body at (72, 180), 18 pt: "Mitochondria produce ATP during aerobic respiration."
Footer at (72, 700), 14 pt: "ATP stores usable chemical energy for cellular work."
```

Save it as:

```text
sample-data/mitochondria-atp/lecture-deck.pdf
```

Render both pages and inspect them. Expected: no clipped text, both pages are 600 × 800 points, and slide 2 contains the exact matching sentence.

- [ ] **Step 4: Extract the PDF once to record its actual normalized boxes**

Run from `apps/api`:

```powershell
uv run python -c "from pathlib import Path; from app.pdf import extract_pdf; import json; slides=extract_pdf(Path('../../sample-data/mitochondria-atp/lecture-deck.pdf')); slide=slides[1]; print(json.dumps([{'text': s.text, 'x': s.x/slide.width, 'y': s.y/slide.height, 'width': s.width/slide.width, 'height': s.height/slide.height} for s in slide.spans], indent=2))"
```

Expected: three slide-2 spans named `Cellular Respiration`, `Mitochondria produce ATP during aerobic respiration.`, and `ATP stores usable chemical energy for cellular work.` with values between 0 and 1.

- [ ] **Step 5: Add the shared expected fixture**

Create `sample-data/mitochondria-atp/expected.json` with the exact normalized
values produced by the specified PDF geometry:

```json
{
  "session_id": "00000000-0000-4000-8000-000000000001",
  "approved_analysis": {
    "page_summary": "Cellular respiration notes about mitochondria and ATP.",
    "regions": [
      {
        "id": "region-mitochondria",
        "label": "Mitochondria and ATP",
        "transcription": "Mitochondria produce ATP during aerobic respiration.",
        "type": "concept",
        "bbox": {
          "x": 0.12,
          "y": 0.25,
          "width": 0.76,
          "height": 0.18
        },
        "markers": ["star"],
        "confidence": 0.94
      }
    ],
    "relationships": []
  },
  "expected_match": {
    "region_id": "region-mitochondria",
    "status": "matched",
    "slide_number": 2,
    "passage": "Cellular Respiration Mitochondria produce ATP during aerobic respiration. ATP stores usable chemical energy for cellular work.",
    "minimum_similarity_score": 0.2,
    "highlight_boxes": [
      {
        "x": 0.12,
        "y": 0.08024999618530274,
        "width": 0.3489600118001302,
        "height": 0.04122000694274902
      },
      {
        "x": 0.12,
        "y": 0.20081249237060547,
        "width": 0.710279795328776,
        "height": 0.030915012359619142
      },
      {
        "x": 0.12,
        "y": 0.8561875152587891,
        "width": 0.5433164978027344,
        "height": 0.024044952392578124
      }
    ]
  },
  "flashcard_count": 2,
  "generated_flashcards": [
    {
      "id": "00000000-0000-4000-8000-000000000101",
      "question": "Where is ATP produced during aerobic respiration?",
      "answer": "Mitochondria produce ATP during aerobic respiration.",
      "difficulty": "easy",
      "source": {
        "session_id": "00000000-0000-4000-8000-000000000001",
        "region_id": "region-mitochondria",
        "slide_number": 2,
        "slide_text": "Cellular Respiration Mitochondria produce ATP during aerobic respiration. ATP stores usable chemical energy for cellular work.",
        "highlight_boxes": [
          {
            "x": 0.12,
            "y": 0.08024999618530274,
            "width": 0.3489600118001302,
            "height": 0.04122000694274902
          },
          {
            "x": 0.12,
            "y": 0.20081249237060547,
            "width": 0.710279795328776,
            "height": 0.030915012359619142
          },
          {
            "x": 0.12,
            "y": 0.8561875152587891,
            "width": 0.5433164978027344,
            "height": 0.024044952392578124
          }
        ]
      }
    },
    {
      "id": "00000000-0000-4000-8000-000000000102",
      "question": "Why are mitochondria important for cellular work?",
      "answer": "They produce ATP, which stores usable chemical energy.",
      "difficulty": "medium",
      "source": {
        "session_id": "00000000-0000-4000-8000-000000000001",
        "region_id": "region-mitochondria",
        "slide_number": 2,
        "slide_text": "Cellular Respiration Mitochondria produce ATP during aerobic respiration. ATP stores usable chemical energy for cellular work.",
        "highlight_boxes": [
          {
            "x": 0.12,
            "y": 0.08024999618530274,
            "width": 0.3489600118001302,
            "height": 0.04122000694274902
          },
          {
            "x": 0.12,
            "y": 0.20081249237060547,
            "width": 0.710279795328776,
            "height": 0.030915012359619142
          },
          {
            "x": 0.12,
            "y": 0.8561875152587891,
            "width": 0.5433164978027344,
            "height": 0.024044952392578124
          }
        ]
      }
    }
  ]
}
```

- [ ] **Step 6: Validate the fixture files**

Run:

```powershell
uv run python -c "from pathlib import Path; import json, fitz; root=Path('../../sample-data/mitochondria-atp'); data=json.loads((root/'expected.json').read_text()); doc=fitz.open(root/'lecture-deck.pdf'); assert (root/'notebook-page.png').stat().st_size > 0; assert len(doc) == 2; assert data['expected_match']['slide_number'] == 2; print('fixture valid')"
```

Expected:

```text
fixture valid
```

- [ ] **Step 7: Commit**

```bash
git add sample-data/mitochondria-atp/notebook-page.png sample-data/mitochondria-atp/lecture-deck.pdf sample-data/mitochondria-atp/expected.json
git commit -m "test: add mitochondria demo fixture"
```

---

### Task 2: Add Confirmed Matching and Normalized Coordinates

**Files:**
- Modify: `apps/api/app/schemas/deck.py`
- Modify: `apps/api/app/schemas/match.py`
- Modify: `apps/api/app/retrieval.py`
- Modify: `apps/api/app/api/matches.py`
- Modify: `apps/api/tests/test_pdf.py`
- Modify: `apps/api/tests/test_retrieval.py`
- Modify: `apps/api/tests/test_confirmation.py`
- Modify: `packages/api-client/openapi.json`
- Modify: `packages/api-client/src/schema.d.ts`

**Interfaces:**
- Consumes: `HighlightBox` from `app.schemas.flashcards`.
- Produces: `MatchResponse.highlight_boxes: list[HighlightBox]` and a match endpoint gated by `confirmed_analysis_storage_key(session_id)`.

- [ ] **Step 1: Write failing schema and retrieval tests**

Append to `apps/api/tests/test_pdf.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas.deck import ExtractedSlide


@pytest.mark.parametrize(("width", "height"), [(0, 100), (100, 0), (-1, 100), (100, -1)])
def test_extracted_slide_requires_positive_dimensions(width: float, height: float) -> None:
    with pytest.raises(ValidationError):
        ExtractedSlide(slide_number=1, width=width, height=height, spans=[])
```

Extend `test_match_region_returns_slide_and_highlight` in
`apps/api/tests/test_retrieval.py`:

```python
    assert [box.model_dump() for box in result.highlight_boxes] == [
        {
            "x": 0.1,
            "y": 0.3,
            "width": 0.6,
            "height": 0.12,
        }
    ]
```

Extend `test_match_region_returns_no_match_without_shared_terms`:

```python
    assert result.highlight_boxes == []
```

- [ ] **Step 2: Write the failing confirmation-gate test**

Add imports to `apps/api/tests/test_confirmation.py`:

```python
from app.api import matches
```

Append:

```python
def test_match_requires_confirmed_analysis(tmp_path, monkeypatch) -> None:
    connection = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = ("lecture-deck.pdf",)
    connection.execute.return_value = cursor
    monkeypatch.setattr(
        matches,
        "get_settings",
        lambda: SimpleNamespace(storage_dir=tmp_path),
    )
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).post(
            f"/api/sessions/{SESSION_ID}/regions/region_1/match"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Confirmed analysis not found"}
```

- [ ] **Step 3: Run focused tests to verify failure**

Run from `apps/api`:

```powershell
uv run pytest tests/test_pdf.py tests/test_retrieval.py tests/test_confirmation.py -q
```

Expected: failures because slide dimensions are not constrained,
`MatchResponse` has no `highlight_boxes`, and matching still reads proposed
analysis.

- [ ] **Step 4: Require positive slide dimensions**

Replace `apps/api/app/schemas/deck.py` with:

```python
from pydantic import BaseModel, Field


class TextSpan(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float


class ExtractedSlide(BaseModel):
    slide_number: int
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    spans: list[TextSpan]


class DeckExtractionResponse(BaseModel):
    session_id: str
    slides: list[ExtractedSlide]
```

- [ ] **Step 5: Extend the match response**

Replace `apps/api/app/schemas/match.py` with:

```python
from typing import Literal

from pydantic import BaseModel

from app.schemas.deck import TextSpan
from app.schemas.flashcards import HighlightBox

MatchStatus = Literal["matched", "uncertain", "no_match"]


class MatchResponse(BaseModel):
    region_id: str
    status: MatchStatus
    slide_number: int | None
    passage: str
    highlights: list[TextSpan]
    highlight_boxes: list[HighlightBox]
    similarity_score: float
    reason: str
```

- [ ] **Step 6: Normalize matched spans**

In `apps/api/app/retrieval.py`, import `HighlightBox`:

```python
from app.schemas.flashcards import HighlightBox
```

Add `highlight_boxes=[]` to the no-match `MatchResponse`.

Add this field to the matched `MatchResponse`:

```python
        highlight_boxes=[
            HighlightBox(
                x=span.x / best_slide.width,
                y=span.y / best_slide.height,
                width=span.width / best_slide.width,
                height=span.height / best_slide.height,
            )
            for span in best_highlights
        ],
```

- [ ] **Step 7: Gate matching on confirmation**

In `apps/api/app/api/matches.py`, replace:

```python
from app.api.analysis import analysis_storage_key
```

with:

```python
from app.api.analysis import confirmed_analysis_storage_key
```

Replace the `load_json` key:

```python
load_json(
    get_settings().storage_dir,
    confirmed_analysis_storage_key(session_id),
)
```

Replace the missing-file detail:

```python
raise HTTPException(status_code=404, detail="Confirmed analysis not found") from error
```

- [ ] **Step 8: Run focused tests**

Run:

```powershell
uv run pytest tests/test_pdf.py tests/test_retrieval.py tests/test_confirmation.py -q
```

Expected: all focused tests pass.

- [ ] **Step 9: Regenerate the TypeScript API client**

From `apps/api`:

```powershell
$env:PYTHONPATH='.'
uv run python ../../scripts/export_openapi.py
Remove-Item Env:PYTHONPATH
```

From the repository root:

```powershell
corepack pnpm --filter @traceback/api-client exec openapi-typescript openapi.json --default-non-nullable=false --output src/schema.d.ts
corepack pnpm --filter @traceback/api-client exec prettier --write openapi.json src/schema.d.ts
```

Expected: generated `MatchResponse` contains `highlight_boxes` referencing `HighlightBox`.

- [ ] **Step 10: Commit**

```bash
git add apps/api/app/schemas/deck.py apps/api/app/schemas/match.py apps/api/app/retrieval.py apps/api/app/api/matches.py apps/api/tests/test_pdf.py apps/api/tests/test_retrieval.py apps/api/tests/test_confirmation.py packages/api-client/openapi.json packages/api-client/src/schema.d.ts
git commit -m "feat: normalize confirmed slide matches"
```

---

### Task 3: Add the Backend Acceptance Path

**Files:**
- Create: `apps/api/tests/test_member4_demo_flow.py`

**Interfaces:**
- Consumes: `sample-data/mitochondria-atp/expected.json`, the committed PDF, `get_connection`, and `get_flashcard_generator`.
- Produces: one hermetic test that proves confirmation → real PDF match → grounded flashcards.

- [ ] **Step 1: Create the acceptance test**

Create `apps/api/tests/test_member4_demo_flow.py`:

```python
import json
import shutil
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api import analysis, matches
from app.api.flashcards import get_flashcard_generator
from app.db import get_connection
from app.main import app
from app.schemas.flashcards import FlashcardSourceInput, GeneratedFlashcard

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "sample-data" / "mitochondria-atp"
EXPECTED = json.loads((FIXTURE_DIR / "expected.json").read_text(encoding="utf-8"))


class FixtureFlashcardGenerator:
    def generate(
        self,
        source: FlashcardSourceInput,
        count: int,
    ) -> list[GeneratedFlashcard]:
        assert count == EXPECTED["flashcard_count"]
        return [
            GeneratedFlashcard.model_validate(
                {
                    "question": card["question"],
                    "answer": card["answer"],
                    "difficulty": card["difficulty"],
                }
            )
            for card in EXPECTED["generated_flashcards"]
        ]


def test_confirmed_region_matches_real_pdf_and_generates_grounded_cards(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = EXPECTED["session_id"]
    lecture_name = "lecture-deck.pdf"
    shutil.copyfile(FIXTURE_DIR / lecture_name, tmp_path / lecture_name)

    connection = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(session_id,), (lecture_name,)]
    connection.execute.return_value = cursor
    settings = SimpleNamespace(storage_dir=tmp_path)
    monkeypatch.setattr(analysis, "get_settings", lambda: settings)
    monkeypatch.setattr(matches, "get_settings", lambda: settings)
    app.dependency_overrides[get_connection] = lambda: connection
    app.dependency_overrides[get_flashcard_generator] = FixtureFlashcardGenerator

    try:
        client = TestClient(app)
        confirm_response = client.post(
            f"/api/sessions/{session_id}/confirm",
            json=EXPECTED["approved_analysis"],
        )
        match_response = client.post(
            f"/api/sessions/{session_id}/regions/"
            f"{EXPECTED['expected_match']['region_id']}/match"
        )
        match = match_response.json()
        region = EXPECTED["approved_analysis"]["regions"][0]
        flashcard_response = client.post(
            "/api/flashcards/generate",
            json={
                "source": {
                    "session_id": session_id,
                    "region_id": region["id"],
                    "slide_number": match["slide_number"],
                    "note_text": region["transcription"],
                    "slide_text": match["passage"],
                    "highlight_boxes": match["highlight_boxes"],
                },
                "count": EXPECTED["flashcard_count"],
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert confirm_response.status_code == 200
    assert match_response.status_code == 200
    assert match["status"] == EXPECTED["expected_match"]["status"]
    assert match["slide_number"] == EXPECTED["expected_match"]["slide_number"]
    assert match["passage"] == EXPECTED["expected_match"]["passage"]
    assert match["similarity_score"] >= EXPECTED["expected_match"]["minimum_similarity_score"]
    assert len(match["highlight_boxes"]) == len(
        EXPECTED["expected_match"]["highlight_boxes"]
    )
    for actual, expected in zip(
        match["highlight_boxes"],
        EXPECTED["expected_match"]["highlight_boxes"],
        strict=True,
    ):
        assert actual == pytest.approx(expected, abs=0.002)

    assert flashcard_response.status_code == 200
    cards = flashcard_response.json()["flashcards"]
    assert [card["question"] for card in cards] == [
        card["question"] for card in EXPECTED["generated_flashcards"]
    ]
    assert all(card["source"]["slide_text"] == match["passage"] for card in cards)
    assert all(card["source"]["highlight_boxes"] == match["highlight_boxes"] for card in cards)
```

- [ ] **Step 2: Run the acceptance test**

Run from `apps/api`:

```powershell
uv run pytest tests/test_member4_demo_flow.py -q
```

Expected:

```text
1 passed
```

If only the coordinate comparison fails, replace the planned values in
`expected.json` with the exact Step 1 extraction output; do not widen the
`0.002` tolerance.

- [ ] **Step 3: Run the backend suite**

```powershell
uv run pytest -q
```

Expected: all backend tests pass without credentials.

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/test_member4_demo_flow.py sample-data/mitochondria-atp/expected.json
git commit -m "test: cover member 4 demo flow"
```

---

### Task 4: Share the Fixture with the Homepage Review Test

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.test.tsx`

**Interfaces:**
- Consumes: `sample-data/mitochondria-atp/expected.json`.
- Produces: the existing homepage demo request and review test from the shared fixture, with no duplicated source data.

- [ ] **Step 1: Change the test to import the fixture**

At the top of `apps/web/app/page.test.tsx`, add:

```typescript
import demoFixture from "../../../sample-data/mitochondria-atp/expected.json";
```

Replace the existing `generatedCards` object with:

```typescript
const generatedCards = {
  flashcards: demoFixture.generated_flashcards,
};
```

In the expected request body, replace the hard-coded source with:

```typescript
          source: {
            session_id: demoFixture.session_id,
            region_id: demoFixture.approved_analysis.regions[0].id,
            slide_number: demoFixture.expected_match.slide_number,
            note_text:
              demoFixture.approved_analysis.regions[0].transcription,
            slide_text: demoFixture.expected_match.passage,
            highlight_boxes: demoFixture.expected_match.highlight_boxes,
          },
          count: demoFixture.flashcard_count,
```

Replace the source-passage assertion with:

```typescript
    expect(
      screen.getByText(demoFixture.expected_match.passage),
    ).toBeInTheDocument();
```

Replace the coordinate assertion with:

```typescript
    const box = demoFixture.expected_match.highlight_boxes[0];
    expect(
      screen.getByText(
        `x ${Math.round(box.x * 100)}% · y ${Math.round(
          box.y * 100,
        )}% · width ${Math.round(box.width * 100)}% · height ${Math.round(
          box.height * 100,
        )}%`,
      ),
    ).toBeInTheDocument();
```

- [ ] **Step 2: Run the homepage test to verify it fails**

Run from the repository root:

```powershell
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
```

Expected: request-body assertions fail because `page.tsx` still contains the old hard-coded demo.

- [ ] **Step 3: Build the homepage request from the fixture**

At the top of `apps/web/app/page.tsx`, add:

```typescript
import demoFixture from "../../../sample-data/mitochondria-atp/expected.json";
```

Replace `slidePassage` and `demoRequest` with:

```typescript
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
```

Do not duplicate the fixture in a TypeScript file.

- [ ] **Step 4: Run frontend tests and type checking**

```powershell
corepack pnpm --filter @traceback/web test
corepack pnpm --filter @traceback/web typecheck
```

Expected: all web tests and TypeScript checks pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/page.test.tsx
git commit -m "test: share demo fixture with review flow"
```

---

### Task 5: Document and Verify the Member 4 Demo Package

**Files:**
- Create: `docs/member-4-demo.md`
- Modify: `README.md`
- Modify: `docs/member-4-progress.md`

**Interfaces:**
- Consumes: the fixture paths and test commands from Tasks 1–4.
- Produces: a runnable demo guide and evidence-linked checklist.

- [ ] **Step 1: Add the demo guide**

Create `docs/member-4-demo.md`:

```markdown
# Member 4 Demo

## Fixture

The non-private demo pair is stored in `sample-data/mitochondria-atp/`:

- `notebook-page.png` — synthetic photographed notebook page.
- `lecture-deck.pdf` — matching two-slide lecture deck.
- `expected.json` — approved analysis, slide match, coordinates, and cards.

## Focused verification

From `apps/api`:

```bash
uv run pytest tests/test_member4_demo_flow.py -q
```

From the repository root:

```bash
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
```

Neither command uses OpenAI or database credentials.

## Demo script

1. Show the notebook page and identify the starred mitochondria region.
2. Show slide 2 of the lecture PDF.
3. Explain that matching is blocked until the region is confirmed.
4. Confirm the region and show the matched passage and highlight coordinates.
5. Generate two grounded flashcards.
6. Edit one card, approve it, reject the other, and confirm the batch.

## Manual fallback

If camera capture is unavailable, upload `notebook-page.png`.
If live analysis or OpenAI is unavailable, use `expected.json` as the approved
analysis and generated-card response. The committed acceptance tests still
verify PDF extraction, matching, grounding, and review behavior.

## Known limitations

- Automated tests begin with approved analysis; they do not evaluate live
  handwriting recognition.
- The matcher is lexical and may mark weak overlap as uncertain.
- Tests fake database and OpenAI boundaries.
- The homepage demonstrates one confirmed fixture and is not the complete
  upload-and-capture application.
- Final-demo deployment, rehearsal, and video recording are separate tasks.

## Recovery

- `404 Confirmed analysis not found`: confirm the reviewed analysis first.
- `503 Flashcard generation is not configured`: set the server-side OpenAI key
  and model, or use the deterministic fixture during the demo.
- Unexpected match: verify the lecture PDF is the committed fixture and the
  selected region is `region-mitochondria`.
- UI generation error: ensure FastAPI is running at `NEXT_PUBLIC_API_URL` or
  `http://localhost:8000`.
```

- [ ] **Step 2: Link the demo guide from README**

Add after the API-first testing section in `README.md`:

```markdown
## Member 4 demo

The deterministic notebook-to-flashcard demo, focused test commands, fallback
steps, and presentation script are documented in
[`docs/member-4-demo.md`](docs/member-4-demo.md).
```

- [ ] **Step 3: Update only evidenced checklist items**

In `docs/member-4-progress.md`:

- Update the verification line with the fresh final test counts.
- Mark the deterministic acceptance-test item complete and link
  `../apps/api/tests/test_member4_demo_flow.py`.
- Mark slide-match passage and coordinate verification complete.
- Mark all three sample-pair fixture items complete and link
  `../sample-data/mitochondria-atp/`.
- Mark complete demo-flow documentation and known-limitations documentation.
- Mark final demo-pair selection and demo-script preparation complete.
- Leave full live integration, low-confidence UI, camera/manual-input
  verification, external environment, rehearsal, recording, and concept graph
  unchecked.

- [ ] **Step 4: Run focused documentation checks**

```powershell
corepack pnpm --filter @traceback/api-client exec prettier --check ../../README.md ../../docs/member-4-demo.md ../../docs/member-4-progress.md ../../docs/superpowers/specs/2026-07-19-member4-demo-qa-design.md ../../docs/superpowers/plans/2026-07-19-member4-demo-qa.md ../../sample-data/mitochondria-atp/expected.json
```

Expected: all listed files pass formatting.

- [ ] **Step 5: Run the complete Windows merge gate**

Run from the repository root:

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
Push-Location apps/api
uv run ruff format --check . ../../scripts
uv run ruff check . ../../scripts
uv run pyright
uv run pytest
Pop-Location
```

Regenerate the contract:

```powershell
Push-Location apps/api
$env:PYTHONPATH='.'
uv run python ../../scripts/export_openapi.py
Remove-Item Env:PYTHONPATH
Pop-Location
corepack pnpm --filter @traceback/api-client exec openapi-typescript openapi.json --default-non-nullable=false --output src/schema.d.ts
corepack pnpm --filter @traceback/api-client exec prettier --write openapi.json src/schema.d.ts
git diff --exit-code -- packages/api-client/openapi.json packages/api-client/src/schema.d.ts
corepack pnpm build
```

Expected: every command exits 0 and generated contracts have no diff.

- [ ] **Step 6: Record final evidence and commit**

Insert the actual passing counts into `docs/member-4-progress.md`, then run:

```bash
git add README.md docs/member-4-demo.md docs/member-4-progress.md
git commit -m "docs: add member 4 demo guide"
```

Final expected state:

```text
git status --short
```

prints nothing.
