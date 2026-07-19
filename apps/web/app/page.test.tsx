import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page, { InteractiveNotebookText, type Region } from "./page";

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

describe("home page", () => {
  it("starts an interactive PDF study session", () => {
    render(<Page />);

    expect(
      screen.getByText("Your pages, all in one place."),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose notebook photos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run demo/i }),
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
});
