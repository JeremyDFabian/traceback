import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page, {
  getNotebookContentLayout,
  getRelevantSources,
  InteractiveNotebookText,
  type Region,
} from "./page";

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

  it("makes supporting note text interactive when it is highlighted", () => {
    render(
      <InteractiveNotebookText
        text="Study notes
Person ? Contribution
Supporting detail for revision."
        regions={[
          {
            ...interactiveRegion,
            id: "support",
            label: "Supporting detail",
            highlightText: "Supporting detail for revision.",
          },
        ]}
        selectedId=""
        onSelect={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Supporting detail for revision." }),
    ).toBeInTheDocument();
  });

  it("chooses medical reference sites for microbiology concepts", () => {
    expect(
      getRelevantSources("Microbes are ubiquitous").map(
        (source) => source.title,
      ),
    ).toEqual([
      "CDC resources on Microbes are ubiquitous",
      "PubMed research on Microbes are ubiquitous",
      "NCBI Bookshelf on Microbes are ubiquitous",
    ]);
  });

  it("highlights valid concepts that contain punctuation", () => {
    render(
      <InteractiveNotebookText
        text="DNA/RNA methods support PCR-based identification."
        regions={[
          {
            ...interactiveRegion,
            id: "dna-rna",
            label: "DNA/RNA",
            highlightText: "DNA/RNA",
          },
          {
            ...interactiveRegion,
            id: "pcr",
            label: "PCR-based",
            highlightText: "PCR-based",
          },
        ]}
        selectedId=""
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "DNA/RNA" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "PCR-based" }),
    ).toBeInTheDocument();
  });

  it("turns named note contributions into a compact structured list", () => {
    const text = [
      "Key Historical Figures and Medical Contributions",
      "Pr. Holmes \u2014 Birth at home",
      "Associated with fewer hospital-acquired infections.",
      "Ignaz Semmelweis \u2014 Handwashing",
      "Kary Mullis \u2014 PCR",
    ].join("\n");
    const layout = getNotebookContentLayout(text);

    expect(layout).toEqual({
      heading: "Key Historical Figures and Medical Contributions",
      items: [
        {
          name: "Pr. Holmes",
          contribution: "Birth at home",
          support: "Associated with fewer hospital-acquired infections.",
        },
        { name: "Ignaz Semmelweis", contribution: "Handwashing" },
        { name: "Kary Mullis", contribution: "PCR" },
      ],
    });

    render(
      <InteractiveNotebookText
        text={text}
        regions={[
          { ...interactiveRegion, highlightText: "Birth at home" },
          {
            ...interactiveRegion,
            id: "pcr",
            label: "PCR",
            highlightText: "PCR",
          },
        ]}
        selectedId=""
        onSelect={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: text.split("\n")[0] }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pr. Holmes").tagName).toBe("STRONG");
    expect(
      screen.getByRole("button", { name: "Birth at home" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PCR" })).toBeInTheDocument();
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
