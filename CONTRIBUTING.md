# Contributing to Traceback

## Setup

1. Install Node.js 22+, Corepack, Python 3.12+, and `uv`.
2. Copy `.env.example` to `.env` and add development credentials.
3. Run `make setup`, then `make dev`.

## Branches and commits

- Use `feature/<short-name>` for features and `fix/<short-name>` for fixes.
- Use conventional commit subjects such as `feat: scaffold project workspace`.
- Keep commit bodies to short bullets when a body adds useful context.
- Do not add co-author trailers.

## Contracts and database changes

- Pydantic models in `apps/api` are the API contract source of truth.
- Run `make api-client` whenever a request or response model changes.
- Do not edit generated files in `packages/api-client` manually.
- Change the database only through a new file in `supabase/migrations`.
- Include migrations and regenerated contract files in the same pull request as
  the behavior that requires them.

## Pull requests

Run `make check` before requesting review. Keep pull requests focused and
include screenshots for visual changes or sample responses for API changes.
