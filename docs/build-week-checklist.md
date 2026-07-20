# Build Week readiness — Traceback

Track: **Education**

Traceback helps students retain the structure of handwritten notes while tracing
each confirmed concept back to its supporting lecture material. The product scope
is intentionally aligned to the implementation plan: one deck, one notebook page,
an editable verification step, a grounded slide match, and marker-led study cards.

## What is already in scope

| Requirement | Traceback implementation | Evidence |
| --- | --- | --- |
| A focused Education project | Connects notebook concepts to lecture slides and recall cards | README and product plan |
| Notebook and lecture intake | PDF upload, image upload, and mobile camera input | `apps/web/app/page.tsx` |
| Student control over AI output | Regions can be selected, renamed, marked, moved, added, or removed before tracing | `apps/web/app/page.tsx` |
| Traceable study support | Trace View retains the notebook concept and shows a grounded source-slide passage | `apps/web/app/page.tsx` |
| Backend API foundation | Sessions, uploads, saved analysis, deck extraction, matching, and flashcards are documented FastAPI routes | `apps/api/app/api/` |
| Responsive demo flow | Upload, processing, verification, Trace View, and flashcard queue adapt to phone layouts | `apps/web/app/globals.css` |

## Required before submission

- [x] Replace the current frontend demo data with a real end-to-end session:
  upload a lecture PDF and notebook image, call the API, save the returned
  analysis, then confirm it.
- [ ] Wire the overlay editor to React Konva and retain normalized bounding-box
  coordinates (`0..1`) from the analysis contract.
- [ ] Render the uploaded deck in the Trace View with PDF.js and draw the API
  highlight boxes over the matched passage.
- [ ] Add the notebook-analysis orchestration endpoint: preprocessing, structured
  vision output, progress status, retry, and cached demo fallback.
- [ ] Run the happy path on a phone and laptop using non-private sample material.
- [ ] Make the project reliably runnable for judges (deployed URL preferred; if
  local-only, exact setup steps, sample data, and a tested fallback are required).
- [ ] Add a relevant open-source license if the GitHub repository remains public.
- [ ] Use only assets, SDKs, APIs, and data that the team is authorized to use.

## Codex and GPT-5.6 evidence

The Build Week rules require meaningful use of both Codex and GPT-5.6, not merely
an incidental mention. Preserve this evidence while building:

- Keep dated commits for the frontend, API, and integration work.
- Record, in your own words, where Codex accelerated implementation and where the
  team made product or engineering decisions.
- In the final README, distinguish any work that existed before the submission
  period from the work added during it.
- Run `/feedback` in the primary Codex build task and save the resulting Session
  ID for the Devpost form: `____________________________`.
- In the public demo's spoken audio, explain both the product and how Codex plus
  GPT-5.6 were used to build it. Do not use a silent screencast.

## Submission handoff

- [ ] Education selected as the single Devpost track.
- [ ] Repository URL submitted (or, if private, access granted to
  `testing@devpost.com` and `build-week-event@openai.com`).
- [ ] README contains installation, environment, sample-data, and demo guidance.
- [ ] Public YouTube demo is under three minutes and includes spoken explanation.
- [ ] Devpost description is written and edited by the team in its own voice.
- [ ] Primary Codex `/feedback` Session ID supplied.

## Demo narrative to validate

1. Upload a lecture PDF and capture one notebook page.
2. Show the meaningful regions and correct one in the overlay editor.
3. Select a confirmed concept and show its source slide plus highlight.
4. Approve the flashcard created from a star or question marker.
5. State the limitation honestly: the student approves structure before it is
   used for matching, and the match is grounded in the uploaded lecture.
