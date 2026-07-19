# Traceback

Traceback turns photographed notebook pages into interactive study surfaces
that connect handwritten ideas to their source lecture slides.

## Prerequisites

- Node.js 22 or newer with Corepack
- Python 3.12 or newer
- [`uv`](https://docs.astral.sh/uv/)
- Access to the team's development Supabase project

## Start locally

```bash
cp .env.example .env
make setup
make dev
```

The web application runs at `http://localhost:3000`. The API runs at
`http://localhost:8000`, with interactive API documentation at
`http://localhost:8000/docs` and a health endpoint at
`http://localhost:8000/api/health`.

## Test flashcard generation without a UI

Flashcard generation is exposed through FastAPI and calls OpenAI only from the
server. Set `OPENAI_API_KEY` and `OPENAI_TEXT_MODEL` in `.env`, start the
project, and open `http://localhost:8000/docs`.

Use `POST /api/flashcards/generate` with an already-matched note region and
lecture slide:

```json
{
  "source": {
    "session_id": "00000000-0000-4000-8000-000000000001",
    "region_id": "region-7",
    "slide_number": 7,
    "note_text": "Mitochondria produce ATP through cellular respiration.",
    "slide_text": "The mitochondrion is the main site of aerobic ATP production."
  },
  "count": 5
}
```

Automated tests replace the OpenAI generator with fakes, so `make test` does
not require an API key and does not spend API credits.

## Member 4 demo

The deterministic notebook-to-flashcard demo, focused test commands, fallback
steps, and presentation script are documented in
[`docs/member-4-demo.md`](docs/member-4-demo.md).

## Repository layout

```text
apps/web/                  Next.js web application
apps/api/                  FastAPI service
packages/api-client/       Generated TypeScript API contract
scripts/                   Contract generation and database utilities
supabase/migrations/       Ordered PostgreSQL schema changes
sample-data/               Shared non-private demo fixtures
```

The browser communicates only with FastAPI. FastAPI owns OpenAI, Supabase,
storage, and database access. Pydantic models are the API contract source of
truth; `make api-client` generates TypeScript definitions from OpenAPI.

## Team commands

Run `make help` to list all commands. The normal workflow is:

```bash
make dev          # Start both applications
make test         # Run frontend and backend tests
make api-client   # Regenerate API types after schema changes
make check        # Run the complete pull-request merge gate
```

## Environment

Copy `.env.example` to `.env`. Variables prefixed with `NEXT_PUBLIC_` are
available to browser code. OpenAI keys, Supabase service-role keys, and database
credentials are server-only and must never be referenced from `apps/web`.

Use the shared development Supabase project during development and a separate
project for the final demo. Apply database changes through committed migration
files only.
