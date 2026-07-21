# Traceback

<p align="center">
  <strong>Turn handwritten study pages into interactive notes you can revisit, understand, and retain.</strong>
</p>

<p align="center">
  <a href="#the-problem">The problem</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#run-it-locally">Run locally</a> ·
  <a href="#openai-build-week">OpenAI Build Week</a>
</p>

<p align="center">
  <img src="apps/web/public/readme-landing-preview.png" alt="Traceback landing page with notebook scanning and interactive study notes" width="1000" />
</p>

## Tech stack

<p>
  <a href="https://nextjs.org"><img alt="Next.js 16" src="https://img.shields.io/badge/Next.js%2016-111111?style=for-the-badge&logo=nextdotjs&logoColor=white" /></a>
  <a href="https://react.dev"><img alt="React 19" src="https://img.shields.io/badge/React%2019-149ECA?style=for-the-badge&logo=react&logoColor=white" /></a>
  <a href="https://www.typescriptlang.org"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" /></a>
  <a href="https://tailwindcss.com"><img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind%20CSS%20v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" /></a>
  <a href="https://fastapi.tiangolo.com"><img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" /></a>
  <a href="https://www.python.org"><img alt="Python 3.12" src="https://img.shields.io/badge/Python%203.12-3776AB?style=for-the-badge&logo=python&logoColor=white" /></a>
  <a href="https://platform.openai.com"><img alt="OpenAI GPT-5.6 Terra" src="https://img.shields.io/badge/OpenAI-GPT--5.6%20Terra-412991?style=for-the-badge&logo=openai&logoColor=white" /></a>
  <a href="https://docs.opencv.org"><img alt="OCR and layout analysis" src="https://img.shields.io/badge/OCR%20%2B%20layout-EasyOCR%20%2B%20OpenCV-5A4A42?style=for-the-badge" /></a>
</p>

## The problem

Students who learn on paper lose momentum when they move to a laptop. A photographed notebook page is hard to search, difficult to review, and easy to abandon in a folder. Conventional OCR often produces a flat text dump rather than something built for learning.

**Traceback is an education tool for turning notebook scans into a more useful study surface.** It keeps the learner's source page close, turns legible handwriting into structured notes, and makes key ideas actionable.

## What Traceback does

| From a notebook page           | To a study workflow                                                              |
| ------------------------------ | -------------------------------------------------------------------------------- |
| One or more photographed pages | Clean, readable, structured study notes                                          |
| A short key phrase             | A safe interactive highlight with a quick explanation and trusted learning links |
| A saved set of notes           | Flashcards, a Pomodoro focus timer, and a shareable study-deck link              |

## How it works

1. **Scan your study pages** — upload one or more clear notebook photos. The original images stay available in the app for cross-checking.
2. **Build study-ready notes** — OCR/layout code extracts the text. GPT-5.6 Terra receives the page image plus bounded OCR regions and returns typed notes, short verified highlight phrases, explanations, and source-search queries as strict structured data.
3. **Study and revisit** — select a highlight to see context and approved learning links. Generate flashcards from the same set, review them with swipe-based recall, use a Pomodoro timer, and share the notes + cards with classmates.

## Product features

- Multi-image notebook upload and scan comparison
- OCR cleanup and smart notebook formatting (headings, bullets, and numbered items)
- Interactive highlights limited to short, meaningful phrases—not whole OCR lines
- Context cards with explanations and trusted-source discovery
- Editable extracted notes and manual pastel highlighter annotations
- Concept graph for relationships found in the page
- Saved study sets that keep notes, original pages, and flashcards together
- Tap-to-flip, swipe-to-rate flashcards with persistent progress
- Built-in 25/5 Pomodoro timer
- Shareable study-deck links; shared decks include notes, highlights, and cards while keeping the uploader's original scans private

## Architecture

```text
Notebook photos
      │
      ▼
Next.js web app ──► FastAPI analysis service
      │                    │
      │                    ├── OCR + layout / marker detection
      │                    ├── GPT-5.6 Terra structured analysis
      │                    └── approved-source search queries
      ▼
Interactive notes · highlights · context · flashcards · study deck
```

The browser never exposes OpenAI or database credentials. The API owns model calls, OCR analysis, and persistence. The web app renders the interactive notebook and stores a learner's study deck locally; share links publish only the cleaned notes and flashcards.

## Run it locally

### Prerequisites

- Node.js 22+ with Corepack
- Python 3.12+
- [`uv`](https://docs.astral.sh/uv/)
- A PostgreSQL/Supabase database URL for the API

### 1. Install dependencies

```bash
make setup
```

### 2. Create `.env`

Add the required local configuration. Keep this file out of version control.

```dotenv
DATABASE_URL=postgresql://...
WEB_ORIGIN=http://localhost:3000

# Use GPT-5.6 Terra for notebook analysis and flashcard generation.
OPENAI_API_KEY=your_key_here
OPENAI_VISION_MODEL=gpt-5.6-terra
ANALYSIS_ENGINE=openai

# Choose an installed OCR engine for real notebook scans.
OCR_ENGINE=easyocr
```

`OPENAI_API_KEY` is optional for the deterministic demo and local fallbacks. Without it, the app remains usable with mock or note-based fallback results; it does not claim AI-generated analysis succeeded.

### 3. Start the app

```bash
make dev
```

Open:

- Web app: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>
- API health: <http://localhost:8000/api/health>

Use **Run demo** on the landing page for a judge-friendly end-to-end example, or upload a clear notebook photo to exercise the live path.

### Verification

```bash
make test
make typecheck
make check
```

`make check` is the full local merge gate. The focused study-deck test lives in `apps/web/app/flashcard-study-deck.test.tsx`.

## Repository layout

```text
apps/web/                  Next.js 16 product experience
apps/api/                  FastAPI analysis and learning service
packages/api-client/       Generated TypeScript API contract
sample-data/               Non-private demonstration fixtures
supabase/migrations/       Versioned PostgreSQL schema changes
scripts/                   Development and contract utilities
```

## OpenAI Build Week

**Category:** Education

Traceback was built for OpenAI Build Week as a complete, runnable education product rather than a single model call. It uses Codex and GPT-5.6 Terra where the product needs multimodal judgment: correcting bounded OCR with the source image, structuring notes for study, choosing short safe highlights, and generating grounded flashcards.

### How Codex accelerated this build

- Designed and iterated on the full Next.js experience: upload, processing, interactive notes, concept graph, study decks, responsive UI, and accessibility states.
- Implemented the FastAPI structured-analysis pathway, validation rules that reject unsafe full-line highlights, and useful fallback behavior when analysis is unavailable.
- Built and tested the flashcard review flow, persistent study sets, Pomodoro timer, and shareable deck endpoints.
- Used Codex to maintain the testable repository workflow, focused tests, TypeScript checks, and clear judge setup instructions.

### How GPT-5.6 Terra is used

1. The backend sends the notebook image alongside OCR/layout evidence—not unbounded user text.
2. GPT-5.6 Terra returns a Pydantic-validated result: clean typed text, 3–8 short highlight phrases, coordinates, one-sentence explanations, and trusted-source search queries.
3. Server-side checks reject phrases that are too long, duplicated, or missing from the typed notes before the frontend can render them.
4. The same model can generate grounded flashcards from the learner's cleaned note text and selected highlights. If it is unavailable, Traceback uses a clearly labelled note-based fallback.

### GPT-5.6 Terra's impact on development

GPT-5.6 Terra shaped both the product capability and the engineering decisions behind it:

- **Made handwriting useful after OCR.** Rather than shipping a flat transcription, Terra turns the OCR and page-layout evidence into readable study notes, concise concepts, and review-ready cards.
- **Kept the interface trustworthy.** Its structured output contract led us to validate every suggested highlight against the rendered text, limiting highlights to meaningful 1–5 word phrases instead of exposing unreliable full-line annotations.
- **Informed a judge-friendly flow.** Terra's multimodal analysis enabled a clear demo narrative: scan pages, receive structured notes, select a concept for grounded context, then review generated flashcards from the same study set.
- **Accelerated iteration.** Together with Codex, Terra helped us test and refine the product's OCR-to-study experience while preserving deterministic fallbacks when a live model call is unavailable.

### Judge demo path

1. Open the app and select **Run demo**.
2. Show the cleaned interactive notes and select a highlighted phrase.
3. Open **Uploaded images** to compare source and output.
4. Generate flashcards, open **Study deck**, review a card, and start the focus timer.
5. Use **Share set** to create a learner-safe link that opens the notes and cards for another person.

### Submission checklist

- [ ] Public demo video under three minutes with voiceover explaining both Codex and GPT-5.6 usage
- [ ] Repository URL and this README included in the Devpost submission
- [ ] Category selected: **Education**
- [ ] A valid `/feedback` Codex session ID from the core implementation session entered in Devpost
- [ ] If the repository is private, access shared with `testing@devpost.com` and `build-week-event@openai.com`

## Privacy note

Notebook pages can contain personal study material. Keep API keys and database credentials server-side. Traceback's share flow excludes original uploaded images by design; it shares only the cleaned notes, highlights, and flashcards required to study together.

---

Built with Next.js, FastAPI, OCR/layout analysis, OpenAI GPT-5.6 Terra, and Codex.
