import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConceptGraph, type ConceptGraphData } from "./concept-graph";

const graphFixture: ConceptGraphData = {
  nodes: [
    {
      id: "cellular respiration",
      label: "Cellular respiration",
      type: "concept",
      confidence: 0.94,
      sources: [
        {
          page_id: "page-1",
          region_id: "region-respiration",
          excerpt: "Cells release energy from glucose.",
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        },
      ],
    },
    {
      id: "atp",
      label: "ATP",
      type: "concept",
      confidence: 0.91,
      sources: [
        {
          page_id: "page-2",
          region_id: "region-atp",
          excerpt: "ATP stores usable chemical energy.",
          bbox: { x: 0.2, y: 0.3, width: 0.2, height: 0.1 },
        },
      ],
    },
  ],
  edges: [
    {
      id: "edge-strong",
      source: "cellular respiration",
      target: "atp",
      label: "produces",
      confidence: 0.9,
      review_required: false,
    },
  ],
};

describe("ConceptGraph", () => {
  it("shows selected concept evidence and opens its source", () => {
    const onOpenSource = vi.fn();
    render(
      <ConceptGraph
        graph={graphFixture}
        status="ready"
        onOpenSource={onOpenSource}
        onCreateFlashcards={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ATP, page 2" }));

    expect(screen.getByRole("heading", { name: "ATP" })).toBeInTheDocument();
    expect(
      screen.getByText("ATP stores usable chemical energy."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Open scanned page 2" }),
    );
    expect(onOpenSource).toHaveBeenCalledWith("page-2", "region-atp");
  });

  it("keeps unverified relationships off the canvas", () => {
    render(
      <ConceptGraph
        graph={{
          ...graphFixture,
          edges: [
            {
              ...graphFixture.edges[0],
              id: "low",
              confidence: 0.65,
              review_required: true,
            },
          ],
        }}
        status="ready"
        onOpenSource={vi.fn()}
        onCreateFlashcards={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("edge-low")).not.toBeInTheDocument();
    expect(
      screen.getByText("No verified relationships found in these notes yet."),
    ).toBeInTheDocument();
  });

  it("draws a high-confidence, evidence-backed relationship automatically", () => {
    render(
      <ConceptGraph
        graph={graphFixture}
        status="ready"
        onOpenSource={vi.fn()}
        onCreateFlashcards={vi.fn()}
      />,
    );

    expect(screen.getByTestId("edge-edge-strong")).toBeInTheDocument();
    expect(screen.getByText("Verified connections")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(screen.queryByTestId("edge-edge-strong")).not.toBeInTheDocument();
  });
  it("keeps the previous graph visible while an update is pending", () => {
    render(
      <ConceptGraph
        graph={graphFixture}
        status="pending"
        onOpenSource={vi.fn()}
        onCreateFlashcards={vi.fn()}
      />,
    );

    expect(screen.getByText("Canvas update pending")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cellular respiration, page 1" }),
    ).toBeInTheDocument();
  });

  it("offers retry when no graph is available", () => {
    const onRetry = vi.fn();
    render(
      <ConceptGraph
        graph={null}
        status="error"
        onRetry={onRetry}
        onOpenSource={vi.fn()}
        onCreateFlashcards={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Retry canvas update" }),
    );
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
