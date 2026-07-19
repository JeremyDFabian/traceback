import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "./page";

const generatedCards = {
  flashcards: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      question: "What is the main site of aerobic ATP production?",
      answer: "The mitochondrion.",
      difficulty: "easy" as const,
      source: {
        session_id: "00000000-0000-4000-8000-000000000001",
        region_id: "region-mitochondria",
        slide_number: 7,
        slide_text:
          "The mitochondrion is the main site of aerobic ATP production.",
        highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
      },
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("home page", () => {
  it("generates cards only after the student confirms the region", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(generatedCards)));

    render(<Page />);

    const generate = screen.getByRole("button", {
      name: "Generate flashcards",
    });
    expect(generate).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I confirm this starred region and lecture source",
      }),
    );
    expect(generate).toBeEnabled();
    fireEvent.click(generate);

    await screen.findByRole("heading", { name: "Review flashcards" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/flashcards/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          source: {
            session_id: "00000000-0000-4000-8000-000000000001",
            region_id: "region-mitochondria",
            slide_number: 7,
            note_text: "Mitochondria make ATP during aerobic respiration.",
            slide_text:
              "The mitochondrion is the main site of aerobic ATP production.",
            highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
          },
          count: 2,
        }),
      }),
    );
    expect(
      screen.getByText(
        "The mitochondrion is the main site of aerobic ATP production.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("x 10% · y 20% · width 30% · height 10%"),
    ).toBeInTheDocument();
  });

  it("shows a retryable error when generation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 502 }),
    );

    render(<Page />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Generate flashcards" }),
    );

    expect(
      await screen.findByText(
        "Flashcard generation failed. Check the API and try again.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate flashcards" }),
      ).toBeEnabled(),
    );
  });
});
