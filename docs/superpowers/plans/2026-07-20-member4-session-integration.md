# Member 4 Session Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing student UI to the session-backed notebook analysis, confirmation, slide matching, grounded flashcard generation, and review flow.

**Architecture:** Add one typed `session-api.ts` boundary around the existing FastAPI routes. Keep workflow state and rendering in `page.tsx`, reuse `FlashcardReview`, and add only the match-state styles needed to communicate `matched`, `uncertain`, and `no_match`.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, Vitest, Testing Library, FastAPI, Pydantic, Pytest, and the generated `@traceback/api-client` contract.

## Global Constraints

- Require exactly one lecture PDF and one notebook image per session.
- Use Node.js 22 or newer and Python 3.12 or 3.13.
- Add no dependency, state-management library, backend orchestration endpoint, or generic API framework.
- Preserve the existing visual design and component vocabulary.
- Generate one grounded flashcard per eligible starred or questioned region.
- Require explicit approval for `uncertain`; block `no_match`.
- Never read `expected.json`, seeded regions, or demo responses in the runtime path.
- Target WCAG 2.2 AA for every changed control and status.
- Do not add concept-graph, PDF.js, React Konva, deployment, camera, or video work.

## File Map

- Create `apps/web/app/session-api.ts`: generated-contract types, safe `fetch`
  calls, file encoding, and analysis mappers.
- Create `apps/web/app/session-api.test.ts`: API boundary and mapper tests.
- Modify `apps/web/app/page.tsx`: one-file setup, real orchestration, match
  decisions, grounded generation, and review handoff.
- Modify `apps/web/app/page.test.tsx`: setup and full browser-flow regression.
- Modify `apps/web/vitest.setup.ts`: stable object-URL mocks for file tests.
- Modify `apps/web/app/globals.css`: match states and existing review component
  styling; delete the duplicate drawer selectors after their markup is removed.
- Modify `apps/api/tests/test_retrieval.py`: missing `uncertain` regression.
- Modify `docs/member-4-progress.md`, `docs/build-week-checklist.md`, and
  `docs/member-4-demo.md`: verified progress and live-flow instructions.

---

### Task 1: Cover the missing uncertain match

**Files:**
- Modify: `apps/api/tests/test_retrieval.py:1-47`

**Interfaces:**
- Consumes: `match_region(region_id: str, query: str, slides: list[ExtractedSlide]) -> MatchResponse`.
- Produces: regression evidence that a non-zero lexical score below `0.2`
  returns `status="uncertain"` with normalized source coordinates.

- [ ] **Step 1: Write the failing regression test**

Append:

```python
def test_match_region_marks_low_overlap_as_uncertain() -> None:
    slides = [
        ExtractedSlide(
            slide_number=2,
            width=200,
            height=100,
            spans=[
                TextSpan(
                    text="alpha",
                    x=20,
                    y=30,
                    width=40,
                    height=10,
                )
            ],
        )
    ]

    result = match_region(
        "region_1",
        "alpha beta gamma delta epsilon zeta",
        slides,
    )

    assert result.status == "uncertain"
    assert result.slide_number == 2
    assert result.passage == "alpha"
    assert result.reason == "The slide is the best lexical match, but the score is low."
    assert result.highlight_boxes[0].model_dump() == {
        "x": 0.1,
        "y": 0.3,
        "width": 0.2,
        "height": 0.1,
    }
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
Push-Location apps/api
uv run pytest tests/test_retrieval.py -q
Pop-Location
```

Expected: three retrieval tests pass. If this test already passes, keep it
because the missing branch is now locked by a runnable regression.

- [ ] **Step 3: Commit the regression**

```powershell
git add apps/api/tests/test_retrieval.py
git commit -m "test: cover uncertain slide matches"
```

---

### Task 2: Add the typed session API boundary

**Files:**
- Create: `apps/web/app/session-api.ts`
- Create: `apps/web/app/session-api.test.ts`

**Interfaces:**
- Consumes: generated `components["schemas"]` from `@traceback/api-client`.
- Produces:
  - `VisionAnalysis`, `VisionRegion`, `StoredAnalysis`, `StoredRegion`,
    `MatchResult`, and `ReviewFlashcard` types.
  - `toStoredAnalysis(analysis: VisionAnalysis): StoredAnalysis`.
  - `toConfirmedAnalysis(pageSummary, regions, relationships): StoredAnalysis`.
  - Existing-route functions used by Tasks 3–5.

- [ ] **Step 1: Write mapper tests**

Create `apps/web/app/session-api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSession,
  generateGroundedFlashcards,
  matchRegion,
  toConfirmedAnalysis,
  toStoredAnalysis,
  uploadDeck,
  type EditableRegion,
  type VisionAnalysis,
} from "./session-api";

const visionAnalysis: VisionAnalysis = {
  page_summary: "Energy notes",
  typed_text: "Mitochondria produce ATP.",
  confidence: 0.9,
  warnings: ["review_low_confidence"],
  markers: [],
  regions: [
    {
      id: "region-1",
      label: "ATP",
      highlight_text: "ATP",
      transcription: "ATP stores energy",
      type: "concept",
      bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      markers: ["star"],
      confidence: 0.9,
      explanation: "Presentation only",
      trusted_source_queries: ["ATP"],
    },
  ],
  relationships: [
    {
      id: "edge-1",
      source_region_id: "region-1",
      target_region_id: "region-2",
      label: "supports",
      type: "arrow",
      confidence: 0.7,
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("analysis mapping", () => {
  it("keeps only the persisted analysis contract", () => {
    expect(toStoredAnalysis(visionAnalysis)).toEqual({
      page_summary: "Energy notes",
      regions: [
        {
          id: "region-1",
          label: "ATP",
          transcription: "ATP stores energy",
          type: "concept",
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          markers: ["star"],
          confidence: 0.9,
        },
      ],
      relationships: [
        {
          id: "edge-1",
          source_region_id: "region-1",
          target_region_id: "region-2",
          label: "supports",
          confidence: 0.7,
        },
      ],
    });
  });

  it("normalizes edited boxes and drops relationships to removed regions", () => {
    const regions: EditableRegion[] = [
      {
        id: "region-1",
        label: "ATP",
        transcription: "ATP stores energy",
        type: "concept",
        x: 10,
        y: 20,
        width: 30,
        height: 10,
        marker: "question",
        confidence: 90,
      },
    ];

    expect(
      toConfirmedAnalysis("Edited notes", regions, visionAnalysis.relationships),
    ).toEqual({
      page_summary: "Edited notes",
      regions: [
        {
          id: "region-1",
          label: "ATP",
          transcription: "ATP stores energy",
          type: "concept",
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          markers: ["question"],
          confidence: 0.9,
        },
      ],
      relationships: [],
    });
  });
});
```

- [ ] **Step 2: Run mapper tests and confirm the missing module failure**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- app/session-api.test.ts
```

Expected: FAIL because `./session-api` does not exist.

- [ ] **Step 3: Implement the module and fetch functions**

Create `apps/web/app/session-api.ts`:

```ts
import type { components } from "@traceback/api-client";

type Schemas = components["schemas"];

export type StoredAnalysis = Schemas["AnalysisResult"];
export type StoredRegion = Schemas["Region"];
export type MatchResult = Schemas["MatchResponse"];
export type ReviewFlashcard = Schemas["Flashcard"];
export type VisionRegion = Schemas["NotebookRegion"] & {
  highlight_text?: string;
};
export type VisionAnalysis = Omit<
  Schemas["NotebookAnalysisResult"],
  "page_summary" | "typed_text" | "regions" | "relationships" | "warnings"
> & {
  page_summary: string;
  typed_text: string;
  regions: VisionRegion[];
  relationships: Schemas["NotebookRelationship"][];
  warnings: string[];
};
export type EditableRegion = {
  id: string;
  label: string;
  transcription?: string;
  type: "concept" | "definition" | "question";
  x: number;
  y: number;
  width: number;
  height: number;
  marker?: "star" | "question";
  confidence: number;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function requestJson<T>(
  path: string,
  init: RequestInit,
  failureMessage: string,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) throw new Error(failureMessage);
  return (await response.json()) as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the notebook image."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read the notebook image."));
        return;
      }
      resolve(reader.result.split(",")[1] ?? reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function toStoredAnalysis(analysis: VisionAnalysis): StoredAnalysis {
  return {
    page_summary: analysis.page_summary,
    regions: analysis.regions.map((region) => ({
      id: region.id,
      label: region.label,
      transcription: region.transcription,
      type: region.type,
      bbox: region.bbox,
      markers: region.markers ?? [],
      confidence: region.confidence,
    })),
    relationships: analysis.relationships.map((relationship) => ({
      id: relationship.id,
      source_region_id: relationship.source_region_id,
      target_region_id: relationship.target_region_id,
      label: relationship.label,
      confidence: relationship.confidence,
    })),
  };
}

export function toConfirmedAnalysis(
  pageSummary: string,
  regions: EditableRegion[],
  relationships: StoredAnalysis["relationships"],
): StoredAnalysis {
  const regionIds = new Set(regions.map(({ id }) => id));
  return {
    page_summary: pageSummary,
    regions: regions.map((region) => ({
      id: region.id,
      label: region.label.trim(),
      transcription: region.transcription?.trim() || region.label.trim(),
      type: region.type,
      bbox: {
        x: region.x / 100,
        y: region.y / 100,
        width: region.width / 100,
        height: region.height / 100,
      },
      markers: region.marker ? [region.marker] : [],
      confidence: region.confidence / 100,
    })),
    relationships: relationships.filter(
      (relationship) =>
        regionIds.has(relationship.source_region_id) &&
        regionIds.has(relationship.target_region_id),
    ),
  };
}

export function createSession(): Promise<Schemas["SessionResponse"]> {
  return requestJson(
    "/api/sessions",
    { method: "POST" },
    "Traceback could not create a study session.",
  );
}

async function upload(
  sessionId: string,
  path: "deck" | "notebook-page",
  file: File,
  failureMessage: string,
): Promise<Schemas["UploadResponse"]> {
  const body = new FormData();
  body.append("file", file);
  return requestJson(
    `/api/sessions/${sessionId}/${path}`,
    { method: "POST", body },
    failureMessage,
  );
}

export function uploadDeck(sessionId: string, file: File) {
  return upload(
    sessionId,
    "deck",
    file,
    "Traceback could not upload the lecture PDF.",
  );
}

export function uploadNotebookPage(sessionId: string, file: File) {
  return upload(
    sessionId,
    "notebook-page",
    file,
    "Traceback could not upload the notebook image.",
  );
}

export async function analyzeNotebook(file: File): Promise<VisionAnalysis> {
  const image_base64 = await fileToBase64(file);
  return requestJson(
    "/api/notebook-analysis",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64 }),
    },
    "Traceback could not analyze the notebook image.",
  );
}

export function saveAnalysis(sessionId: string, analysis: StoredAnalysis) {
  return requestJson<StoredAnalysis>(
    `/api/sessions/${sessionId}/analysis`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysis),
    },
    "Traceback could not save the notebook analysis.",
  );
}

export function confirmAnalysis(sessionId: string, analysis: StoredAnalysis) {
  return requestJson<StoredAnalysis>(
    `/api/sessions/${sessionId}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysis),
    },
    "Traceback could not confirm the notebook analysis.",
  );
}

export function extractDeck(sessionId: string) {
  return requestJson<Schemas["DeckExtractionResponse"]>(
    `/api/sessions/${sessionId}/extract-deck`,
    { method: "POST" },
    "Traceback could not read the lecture PDF.",
  );
}

export function matchRegion(sessionId: string, regionId: string) {
  return requestJson<MatchResult>(
    `/api/sessions/${sessionId}/regions/${regionId}/match`,
    { method: "POST" },
    "Traceback could not match that notebook region.",
  );
}

export function generateGroundedFlashcards(
  request: Schemas["GenerateFlashcardsRequest"],
) {
  return requestJson<Schemas["GenerateFlashcardsResponse"]>(
    "/api/flashcards/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Traceback could not generate grounded flashcards.",
  );
}
```

- [ ] **Step 4: Add route-shape coverage**

Append to `session-api.test.ts`:

```ts
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("session API", () => {
  it("uses the existing upload, match, and grounded-card routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: "00000000-0000-4000-8000-000000000001",
          status: "created",
          created_at: "2026-07-20T00:00:00Z",
          updated_at: "2026-07-20T00:00:00Z",
        }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session_id: "00000000-0000-4000-8000-000000000001",
          kind: "deck",
          storage_path: "deck.pdf",
        }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          region_id: "region-1",
          status: "matched",
          slide_number: 2,
          passage: "ATP stores energy",
          highlights: [],
          highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
          similarity_score: 0.4,
          reason: "Matched",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ flashcards: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const session = await createSession();
    const pdf = new File(["pdf"], "lecture.pdf", {
      type: "application/pdf",
    });
    await uploadDeck(session.id, pdf);
    const match = await matchRegion(session.id, "region-1");
    await generateGroundedFlashcards({
      count: 1,
      source: {
        session_id: session.id,
        region_id: "region-1",
        slide_number: match.slide_number!,
        note_text: "ATP",
        slide_text: match.passage,
        highlight_boxes: match.highlight_boxes,
      },
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8000/api/sessions",
      `http://localhost:8000/api/sessions/${session.id}/deck`,
      `http://localhost:8000/api/sessions/${session.id}/regions/region-1/match`,
      "http://localhost:8000/api/flashcards/generate",
    ]);
    expect(
      (fetchMock.mock.calls[1][1]?.body as FormData).get("file"),
    ).toBe(pdf);
    expect(JSON.parse(fetchMock.mock.calls[3][1]?.body as string)).toMatchObject({
      count: 1,
      source: { region_id: "region-1", slide_number: 2 },
    });
  });
});
```

- [ ] **Step 5: Run and type-check**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- app/session-api.test.ts
corepack pnpm --filter @traceback/web typecheck
```

Expected: session API tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit the API boundary**

```powershell
git add apps/web/app/session-api.ts apps/web/app/session-api.test.ts
git commit -m "feat(web): add session API boundary"
```

---

### Task 3: Require both files and persist live analysis

**Files:**
- Modify: `apps/web/app/page.tsx:1-1150`
- Modify: `apps/web/app/page.test.tsx:1-77`
- Modify: `apps/web/vitest.setup.ts:1-17`

**Interfaces:**
- Consumes: Task 2 session creation, upload, analysis, mapping, and save
  functions.
- Produces: a real session ID, one editable `PageAnalysis`, and a stored
  relationship list ready for confirmation in Task 4.

- [ ] **Step 1: Add stable object-URL test support**

Append to `apps/web/vitest.setup.ts`:

```ts
Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  writable: true,
  value: () => "blob:notebook-preview",
});

Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  writable: true,
  value: () => undefined,
});
```

- [ ] **Step 2: Write the required-file test**

Change the imports in `page.test.tsx` to include `fireEvent`, `waitFor`, `vi`,
and the API module:

```ts
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page, { InteractiveNotebookText, type Region } from "./page";
import * as sessionApi from "./session-api";
import type { StoredAnalysis, VisionAnalysis } from "./session-api";
```

Add these shared test values and helpers:

```ts
const session = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "created" as const,
  created_at: "2026-07-20T00:00:00Z",
  updated_at: "2026-07-20T00:00:00Z",
};

const vision: VisionAnalysis = {
  page_summary: "Energy notes",
  typed_text: "Mitochondria produce ATP.",
  confidence: 0.9,
  warnings: [],
  markers: [],
  regions: [
    {
      id: "region-1",
      label: "Mitochondria",
      highlight_text: "Mitochondria",
      transcription: "Mitochondria produce ATP.",
      type: "concept",
      bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      markers: ["star"],
      confidence: 0.9,
    },
  ],
  relationships: [],
};

const stored: StoredAnalysis = {
  page_summary: "Energy notes",
  regions: [
    {
      id: "region-1",
      label: "Mitochondria",
      transcription: "Mitochondria produce ATP.",
      type: "concept",
      bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      markers: ["star"],
      confidence: 0.9,
    },
  ],
  relationships: [],
};

function selectRequiredFiles() {
  fireEvent.change(screen.getByLabelText(/choose lecture pdf/i), {
    target: {
      files: [
        new File(["pdf"], "lecture.pdf", { type: "application/pdf" }),
      ],
    },
  });
  fireEvent.change(screen.getByLabelText(/choose notebook image/i), {
    target: {
      files: [new File(["image"], "notes.png", { type: "image/png" })],
    },
  });
}

function mockInitialSession() {
  vi.spyOn(sessionApi, "createSession").mockResolvedValue(session);
  vi.spyOn(sessionApi, "uploadDeck").mockResolvedValue({
    session_id: session.id,
    kind: "deck",
    storage_path: "deck.pdf",
  });
  vi.spyOn(sessionApi, "uploadNotebookPage").mockResolvedValue({
    session_id: session.id,
    kind: "notebook_page",
    storage_path: "notes.png",
  });
  vi.spyOn(sessionApi, "analyzeNotebook").mockResolvedValue(vision);
  vi.spyOn(sessionApi, "saveAnalysis").mockResolvedValue(stored);
}

afterEach(() => vi.restoreAllMocks());
```

Add:

```ts
it("requires one lecture PDF and one notebook image", () => {
  render(<Page />);

  const start = screen.getByRole("button", { name: /create my pdf/i });
  expect(start).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/choose lecture pdf/i), {
    target: {
      files: [
        new File(["pdf"], "lecture.pdf", { type: "application/pdf" }),
      ],
    },
  });
  expect(start).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/choose notebook image/i), {
    target: {
      files: [new File(["image"], "notes.png", { type: "image/png" })],
    },
  });
  expect(start).toBeEnabled();
});

it("creates a session and saves live analysis before editing", async () => {
  mockInitialSession();
  render(<Page />);
  selectRequiredFiles();

  fireEvent.click(screen.getByRole("button", { name: /create my pdf/i }));

  expect(
    await screen.findByRole("heading", {
      name: "Review and refine your highlights.",
    }),
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(sessionApi.uploadDeck).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({ name: "lecture.pdf" }),
    );
    expect(sessionApi.uploadNotebookPage).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({ name: "notes.png" }),
    );
    expect(sessionApi.saveAnalysis).toHaveBeenCalledWith(session.id, stored);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
```

Expected: FAIL because the lecture input does not exist.

- [ ] **Step 4: Replace multi-page/demo setup with one real file pair**

In `page.tsx`:

1. Import Task 2 functions and types.
2. Replace `UploadField` with:

```tsx
function UploadField({
  label,
  detail,
  accept,
  file,
  onChange,
}: {
  label: string;
  detail: string;
  accept: string;
  file?: File;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="upload-card">
      <input
        className="sr-only"
        type="file"
        accept={accept}
        onChange={onChange}
      />
      <span className="upload-icon" aria-hidden="true">
        {accept === "application/pdf" ? "↗" : "⌁"}
      </span>
      <span>
        <strong>{file?.name ?? label}</strong>
        <small>{file ? "Choose a different file." : detail}</small>
      </span>
      <span className="upload-action">{file ? "Replace" : "Choose"}</span>
    </label>
  );
}
```

3. Replace `notebooks: File[]` with `lecture?: File` and `notebook?: File`.
4. Replace the setup copy and controls with this existing-component markup:

```tsx
<UploadField
  label="Choose lecture PDF"
  detail="Select the lecture deck used to ground your study cards."
  accept="application/pdf"
  file={lecture}
  onChange={(event) => setLecture(event.target.files?.[0])}
/>
<UploadField
  label="Choose notebook image"
  detail="Select one clear JPG or PNG notebook page."
  accept="image/*"
  file={notebook}
  onChange={selectNotebook}
/>
<button
  className="primary-button"
  disabled={!lecture || !notebook || isLiveAnalysis}
  onClick={beginAnalysis}
>
  Create my PDF <span>→</span>
</button>
```

Remove the seeded no-file path, “View a finished example,” multi-page
navigation, and the topbar “Run demo” behavior. Change the topbar action to
scroll to `#upload-map` and label it “Start a session”:

```tsx
<button
  className="demo-button"
  onClick={() => {
    setScreen("setup");
    window.setTimeout(
      () => document.getElementById("upload-map")?.scrollIntoView(),
      0,
    );
  }}
>
  Start a session
</button>
```

- [ ] **Step 5: Replace standalone analysis with the session sequence**

Change `PageAnalysis` to include:

```ts
type PageAnalysis = {
  pageSummary: string;
  typedText: string;
  regions: Region[];
  relationships: StoredAnalysis["relationships"];
  warnings: string[];
};
```

Replace the multi-page state with one analysis:

```ts
const [pageAnalysis, setPageAnalysis] = useState<PageAnalysis>();
const activeAnalysis = pageAnalysis;
```

Use these real stages:

```ts
const stages = [
  "Creating session",
  "Uploading lecture",
  "Uploading notebook",
  "Analyzing notebook",
  "Saving analysis",
];
```

Replace `analyzeNotebookPages` with:

```ts
async function analyzeNotebookPage() {
  if (!lecture || !notebook) return;
  setAnalysisError(undefined);
  setIsLiveAnalysis(true);
  setScreen("processing");

  try {
    setStage(0);
    const activeSession = sessionId ?? (await createSession()).id;
    setSessionId(activeSession);

    setStage(1);
    await uploadDeck(activeSession, lecture);
    setStage(2);
    await uploadNotebookPage(activeSession, notebook);
    setStage(3);
    const vision = await analyzeNotebook(notebook);
    const stored = toStoredAnalysis(vision);
    setStage(4);
    await saveAnalysis(activeSession, stored);

    const analysis: PageAnalysis = {
      pageSummary: vision.page_summary,
      typedText: vision.typed_text,
      regions: vision.regions.map(normalizeRegion),
      relationships: stored.relationships,
      warnings: vision.warnings,
    };
    setPageAnalysis(analysis);
    setRegions(analysis.regions);
    setSelectedId(analysis.regions[0]?.id ?? "");
    setScreen("editor");
  } catch (error) {
    setAnalysisError(
      error instanceof Error
        ? error.message
        : "Traceback could not prepare this study session.",
    );
    setScreen("setup");
  } finally {
    setIsLiveAnalysis(false);
  }
}
```

`beginAnalysis` must clear the error and call `void analyzeNotebookPage()`.
Add `const [sessionId, setSessionId] = useState<string>();`.

Move keyboard focus to the active workflow heading without changing layout:

```ts
useEffect(() => {
  if (screen === "setup") return;
  document
    .querySelector<HTMLElement>("[data-screen-heading]")
    ?.focus();
}, [screen]);
```

Add `data-screen-heading tabIndex={-1}` to the processing, editor, trace, and
cards `<h1>` elements. Add `aria-live="polite"` to `.progress-list`.

Delete `demoTypedText`, `seededRegions`, `editedDemoText`, `fileToBase64`, the
old local `analyzeNotebook`, and the timer effect that simulates processing.
Also delete `pageAnalyses`, `activePageIndex`, `showPage`, and multi-page
navigation. Initialize `regions` and `selectedId` with empty values and derive
text only from live analysis:

```ts
const [regions, setRegions] = useState<Region[]>([]);
const [selectedId, setSelectedId] = useState("");
const renderedTypedText = activeAnalysis?.typedText ?? "";
```

Replace the indexed text update with:

```ts
function updateNoteText(nextText: string) {
  setPageAnalysis((current) =>
    current ? { ...current, typedText: nextText } : current,
  );
}
```

Update `normalizeRegion` for optional generated fields:

```ts
function normalizeRegion(region: VisionRegion): Region {
  const markers = region.markers ?? [];
  const marker = markers.includes("star")
    ? "star"
    : markers.includes("question")
      ? "question"
      : undefined;
  const type =
    region.type === "definition" || region.type === "question"
      ? region.type
      : "concept";

  return {
    id: region.id,
    label: region.label,
    highlightText: region.highlight_text ?? "",
    highlightColor: "yellow",
    type,
    x: region.bbox.x * 100,
    y: region.bbox.y * 100,
    width: region.bbox.width * 100,
    height: region.bbox.height * 100,
    marker,
    confidence: Math.round(region.confidence * 100),
    transcription: region.transcription,
    explanation: region.explanation,
    trustedSourceQueries: region.trusted_source_queries ?? [],
  };
}
```

- [ ] **Step 6: Run focused frontend verification**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- app/page.test.tsx app/session-api.test.ts
corepack pnpm --filter @traceback/web typecheck
```

Expected: both test files pass and TypeScript reports no errors.

- [ ] **Step 7: Commit live setup and analysis**

```powershell
git add apps/web/app/page.tsx apps/web/app/page.test.tsx apps/web/vitest.setup.ts
git commit -m "feat(web): persist live notebook sessions"
```

---

### Task 4: Confirm edits and expose match decisions

**Files:**
- Modify: `apps/web/app/page.tsx:674-1710`
- Modify: `apps/web/app/page.test.tsx`
- Modify: `apps/web/app/globals.css:4580-4710`

**Interfaces:**
- Consumes: `toConfirmedAnalysis`, `confirmAnalysis`, `extractDeck`, and
  `matchRegion` from Task 2 plus Task 3’s `sessionId` and relationships.
- Produces: `confirmedAnalysis`, `matchResults`, and
  `approvedUncertainRegionIds` consumed by Task 5.

- [ ] **Step 1: Write the uncertain-decision UI test**

Add:

```ts
it("requires explicit approval for an uncertain match", async () => {
  mockInitialSession();
  vi.spyOn(sessionApi, "confirmAnalysis").mockResolvedValue(stored);
  vi.spyOn(sessionApi, "extractDeck").mockResolvedValue({
    session_id: session.id,
    slides: [],
  });
  vi.spyOn(sessionApi, "matchRegion").mockResolvedValue({
    region_id: "region-1",
    status: "uncertain",
    slide_number: 2,
    passage: "Mitochondria produce ATP.",
    highlights: [],
    highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
    similarity_score: 0.15,
    reason: "The slide is the best lexical match, but the score is low.",
  });

  render(<Page />);
  selectRequiredFiles();
  fireEvent.click(screen.getByRole("button", { name: /create my pdf/i }));
  fireEvent.click(
    await screen.findByRole("button", { name: /save & open pdf/i }),
  );

  expect(await screen.findByText("Uncertain match")).toBeInTheDocument();
  expect(
    screen.getByText(
      "The slide is the best lexical match, but the score is low.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("15% confidence")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Use this match" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /generate flashcards/i }),
  ).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Use this match" }));
  expect(
    screen.getByRole("button", { name: /generate flashcards/i }),
  ).toBeEnabled();
});
```

- [ ] **Step 2: Run the focused page test**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
```

Expected: FAIL because editor confirmation currently skips persistence and
matching.

- [ ] **Step 3: Add confirmation and match state**

Add:

```ts
const [confirmedAnalysis, setConfirmedAnalysis] =
  useState<StoredAnalysis>();
const [matchResults, setMatchResults] = useState<Record<string, MatchResult>>(
  {},
);
const [approvedUncertainRegionIds, setApprovedUncertainRegionIds] = useState<
  string[]
>([]);
const [isMatching, setIsMatching] = useState(false);
```

Derive the generation gate:

```ts
const hasEligibleMatch = Object.values(matchResults).some(
  (match) =>
    match.status === "matched" ||
    (match.status === "uncertain" &&
      approvedUncertainRegionIds.includes(match.region_id)),
);
```

Implement:

```ts
async function confirmAndMatch() {
  if (!sessionId || !activeAnalysis) return;
  setAnalysisError(undefined);
  setIsMatching(true);

  try {
    const confirmed = toConfirmedAnalysis(
      activeAnalysis.pageSummary,
      regions,
      activeAnalysis.relationships,
    );
    await confirmAnalysis(sessionId, confirmed);
    await extractDeck(sessionId);
    const marked = confirmed.regions.filter((region) =>
      region.markers?.some(
        (marker) => marker === "star" || marker === "question",
      ),
    );
    const results = await Promise.all(
      marked.map((region) => matchRegion(sessionId, region.id)),
    );

    setConfirmedAnalysis(confirmed);
    setMatchResults(
      Object.fromEntries(results.map((result) => [result.region_id, result])),
    );
    setApprovedUncertainRegionIds([]);
    setScreen("trace");
  } catch (error) {
    setAnalysisError(
      error instanceof Error
        ? error.message
        : "Traceback could not match the confirmed notes.",
    );
  } finally {
    setIsMatching(false);
  }
}
```

Change the editor button to call `confirmAndMatch`, disable it while matching,
and announce `analysisError` beside it with `role="alert"`. Change the existing
generate button to:

```tsx
<button
  className="primary-button flashcard-button"
  disabled={isGeneratingFlashcards || !hasEligibleMatch}
  onClick={generateFlashcards}
>
  {isGeneratingFlashcards ? "Creating cards…" : "Generate flashcards"}
</button>
```

- [ ] **Step 4: Render accessible match states in Trace View**

For the selected marked region, render:

```tsx
{selected.marker && matchResults[selected.id] ? (
  <section
    className="match-result"
    data-status={matchResults[selected.id].status}
    aria-labelledby={`match-${selected.id}-title`}
  >
    <h3 id={`match-${selected.id}-title`}>
      {matchResults[selected.id].status === "matched"
        ? "Matched source"
        : matchResults[selected.id].status === "uncertain"
          ? "Uncertain match"
          : "No source match"}
    </h3>
    <p>{matchResults[selected.id].reason}</p>
    <p>
      {Math.round(matchResults[selected.id].similarity_score * 100)}%
      confidence
    </p>
    {matchResults[selected.id].status === "uncertain" ? (
      <button
        type="button"
        className="secondary-button"
        aria-pressed={approvedUncertainRegionIds.includes(selected.id)}
        onClick={() =>
          setApprovedUncertainRegionIds((current) =>
            current.includes(selected.id)
              ? current.filter((id) => id !== selected.id)
              : [...current, selected.id],
          )
        }
      >
        {approvedUncertainRegionIds.includes(selected.id)
          ? "Match approved"
          : "Use this match"}
      </button>
    ) : null}
  </section>
) : selected.marker ? (
  <p className="match-result" role="status">
    This marked region does not have a usable lecture match.
  </p>
) : null}
```

Add restrained styles using existing tokens:

```css
.match-result {
  margin-top: 1rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1rem;
  background: var(--trace-white);
}

.match-result[data-status="matched"] {
  background: #e9f0ee;
}

.match-result[data-status="uncertain"] {
  background: #fff2d6;
}

.match-result[data-status="no_match"] {
  background: #f3d5cc70;
}

.match-result h3,
.match-result p {
  margin: 0 0 0.5rem;
}
```

- [ ] **Step 5: Run focused tests, lint, and type checking**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
corepack pnpm --filter @traceback/web lint
corepack pnpm --filter @traceback/web typecheck
```

Expected: all commands exit successfully.

- [ ] **Step 6: Commit confirmation and matching**

```powershell
git add apps/web/app/page.tsx apps/web/app/page.test.tsx apps/web/app/globals.css
git commit -m "feat(web): confirm notes and review slide matches"
```

---

### Task 5: Generate grounded cards and reuse FlashcardReview

**Files:**
- Modify: `apps/web/app/page.tsx:1-1890`
- Modify: `apps/web/app/page.test.tsx`
- Modify: `apps/web/app/globals.css:2530-2640,3970-4075,4580-4970`
- Verify: `apps/web/app/flashcard-review.test.tsx`

**Interfaces:**
- Consumes: Task 4’s confirmed regions, match results, and uncertain approvals;
  Task 2’s `generateGroundedFlashcards`.
- Produces: `ReviewFlashcard[]` passed directly to `FlashcardReview`.

- [ ] **Step 1: Extend the browser-flow test through review**

In the Task 4 test, add this spy before `render(<Page />)`:

```ts
vi.spyOn(sessionApi, "generateGroundedFlashcards").mockResolvedValue({
  flashcards: [
    {
      id: "00000000-0000-4000-8000-000000000010",
      question: "What produces ATP?",
      answer: "Mitochondria",
      difficulty: "easy",
      source: {
        session_id: "00000000-0000-4000-8000-000000000001",
        region_id: "region-1",
        slide_number: 2,
        slide_text: "Mitochondria produce ATP.",
        highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
      },
    },
  ],
});
```

Append these assertions after the “Use this match” click:

```ts
fireEvent.click(
  screen.getByRole("button", { name: /generate flashcards/i }),
);

expect(
  await screen.findByRole("heading", { name: "Review flashcards" }),
).toBeInTheDocument();
expect(
  screen.getByRole("heading", { name: "Review every generated card." }),
).toHaveFocus();
expect(screen.getByDisplayValue("What produces ATP?")).toBeInTheDocument();
expect(screen.getByText("Mitochondria produce ATP.")).toBeInTheDocument();
expect(screen.getByText(/x 10%/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify the old drawer fails the assertion**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- app/page.test.tsx
```

Expected: FAIL because the page still calls `/api/notebook-flashcards/generate`
and opens the duplicate drawer.

- [ ] **Step 3: Replace notebook-card state with generated contract cards**

Import:

```ts
import { FlashcardReview } from "./flashcard-review";
import {
  generateGroundedFlashcards,
  type ReviewFlashcard,
} from "./session-api";
```

Replace the old notebook-card, drawer, and saved-annotation states with:

```ts
const [flashcards, setFlashcards] = useState<ReviewFlashcard[]>([]);
const [reviewStatus, setReviewStatus] = useState("");
```

Compute eligible regions:

```ts
const eligibleRegions =
  confirmedAnalysis?.regions.filter((region) => {
    const match = matchResults[region.id];
    return (
      match?.status === "matched" ||
      (match?.status === "uncertain" &&
        approvedUncertainRegionIds.includes(region.id))
    );
  }) ?? [];
```

- [ ] **Step 4: Generate one grounded card per eligible region**

Replace `generateFlashcards` with:

```ts
async function generateFlashcards() {
  if (!sessionId || !eligibleRegions.length) return;
  setFlashcardError(undefined);
  setIsGeneratingFlashcards(true);

  try {
    const batches = await Promise.all(
      eligibleRegions.map((region) => {
        const match = matchResults[region.id];
        if (
          !match ||
          match.slide_number === null ||
          !match.passage ||
          !match.highlight_boxes.length
        ) {
          throw new Error("A selected match is missing source coordinates.");
        }
        return generateGroundedFlashcards({
          count: 1,
          source: {
            session_id: sessionId,
            region_id: region.id,
            slide_number: match.slide_number,
            note_text: region.transcription,
            slide_text: match.passage,
            highlight_boxes: match.highlight_boxes,
          },
        });
      }),
    );
    setFlashcards(batches.flatMap(({ flashcards }) => flashcards));
    setScreen("cards");
  } catch (error) {
    setFlashcardError(
      error instanceof Error
        ? error.message
        : "Traceback could not generate grounded flashcards.",
    );
  } finally {
    setIsGeneratingFlashcards(false);
  }
}
```

Disable generation when `eligibleRegions.length === 0` and put
`aria-live="polite"` on the existing error/status container.

- [ ] **Step 5: Make FlashcardReview the only cards screen**

Delete the modal drawer and saved-annotation cards markup. Render:

```tsx
{screen === "cards" ? (
  <section className="cards-view">
    <header className="trace-header">
      <div>
        <p className="eyebrow">Grounded study cards</p>
        <h1>Review every generated card.</h1>
      </div>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setScreen("trace")}
      >
        ← Back to interactive PDF
      </button>
    </header>
    <FlashcardReview
      key={flashcards.map(({ id }) => id).join(":")}
      cards={flashcards}
      onComplete={(approvedCards) => {
        setFlashcards(approvedCards);
        setReviewStatus(
          `${approvedCards.length} ${
            approvedCards.length === 1 ? "card" : "cards"
          } approved.`,
        );
        setScreen("trace");
      }}
    />
  </section>
) : null}
<p className="sr-only" aria-live="polite">
  {reviewStatus}
</p>
```

- [ ] **Step 6: Reuse the existing visual vocabulary and delete dead CSS**

Add:

```css
.review {
  width: min(860px, calc(100% - 2rem));
  margin: 2rem auto;
}

.review-heading,
.review-summary,
.review-navigation,
.review-decisions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.review-progress {
  width: 100%;
  margin: 1rem 0;
}

.review-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: clamp(1rem, 3vw, 2rem);
  background: var(--trace-white);
  box-shadow: 0 18px 46px #4d0e1215;
}

.review-card label,
.review-source {
  display: block;
  margin-top: 1rem;
}

.review-card textarea,
.review-card select {
  width: 100%;
  margin-top: 0.35rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.75rem;
  background: var(--trace-white);
  color: var(--ink);
  font: inherit;
}

.review-card textarea:focus-visible,
.review-card select:focus-visible,
.review button:focus-visible {
  outline: 3px solid var(--deep);
  outline-offset: 2px;
}

.review-source {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1rem;
  background: var(--paper);
}

.review-source blockquote {
  margin: 0.75rem 0;
}

.review-error {
  color: #9a4038;
}

.review-decisions,
.review-navigation,
.review-summary {
  margin-top: 1rem;
}

.review-decisions button,
.review-navigation button,
.review-summary button {
  min-height: 44px;
  border: 1px solid var(--deep);
  border-radius: 999px;
  padding: 0.65rem 1rem;
  background: var(--trace-white);
  color: var(--deep);
  font: inherit;
  font-weight: 700;
}

.review .review-approve,
.review .review-summary button {
  background: var(--deep);
  color: var(--trace-white);
}
```

Delete selectors whose only callers were removed:

```text
.flashcard-modal
.flashcard-drawer
.flashcard-drawer-copy
.flashcard-drawer-footer
.notebook-flashcards
```

Confirm deletion safety:

```powershell
rg -n "flashcard-modal|flashcard-drawer|notebook-flashcards" apps/web
```

Expected: no matches.

- [ ] **Step 7: Run frontend verification**

Run:

```powershell
corepack pnpm --filter @traceback/web test
corepack pnpm --filter @traceback/web format:check
corepack pnpm --filter @traceback/web lint
corepack pnpm --filter @traceback/web typecheck
corepack pnpm --filter @traceback/web build
```

Expected: every command exits successfully.

- [ ] **Step 8: Commit grounded review integration**

```powershell
git add apps/web/app/page.tsx apps/web/app/page.test.tsx apps/web/app/globals.css
git commit -m "feat(web): review grounded flashcards"
```

---

### Task 6: Update progress evidence and run the merge gate

**Files:**
- Modify: `docs/member-4-progress.md`
- Modify: `docs/build-week-checklist.md`
- Modify: `docs/member-4-demo.md`

**Interfaces:**
- Consumes: passing implementation and verification from Tasks 1–5.
- Produces: accurate Member 4 progress and a live team-integration demo guide.

- [ ] **Step 1: Update Member 4 progress only after focused tests pass**

Set the check date to `2026-07-20`. Check exactly:

```markdown
- [x] Connect the existing review UI to the frontend team's integrated student
      flow after its API handoff is ready.
- [x] Complete the full approved-region → slide match → flashcard generation →
      review flow.
```

And:

```markdown
- [x] Verify low-confidence results remain visibly distinct.
```

Leave the combined phone-camera QA item and every graph/demo-preparation item
unchecked.

- [ ] **Step 2: Update Build Week evidence**

Check exactly:

```markdown
- [x] Replace the current frontend demo data with a real end-to-end session:
  upload a lecture PDF and notebook image, call the API, save the returned
  analysis, then confirm it.
```

Leave Konva, PDF.js, orchestration fallback, device testing, deployment, license,
authorization, and submission items unchanged.

- [ ] **Step 3: Replace the demo guide’s runtime fallback instructions**

Make the primary script:

```markdown
1. Upload `lecture-deck.pdf` and `notebook-page.png`.
2. Review the detected regions and confirm the starred mitochondria region.
3. Show the matched slide passage and normalized highlight coordinates.
4. Approve the match if it is visibly marked uncertain.
5. Generate the grounded card and open the review screen.
6. Edit, approve or reject, and confirm the batch.
```

State that `expected.json` is an automated-test fixture only. Recovery for live
analysis or generation must direct the presenter to retry the failed phase or
fix the missing server configuration; it must not instruct the runtime UI to
load the fixture.

- [ ] **Step 4: Run focused backend and frontend tests**

```powershell
Push-Location apps/api
uv run pytest tests/test_retrieval.py tests/test_member4_demo_flow.py -q
Pop-Location
corepack pnpm --filter @traceback/web test
```

Expected: all selected tests pass.

- [ ] **Step 5: Run the complete Windows merge gate**

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test

Push-Location apps/api
uv run ruff format --check . ../../scripts
uv run ruff check . ../../scripts
uv run pyright
uv run pytest -q
Pop-Location

bash scripts/generate-api-client.sh
corepack pnpm build
git diff --exit-code -- packages/api-client/openapi.json packages/api-client/src/schema.d.ts
```

Expected: every command exits `0`; generated API files have no diff.

- [ ] **Step 6: Record fresh counts and commit verified documentation**

Replace the old test counts in `docs/member-4-progress.md` with the exact counts
printed by Step 5, then commit:

```powershell
git add docs/member-4-progress.md docs/build-week-checklist.md docs/member-4-demo.md
git commit -m "docs: record member 4 integration progress"
```

- [ ] **Step 7: Verify final branch state**

```powershell
git status --short --branch
git log --oneline --decorate -7
```

Expected: clean `codex/member4-integration-qa` with the spec commit plus the six
implementation-plan commits above.
