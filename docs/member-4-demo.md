# Member 4 Demo

## Fixture

The non-private demo pair is stored in `sample-data/mitochondria-atp/`:

- `notebook-page.png` — synthetic photographed notebook page.
- `lecture-deck.pdf` — matching two-slide lecture deck.
- `expected.json` — automated-test fixture only; it is not loaded by the
  runtime UI.

## Focused verification

Use Python 3.12 or 3.13; the vision-analysis dependencies currently include
PaddlePaddle, which does not provide a Python 3.14 wheel.

From `apps/api`:

```bash
uv run pytest tests/test_member4_demo_flow.py -q
```

From the repository root:

```bash
corepack pnpm --filter @traceback/web test -- app/flashcard-review.test.tsx
```

Neither command uses OpenAI or database credentials.

## Demo script

1. Upload `lecture-deck.pdf` and `notebook-page.png`.
2. Review the detected regions and confirm the starred mitochondria region.
3. Show the matched slide passage and normalized highlight coordinates.
4. Approve the match if it is visibly marked uncertain.
5. Generate the grounded card and open the review screen.
6. Edit, approve or reject, and confirm the batch.

## Manual fallback

If camera capture is unavailable, upload `notebook-page.png`. If live analysis
or generation fails, retry the failed phase after restoring the missing server
configuration. Do not load `expected.json` into the runtime UI. The committed
acceptance tests use that fixture to verify PDF extraction, matching, grounding,
and review behavior.

## Known limitations

- Automated tests begin with approved analysis; they do not evaluate live
  handwriting recognition.
- The matcher is lexical and may mark weak overlap as uncertain.
- Tests fake database and OpenAI boundaries.
- Final-demo deployment, rehearsal, and video recording are separate tasks.

## Recovery

- `404 Confirmed analysis not found`: confirm the reviewed analysis first.
- `503 Flashcard generation is not configured`: set the server-side OpenAI key
  and model, then retry generation.
- Unexpected match: verify the lecture PDF is the committed fixture and the
  selected region is `region-mitochondria`.
- Live analysis failure: verify the API and vision configuration, then retry the
  session.
