# Member 3 Backend Handoff

This document explains how the backend is intended to be used by the other team members.
It contains implementation and integration information only.

## Backend location

The FastAPI service is in `apps/api/`.

Start it locally with:

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs`.

The backend requires a PostgreSQL connection:

```env
DATABASE_URL=postgresql://...
```

OpenAI-backed flashcards additionally require:

```env
OPENAI_API_KEY=...
OPENAI_TEXT_MODEL=...
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=traceback-files
```

Do not expose these server-only values in the web application.

## Required database setup

The initial schema creates sessions and processing jobs. The analysis and retrieval
features also require this migration:

```text
supabase/migrations/20260719000000_analysis_retrieval_schema.sql
```

Apply committed migrations to the shared Supabase project before testing analysis,
deck extraction, matching, or persisted flashcard suggestions. The backend connects
to Supabase through its PostgreSQL `DATABASE_URL`; it does not use the Supabase
JavaScript client.

## Main API flow

The expected order is:

1. Create a session.
2. Upload the lecture PDF and notebook image.
3. Send Member 2's analysis result to the analysis endpoint.
4. Let the user edit and confirm the analysis.
5. Extract the lecture deck.
6. Match a confirmed region to the lecture slides.
7. Request graph data or flashcard suggestions.

All application routes use the `/api` prefix.

## Session and upload endpoints

### Create a session

```http
POST /api/sessions
```

Returns `201` with:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "status": "created",
  "created_at": "2026-07-19T12:00:00Z",
  "updated_at": "2026-07-19T12:00:00Z"
}
```

### Get a session

```http
GET /api/sessions/{session_id}
```

### Upload the lecture PDF

```http
POST /api/sessions/{session_id}/deck
Content-Type: multipart/form-data
```

Use the form field name `file`. The file must have an `application/pdf` content type.

### Upload the notebook image

```http
POST /api/sessions/{session_id}/notebook-page
Content-Type: multipart/form-data
```

Use the form field name `file`. The file content type must begin with `image/`.

When the Supabase Storage variables are configured, files are stored in the private
`traceback-files` bucket. Without those variables, the backend falls back to local
storage under `.data/uploads` for local development. The response's `storage_path`
is a backend storage key, not a browser URL.

## Analysis contract

Member 2 should send this shape to:

```http
POST /api/sessions/{session_id}/analysis
```

```json
{
  "page_summary": "Cellular respiration notes",
  "regions": [
    {
      "id": "region_1",
      "label": "ATP",
      "transcription": "ATP stores energy",
      "type": "concept",
      "bbox": {"x": 0.1, "y": 0.2, "width": 0.2, "height": 0.1},
      "markers": ["star"],
      "confidence": 0.9
    }
  ],
  "relationships": [
    {
      "id": "relationship_1",
      "source_region_id": "region_1",
      "target_region_id": "region_2",
      "label": "produces",
      "confidence": 0.8
    }
  ]
}
```

Allowed region types are `concept`, `definition`, `question`, `example`, and `other`.
Allowed markers are `star`, `question`, `highlight`, and `circle`.

Bounding-box coordinates are normalized from `0` to `1`, rather than being raw pixel
values. This lets the frontend render overlays at different image sizes.

The analysis endpoint stores both the validated JSON file and database rows. The
confirmation endpoint is:

```http
POST /api/sessions/{session_id}/confirm
```

The frontend should send the edited analysis object back to this endpoint. Successful
confirmation changes the session status to `ready`.

## PDF extraction and matching

### Extract the lecture deck

```http
POST /api/sessions/{session_id}/extract-deck
```

This extracts text spans from each PDF page using PyMuPDF. Each span includes:

```json
{
  "text": "Mitochondria produce ATP",
  "x": 20,
  "y": 30,
  "width": 120,
  "height": 12
}
```

These coordinates are PDF coordinates and are useful for drawing slide highlights.
The extracted passages are also stored in the `slide_passages` database table with
normalized coordinates.

### Match a region

```http
POST /api/sessions/{session_id}/regions/{region_id}/match
```

Example response:

```json
{
  "region_id": "region_1",
  "status": "matched",
  "slide_number": 3,
  "passage": "Mitochondria produce ATP",
  "highlights": [
    {"text": "Mitochondria produce ATP", "x": 20, "y": 30, "width": 120, "height": 12}
  ],
  "similarity_score": 0.4,
  "reason": "The slide shares enough terms with the notebook region."
}
```

Match statuses are `matched`, `uncertain`, and `no_match`. The current implementation
uses lexical word overlap as a reliable local baseline. Embedding and AI-reranking
interfaces are not connected yet.

## Learning endpoints

### Graph data

```http
GET /api/sessions/{session_id}/graph
```

This reads confirmed relationships and returns:

```json
{
  "nodes": [{"id": "region_1", "label": "ATP", "type": "concept"}],
  "edges": [{"id": "relationship_1", "source": "region_1", "target": "region_2", "label": "produces"}]
}
```

### Confirmed-analysis flashcard suggestions

```http
POST /api/sessions/{session_id}/flashcards/generate
```

This is the simple marker-based flow. It uses confirmed regions with markers and
returns editable suggestions. It also stores those suggestions in PostgreSQL.

### OpenAI-backed flashcard generation

```http
POST /api/flashcards/generate
```

This is a separate provider-backed endpoint. It accepts matched note/slide text and
highlight boxes, then calls OpenAI on the server. It returns generated cards with
source coordinates. It requires `OPENAI_API_KEY` and `OPENAI_TEXT_MODEL`.

## Processing jobs

The backend exposes job records for progress polling:

```http
POST /api/sessions/{session_id}/processing-jobs
GET /api/sessions/{session_id}/processing-jobs/{job_id}
```

The current implementation creates and reads job status records. Long-running
background orchestration is not connected yet; deck extraction currently runs inside
the request.

## What other members should implement

### Member 1 — frontend

- Use the session and upload endpoints to create the workflow.
- Render normalized notebook `bbox` values as editable overlays.
- Call `/confirm` after the user approves edits.
- Use `slide_number` and `highlights` from the match response to render slide text highlights.
- Use `/graph` for React Flow nodes and edges.
- Choose either the marker-based flashcard endpoint or the OpenAI-backed endpoint based on the desired demo flow.

### Member 2 — AI vision

- Return the `AnalysisResult` shape shown above.
- Keep region IDs stable while the user edits the analysis.
- Keep coordinates normalized from `0` to `1`.
- Use the allowed region and marker values.

### Member 4 — learning and QA

- Test the confirmed-analysis flashcard and graph flows.
- Test matched, uncertain, and no-match responses.
- Provide a demo PDF and notebook image with stable expected region IDs.
- Verify the complete flow against the presentation device.

## Current limitations and follow-up work

- The new Supabase migration must be applied to the shared database.
- Supabase Storage is supported, with local storage retained as a development fallback.
- Matching currently uses lexical overlap, not embeddings or AI reranking.
- Match requests still parse the local PDF instead of reading passages from the database.
- Background processing jobs are records only; extraction is synchronous.
- Deployment configuration is not included in this backend slice.

## Verification

From `apps/api/`:

```bash
uv run pytest -q
uv run ruff format --check . ../../scripts
uv run ruff check . ../../scripts
uv run pyright
```

The current backend suite passes 64 tests.
