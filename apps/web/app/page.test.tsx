import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import demoFixture from "../../../sample-data/mitochondria-atp/expected.json";

import Page from "./page";

const generatedCards = {
  flashcards: demoFixture.generated_flashcards,
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
            session_id: demoFixture.session_id,
            region_id: demoFixture.approved_analysis.regions[0].id,
            slide_number: demoFixture.expected_match.slide_number,
            note_text: demoFixture.approved_analysis.regions[0].transcription,
            slide_text: demoFixture.expected_match.passage,
            highlight_boxes: demoFixture.expected_match.highlight_boxes,
          },
          count: demoFixture.flashcard_count,
        }),
      }),
    );
    expect(
      screen.getByText(demoFixture.expected_match.passage),
    ).toBeInTheDocument();
    const box = demoFixture.expected_match.highlight_boxes[0];
    expect(
      screen.getByText(
        `x ${Math.round(box.x * 100)}% · y ${Math.round(
          box.y * 100,
        )}% · width ${Math.round(box.width * 100)}% · height ${Math.round(
          box.height * 100,
        )}%`,
      ),
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
