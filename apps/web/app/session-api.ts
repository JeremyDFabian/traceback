import type { components } from "@traceback/api-client";

type Schemas = components["schemas"];

export type StoredAnalysis = Schemas["AnalysisResult"];
export type MatchResult = Schemas["MatchResponse"];
export type ReviewFlashcard = Schemas["Flashcard"];
export type VisionRegion = Schemas["NotebookRegion"] & {
  highlight_text?: string;
};
export type VisionAnalysis = Omit<
  Schemas["NotebookAnalysisResult"],
  "page_summary" | "typed_text" | "regions" | "relationships" | "warnings"
> & {
  page_summary: string;
  typed_text: string;
  regions: VisionRegion[];
  relationships: Schemas["NotebookRelationship"][];
  warnings: string[];
};
export type EditableRegion = {
  id: string;
  label: string;
  transcription?: string;
  type: "concept" | "definition" | "question";
  x: number;
  y: number;
  width: number;
  height: number;
  marker?: "star" | "question";
  confidence: number;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function requestJson<T>(
  path: string,
  init: RequestInit,
  failureMessage: string,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) throw new Error(failureMessage);
  return (await response.json()) as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Unable to read the notebook image."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read the notebook image."));
        return;
      }
      resolve(reader.result.split(",")[1] ?? reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function toStoredAnalysis(analysis: VisionAnalysis): StoredAnalysis {
  return {
    page_summary: analysis.page_summary,
    regions: analysis.regions.map((region) => ({
      id: region.id,
      label: region.label,
      transcription: region.transcription,
      type: region.type,
      bbox: region.bbox,
      markers: region.markers ?? [],
      confidence: region.confidence,
    })),
    relationships: analysis.relationships.map((relationship) => ({
      id: relationship.id,
      source_region_id: relationship.source_region_id,
      target_region_id: relationship.target_region_id,
      label: relationship.label,
      confidence: relationship.confidence,
    })),
  };
}

export function toConfirmedAnalysis(
  pageSummary: string,
  regions: EditableRegion[],
  relationships: StoredAnalysis["relationships"],
): StoredAnalysis {
  const regionIds = new Set(regions.map(({ id }) => id));
  return {
    page_summary: pageSummary,
    regions: regions.map((region) => ({
      id: region.id,
      label: region.label.trim(),
      transcription: region.transcription?.trim() || region.label.trim(),
      type: region.type,
      bbox: {
        x: region.x / 100,
        y: region.y / 100,
        width: region.width / 100,
        height: region.height / 100,
      },
      markers: region.marker ? [region.marker] : [],
      confidence: region.confidence / 100,
    })),
    relationships: relationships.filter(
      (relationship) =>
        regionIds.has(relationship.source_region_id) &&
        regionIds.has(relationship.target_region_id),
    ),
  };
}

export function createSession(): Promise<Schemas["SessionResponse"]> {
  return requestJson(
    "/api/sessions",
    { method: "POST" },
    "Traceback could not create a study session.",
  );
}

async function upload(
  sessionId: string,
  path: "deck" | "notebook-page",
  file: File,
  failureMessage: string,
): Promise<Schemas["UploadResponse"]> {
  const body = new FormData();
  body.append("file", file);
  return requestJson(
    `/api/sessions/${sessionId}/${path}`,
    { method: "POST", body },
    failureMessage,
  );
}

export function uploadDeck(sessionId: string, file: File) {
  return upload(
    sessionId,
    "deck",
    file,
    "Traceback could not upload the lecture PDF.",
  );
}

export function uploadNotebookPage(sessionId: string, file: File) {
  return upload(
    sessionId,
    "notebook-page",
    file,
    "Traceback could not upload the notebook image.",
  );
}

export async function analyzeNotebook(file: File): Promise<VisionAnalysis> {
  const image_base64 = await fileToBase64(file);
  return requestJson(
    "/api/notebook-analysis",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64 }),
    },
    "Traceback could not analyze the notebook image.",
  );
}

export function saveAnalysis(sessionId: string, analysis: StoredAnalysis) {
  return requestJson<StoredAnalysis>(
    `/api/sessions/${sessionId}/analysis`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysis),
    },
    "Traceback could not save the notebook analysis.",
  );
}

export function confirmAnalysis(sessionId: string, analysis: StoredAnalysis) {
  return requestJson<StoredAnalysis>(
    `/api/sessions/${sessionId}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysis),
    },
    "Traceback could not confirm the notebook analysis.",
  );
}

export function extractDeck(sessionId: string) {
  return requestJson<Schemas["DeckExtractionResponse"]>(
    `/api/sessions/${sessionId}/extract-deck`,
    { method: "POST" },
    "Traceback could not read the lecture PDF.",
  );
}

export function matchRegion(sessionId: string, regionId: string) {
  return requestJson<MatchResult>(
    `/api/sessions/${sessionId}/regions/${regionId}/match`,
    { method: "POST" },
    "Traceback could not match that notebook region.",
  );
}

export function generateGroundedFlashcards(
  request: Schemas["GenerateFlashcardsRequest"],
) {
  return requestJson<Schemas["GenerateFlashcardsResponse"]>(
    "/api/flashcards/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Traceback could not generate grounded flashcards.",
  );
}
