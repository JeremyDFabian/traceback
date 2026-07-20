import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSession,
  generateGroundedFlashcards,
  matchRegion,
  toConfirmedAnalysis,
  toStoredAnalysis,
  uploadDeck,
  type EditableRegion,
  type VisionAnalysis,
} from "./session-api";

const visionAnalysis: VisionAnalysis = {
  page_summary: "Energy notes",
  typed_text: "Mitochondria produce ATP.",
  confidence: 0.9,
  warnings: ["review_low_confidence"],
  markers: [],
  regions: [
    {
      id: "region-1",
      label: "ATP",
      highlight_text: "ATP",
      transcription: "ATP stores energy",
      type: "concept",
      bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      markers: ["star"],
      confidence: 0.9,
      explanation: "Presentation only",
      trusted_source_queries: ["ATP"],
    },
  ],
  relationships: [
    {
      id: "edge-1",
      source_region_id: "region-1",
      target_region_id: "region-2",
      label: "supports",
      type: "arrow",
      confidence: 0.7,
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("analysis mapping", () => {
  it("keeps only the persisted analysis contract", () => {
    expect(toStoredAnalysis(visionAnalysis)).toEqual({
      page_summary: "Energy notes",
      regions: [
        {
          id: "region-1",
          label: "ATP",
          transcription: "ATP stores energy",
          type: "concept",
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          markers: ["star"],
          confidence: 0.9,
        },
      ],
      relationships: [
        {
          id: "edge-1",
          source_region_id: "region-1",
          target_region_id: "region-2",
          label: "supports",
          confidence: 0.7,
        },
      ],
    });
  });

  it("normalizes edited boxes and drops relationships to removed regions", () => {
    const regions: EditableRegion[] = [
      {
        id: "region-1",
        label: "ATP",
        transcription: "ATP stores energy",
        type: "concept",
        x: 10,
        y: 20,
        width: 30,
        height: 10,
        marker: "question",
        confidence: 90,
      },
    ];

    expect(
      toConfirmedAnalysis(
        "Edited notes",
        regions,
        visionAnalysis.relationships,
      ),
    ).toEqual({
      page_summary: "Edited notes",
      regions: [
        {
          id: "region-1",
          label: "ATP",
          transcription: "ATP stores energy",
          type: "concept",
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          markers: ["question"],
          confidence: 0.9,
        },
      ],
      relationships: [],
    });
  });
});

describe("session API", () => {
  it("uses the existing upload, match, and grounded-card routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: "00000000-0000-4000-8000-000000000001",
            status: "created",
            created_at: "2026-07-20T00:00:00Z",
            updated_at: "2026-07-20T00:00:00Z",
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            session_id: "00000000-0000-4000-8000-000000000001",
            kind: "deck",
            storage_path: "deck.pdf",
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          region_id: "region-1",
          status: "matched",
          slide_number: 2,
          passage: "ATP stores energy",
          highlights: [],
          highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
          similarity_score: 0.4,
          reason: "Matched",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ flashcards: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const session = await createSession();
    const pdf = new File(["pdf"], "lecture.pdf", {
      type: "application/pdf",
    });
    await uploadDeck(session.id, pdf);
    const match = await matchRegion(session.id, "region-1");
    await generateGroundedFlashcards({
      count: 1,
      source: {
        session_id: session.id,
        region_id: "region-1",
        slide_number: match.slide_number!,
        note_text: "ATP",
        slide_text: match.passage,
        highlight_boxes: match.highlight_boxes,
      },
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8000/api/sessions",
      `http://localhost:8000/api/sessions/${session.id}/deck`,
      `http://localhost:8000/api/sessions/${session.id}/regions/region-1/match`,
      "http://localhost:8000/api/flashcards/generate",
    ]);
    expect((fetchMock.mock.calls[1][1]?.body as FormData).get("file")).toBe(
      pdf,
    );
    expect(
      JSON.parse(fetchMock.mock.calls[3][1]?.body as string),
    ).toMatchObject({
      count: 1,
      source: { region_id: "region-1", slide_number: 2 },
    });
  });
});
