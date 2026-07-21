# Scan Concept Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist approved camera-scanned notebook pages in a study session and automatically build an accessible cross-page concept graph using the approved Graph + Detail interface.

**Architecture:** Extend the existing session, confirmed-analysis, learning API, and object-storage patterns. Approved pages are stored as one session collection, graph generation validates provider output before caching it, and the existing graph route returns the last valid cache. The frontend creates a session, confirms approved pages, fetches the graph, and renders a focused SVG-based Graph + Detail component without adding a dependency.

**Tech Stack:** FastAPI, Pydantic, existing OpenAI/Gemini clients, Supabase/local object storage, React 19, Next.js 16, TypeScript, Vitest, Testing Library, pytest.

## Global Constraints

- Camera-scanned notebook pages are the only content-ingestion path; do not add lecture-PDF upload, rendering, extraction, or slide matching.
- Only student-approved concepts may enter graph generation.
- AI relationships must be grounded exclusively in approved labels and excerpts.
- Graph failure must preserve approved pages and the last valid cached graph.
- Relationships below `0.70` confidence set `review_required: true` and use text plus line style in the UI.
- The UI must match `DESIGN.md` and the approved Graph + Detail mock.
- Meet WCAG 2.2 AA, keyboard navigation, non-color state indicators, phone layout, and reduced motion.
- Automated tests must not call external model providers.
- Keep the implementation minimal: reuse existing settings, storage helpers, session checks, and API-client generation.

---

### Task 1: Approved-page and graph contracts

**Files:**
- Modify: `apps/api/app/schemas/learning.py`
- Test: `apps/api/tests/test_learning.py`

**Interfaces:**
- Consumes: `BoundingBox`, region types, and existing `GraphResponse` conventions.
- Produces: `ApprovedNotebookPage`, `ApprovedNotebookPages`, `ConfirmPageResponse`, `GraphSource`, extended `GraphNode`, and extended `GraphEdge`.

- [ ] **Step 1: Write failing schema tests**

Add tests that express the complete contract:

```python
from pydantic import ValidationError

from app.schemas.learning import ApprovedNotebookPages, GraphResponse


def test_graph_contract_keeps_sources_and_marks_low_confidence_edges() -> None:
    graph = GraphResponse.model_validate(
        {
            "nodes": [
                {
                    "id": "cellular respiration",
                    "label": "Cellular respiration",
                    "type": "concept",
                    "confidence": 0.92,
                    "sources": [
                        {
                            "page_id": "page-1",
                            "region_id": "region-1",
                            "excerpt": "Cells release energy from glucose.",
                            "bbox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1},
                        }
                    ],
                }
            ],
            "edges": [
                {
                    "id": "edge-1",
                    "source": "cellular respiration",
                    "target": "atp",
                    "label": "produces",
                    "confidence": 0.69,
                    "review_required": True,
                }
            ],
        }
    )
    assert graph.nodes[0].sources[0].page_id == "page-1"
    assert graph.edges[0].review_required is True


def test_approved_pages_reject_duplicate_page_ids() -> None:
    page = {
        "page_id": "page-1",
        "page_summary": "Energy notes",
        "typed_text": "ATP stores energy.",
        "regions": [],
        "relationships": [],
    }
    try:
        ApprovedNotebookPages(pages=[page, page])
    except ValidationError:
        return
    raise AssertionError("duplicate page IDs must be rejected")
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_learning.py -q
```

Expected: import or validation failures because the new models and fields do not exist.

- [ ] **Step 3: Add the minimal Pydantic models**

Implement these shapes in `apps/api/app/schemas/learning.py`:

```python
from pydantic import BaseModel, Field, model_validator

from app.schemas.analysis import BoundingBox, Region, Relationship


class ApprovedNotebookPage(BaseModel):
    page_id: str = Field(min_length=1)
    page_summary: str
    typed_text: str
    regions: list[Region]
    relationships: list[Relationship]


class ApprovedNotebookPages(BaseModel):
    pages: list[ApprovedNotebookPage] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_unique_page_ids(self) -> "ApprovedNotebookPages":
        ids = [page.page_id for page in self.pages]
        if len(ids) != len(set(ids)):
            raise ValueError("page IDs must be unique")
        return self


class GraphSource(BaseModel):
    page_id: str
    region_id: str
    excerpt: str
    bbox: BoundingBox


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    confidence: float = Field(ge=0, le=1)
    sources: list[GraphSource]


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None
    confidence: float = Field(ge=0, le=1)
    review_required: bool


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ConfirmPageResponse(BaseModel):
    page: ApprovedNotebookPage
    graph_status: Literal["ready", "pending"]
```

- [ ] **Step 4: Run the schema tests and verify GREEN**

Run the Task 1 command again. Expected: all `test_learning.py` tests pass after updating existing fixtures to include `confidence`, `sources`, and `review_required`.

- [ ] **Step 5: Commit Task 1**

```powershell
git add apps/api/app/schemas/learning.py apps/api/tests/test_learning.py
git commit -m "feat: define approved page graph contracts"
```

---

### Task 2: Deterministic graph assembly and provider boundary

**Files:**
- Create: `apps/api/app/services/concept_graph.py`
- Create: `apps/api/tests/test_concept_graph.py`

**Interfaces:**
- Consumes: `ApprovedNotebookPages`, `GraphEdge`, `GraphNode`, `GraphResponse`, `Settings`.
- Produces: `build_concept_graph(pages, generated_edges=None) -> GraphResponse`, `generate_cross_page_edges(pages, settings=None) -> list[GraphEdge]`, and `GraphGenerationError`.

- [ ] **Step 1: Write failing assembly tests**

Create tests for approved-page aggregation, normalized duplicate merging, source retention, endpoint validation, and review thresholds:

```python
from app.schemas.learning import ApprovedNotebookPages, GraphEdge
from app.services.concept_graph import build_concept_graph


def test_build_graph_merges_labels_and_keeps_every_source() -> None:
    pages = ApprovedNotebookPages.model_validate(
        {"pages": [page("page-1", "ATP", "ATP stores energy."), page("page-2", " atp ", "ATP powers cells.")]}
    )
    graph = build_concept_graph(pages)
    assert [node.id for node in graph.nodes] == ["atp"]
    assert [source.page_id for source in graph.nodes[0].sources] == ["page-1", "page-2"]


def test_build_graph_discards_unknown_endpoints_and_marks_review() -> None:
    pages = ApprovedNotebookPages.model_validate(
        {"pages": [page("page-1", "ATP", "ATP stores energy."), page("page-2", "Mitochondria", "Mitochondria produce ATP.")]}
    )
    graph = build_concept_graph(
        pages,
        generated_edges=[
            GraphEdge(id="valid", source="mitochondria", target="atp", label="produces", confidence=0.69, review_required=False),
            GraphEdge(id="invalid", source="missing", target="atp", label="relates", confidence=0.9, review_required=False),
        ],
    )
    assert [edge.id for edge in graph.edges] == ["valid"]
    assert graph.edges[0].review_required is True
```

The local `page()` test helper must construct a real `ApprovedNotebookPage` with a normalized bounding box and one approved region.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_concept_graph.py -q
```

Expected: module import failure because `concept_graph.py` does not exist.

- [ ] **Step 3: Implement minimal deterministic assembly**

Use one normalization function and no graph library:

```python
def normalize_label(label: str) -> str:
    return " ".join(label.casefold().split())


def build_concept_graph(
    pages: ApprovedNotebookPages,
    generated_edges: list[GraphEdge] | None = None,
) -> GraphResponse:
    nodes: dict[str, GraphNode] = {}
    for page in pages.pages:
        for region in page.regions:
            node_id = normalize_label(region.label)
            source = GraphSource(
                page_id=page.page_id,
                region_id=region.id,
                excerpt=region.transcription,
                bbox=region.bbox,
            )
            if node_id in nodes:
                nodes[node_id].sources.append(source)
                nodes[node_id].confidence = max(nodes[node_id].confidence, region.confidence)
            else:
                nodes[node_id] = GraphNode(
                    id=node_id,
                    label=region.label.strip(),
                    type=region.type,
                    confidence=region.confidence,
                    sources=[source],
                )

    valid_ids = set(nodes)
    edges = []
    for edge in generated_edges or []:
        source = normalize_label(edge.source)
        target = normalize_label(edge.target)
        if source not in valid_ids or target not in valid_ids or source == target:
            continue
        edges.append(
            edge.model_copy(
                update={
                    "source": source,
                    "target": target,
                    "review_required": edge.confidence < 0.70,
                }
            )
        )
    return GraphResponse(nodes=list(nodes.values()), edges=edges)
```

Also translate approved within-page relationships into the same normalized node IDs before adding provider-generated cross-page edges.

- [ ] **Step 4: Verify deterministic assembly GREEN**

Run the Task 2 test command. Expected: all tests pass.

- [ ] **Step 5: Add a failing provider-boundary test**

Test that disabled remote analysis returns only deterministic within-page edges, while a supplied fake generator may add valid cross-page relationships without network access:

```python
def test_generate_cross_page_edges_uses_injected_generator() -> None:
    pages = ApprovedNotebookPages.model_validate(
        {
            "pages": [
                page("page-1", "Mitochondria", "Mitochondria produce ATP."),
                page("page-2", "ATP", "ATP stores usable chemical energy."),
            ]
        }
    )
    edges = generate_cross_page_edges(
        pages,
        generator=lambda _: [
            GraphEdge(id="cross-1", source="mitochondria", target="atp", label="produces", confidence=0.91, review_required=False)
        ],
    )
    assert edges[0].label == "produces"
```

- [ ] **Step 6: Implement the provider boundary**

Define a callable injection point. Follow the existing `analysis_engine` setting and the structured-output patterns in `services/concept_details.py`. Provider failures raise `GraphGenerationError`; they do not silently fabricate edges. The prompt must include only page IDs, approved labels, region IDs, and excerpts, and must require endpoint IDs from that submitted set.

- [ ] **Step 7: Run Task 2 tests and commit**

```powershell
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_concept_graph.py -q
git add apps/api/app/services/concept_graph.py apps/api/tests/test_concept_graph.py
git commit -m "feat: build grounded cross-page concept graphs"
```

Expected: tests pass; no external provider is contacted.

---

### Task 3: Confirm scanned pages and cache the last valid graph

**Files:**
- Modify: `apps/api/app/api/analysis.py`
- Modify: `apps/api/app/api/learning.py`
- Modify: `apps/api/tests/test_learning.py`

**Interfaces:**
- Consumes: `ApprovedNotebookPage`, `ApprovedNotebookPages`, `ConfirmPageResponse`, `build_concept_graph`, `generate_cross_page_edges`, existing `_require_session`, `save_json`, and `load_json`.
- Produces: `POST /api/sessions/{session_id}/pages/{page_id}/confirm`, `POST /api/sessions/{session_id}/graph/refresh`, and an extended cached `GET /api/sessions/{session_id}/graph`.

- [ ] **Step 1: Write failing API tests**

Add route tests with local object storage and an injected fake relationship generator:

```python
def test_confirm_page_saves_approved_pages_and_refreshes_graph(tmp_path, monkeypatch) -> None:
    client = configured_client(tmp_path, monkeypatch)
    response = client.post(
        f"/api/sessions/{SESSION_ID}/pages/page-1/confirm",
        json=approved_page_payload("page-1", "ATP"),
    )
    assert response.status_code == 200
    assert response.json()["graph_status"] == "ready"
    graph = client.get(f"/api/sessions/{SESSION_ID}/graph")
    assert graph.status_code == 200
    assert graph.json()["nodes"][0]["sources"][0]["page_id"] == "page-1"


def test_graph_failure_keeps_page_and_previous_cache(tmp_path, monkeypatch) -> None:
    client = configured_client(tmp_path, monkeypatch)
    confirm_first_page_and_graph(client)
    monkeypatch.setattr(learning, "generate_cross_page_edges", failing_generator)
    response = client.post(
        f"/api/sessions/{SESSION_ID}/pages/page-2/confirm",
        json=approved_page_payload("page-2", "Mitochondria"),
    )
    assert response.status_code == 200
    assert response.json()["graph_status"] == "pending"
    assert load_saved_pages(tmp_path).pages[-1].page_id == "page-2"
    assert client.get(f"/api/sessions/{SESSION_ID}/graph").json() == previous_graph


def test_refresh_retries_pending_graph_without_resaving_pages(tmp_path, monkeypatch) -> None:
    client = configured_client(tmp_path, monkeypatch)
    save_two_approved_pages_with_pending_graph(client)
    monkeypatch.setattr(learning, "generate_cross_page_edges", successful_generator)
    response = client.post(f"/api/sessions/{SESSION_ID}/graph/refresh")
    assert response.status_code == 200
    assert response.json()["edges"][0]["label"] == "produces"
    assert len(load_saved_pages(tmp_path).pages) == 2
```

- [ ] **Step 2: Run route tests and verify RED**

Run:

```powershell
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_learning.py -q
```

Expected: 404 for the new confirm route or missing response fields.

- [ ] **Step 3: Add storage keys and page upsert**

In `analysis.py`, add:

```python
def approved_pages_storage_key(session_id: UUID) -> str:
    return f"approved-pages/{session_id}.json"


def graph_storage_key(session_id: UUID) -> str:
    return f"concept-graphs/{session_id}.json"
```

The confirm route must load the collection if present, replace the page with the same `page_id` or append it, save the collection before graph generation, then attempt graph generation and cache only a successful `GraphResponse`.

- [ ] **Step 4: Extend the graph route**

Change `get_graph()` to load `concept-graphs/{session_id}.json`. If no graph cache exists but approved pages do, return a graph assembled from approved nodes and within-page relationships. Preserve the legacy single confirmed-analysis fallback only for existing sessions.

Add `POST /sessions/{session_id}/graph/refresh`. It loads the already-saved approved pages, retries generation, saves a successful cache, and returns `GraphResponse`. It never rewrites or removes approved pages.

- [ ] **Step 5: Run API tests and verify GREEN**

Run:

```powershell
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_learning.py apps/api/tests/test_concept_graph.py -q
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit Task 3**

```powershell
git add apps/api/app/api/analysis.py apps/api/app/api/learning.py apps/api/tests/test_learning.py
git commit -m "feat: persist approved scan graphs"
```

---

### Task 4: Accessible Graph + Detail component

**Files:**
- Create: `apps/web/app/concept-graph.tsx`
- Create: `apps/web/app/concept-graph.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: generated `GraphResponse` API type, `onOpenSource(pageId, regionId)`, and `onCreateFlashcards(nodeId)` callbacks.
- Produces: `ConceptGraph` with selected-node state, SVG relationships, detail panel, pending/error/empty states, keyboard selection, and responsive layout.

- [ ] **Step 1: Write failing component tests**

Create tests that render real graph data and verify the approved behavior:

```tsx
it("shows selected concept evidence and opens its source", () => {
  const onOpenSource = vi.fn();
  render(<ConceptGraph graph={graphFixture} status="ready" onOpenSource={onOpenSource} onCreateFlashcards={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "ATP, page 2" }));
  expect(screen.getByRole("heading", { name: "ATP" })).toBeInTheDocument();
  expect(screen.getByText("ATP stores usable chemical energy.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open scanned page 2" }));
  expect(onOpenSource).toHaveBeenCalledWith("page-2", "region-atp");
});

it("labels low confidence relationships for review", () => {
  render(<ConceptGraph graph={lowConfidenceFixture} status="ready" onOpenSource={vi.fn()} onCreateFlashcards={vi.fn()} />);
  expect(screen.getByText("Review")).toBeInTheDocument();
  expect(screen.getByTestId("edge-low")).toHaveClass("review-required");
});

it("keeps the previous graph visible while an update is pending", () => {
  render(<ConceptGraph graph={graphFixture} status="pending" onOpenSource={vi.fn()} onCreateFlashcards={vi.fn()} />);
  expect(screen.getByText("Graph update pending")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cellular respiration, page 1" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run component tests and verify RED**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- concept-graph.test.tsx
```

Expected: import failure because the component does not exist.

- [ ] **Step 3: Implement the minimal component**

Use semantic buttons for nodes and one SVG for edges. Use a deterministic grid based on node index; do not add dragging, zooming, filters, or a graph dependency. The component signature is:

```tsx
type ConceptGraphProps = {
  graph: GraphResponse | null;
  status: "idle" | "loading" | "ready" | "pending" | "error";
  onRetry?: () => void;
  onOpenSource: (pageId: string, regionId: string) => void;
  onCreateFlashcards: (nodeId: string) => void;
};

export function ConceptGraph({
  graph,
  status,
  onRetry,
  onOpenSource,
  onCreateFlashcards,
}: ConceptGraphProps) {
  const [selectedId, setSelectedId] = useState(graph?.nodes[0]?.id ?? "");
  const selected =
    graph?.nodes.find((node) => node.id === selectedId) ?? graph?.nodes[0];

  if (!graph?.nodes.length) {
    return (
      <section className="concept-graph-empty">
        <h2>Your concept graph</h2>
        <p>Scan and approve more notebook concepts to reveal connections.</p>
        {status === "error" && onRetry ? (
          <button type="button" onClick={onRetry}>Retry graph update</button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="concept-graph-layout" aria-label="Concept graph">
      <div className="concept-graph-canvas">
        {status === "pending" ? <p role="status">Graph update pending</p> : null}
        <svg aria-label="Concept relationships">
          {graph.edges.map((edge) => (
            <line
              key={edge.id}
              data-testid={`edge-${edge.id}`}
              className={`concept-graph-edge ${edge.review_required ? "review-required" : ""}`}
            />
          ))}
          {graph.edges.map((edge) => (
            <text key={`${edge.id}-label`} className="concept-graph-edge-label">
              {edge.review_required ? "Review" : edge.label}
            </text>
          ))}
        </svg>
        {graph.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className="concept-graph-node"
            aria-pressed={node.id === selected?.id}
            aria-label={`${node.label}, ${node.sources[0].page_id.replace("page-", "page ")}`}
            onClick={() => setSelectedId(node.id)}
          >
            <strong>{node.label}</strong>
            <small>{node.sources[0].page_id.toUpperCase()}</small>
          </button>
        ))}
      </div>
      {selected ? (
        <aside className="concept-graph-detail">
          <p>Selected concept</p>
          <h2>{selected.label}</h2>
          <blockquote>{selected.sources[0].excerpt}</blockquote>
          <button
            type="button"
            onClick={() => onOpenSource(selected.sources[0].page_id, selected.sources[0].region_id)}
          >
            Open scanned {selected.sources[0].page_id.replace("page-", "page ")}
          </button>
          <button type="button" onClick={() => onCreateFlashcards(selected.id)}>
            Create flashcards
          </button>
        </aside>
      ) : null}
    </section>
  );
}
```

The first node is selected initially. Each node accessible name includes its label and first page number. Selecting a node updates the persistent detail panel. A no-edge graph still renders nodes and explains that more scanned pages may reveal connections.

- [ ] **Step 4: Add approved visual styles**

Append focused `.concept-graph-*` rules to `globals.css` using existing custom properties and exact `DESIGN.md` tokens:

```css
.concept-graph-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  min-height: 560px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: #fffdf8;
  box-shadow: 0 18px 46px #4d0e1215;
}
.concept-graph-node[aria-pressed="true"] {
  border: 2px solid #4d0e12;
  background: #dfe8f1;
}
.concept-graph-edge.review-required {
  stroke-dasharray: 5 5;
}
@media (max-width: 800px) {
  .concept-graph-layout { grid-template-columns: 1fr; }
  .concept-graph-detail { border-left: 0; border-top: 1px solid var(--line); }
}
@media (prefers-reduced-motion: reduce) {
  .concept-graph-node { transition: none; }
}
```

- [ ] **Step 5: Run component tests and verify GREEN**

Run the Task 4 test command. Expected: all concept-graph tests pass.

- [ ] **Step 6: Commit Task 4**

```powershell
git add apps/web/app/concept-graph.tsx apps/web/app/concept-graph.test.tsx apps/web/app/globals.css
git commit -m "feat: add accessible concept graph view"
```

---

### Task 5: Connect scanning, approval, graph refresh, and source navigation

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.test.tsx`

**Interfaces:**
- Consumes: `POST /api/sessions`, `POST /api/sessions/{session_id}/pages/{page_id}/confirm`, `GET /api/sessions/{session_id}/graph`, and `ConceptGraph`.
- Produces: one active session per browser run, a `graph` screen, automatic refresh after approval, Graph navigation, source-page selection, retry, and stale-cache behavior.

- [ ] **Step 1: Write failing integration tests**

Extend the existing page test fetch mock and add focused tests:

```tsx
it("confirms an approved scan and opens the refreshed graph", async () => {
  mockApiSequence({ session: sessionFixture, analysis: analysisFixture, confirm: { page: approvedPageFixture, graph_status: "ready" }, graph: graphFixture });
  render(<Home />);
  await scanAndApprovePage();
  fireEvent.click(screen.getByRole("button", { name: "Graph" }));
  expect(await screen.findByRole("heading", { name: "Cellular respiration" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/pages/page-1/confirm"), expect.objectContaining({ method: "POST" }));
});

it("opens the scanned page and region from graph detail", async () => {
  renderConfiguredGraphFlow();
  fireEvent.click(await screen.findByRole("button", { name: "Open scanned page 2" }));
  expect(screen.getByText("Page 2 / 2")).toBeInTheDocument();
  expect(screen.getByLabelText("ATP detection")).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run page tests and verify RED**

Run:

```powershell
corepack pnpm --filter @traceback/web test -- page.test.tsx
```

Expected: no Graph navigation or confirm-page request exists.

- [ ] **Step 3: Add minimal API helpers and state**

In `page.tsx`, add `"graph"` to `Screen`, import `ConceptGraph`, and keep only the required state:

```tsx
const [sessionId, setSessionId] = useState<string>();
const [graph, setGraph] = useState<GraphResponse | null>(null);
const [graphStatus, setGraphStatus] = useState<GraphStatus>("idle");
```

Create the session lazily before the first confirmation. Convert the active edited page into the approved-page request, using `page-${activePageIndex + 1}` as the stable page ID for the current browser session. After confirmation, set `pending` or fetch the graph immediately based on `graph_status`.

- [ ] **Step 4: Add Graph navigation and source callbacks**

Reuse the existing screen navigation rather than adding a second app shell. Render:

```tsx
<ConceptGraph
  graph={graph}
  status={graphStatus}
  onRetry={retryGraphGeneration}
  onOpenSource={(pageId, regionId) => {
    const pageIndex = Number(pageId.replace("page-", "")) - 1;
    showPage(pageIndex);
    setSelectedId(regionId);
    setScreen("trace");
  }}
  onCreateFlashcards={() => setScreen("cards")}
/>
```

`retryGraphGeneration` posts to `/api/sessions/${sessionId}/graph/refresh`, stores the returned graph, and changes `graphStatus` to `ready`; a failed retry leaves the existing graph visible and sets `graphStatus` to `error`.

Whenever the student saves edits to a previously approved page, post the current approved-page payload again. The backend page upsert replaces that page and regenerates the graph, covering rename and rejection updates without a second edit endpoint.

Rename scan-only copy that still claims the student uploads or opens a PDF. Do not change unrelated marketing sections.

- [ ] **Step 5: Run page tests and verify GREEN**

Run the Task 5 command. Expected: existing and new page tests pass.

- [ ] **Step 6: Commit Task 5**

```powershell
git add apps/web/app/page.tsx apps/web/app/page.test.tsx
git commit -m "feat: connect approved scans to concept graph"
```

---

### Task 6: Regenerate contracts and run the merge gate

**Files:**
- Modify: `packages/api-client/openapi.json`
- Modify: `packages/api-client/src/schema.d.ts`
- Modify only if verification proves it stale: `docs/build-week-checklist.md`

**Interfaces:**
- Consumes: final FastAPI schema and all prior tasks.
- Produces: synchronized TypeScript contract and a verified repository.

- [ ] **Step 1: Regenerate the API client**

Run the repository generator's exact Windows equivalent:

```powershell
Push-Location apps\api
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe ..\..\scripts\export_openapi.py
Pop-Location
corepack pnpm --filter @traceback/api-client exec openapi-typescript openapi.json --default-non-nullable=false --output src/schema.d.ts
corepack pnpm --filter @traceback/api-client exec prettier --write openapi.json src/schema.d.ts
```

Do not hand-edit generated files.

- [ ] **Step 2: Run focused backend verification**

```powershell
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_concept_graph.py apps/api/tests/test_learning.py -q
```

Expected: all selected backend tests pass with no external calls.

- [ ] **Step 3: Run focused frontend verification**

```powershell
corepack pnpm --filter @traceback/web test -- concept-graph.test.tsx page.test.tsx
```

Expected: all selected frontend tests pass.

- [ ] **Step 4: Run formatting, lint, and type checks**

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
apps\api\.venv\Scripts\python.exe -m ruff format --check apps/api scripts
apps\api\.venv\Scripts\python.exe -m ruff check apps/api scripts
apps\api\.venv\Scripts\python.exe -m pyright apps/api/app
```

Expected: every command exits 0.

- [ ] **Step 5: Run the complete test and build gate**

```powershell
corepack pnpm test
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests -q
corepack pnpm build
git diff --exit-code -- packages/api-client/openapi.json packages/api-client/src/schema.d.ts
```

Expected: all tests pass, production builds succeed, and generated API files are clean after regeneration.

- [ ] **Step 6: Commit generated contracts and any verified checklist correction**

```powershell
git add packages/api-client/openapi.json packages/api-client/src/schema.d.ts
git commit -m "chore: regenerate concept graph API contract"
```

Do not stage temp directories or unrelated changes already present in the original workspace.
