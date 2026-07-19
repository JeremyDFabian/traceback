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
