import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page, { InteractiveNotebookText, type Region } from "./page";
import * as sessionApi from "./session-api";
import type { StoredAnalysis, VisionAnalysis } from "./session-api";

const interactiveRegion: Region = {
  id: "mitochondria",
  label: "Mitochondria",
  highlightText: "Mitochondria",
  type: "concept",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  confidence: 90,
  transcription: "Mitochondria produce ATP during cellular respiration.",
};

const session = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "created" as const,
  created_at: "2026-07-20T00:00:00Z",
  updated_at: "2026-07-20T00:00:00Z",
};

const vision: VisionAnalysis = {
  page_summary: "Energy notes",
  typed_text: "Mitochondria produce ATP.",
  confidence: 0.9,
  warnings: [],
  markers: [],
  regions: [
    {
      id: "region-1",
      label: "Mitochondria",
      highlight_text: "Mitochondria",
      transcription: "Mitochondria produce ATP.",
      type: "concept",
      bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      markers: ["star"],
      confidence: 0.9,
    },
  ],
  relationships: [],
};

const stored: StoredAnalysis = {
  page_summary: "Energy notes",
  regions: [
    {
      id: "region-1",
      label: "Mitochondria",
      transcription: "Mitochondria produce ATP.",
      type: "concept",
      bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      markers: ["star"],
      confidence: 0.9,
    },
  ],
  relationships: [],
};

function selectRequiredFiles() {
  fireEvent.change(screen.getByLabelText(/choose lecture pdf/i), {
    target: {
      files: [
        new File(["pdf"], "lecture.pdf", { type: "application/pdf" }),
      ],
    },
  });
  fireEvent.change(screen.getByLabelText(/choose notebook image/i), {
    target: {
      files: [new File(["image"], "notes.png", { type: "image/png" })],
    },
  });
}

function mockInitialSession() {
  vi.spyOn(sessionApi, "createSession").mockResolvedValue(session);
  vi.spyOn(sessionApi, "uploadDeck").mockResolvedValue({
    session_id: session.id,
    kind: "deck",
    storage_path: "deck.pdf",
  });
  vi.spyOn(sessionApi, "uploadNotebookPage").mockResolvedValue({
    session_id: session.id,
    kind: "notebook_page",
    storage_path: "notes.png",
  });
  vi.spyOn(sessionApi, "analyzeNotebook").mockResolvedValue(vision);
  vi.spyOn(sessionApi, "saveAnalysis").mockResolvedValue(stored);
}

afterEach(() => vi.restoreAllMocks());

describe("home page", () => {
  it("starts an interactive PDF study session", () => {
    render(<Page />);

    expect(
      screen.getByText("Your pages, all in one place."),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose lecture PDF")).toBeInTheDocument();
    expect(screen.getByText("Choose notebook image")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start a session/i }),
    ).toBeInTheDocument();
  });

  it("highlights only the verified short phrase, not its OCR sentence", () => {
    render(
      <InteractiveNotebookText
        text="Mitochondria produce ATP during cellular respiration. ATP powers cell work."
        regions={[
          interactiveRegion,
          {
            ...interactiveRegion,
            id: "atp",
            label: "ATP",
            highlightText: "ATP",
            transcription: "ATP powers cell work.",
          },
        ]}
        selectedId=""
        onSelect={() => undefined}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Mitochondria" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "ATP" })).toHaveLength(1);
    expect(
      screen.queryByRole("button", {
        name: "Mitochondria produce ATP during cellular respiration.",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders legacy regions without highlight text as plain PDF text", () => {
    render(
      <InteractiveNotebookText
        text="Legacy OCR text remains readable."
        regions={[{ ...interactiveRegion, highlightText: undefined }]}
        selectedId=""
        onSelect={() => undefined}
      />,
    );

    expect(
      screen.getByText("Legacy OCR text remains readable."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("requires one lecture PDF and one notebook image", () => {
    render(<Page />);

    const start = screen.getByRole("button", { name: /create my pdf/i });
    expect(start).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/choose lecture pdf/i), {
      target: {
        files: [
          new File(["pdf"], "lecture.pdf", { type: "application/pdf" }),
        ],
      },
    });
    expect(start).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/choose notebook image/i), {
      target: {
        files: [new File(["image"], "notes.png", { type: "image/png" })],
      },
    });
    expect(start).toBeEnabled();
  });

  it("creates a session and saves live analysis before editing", async () => {
    mockInitialSession();
    render(<Page />);
    selectRequiredFiles();

    fireEvent.click(screen.getByRole("button", { name: /create my pdf/i }));

    expect(
      await screen.findByRole("heading", {
        name: "Review and refine your highlights.",
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(sessionApi.uploadDeck).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({ name: "lecture.pdf" }),
      );
      expect(sessionApi.uploadNotebookPage).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({ name: "notes.png" }),
      );
      expect(sessionApi.saveAnalysis).toHaveBeenCalledWith(session.id, stored);
    });
  });

  it("requires explicit approval for an uncertain match", async () => {
    mockInitialSession();
    vi.spyOn(sessionApi, "confirmAnalysis").mockResolvedValue(stored);
    vi.spyOn(sessionApi, "extractDeck").mockResolvedValue({
      session_id: session.id,
      slides: [],
    });
    vi.spyOn(sessionApi, "matchRegion").mockResolvedValue({
      region_id: "region-1",
      status: "uncertain",
      slide_number: 2,
      passage: "Mitochondria produce ATP.",
      highlights: [],
      highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
      similarity_score: 0.15,
      reason: "The slide is the best lexical match, but the score is low.",
    });

    render(<Page />);
    selectRequiredFiles();
    fireEvent.click(screen.getByRole("button", { name: /create my pdf/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /save & open pdf/i }),
    );

    expect(await screen.findByText("Uncertain match")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The slide is the best lexical match, but the score is low.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("15% confidence")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use this match" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate flashcards/i }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Use this match" }));
    expect(
      screen.getByRole("button", { name: /generate flashcards/i }),
    ).toBeEnabled();
  });
});
