# Member 4 Progress Checklist Design

**Date:** 2026-07-19

## Goal

Create one Markdown checklist that shows the status of every Member 4
responsibility defined by the repository.

## Design

- Store the checklist at `docs/member-4-progress.md`.
- Group work into flashcards, concept graph, integration and QA, demo data,
  documentation, demo preparation, and demo video.
- Separate MVP responsibilities from work explicitly deferred until after the
  end-to-end MVP path works.
- Mark an item `[x]` only when the repository contains evidence that it is
  complete; otherwise mark it `[ ]`.
- Link completed or in-progress items to their supporting code, tests, plans,
  specifications, or documentation.
- Keep the file manually editable with ordinary Markdown checkboxes and no
  supporting tooling.

## Verification

Compare every checklist item against the repository files and current test
results. Confirm that the checklist covers all responsibilities assigned to
Member 4 in `AGENTS.md`.
