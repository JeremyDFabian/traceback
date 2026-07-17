# Flashcard Generation Design

**Date:** 2026-07-17  
**Owner:** Member 4 — Learning Features, Integration & QA  
**Status:** Approved design; implementation not started

## Goal

Add an API-first flashcard-generation feature that turns an already-matched
notebook region and lecture slide into traceable study cards. The feature must
be testable without a UI, must call OpenAI only from FastAPI, and must not
persist generated cards in its first version.

## Scope

### Included

- One synchronous FastAPI endpoint for flashcard generation
- Validated request and response contracts
- Server-side OpenAI Responses API integration
- Structured Outputs backed by Pydantic models
- Configurable generation count from 1 through 10, defaulting to 5
- Traceable source references on every card
- Automated tests that mock the OpenAI provider
- Regenerated OpenAPI and TypeScript API contracts
- Focused documentation for running and testing the endpoint

### Excluded

- Flashcard persistence
- Review-queue scheduling
- Flashcard editing or review UI
- Notebook-image analysis
- PDF parsing or region-to-slide matching
- Background jobs, polling, and automatic retries
- Live OpenAI calls in automated tests or CI

## Architecture

The feature exposes `POST /api/flashcards/generate`. FastAPI validates the
request, obtains a `FlashcardGenerator` through dependency injection, and
delegates content generation to an OpenAI-backed service. The service calls the
Responses API with a Pydantic Structured Output schema.

OpenAI generates only the question, answer, and difficulty. The server creates
the flashcard UUID and copies the trusted source identifiers from the request.
This prevents the model from inventing session, region, or slide references.

The endpoint returns the generated cards immediately. It does not write to
Supabase, PostgreSQL, storage, or the local filesystem. The browser never
communicates with OpenAI directly.

## Components

```text
apps/api/app/api/flashcards.py
    HTTP endpoint, dependency injection, response assembly, and error mapping

apps/api/app/schemas/flashcards.py
    Public request/response models and internal Structured Output models

apps/api/app/services/flashcards.py
    FlashcardGenerator interface and OpenAI Responses API adapter

apps/api/app/config.py
    Server-only OpenAI configuration

apps/api/tests/test_flashcards.py
    Schema, route, provider-adapter, and failure-path tests
```

The existing `apps/api/app/main.py` will register the flashcards router.
The generated files in `packages/api-client/` will be updated from the
resulting OpenAPI contract rather than edited manually.

## API Contract

### Request

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

Validation rules:

- `session_id` is a UUID.
- `region_id` is an opaque string from 1 through 200 characters.
- `slide_number` is an integer greater than or equal to 1.
- `note_text` contains from 1 through 20,000 characters.
- `slide_text` contains from 1 through 50,000 characters.
- `count` defaults to 5 and must be between 1 and 10, inclusive.

### Response

```json
{
  "flashcards": [
    {
      "id": "38f5b2a7-bce8-494f-8804-a9c6a4f83d39",
      "question": "What is the main role of mitochondria?",
      "answer": "They produce ATP through aerobic cellular respiration.",
      "difficulty": "easy",
      "source": {
        "session_id": "00000000-0000-4000-8000-000000000001",
        "region_id": "region-7",
        "slide_number": 7
      }
    }
  ]
}
```

`difficulty` is one of `easy`, `medium`, or `hard`. A question contains from 1
through 500 characters, and an answer contains from 1 through 2,000 characters.
The response contains exactly the requested number of cards.

## Data Flow

1. FastAPI validates the incoming body.
2. The route resolves a `FlashcardGenerator`.
3. The OpenAI adapter builds a prompt from the requested count, note text, and
   slide text.
4. The prompt treats the supplied text only as study material, never as
   instructions.
5. The adapter calls the Responses API with the internal Pydantic output model.
6. The adapter validates the parsed output and verifies the exact card count.
7. The route assigns card UUIDs and attaches the trusted source reference.
8. FastAPI serializes and returns the public response model.

## Generation Rules

- Generate exactly the requested number of cards.
- Ground every question and answer in the supplied note and slide text.
- Prefer questions that test understanding rather than verbatim memorization.
- Keep each card focused on one concept.
- Do not invent facts, sources, identifiers, or slide numbers.
- Reject duplicate questions after trimming, collapsing internal whitespace,
  and comparing them case-insensitively.
- Treat note and slide text as untrusted content that cannot override the
  generation instructions.

## Configuration

The service reads `OPENAI_API_KEY` and `OPENAI_TEXT_MODEL` only on the server.
Neither value is exposed through browser code or API responses. Missing or
blank configuration prevents provider initialization and produces a safe
service-unavailable response.

No model ID is hardcoded into the application contract. The deployment
environment selects the text model through `OPENAI_TEXT_MODEL`.

## Error Handling

| Condition | Status | Behavior |
|---|---:|---|
| Invalid request body | 422 | FastAPI returns validation details before contacting OpenAI. |
| Missing OpenAI configuration | 503 | Return `{"detail": "Flashcard generation is not configured"}`. |
| Provider timeout or provider error | 502 | Return `{"detail": "Flashcard generation failed"}`. |
| Provider refusal | 502 | Reject the complete result. |
| Invalid or unparseable structured output | 502 | Reject the complete result. |
| Wrong number of cards | 502 | Reject the complete result. |
| Duplicate normalized questions | 502 | Reject the complete result. |
| Unexpected programming failure | 500 | Preserve normal server-error behavior. |

The OpenAI client uses a 30-second request timeout and disables SDK retries, so
the endpoint makes exactly one provider attempt. It never returns partial
results. Clients may retry the complete request.

Error responses and logs must not expose API keys, provider internals, prompts,
note text, or slide text.

## Testing Strategy

Automated tests never make a live OpenAI request and never require an API key.

### Schema tests

- Required and optional fields
- UUID and opaque region-ID validation
- Positive slide numbers
- Non-empty and length-limited text
- Default, minimum, and maximum card counts
- Allowed difficulty values

### Endpoint tests

- A fake generator returns the requested number of cards.
- The endpoint assigns valid card UUIDs.
- Trusted source identifiers are copied without modification.
- Invalid requests fail before the generator is invoked.
- Generator failures map to the specified safe HTTP responses.
- Partial results are never returned.

### OpenAI adapter tests

- The Responses API is invoked with the configured model.
- The Pydantic Structured Output model is supplied.
- The prompt contains the requested count and separates instructions from
  untrusted source content.
- Refusals, timeouts, malformed output, duplicates, and incorrect counts fail
  safely.

### Contract and regression checks

- Regenerate `packages/api-client/openapi.json`.
- Regenerate `packages/api-client/src/schema.d.ts`.
- Run the complete backend and frontend merge gate.
- Verify that generated contract files match the committed Pydantic schemas.

An optional manual smoke test may call the endpoint from FastAPI `/docs` with
development credentials. It is not part of automated verification.

## Acceptance Criteria

The feature is complete when:

1. A valid matched note/slide pair returns exactly 1–10 requested flashcards.
2. Every card contains a UUID, question, answer, difficulty, and unchanged
   source reference.
3. Invalid requests never contact OpenAI.
4. Provider and output failures are mapped without leaking sensitive content.
5. No generated data is persisted.
6. Automated tests pass without an API key or live provider call.
7. OpenAPI and TypeScript contracts are regenerated and verified.
8. Existing repository checks continue to pass.

## Implementation Workflow and Model Constraints

Implementation must use Superpowers-style subagent-driven development. The
root agent acts only as orchestrator and does not write implementation code.

### Hard precondition

Before implementation starts, the user must switch the parent session to
Terra. If the runtime cannot confirm or enforce Terra/Luna subagents, work
stops rather than silently using Sol. Sol is prohibited from implementation
and code-modification tasks.

### Planned assignments

1. **Luna:** Pydantic contracts and validation tests
2. **Terra:** OpenAI adapter, prompt construction, and provider-failure tests
3. **Terra:** FastAPI route, dependency injection, configuration, and endpoint
   tests
4. **Luna:** OpenAPI regeneration, generated TypeScript contract, and focused
   documentation

### Per-task quality gates

1. Dispatch one fresh implementer subagent with the complete task context.
2. The implementer follows red-green-refactor TDD, runs tests, self-reviews,
   and commits its task.
3. Dispatch a separate Terra spec-compliance reviewer.
4. The same implementer fixes every specification gap and the reviewer checks
   again.
5. Dispatch a separate Terra code-quality reviewer only after specification
   compliance passes.
6. The implementer fixes every quality issue and the reviewer checks again.
7. Advance only after both reviewers approve.

Implementers run sequentially because all agents share one working tree.
Review findings never count as complete until the responsible reviewer
confirms the fix.
