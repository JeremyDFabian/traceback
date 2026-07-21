import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page, {
  getNotebookContentLayout,
  getPreferredSources,
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
  afterEach(() => vi.restoreAllMocks());

  it("starts a scan-only study session", () => {
    render(<Page />);

    expect(
      screen.getByText("Your pages, all in one place."),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose notebook photos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run demo/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/upload.*pdf/i)).not.toBeInTheDocument();
  });

  it("approves a scanned page and opens its concept graph", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/notebook-analysis"))
        return new Response(
          JSON.stringify({
            page_summary: "Energy in cells",
            typed_text: "Mitochondria produce ATP.",
            regions: [
              {
                ...interactiveRegion,
                highlight_text: "Mitochondria",
                transcription: "Mitochondria produce ATP.",
                bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
                markers: [],
                confidence: 0.9,
                explanation: "Cell organelle",
                trusted_source_queries: [],
              },
            ],
            relationships: [],
            warnings: [],
          }),
        );
      if (url.endsWith("/api/concept-details"))
        return new Response(
          JSON.stringify({ definition: "Cell organelle", sources: [] }),
        );
      if (url.endsWith("/api/sessions") && init?.method === "POST")
        return new Response(
          JSON.stringify({
            id: "00000000-0000-0000-0000-000000000001",
            status: "created",
            created_at: "2026-07-21T00:00:00Z",
            updated_at: "2026-07-21T00:00:00Z",
          }),
          { status: 201 },
        );
      if (url.endsWith("/pages/page-1/confirm"))
        return new Response(
          JSON.stringify({
            page: { page_id: "page-1" },
            graph_status: "ready",
          }),
        );
      if (url.endsWith("/graph"))
        return new Response(
          JSON.stringify({
            nodes: [
              {
                id: "mitochondria",
                label: "Mitochondria",
                type: "concept",
                confidence: 0.9,
                sources: [
                  {
                    page_id: "page-1",
                    region_id: "mitochondria",
                    excerpt: "Mitochondria produce ATP.",
                    bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
                  },
                ],
              },
            ],
            edges: [],
          }),
        );
      return new Response(null, { status: 404 });
    });

    const { container } = render(<Page />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: {
        files: [new File(["scan"], "notes.png", { type: "image/png" })],
      },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /Scan my pages/ })[1],
    );

    await screen.findByRole("heading", { name: "Energy in cells" });
    fireEvent.click(screen.getByRole("button", { name: /concept graph/i }));

    expect(
      await screen.findByRole("heading", { name: "Your study canvas" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes(
            "/api/sessions/00000000-0000-0000-0000-000000000001/pages/page-1/confirm",
          ),
        ),
      ).toBe(true),
    );
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

  it("does not create generic fallback links without a verified source", () => {
    expect(getRelevantSources("Microbes are ubiquitous")).toEqual([]);
  });

  it("prefers exact highlight links and approved API sources", () => {
    expect(
      getPreferredSources(
        "PCR",
        ["PCR diagnostic testing"],
        [{ title: "WHO PCR guidance", url: "https://www.who.int/pcr" }],
        [{ title: "Fallback API source", url: "https://example.com/api" }],
      ),
    ).toEqual([{ title: "WHO PCR guidance", url: "https://www.who.int/pcr" }]);

    expect(
      getPreferredSources(
        "PCR",
        ["PCR diagnostic testing"],
        [],
        [{ title: "NIH PCR overview", url: "https://www.nih.gov/pcr" }],
      ),
    ).toEqual([{ title: "NIH PCR overview", url: "https://www.nih.gov/pcr" }]);
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
          {
            ...interactiveRegion,
            id: "holmes",
            label: "Pr. Holmes",
            highlightText: "Pr. Holmes",
          },
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
    expect(
      screen.getByRole("button", { name: "Pr. Holmes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Birth at home" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PCR" })).toBeInTheDocument();
  });

  it("preserves an explicit heading, bullet hierarchy, and supporting details", () => {
    const text = [
      "# Cell Biology",
      "- Cell membrane - controls movement",
      "  - Selectively permeable barrier",
      "- Mitochondria - releases energy",
    ].join("\n");

    expect(getNotebookContentLayout(text)).toEqual({
      heading: "Cell Biology",
      items: [
        {
          name: "Cell membrane",
          contribution: "controls movement",
          support: "Selectively permeable barrier",
          style: "bullet",
        },
        {
          name: "Mitochondria",
          contribution: "releases energy",
          style: "bullet",
        },
      ],
    });
  });
  it("treats a person-name hash heading as the name for the first contribution", () => {
    const text = [
      "# Pr. Holmes",
      "- Birth at home",
      "Ignaz Semmelweis",
      "- Handwashing",
      "Edward Jenner",
      "- Smallpox vaccination",
    ].join("\n");

    expect(getNotebookContentLayout(text)).toEqual({
      heading: undefined,
      items: [
        { name: "Pr. Holmes", contribution: "Birth at home", style: "bullet" },
        {
          name: "Ignaz Semmelweis",
          contribution: "Handwashing",
          style: "bullet",
        },
        {
          name: "Edward Jenner",
          contribution: "Smallpox vaccination",
          style: "bullet",
        },
      ],
    });
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
