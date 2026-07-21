/* eslint-disable react-hooks/immutability */
"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  ConceptGraph,
  type ConceptGraphData,
  type GraphStatus,
} from "./concept-graph";
import {
  FlashcardStudyDeck,
  type SavedStudySet,
  type StudyCard,
  type StudySetInput,
} from "./flashcard-study-deck";
import { FocusTimer } from "./focus-timer";

type Marker = "star" | "question";
type HighlightColor = "yellow" | "blue" | "pink" | "red";
export type Region = {
  id: string;
  label: string;
  highlightText?: string;
  highlightColor?: HighlightColor;
  type: "concept" | "definition" | "question";
  x: number;
  y: number;
  width: number;
  height: number;
  marker?: Marker;
  confidence: number;
  transcription?: string;
  explanation?: string;
  trustedSourceQueries?: string[];
  referenceLinks?: Array<{ title: string; url: string }>;
};

type ApiNotebookRegion = {
  id: string;
  label: string;
  highlight_text: string;
  transcription: string;
  type: "concept" | "definition" | "question" | "example" | "other";
  bbox: { x: number; y: number; width: number; height: number };
  markers: Array<"star" | "question" | "highlight" | "circle">;
  confidence: number;
  explanation: string;
  trusted_source_queries: string[];
};

type ApiNotebookAnalysis = {
  page_summary: string;
  typed_text: string;
  regions: ApiNotebookRegion[];
  relationships: ApiNotebookRelationship[];
  warnings: string[];
};

type ApiNotebookRelationship = {
  id: string;
  source_region_id: string;
  target_region_id: string;
  label: string | null;
  confidence: number;
};

type PageAnalysis = {
  pageSummary: string;
  typedText: string;
  regions: Region[];
  relationships: ApiNotebookRelationship[];
  warnings: string[];
};

type ConceptDetails = {
  definition: string;
  sources: Array<{ title: string; url: string }>;
};

type NotebookFlashcard = StudyCard & {
  included: boolean;
};

type SourceStatus = "idle" | "loading" | "ready" | "unavailable";

type ConceptDetailsResult = {
  highlightId: string;
  status: Exclude<SourceStatus, "idle" | "loading">;
  details?: ConceptDetails;
};

type Screen = "setup" | "processing" | "editor" | "trace" | "graph" | "cards";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getRelevantSources(_label: string, _queries: string[] = []) {
  return [];
}

export function getPreferredSources(
  label: string,
  queries: string[] = [],
  referenceLinks: Array<{ title: string; url: string }> = [],
  approvedSources: Array<{ title: string; url: string }> = [],
) {
  const exactLinks = referenceLinks.filter(
    (source) => source.title.trim() && source.url.trim(),
  );
  if (exactLinks.length) return exactLinks;

  const approvedLinks = approvedSources.filter(
    (source) => source.title.trim() && source.url.trim(),
  );
  if (approvedLinks.length) return approvedLinks;

  return getRelevantSources(label, queries);
}
const demoTypedText =
  "Cells make usable energy through cellular respiration. This process uses mitochondria to help produce ATP, the energy cells can use for work.";
const seededRegions: Region[] = [
  {
    id: "mitochondria",
    label: "Mitochondria",
    highlightText: "mitochondria",
    highlightColor: "yellow",
    type: "concept",
    x: 12,
    y: 24,
    width: 34,
    height: 10,
    confidence: 96,
    explanation:
      "Mitochondria are the parts of a cell where most aerobic respiration happens.",
    trustedSourceQueries: [
      "mitochondria structure and function",
      "mitochondria aerobic respiration",
    ],
    referenceLinks: [
      {
        title: "Mitochondria · OpenStax",
        url: "https://openstax.org/books/biology-2e/pages/4-3-eukaryotic-cells",
      },
      {
        title: "Mitochondrion · Wikipedia",
        url: "https://en.wikipedia.org/wiki/Mitochondrion",
      },
    ],
  },
  {
    id: "atp",
    label: "ATP",
    highlightText: "ATP",
    highlightColor: "blue",
    type: "concept",
    x: 56,
    y: 45,
    width: 19,
    height: 10,
    marker: "star",
    confidence: 91,
    explanation:
      "ATP is the energy-carrying molecule cells use to power most of their work.",
    trustedSourceQueries: ["ATP cellular energy", "ATP structure and function"],
    referenceLinks: [
      {
        title: "ATP and energy · Khan Academy",
        url: "https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation/atp-structure-and-hydrolysis/a/adenosine-triphosphate",
      },
      {
        title: "Adenosine triphosphate · Wikipedia",
        url: "https://en.wikipedia.org/wiki/Adenosine_triphosphate",
      },
    ],
  },
  {
    id: "respiration",
    label: "Cellular respiration",
    highlightText: "cellular respiration",
    highlightColor: "pink",
    type: "definition",
    x: 23,
    y: 66,
    width: 47,
    height: 10,
    marker: "question",
    confidence: 84,
    explanation:
      "Cellular respiration releases usable energy from food and stores it in ATP.",
    trustedSourceQueries: [
      "cellular respiration overview biology",
      "cellular respiration ATP production",
    ],
    referenceLinks: [
      {
        title: "Cellular respiration · OpenStax",
        url: "https://openstax.org/books/biology-2e/pages/7-1-energy-in-living-systems",
      },
      {
        title: "Cellular respiration · Khan Academy",
        url: "https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation",
      },
    ],
  },
];

const stages = [
  "Reading handwriting with OCR",
  "Extracting clean typed text",
  "Finding key topics to highlight",
  "Building your interactive notes",
];

const loadingCopy = [
  {
    eyebrow: "Reading your notebook",
    heading: "Finding the ideas",
    emphasis: "you put on paper.",
    detail:
      "Starting with the handwriting, structure, and study cues on the page.",
  },
  {
    eyebrow: "Shaping your notes",
    heading: "Turning handwriting into",
    emphasis: "clear study text.",
    detail: "Keeping the language readable while preserving what matters.",
  },
  {
    eyebrow: "Adding useful context",
    heading: "Choosing the concepts",
    emphasis: "worth exploring.",
    detail: "Only short, meaningful ideas become interactive highlights.",
  },
  {
    eyebrow: "Finishing your study view",
    heading: "Putting your notes",
    emphasis: "within reach.",
    detail: "Your interactive notes are nearly ready to review.",
  },
];

function createStarterFlashcards(regions: Region[], typedText: string) {
  const seen = new Set<string>();
  return regions
    .filter((region) => {
      const phrase = (region.highlightText ?? region.label).trim();
      const key = phrase.toLocaleLowerCase();
      if (!phrase || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((region, index) => {
      const phrase = (region.highlightText ?? region.label).trim();
      return {
        id: `starter-${region.id}-${index}`,
        question: `What should you remember about ${phrase}?`,
        answer:
          region.explanation ??
          `${phrase} appears in these notes: ${typedText.slice(0, 180)}${typedText.length > 180 ? "…" : ""}`,
        difficulty: "medium" as const,
        source_phrase: phrase,
      };
    });
}

function UploadField({
  label,
  detail,
  accept,
  files,
  multiple,
  onChange,
}: {
  label: string;
  detail: string;
  accept: string;
  files: File[];
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const pageCount = files.length;

  return (
    <label className="upload-card">
      <input
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
      <span className="upload-icon" aria-hidden="true">
        {accept === "application/pdf" ? "↗" : "⌁"}
      </span>
      <span>
        <strong>
          {pageCount
            ? `${pageCount} notebook ${pageCount === 1 ? "page" : "pages"} selected`
            : label}
        </strong>
        <small>
          {pageCount ? "Choose again anytime to add more pages." : detail}
        </small>
      </span>
      <span className="upload-action">
        {pageCount ? "Add pages" : "Choose"}
      </span>
    </label>
  );
}

function OpeningNotebook() {
  return (
    <div className="opening-notebook" aria-hidden="true">
      <div className="notebook-spine" />
      <div className="notebook-cover">
        <span>trace</span>
      </div>
      <div className="notebook-page left">
        <i />
        <i />
        <i />
      </div>
      <div className="notebook-page right">
        <i />
        <i />
        <i />
      </div>
      <div className="notebook-spark one">✦</div>
      <div className="notebook-spark two">✦</div>
    </div>
  );
}

function NotebookPreview({
  imageUrl,
  regions,
  selected,
  onSelect,
  editable,
  allowDragging,
  onRegionChange,
}: {
  imageUrl?: string;
  regions: Region[];
  selected?: string;
  onSelect: (id: string) => void;
  editable?: boolean;
  allowDragging?: boolean;
  onRegionChange?: (region: Region) => void;
}) {
  const drag = useRef<
    | {
        id: string;
        startX: number;
        startY: number;
        regionX: number;
        regionY: number;
      }
    | undefined
  >(undefined);
  function move(event: React.PointerEvent<HTMLButtonElement>, region: Region) {
    if (!editable || !allowDragging) return;
    drag.current = {
      id: region.id,
      startX: event.clientX,
      startY: event.clientY,
      regionX: region.x,
      regionY: region.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moving(event: React.PointerEvent<HTMLButtonElement>) {
    const action = drag.current;
    if (!action || !onRegionChange) return;
    const host = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!host) return;
    onRegionChange({
      ...regions.find((region) => region.id === action.id)!,
      x: Math.max(
        0,
        Math.min(
          100 - 12,
          action.regionX + ((event.clientX - action.startX) / host.width) * 100,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          100 - 8,
          action.regionY +
            ((event.clientY - action.startY) / host.height) * 100,
        ),
      ),
    });
  }
  return (
    <div
      className="notebook-surface"
      aria-label="Notebook page with detected interactive highlights"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Uploaded notebook page"
          className="notebook-image"
        />
      ) : (
        <div className="notebook-demo" aria-hidden="true">
          <span className="scribble s1">CELLULAR RESPIRATION</span>
          <span className="scribble s2">mitochondria → ATP</span>
          <span className="scribble s3">energy for the cell</span>
          <span className="scribble s4">where does it happen?</span>
          <span className="scribble star">★</span>
        </div>
      )}
      <div className="notebook-lines" aria-hidden="true" />
      {regions.map((region) => (
        <button
          key={region.id}
          type="button"
          className={`region ${selected === region.id ? "is-selected" : ""}`}
          data-highlight-color={region.highlightColor ?? "yellow"}
          style={{
            left: `${region.x}%`,
            top: `${region.y}%`,
            width: `${region.width}%`,
            height: `${region.height}%`,
          }}
          onClick={() => onSelect(region.id)}
          onPointerDown={
            allowDragging ? (event) => move(event, region) : undefined
          }
          onPointerMove={allowDragging ? moving : undefined}
          onPointerUp={() => {
            drag.current = undefined;
          }}
        >
          <span>
            {region.marker === "star"
              ? "★ "
              : region.marker === "question"
                ? "? "
                : ""}
            {region.label}
          </span>
          {selected === region.id && editable && allowDragging ? (
            <i className="drag-handle">Drag</i>
          ) : null}
        </button>
      ))}
    </div>
  );
}

type StructuredNotebookItem = {
  name?: string;
  contribution: string;
  support?: string;
  style?: "numbered" | "bullet";
};

type NotebookContentLayout = {
  heading?: string;
  items: StructuredNotebookItem[];
};

export function getNotebookHeading(text: string): string | undefined {
  const match = text.match(/^\s*#\s*([^\n:]{2,80}):?\s*/);
  return match?.[1].trim() || undefined;
}

function splitLongNotebookLine(line: string): string[] {
  const words = line.split(/\s+/);
  if (words.length < 18) return [line];

  const chunks: string[] = [];
  let chunk = "";
  for (const word of words) {
    if (chunk && `${chunk} ${word}`.length > 105) {
      chunks.push(chunk);
      chunk = word;
      continue;
    }
    chunk = chunk ? `${chunk} ${word}` : word;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((part, index) => (index ? `- ${part}` : part));
}

function getReadableNotebookLines(text: string): string[] {
  const withoutHashHeading = text.replace(/^\s*#\s*[^\n:]{2,80}:?\s*/, "");
  return withoutHashHeading
    .replace(/\s+(?=\d+[.)]\s+)/g, "\n")
    .replace(/(\S)[ \t]+-[ \t]+(?=[A-Z])/g, "$1\n- ")
    .replace(/([.!?])\s+(?=(?:[A-Z][A-Za-z ]{2,60}:|\d+[.)]))/g, "$1\n")
    .split(/\n+/)
    .map((line) => {
      const indentation = line.match(/^[\t ]*/)?.[0].replace(/\t/g, "  ") ?? "";
      const content = line.trim().replace(/\s+/g, " ");
      return content ? `${indentation}${content}` : "";
    })
    .filter(Boolean)
    .flatMap(splitLongNotebookLine);
}

export function getNotebookContentLayout(
  text: string,
): NotebookContentLayout | undefined {
  const rawExplicitHeading = getNotebookHeading(text);
  const lines = getReadableNotebookLines(text);
  if (lines.length < 2) return undefined;

  const itemPattern = /^([-*\u2022]|\d+[.)])\s+(.+)$/;
  const nameAndContribution = /^(.{2,72}?)\s+(?:\u2014|\u2013|-|:|\?)\s+(.+)$/;
  const personName =
    /^(?:(?:Dr|Pr|Prof)\.?\s+[A-Z][a-z]+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\??$/;
  const titledPersonName = /^(?:Dr|Pr|Prof)\.?\s+[A-Z][a-z]+\??$/;
  const explicitHeading =
    rawExplicitHeading && !titledPersonName.test(rawExplicitHeading)
      ? rawExplicitHeading
      : undefined;
  const headingPersonName =
    rawExplicitHeading && titledPersonName.test(rawExplicitHeading)
      ? rawExplicitHeading.replace(/\?+\s*$/, "").trim()
      : undefined;
  const firstContent = lines[0].trim();
  const firstLineIsHeading =
    !explicitHeading &&
    !itemPattern.test(firstContent) &&
    !nameAndContribution.test(firstContent) &&
    !personName.test(firstContent) &&
    !/[.!?]$/.test(firstContent);
  const heading =
    explicitHeading ?? (firstLineIsHeading ? firstContent : undefined);
  if (firstLineIsHeading) lines.shift();
  const items: StructuredNotebookItem[] = [];
  let pendingName: string | undefined = headingPersonName;

  for (const line of lines) {
    const indentation = line.match(/^[\t ]*/)?.[0].length ?? 0;
    const normalizedLine = line.trim();
    const bulletMatch = normalizedLine.match(itemPattern);
    const content = bulletMatch?.[2] ?? normalizedLine;
    const style = bulletMatch?.[1]?.match(/^\d/)
      ? "numbered"
      : bulletMatch
        ? "bullet"
        : undefined;
    if (!bulletMatch && personName.test(content)) {
      pendingName = content.replace(/\?+\s*$/, "").trim();
      continue;
    }
    const namedMatch = content.match(nameAndContribution);
    if (namedMatch) {
      items.push({
        name: namedMatch[1].replace(/\?+\s*$/, "").trim(),
        contribution: namedMatch[2].trim(),
        ...(style ? { style } : {}),
      });
      pendingName = undefined;
      continue;
    }
    if (bulletMatch && indentation > 0 && items.length) {
      const lastItem = items[items.length - 1];
      lastItem.support = [lastItem.support, content].filter(Boolean).join(" ");
      continue;
    }
    if (bulletMatch) {
      items.push({
        contribution: content,
        ...(pendingName ? { name: pendingName } : {}),
        style,
      });
      pendingName = undefined;
      continue;
    }
    if (items.length) {
      const lastItem = items[items.length - 1];
      lastItem.support = [lastItem.support, content].filter(Boolean).join(" ");
      continue;
    }
    items.push({ contribution: content, ...(style ? { style } : {}) });
  }

  return items.length >= 2 ? { heading, items } : undefined;
}

function HighlightableNotebookText({
  text,
  regions,
  selectedId,
  onSelect,
}: {
  text: string;
  regions: Region[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const interactiveRegions = regions.filter((region) =>
    region.highlightText?.trim(),
  );
  if (!interactiveRegions.length) return <>{text}</>;

  const matches: Array<{ start: number; end: number; region: Region }> = [];
  const seenPhrases = new Set<string>();
  for (const region of [...interactiveRegions].sort(
    (first, second) =>
      (second.highlightText?.length ?? 0) - (first.highlightText?.length ?? 0),
  )) {
    const phrase = region.highlightText?.trim() ?? "";
    const phraseKey = phrase.toLocaleLowerCase();
    if (seenPhrases.has(phraseKey)) continue;

    const pattern = phrase
      .split(/\s+/)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const match = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`,
      "iu",
    ).exec(text);
    if (!match || match.index === undefined) continue;

    const start = match.index + (match[1]?.length ?? 0);
    const end = start + (match[2]?.length ?? 0);
    if (
      matches.some(
        (candidate) => start < candidate.end && end > candidate.start,
      )
    ) {
      continue;
    }
    matches.push({ start, end, region });
    seenPhrases.add(phraseKey);
  }
  matches.sort((first, second) => first.start - second.start);

  return (
    <>
      {matches.map((match, index) => (
        <span key={match.region.id}>
          {text.slice(index ? matches[index - 1].end : 0, match.start)}
          <button
            type="button"
            className={`pdf-highlight highlight-${match.region.highlightColor ?? "yellow"} ${selectedId === match.region.id ? "selected" : ""}`}
            onPointerEnter={() => onSelect(match.region.id)}
            onFocus={() => onSelect(match.region.id)}
            onClick={() => onSelect(match.region.id)}
          >
            {text.slice(match.start, match.end)}
          </button>
        </span>
      ))}
      {text.slice(matches.at(-1)?.end ?? 0)}
    </>
  );
}

export function InteractiveNotebookText({
  text,
  regions,
  selectedId,
  onSelect,
  showHeading = true,
}: {
  text: string;
  regions: Region[];
  selectedId: string;
  onSelect: (id: string) => void;
  showHeading?: boolean;
}) {
  const layout = getNotebookContentLayout(text);
  if (!layout) {
    return (
      <div className="notebook-plain-text">
        {getReadableNotebookLines(text).map((line, index) => (
          <p key={`${line}-${index}`}>
            <HighlightableNotebookText
              text={line}
              regions={regions}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </p>
        ))}
      </div>
    );
  }

  const List = layout.items.every((item) => item.style === "numbered")
    ? "ol"
    : "ul";

  return (
    <section
      className="structured-notebook-text"
      aria-label="Extracted notebook notes"
    >
      {showHeading && layout.heading ? <h3>{layout.heading}</h3> : null}
      <List className={List === "ol" ? "numbered-notes" : undefined}>
        {layout.items.map((item, index) => (
          <li key={`${item.name ?? item.contribution}-${index}`}>
            <div>
              {item.name ? (
                <strong>
                  <HighlightableNotebookText
                    text={item.name}
                    regions={regions}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                </strong>
              ) : null}
              {item.name ? " \u2014 " : null}
              <HighlightableNotebookText
                text={item.contribution}
                regions={regions}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </div>
            {item.support ? (
              <small>
                <HighlightableNotebookText
                  text={item.support}
                  regions={regions}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              </small>
            ) : null}
          </li>
        ))}
      </List>
    </section>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Unable to read this notebook photo."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to prepare this notebook photo."));
        return;
      }
      resolve(result.split(",")[1] ?? result);
    };
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Unable to prepare this notebook photo."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to prepare this notebook photo."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function normalizeRegion(region: ApiNotebookRegion): Region {
  const marker = region.markers.includes("star")
    ? "star"
    : region.markers.includes("question")
      ? "question"
      : undefined;
  const type =
    region.type === "definition" || region.type === "question"
      ? region.type
      : "concept";

  return {
    id: region.id,
    label: region.label,
    highlightText: region.highlight_text ?? "",
    highlightColor: "yellow",
    type,
    x: region.bbox.x * 100,
    y: region.bbox.y * 100,
    width: region.bbox.width * 100,
    height: region.bbox.height * 100,
    marker,
    confidence: Math.round(region.confidence * 100),
    transcription: region.transcription,
    explanation: region.explanation,
    trustedSourceQueries: region.trusted_source_queries,
  };
}

async function analyzeNotebook(file: File): Promise<PageAnalysis> {
  const imageBase64 = await fileToBase64(file);
  const response = await fetch(`${apiBaseUrl}/api/notebook-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });
  if (!response.ok) {
    throw new Error("Traceback could not analyze that notebook page.");
  }

  const analysis = (await response.json()) as ApiNotebookAnalysis;
  return {
    pageSummary: analysis.page_summary,
    typedText: analysis.typed_text,
    regions: analysis.regions.map(normalizeRegion),
    relationships: analysis.relationships ?? [],
    warnings: analysis.warnings ?? [],
  };
}

function isValidHighlightPhrase(phrase: string | undefined, typedText: string) {
  const normalizedPhrase = (phrase ?? "").trim().replace(/\s+/g, " ");
  if (!normalizedPhrase || normalizedPhrase.length > 200) return false;

  const pattern = normalizedPhrase
    .split(" ")
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(pattern, "i").test(typedText);
}

function WhatIsTraceback() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.32 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="what-it-is"
      ref={sectionRef}
      className={`what-is-traceback ${isVisible ? "is-visible" : ""}`}
      aria-labelledby="what-is-traceback-title"
    >
      <div className="falling-papers" aria-hidden="true">
        <article className="falling-paper paper-one">
          <small>BIOLOGY</small>
          <b>Cellular respiration</b>
          <i />
          <i />
          <em>mitochondria → ATP</em>
        </article>
        <article className="falling-paper paper-two">
          <small>STUDY NOTES</small>
          <b>Photosynthesis</b>
          <i />
          <i />
          <em>light + CO₂</em>
        </article>
        <article className="falling-paper paper-three">
          <small>REVIEW</small>
          <b>Key idea</b>
          <i />
          <i />
          <em>ask why?</em>
        </article>
        <article className="falling-paper paper-four">
          <small>LECTURE 04</small>
          <b>Memory pathway</b>
          <i />
          <i />
          <em>short-term → long-term</em>
        </article>
      </div>
      <div className="what-is-content">
        <p className="eyebrow">What is Traceback?</p>
        <h2 id="what-is-traceback-title">
          <span>A notebook photo becomes</span>
          <em>interactive notes you can learn from.</em>
          <span>No more pages trapped in a folder.</span>
        </h2>
        <p className="what-is-note">
          Traceback extracts the text from your notes, preserves it in a clean
          study view, and adds hoverable ideas that open helpful context and
          relevant links.
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.22 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className={`how-it-works ${isVisible ? "is-visible" : ""}`}
      aria-labelledby="how-it-works-title"
    >
      <p className="eyebrow" id="how-it-works-title">
        How Traceback works
      </p>
      <div className="how-it-works-grid">
        <article className="process-card capture-card">
          <span>Step 01</span>
          <div
            className="process-visual workflow-mockup capture-mockup"
            aria-hidden="true"
          >
            <div className="mockup-phone">
              <div className="phone-camera" />
              <div className="phone-note">
                <i />
                <i />
                <i />
                <b>→</b>
              </div>
              <div className="camera-corners" />
            </div>
            <div className="page-count-chip">+ 3 PAGES</div>
            <p>SCANS SAVED</p>
          </div>
          <h3>scan your study pages</h3>
          <p>
            Add one or more clear notebook photos. Keep the originals beside the
            cleaned notes whenever you need to cross-check them.
          </p>
        </article>
        <article className="process-card confirm-card">
          <span>Step 02</span>
          <div
            className="process-visual workflow-mockup extraction-mockup"
            aria-hidden="true"
          >
            <div className="mockup-paper">
              <small>CLEAN STUDY NOTES</small>
              <b>Cellular respiration</b>
              <i />
              <i />
              <i />
              <em>• Mitochondria produce ATP</em>
            </div>
            <div className="ocr-chip">
              OCR + AI <strong>✓</strong>
            </div>
          </div>
          <h3>get notes built for study</h3>
          <p>
            OCR and GPT-5.6 clean up the layout, preserve the important ideas,
            and add only safe, short highlights.
          </p>
        </article>
        <article className="process-card trace-card">
          <span>Step 03</span>
          <div
            className="process-visual workflow-mockup study-mockup"
            aria-hidden="true"
          >
            <div className="mockup-pdf">
              <small>INTERACTIVE NOTES</small>
              <i />
              <i />
              <b>Mitochondria</b>
              <i />
            </div>
            <div className="mockup-study-card">
              <small>STUDY DECK</small>
              <b>25:00</b>
              <p>Flashcards · share set</p>
            </div>
          </div>
          <h3>study it your way</h3>
          <p>
            Select a highlighted phrase for context and trusted links, then turn
            the same notes into flashcards, a focus session, or a shareable
            deck.
          </p>
        </article>
      </div>
    </section>
  );
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [notebooks, setNotebooks] = useState<File[]>([]);
  const [imageUrl, setImageUrl] = useState<string>();
  const [pageImageDataUrls, setPageImageDataUrls] = useState<string[]>([]);
  const [isUploadedImagesOpen, setIsUploadedImagesOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const [regions, setRegions] = useState(seededRegions);
  const [selectedId, setSelectedId] = useState("mitochondria");
  const [approved, setApproved] = useState<string[]>([]);
  const [pageAnalyses, setPageAnalyses] = useState<PageAnalysis[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isLiveAnalysis, setIsLiveAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  const prefetchedConceptDetails = useRef(
    new Map<string, ConceptDetailsResult>(),
  );
  const [conceptDetailsResult, setConceptDetailsResult] =
    useState<ConceptDetailsResult>();
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [selectedNoteText, setSelectedNoteText] = useState("");
  const [annotationHint, setAnnotationHint] = useState(
    "Select a short phrase on the page to add a highlighter.",
  );
  const [selectionPosition, setSelectionPosition] = useState<{
    x: number;
    y: number;
  }>();
  const [editedDemoText, setEditedDemoText] = useState(demoTypedText);
  const [flashcards, setFlashcards] = useState<NotebookFlashcard[]>([]);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardError, setFlashcardError] = useState<string>();
  const [isFlashcardDrawerOpen, setIsFlashcardDrawerOpen] = useState(false);
  const [flashcardDrawerMode, setFlashcardDrawerMode] = useState<
    "library" | "review"
  >("library");
  const [studySetIdOverride, setStudySetIdOverride] = useState<string>();
  const automaticFlashcardsStarted = useRef(false);
  const [sessionId, setSessionId] = useState<string>();
  const [graph, setGraph] = useState<ConceptGraphData | null>(null);
  const [graphStatus, setGraphStatus] = useState<GraphStatus>("idle");
  const manualHighlightCounter = useRef(0);
  const selected = useMemo(
    () => regions.find((region) => region.id === selectedId) ?? regions[0],
    [regions, selectedId],
  );
  const activeAnalysis = pageAnalyses[activePageIndex];
  const renderedTypedText = activeAnalysis
    ? activeAnalysis.typedText
    : editedDemoText;
  const currentStudySet = useMemo<StudySetInput>(() => {
    const analysesToSave = pageAnalyses.length
      ? pageAnalyses
      : [
          {
            pageSummary: "Interactive notebook notes",
            typedText: editedDemoText,
          },
        ];
    const pages = analysesToSave.map((analysis, index) => ({
      id: `page-${index + 1}`,
      title:
        getNotebookHeading(analysis.typedText) ??
        analysis.pageSummary ??
        `Notebook page ${index + 1}`,
      typedText: analysis.typedText,
      imageDataUrl: pageImageDataUrls[index],
      regions:
        index === activePageIndex
          ? regions
          : "regions" in analysis
            ? analysis.regions
            : seededRegions,
    }));
    const fingerprint = pages
      .map((page) => `${page.title}-${page.typedText.length}`)
      .join("-");

    return {
      id: studySetIdOverride ?? `notes-${sessionId ?? fingerprint}`,
      title: pages[0]?.title ?? "Saved notebook notes",
      pages,
    };
  }, [
    activePageIndex,
    editedDemoText,
    pageAnalyses,
    pageImageDataUrls,
    regions,
    sessionId,
    studySetIdOverride,
  ]);
  const activeLoadingCopy =
    loadingCopy[Math.min(stage, loadingCopy.length - 1)];
  const structuredNotebookLayout = getNotebookContentLayout(renderedTypedText);
  const extractedNotebookHeading = getNotebookHeading(renderedTypedText);
  const useCompactNotebookTitle =
    Boolean(structuredNotebookLayout || extractedNotebookHeading) ||
    renderedTypedText.length > 160;
  const hasUnsafeHighlightFallback = Boolean(
    activeAnalysis?.warnings.includes(
      "interactive_highlights_unavailable_showing_plain_ocr",
    ),
  );
  const selectedPhraseIsValid = selected
    ? isValidHighlightPhrase(selected.highlightText, renderedTypedText)
    : false;
  const allHighlightsAreValid =
    regions.length > 0 &&
    regions.every((region) =>
      isValidHighlightPhrase(region.highlightText, renderedTypedText),
    );
  const conceptDetails =
    conceptDetailsResult?.highlightId === selected?.id
      ? conceptDetailsResult.details
      : undefined;
  const sourceStatus: SourceStatus =
    screen !== "trace" || !selected
      ? "idle"
      : conceptDetailsResult?.highlightId === selected.id
        ? conceptDetailsResult.status
        : "loading";
  const isResolvingManualHighlight =
    sourceStatus === "loading" && selected?.id.startsWith("manual-");
  const visibleSources = selected
    ? getPreferredSources(
        selected.label,
        selected.trustedSourceQueries,
        selected.referenceLinks,
        conceptDetails?.sources,
      )
    : (conceptDetails?.sources ?? []);

  useEffect(
    () => () => {
      if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  useEffect(() => {
    if (screen !== "processing") return;
    const timer = window.setInterval(
      () =>
        setStage((current) => {
          if (current >= stages.length - 1) {
            window.clearInterval(timer);
            if (!isLiveAnalysis) {
              window.setTimeout(() => setScreen("trace"), 650);
            }
            return current;
          }
          return current + 1;
        }),
      800,
    );
    return () => window.clearInterval(timer);
  }, [isLiveAnalysis, screen]);
  useEffect(() => {
    if (screen !== "trace" || !selected) return;

    const cached = prefetchedConceptDetails.current.get(selected.id);
    if (cached) {
      queueMicrotask(() => setConceptDetailsResult(cached));
      return;
    }

    const highlightId = selected.id;
    const controller = new AbortController();
    void fetch(`${apiBaseUrl}/api/concept-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        label: selected.label,
        transcription: selected.transcription,
        explanation: selected.explanation,
        trusted_source_queries: selected.trustedSourceQueries ?? [],
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to retrieve sources.");
        return (await response.json()) as ConceptDetails;
      })
      .then((details) => {
        if (controller.signal.aborted) return;
        const result = { highlightId, status: "ready" as const, details };
        prefetchedConceptDetails.current.set(highlightId, result);
        setConceptDetailsResult(result);
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") {
          setConceptDetailsResult({ highlightId, status: "unavailable" });
        }
      });

    return () => controller.abort();
  }, [screen, selected]);

  useEffect(() => {
    if (screen !== "trace") return;

    const controller = new AbortController();
    for (const region of regions) {
      if (region.id === selected?.id || region.id.startsWith("manual-"))
        continue;
      if (prefetchedConceptDetails.current.has(region.id)) continue;

      void fetch(`${apiBaseUrl}/api/concept-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          label: region.label,
          transcription: region.transcription,
          explanation: region.explanation,
          trusted_source_queries: region.trustedSourceQueries ?? [],
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Unable to retrieve sources.");
          return (await response.json()) as ConceptDetails;
        })
        .then((details) => {
          if (controller.signal.aborted) return;
          prefetchedConceptDetails.current.set(region.id, {
            highlightId: region.id,
            status: "ready",
            details,
          });
        })
        .catch(() => undefined);
    }

    return () => controller.abort();
  }, [regions, screen, selected?.id]);
  function selectNotebook(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    if (!notebooks.length) {
      if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(files[0]));
    }
    setNotebooks((current) => [...current, ...files]);
    event.target.value = "";
  }
  function clearNotebooks() {
    if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    setNotebooks([]);
    setImageUrl(undefined);
    setPageImageDataUrls([]);
  }
  function beginAnalysis() {
    setAnalysisError(undefined);
    setStage(0);
    setStudySetIdOverride(undefined);
    setFlashcards([]);
    setFlashcardError(undefined);
    automaticFlashcardsStarted.current = false;

    if (notebooks.length) {
      void analyzeNotebookPages();
      return;
    }

    setIsLiveAnalysis(false);
    setPageAnalyses([]);
    setActivePageIndex(0);
    setRegions(seededRegions);
    setSelectedId(seededRegions[0].id);
    setScreen("processing");
  }
  async function analyzeNotebookPages() {
    setStage(0);
    setIsLiveAnalysis(true);
    setScreen("processing");

    try {
      const analyses: PageAnalysis[] = [];
      const savedImages: string[] = [];
      for (const file of notebooks) {
        savedImages.push(await fileToDataUrl(file));
        analyses.push(await analyzeNotebook(file));
        setStage((current) => Math.min(stages.length - 1, current + 1));
      }

      const firstPage = analyses[0];
      if (!firstPage)
        throw new Error("Traceback could not read those notebook pages.");
      setPageAnalyses(analyses);
      setPageImageDataUrls(savedImages);
      setImageUrl(savedImages[0]);
      setActivePageIndex(0);
      setRegions(firstPage.regions);
      setSelectedId(firstPage.regions[0]?.id ?? "");
      setScreen("trace");
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Traceback could not analyze those notebook pages.",
      );
      setScreen("setup");
    } finally {
      setIsLiveAnalysis(false);
    }
  }
  function showPage(index: number) {
    const nextPage = pageAnalyses[index];
    if (!nextPage) return;
    setActivePageIndex(index);
    setImageUrl(pageImageDataUrls[index]);
    setRegions(nextPage.regions);
    setSelectedId(nextPage.regions[0]?.id ?? "");
    setIsEditingNotes(false);
    setIsAnnotating(false);
    setSelectedNoteText("");
    setSelectionPosition(undefined);
    setAnnotationHint(
      "Select a short phrase on the page to add a highlighter.",
    );
  }
  function openSavedStudySet(
    savedStudySet: SavedStudySet,
    savedCards: StudyCard[],
  ) {
    const restoredPages = savedStudySet.pages.map((page) => ({
      pageSummary: page.title,
      typedText: page.typedText,
      regions: Array.isArray(page.regions) ? (page.regions as Region[]) : [],
      relationships: [],
      warnings: [],
    }));
    const firstPage = restoredPages[0];
    if (!firstPage) return;

    setNotebooks([]);
    setStudySetIdOverride(savedStudySet.id);
    setPageAnalyses(restoredPages);
    setPageImageDataUrls(
      savedStudySet.pages.map((page) => page.imageDataUrl ?? ""),
    );
    setActivePageIndex(0);
    setImageUrl(savedStudySet.pages[0]?.imageDataUrl);
    setRegions(firstPage.regions);
    setSelectedId(firstPage.regions[0]?.id ?? "");
    setFlashcards(savedCards.map((card) => ({ ...card, included: true })));
    setIsFlashcardDrawerOpen(false);
    setScreen("trace");
  }

  async function shareStudySet(studySet: SavedStudySet, cards: StudyCard[]) {
    // Scans stay on the learner's device. A shared deck includes the cleaned
    // notes, highlights, and recall cards needed to study together.
    const sharedStudySet = {
      ...studySet,
      pages: studySet.pages.map(
        ({ imageDataUrl: _imageDataUrl, ...page }) => page,
      ),
    };
    const response = await fetch("/api/shared-study-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study_set: sharedStudySet, cards }),
    });
    if (!response.ok) {
      throw new Error("Traceback could not create a share link.");
    }
    const payload = (await response.json()) as { id: string };
    return `${window.location.origin}/?study=${encodeURIComponent(payload.id)}`;
  }

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("study");
    if (!shareId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/shared-study-sets/${encodeURIComponent(shareId)}`,
        );
        if (!response.ok)
          throw new Error("This shared study set is unavailable.");
        const payload = (await response.json()) as {
          study_set: SavedStudySet;
          cards: StudyCard[];
        };
        if (!cancelled) openSavedStudySet(payload.study_set, payload.cards);
      } catch (error) {
        if (!cancelled) {
          setAnalysisError(
            error instanceof Error
              ? error.message
              : "This shared study set is unavailable.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function ensureSession() {
    if (sessionId) return sessionId;
    const response = await fetch(`${apiBaseUrl}/api/sessions`, {
      method: "POST",
    });
    if (!response.ok)
      throw new Error("Traceback could not start this scan session.");
    const payload = (await response.json()) as { id: string };
    setSessionId(payload.id);
    return payload.id;
  }
  async function approveActivePage() {
    const analysis = pageAnalyses[activePageIndex];
    if (!analysis)
      throw new Error("Scan a notebook page before opening its graph.");
    const id = await ensureSession();
    const pageId = `page-${activePageIndex + 1}`;
    const regionIds = new Set(regions.map((region) => region.id));
    const response = await fetch(
      `${apiBaseUrl}/api/sessions/${id}/pages/${pageId}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          page_summary: analysis.pageSummary,
          typed_text: analysis.typedText,
          regions: regions
            .filter(
              (region) => region.label.trim() && region.transcription?.trim(),
            )
            .map((region) => ({
              id: region.id,
              label: region.label.trim(),
              transcription: region.transcription,
              type: region.type,
              bbox: {
                x: region.x / 100,
                y: region.y / 100,
                width: Math.max(region.width / 100, 0.0001),
                height: Math.max(region.height / 100, 0.0001),
              },
              markers: region.marker ? [region.marker] : [],
              confidence: region.confidence / 100,
            })),
          relationships: analysis.relationships.filter(
            (relationship) =>
              regionIds.has(relationship.source_region_id) &&
              regionIds.has(relationship.target_region_id),
          ),
        }),
      },
    );
    if (!response.ok)
      throw new Error("Traceback could not approve this scanned page.");
    const payload = (await response.json()) as {
      graph_status: "ready" | "pending";
    };
    setPageAnalyses((current) =>
      current.map((page, index) =>
        index === activePageIndex ? { ...page, regions } : page,
      ),
    );
    return { sessionId: id, status: payload.graph_status };
  }
  async function loadGraph(id: string) {
    const response = await fetch(`${apiBaseUrl}/api/sessions/${id}/graph`);
    if (!response.ok)
      throw new Error("Traceback could not load the concept graph.");
    const payload = (await response.json()) as ConceptGraphData;
    setGraph(payload);
    setGraphStatus("ready");
  }
  async function openConceptGraph() {
    setGraphStatus("loading");
    try {
      const approvedPage = await approveActivePage();
      setScreen("graph");
      if (approvedPage.status === "pending") setGraphStatus("pending");
      await loadGraph(approvedPage.sessionId);
    } catch {
      setScreen("graph");
      setGraphStatus("error");
    }
  }
  async function retryGraph() {
    if (!sessionId) return;
    setGraphStatus("loading");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/sessions/${sessionId}/graph/refresh`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Graph refresh failed");
      setGraph((await response.json()) as ConceptGraphData);
      setGraphStatus("ready");
    } catch {
      setGraphStatus("error");
    }
  }
  function openGraphSource(pageId: string, regionId: string) {
    const index = Number(pageId.replace(/^page-/, "")) - 1;
    if (Number.isInteger(index) && pageAnalyses[index]) showPage(index);
    setSelectedId(regionId);
    setScreen("trace");
  }
  function navigateTo(sectionId: "what-it-is" | "how-it-works") {
    setScreen("setup");
    window.setTimeout(
      () =>
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: "smooth" }),
      0,
    );
  }
  function scrollToScan() {
    setScreen("setup");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }
  function addRegion() {
    const id = `region-${Date.now()}`;
    setRegions((current) => [
      ...current,
      {
        id,
        label: "",
        highlightText: "",
        highlightColor: "yellow",
        type: "concept",
        x: 35,
        y: 38,
        width: 24,
        height: 9,
        confidence: 100,
      },
    ]);
    setSelectedId(id);
    setIsRepositioning(false);
  }
  function updateNoteText(nextText: string) {
    if (!activeAnalysis) {
      setEditedDemoText(nextText);
      return;
    }
    setPageAnalyses((current) =>
      current.map((analysis, index) =>
        index === activePageIndex
          ? { ...analysis, typedText: nextText }
          : analysis,
      ),
    );
  }
  function captureNoteSelection() {
    const selection = window.getSelection();
    const phrase = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!phrase || !selection?.rangeCount) {
      setSelectedNoteText("");
      setSelectionPosition(undefined);
      return;
    }

    if (!isValidHighlightPhrase(phrase, renderedTypedText)) {
      setSelectedNoteText("");
      setSelectionPosition(undefined);
      setAnnotationHint("Choose 1–5 words that appear in the extracted notes.");
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSelectedNoteText(phrase);
    setAnnotationHint("Choose a color to save this highlight.");
    setSelectionPosition({
      x: Math.min(
        window.innerWidth - 150,
        Math.max(12, rect.left + rect.width / 2),
      ),
      y: Math.max(12, rect.top - 12),
    });
  }
  function addManualHighlight(color: HighlightColor) {
    const phrase = selectedNoteText;
    if (!isValidHighlightPhrase(phrase, renderedTypedText)) return;

    const existing = regions.find(
      (region) =>
        region.highlightText?.trim().toLocaleLowerCase() ===
        phrase.toLocaleLowerCase(),
    );
    if (existing) {
      setRegions((current) =>
        current.map((region) =>
          region.id === existing.id
            ? { ...region, highlightColor: color }
            : region,
        ),
      );
      setSelectedId(existing.id);
    } else {
      const id = `manual-${++manualHighlightCounter.current}`;
      setRegions((current) => [
        ...current,
        {
          id,
          label: phrase,
          highlightText: phrase,
          highlightColor: color,
          type: "concept",
          x: 0,
          y: 0,
          width: 0.01,
          height: 0.01,
          confidence: 100,
          transcription: renderedTypedText,
          trustedSourceQueries: [phrase],
        },
      ]);
      setSelectedId(id);
    }
    setSelectedNoteText("");
    setSelectionPosition(undefined);
    setAnnotationHint("Select another short phrase to add a highlighter.");
    window.getSelection()?.removeAllRanges();
  }
  async function generateFlashcards() {
    setFlashcardError(undefined);
    setIsGeneratingFlashcards(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/notebook-flashcards/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typed_text: renderedTypedText,
            highlights: regions.flatMap((region) => {
              const phrase = region.highlightText?.trim();
              return phrase ? [{ id: region.id, phrase }] : [];
            }),
            count: 5,
          }),
        },
      );
      if (!response.ok)
        throw new Error("Traceback could not generate flashcards.");
      const payload = (await response.json()) as {
        flashcards: Omit<NotebookFlashcard, "included">[];
      };
      if (!payload.flashcards.length) {
        throw new Error("No safe flashcards were returned for these notes.");
      }
      setFlashcards(
        payload.flashcards.map((card) => ({ ...card, included: true })),
      );
    } catch (error) {
      const starterCards = createStarterFlashcards(regions, renderedTypedText);
      if (starterCards.length) {
        setFlashcards(
          starterCards.map((card) => ({ ...card, included: true })),
        );
        return;
      }
      setFlashcardError(
        error instanceof Error
          ? error.message
          : "Traceback could not generate flashcards.",
      );
    } finally {
      setIsGeneratingFlashcards(false);
    }
  }
  useEffect(() => {
    if (
      screen !== "trace" ||
      automaticFlashcardsStarted.current ||
      !renderedTypedText.trim()
    ) {
      return;
    }
    automaticFlashcardsStarted.current = true;
    void generateFlashcards();
  }, [screen, renderedTypedText]);
  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <button
          className="brand"
          onClick={() => setScreen("setup")}
          aria-label="Traceback home"
        >
          <img src="/traceback-logo-cropped.png" alt="Traceback" />
        </button>
        <div className="nav-steps">
          <a
            href="#what-it-is"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("what-it-is");
            }}
          >
            What it is
          </a>
          <a
            href="#how-it-works"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("how-it-works");
            }}
          >
            How it works
          </a>
          <a
            className="nav-github-link"
            href="https://github.com/JeremyDFabian/traceback"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
        <div className="topbar-actions">
          <button
            className="study-deck-button"
            onClick={() => {
              setFlashcardDrawerMode("library");
              setIsFlashcardDrawerOpen(true);
            }}
          >
            Study deck
          </button>
          <button className="demo-button" onClick={scrollToScan}>
            Scan my pages <span>↗</span>
          </button>
        </div>
      </nav>

      {screen === "setup" && (
        <>
          <section className="landing">
            <div className="landing-notebook-stage">
              <img
                className="landing-notebook-image"
                src="/landing-notebook.png"
                alt="Open ruled notebook showing the Traceback interactive-notes message"
              />
            </div>
            <div id="upload-map" className="setup-card">
              <p className="setup-intro">Your pages, all in one place.</p>
              <div className="setup-heading">
                <div>
                  <p className="eyebrow">Create your study reference</p>
                  <h2>Scan notebook pages</h2>
                </div>
              </div>
              <p className="setup-subcopy">
                Add one page or a whole notebook. We keep your pages together
                and make each one easier to revisit.
              </p>
              <UploadField
                label="Choose notebook photos"
                detail="Select clear JPG or PNG pages. You can add more afterward."
                accept="image/*"
                multiple
                files={notebooks}
                onChange={selectNotebook}
              />
              {notebooks.length ? (
                <div className="upload-selection-summary" aria-live="polite">
                  <span>
                    {notebooks.length}{" "}
                    {notebooks.length === 1 ? "page" : "pages"} queued
                  </span>
                  <button type="button" onClick={clearNotebooks}>
                    Clear all
                  </button>
                </div>
              ) : null}
              {analysisError ? (
                <p className="analysis-error" role="alert">
                  {analysisError} Check that the API is running, then try again.
                </p>
              ) : null}
              <button
                className="primary-button"
                disabled={!notebooks.length}
                onClick={beginAnalysis}
              >
                Scan my pages <span>→</span>
              </button>
              <button className="card-demo-button" onClick={beginAnalysis}>
                Run demo <span>↗</span>
              </button>
              <p className="privacy-note">
                Your photos are used only to create your interactive study view.
              </p>
            </div>
          </section>
          <WhatIsTraceback />
          <HowItWorks />
        </>
      )}

      {screen === "processing" && (
        <section className="processing-screen">
          <div className="processing-notebook">
            <OpeningNotebook />
          </div>
          <div className="processing-copy" key={stage} aria-live="polite">
            <p className="eyebrow">{activeLoadingCopy.eyebrow}</p>
            <h1>
              {activeLoadingCopy.heading}
              <br />
              <em>{activeLoadingCopy.emphasis}</em>
            </h1>
            <p>{activeLoadingCopy.detail}</p>
          </div>
          <div
            className="processing-progress"
            role="progressbar"
            aria-label="Notebook analysis progress"
            aria-valuemin={0}
            aria-valuemax={stages.length}
            aria-valuenow={stage + 1}
          >
            <i
              className={isLiveAnalysis ? "is-live" : undefined}
              style={{
                width: `${
                  isLiveAnalysis
                    ? Math.min(88, 28 + stage * 20)
                    : ((stage + 1) / stages.length) * 100
                }%`,
              }}
            />
          </div>
          <div className="progress-list">
            {stages.map((item, index) => (
              <div key={item} className={index <= stage ? "done" : ""}>
                <i>{index < stage ? "✓" : index === stage ? "" : ""}</i>
                <span>{item}</span>
                {index === stage ? (
                  <small className="working-status" aria-label="Working">
                    Working<span aria-hidden="true">...</span>
                  </small>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {screen === "editor" && (
        <section className="workspace">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">Step 2 of 3 · Review highlights</p>
              <h1>Review and refine your highlights.</h1>
              <p>
                Review the exact phrases you can explore in your interactive
                notes. Every phrase must appear in the extracted text.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={!allHighlightsAreValid}
              onClick={() => setScreen("trace")}
            >
              Save &amp; open notes <span>→</span>
            </button>
          </header>
          <div className="editor-grid">
            <div className="canvas-panel">
              <div className="canvas-toolbar">
                <span>
                  <b>{regions.length}</b> highlights found
                </span>
                <button onClick={addRegion}>+ Add highlight</button>
                <button
                  className={
                    isRepositioning ? "move-button active" : "move-button"
                  }
                  onClick={() => setIsRepositioning((current) => !current)}
                >
                  {isRepositioning ? "Done moving" : "Move selected"}
                </button>
                <span className="canvas-hint">
                  {isRepositioning
                    ? "Drag the selected outline on the page"
                    : "Select a phrase to edit it"}
                </span>
              </div>
              <NotebookPreview
                imageUrl={imageUrl}
                regions={regions}
                selected={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setIsRepositioning(false);
                }}
                editable
                allowDragging={isRepositioning}
                onRegionChange={(changed) =>
                  setRegions((current) =>
                    current.map((region) =>
                      region.id === changed.id ? changed : region,
                    ),
                  )
                }
              />
            </div>
            <aside className="inspector">
              {selected ? (
                <>
                  <p className="eyebrow">1. Choose a highlight</p>
                  <div className="highlight-picker" role="list">
                    {regions.map((region, index) => (
                      <button
                        key={region.id}
                        type="button"
                        role="listitem"
                        className={region.id === selected.id ? "active" : ""}
                        onClick={() => {
                          setSelectedId(region.id);
                          setIsRepositioning(false);
                        }}
                      >
                        <span>{index + 1}</span>
                        {region.highlightText || "Untitled highlight"}
                      </button>
                    ))}
                  </div>
                  <div className="inspector-divider" />
                  <p className="eyebrow">2. Edit the selected phrase</p>
                  <label>
                    Highlighted phrase
                    <input
                      value={selected.highlightText}
                      onChange={(event) =>
                        setRegions((current) =>
                          current.map((region) =>
                            region.id === selected.id
                              ? {
                                  ...region,
                                  label: event.target.value,
                                  highlightText: event.target.value,
                                }
                              : region,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="editor-context">
                    <small>ORIGINAL OCR CONTEXT</small>
                    <p>
                      {selected.transcription || "No OCR context available."}
                    </p>
                  </div>
                  {!selectedPhraseIsValid ? (
                    <p className="field-error">
                      Use a phrase of up to five words that appears in the
                      extracted text.
                    </p>
                  ) : null}
                  <label>
                    Highlight type
                    <select
                      value={selected.type}
                      onChange={(event) =>
                        setRegions((current) =>
                          current.map((region) =>
                            region.id === selected.id
                              ? {
                                  ...region,
                                  type: event.target.value as Region["type"],
                                }
                              : region,
                          ),
                        )
                      }
                    >
                      <option value="concept">Topic</option>
                      <option value="definition">Definition</option>
                      <option value="question">Question</option>
                    </select>
                  </label>
                  <div className="highlighter-colors">
                    <span>Highlighter color</span>
                    <div>
                      {(
                        ["yellow", "red", "pink", "blue"] as HighlightColor[]
                      ).map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`highlighter-color ${color} ${selected.highlightColor === color ? "active" : ""}`}
                          aria-label={`${color} highlighter`}
                          aria-pressed={selected.highlightColor === color}
                          onClick={() =>
                            setRegions((current) =>
                              current.map((region) =>
                                region.id === selected.id
                                  ? { ...region, highlightColor: color }
                                  : region,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div className="marker-row">
                    <span>Optional study marker</span>
                    <button
                      className={
                        selected.marker === "star" ? "marker active" : "marker"
                      }
                      onClick={() =>
                        setRegions((current) =>
                          current.map((region) =>
                            region.id === selected.id
                              ? {
                                  ...region,
                                  marker:
                                    region.marker === "star"
                                      ? undefined
                                      : "star",
                                }
                              : region,
                          ),
                        )
                      }
                    >
                      ★ Mark important
                    </button>
                    <button
                      className={
                        selected.marker === "question"
                          ? "marker active"
                          : "marker"
                      }
                      onClick={() =>
                        setRegions((current) =>
                          current.map((region) =>
                            region.id === selected.id
                              ? {
                                  ...region,
                                  marker:
                                    region.marker === "question"
                                      ? undefined
                                      : "question",
                                }
                              : region,
                          ),
                        )
                      }
                    >
                      ? Review later
                    </button>
                  </div>
                  <p className="editor-help">
                    Need a different position? Select <b>Move selected</b>, then
                    drag the outline on the notebook.
                  </p>
                  <div
                    className="confidence"
                    aria-label="AI text detection confidence"
                  >
                    <span>AI confidence</span>
                    <strong>{selected.confidence}%</strong>
                    <div>
                      <i style={{ width: `${selected.confidence}%` }} />
                    </div>
                  </div>
                  <button
                    className="text-button danger"
                    disabled={regions.length === 1}
                    onClick={() => {
                      setRegions((current) =>
                        current.filter((region) => region.id !== selected.id),
                      );
                      setSelectedId(
                        regions.find((region) => region.id !== selected.id)
                          ?.id ?? "",
                      );
                    }}
                  >
                    {regions.length === 1
                      ? "Keep at least one highlight"
                      : "Remove highlight"}
                  </button>
                </>
              ) : (
                <div className="empty-highlight-editor">
                  <p className="eyebrow">No verified highlights</p>
                  <h2>Your typed notes are still ready.</h2>
                  <p>
                    Terra did not return any safe key phrases for this page. You
                    can retry analysis or add a phrase that appears in the
                    extracted text.
                  </p>
                  <button className="secondary-button" onClick={addRegion}>
                    Add a phrase
                  </button>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      {screen === "trace" && (
        <section className="trace-view interactive-pdf-view">
          <header className="trace-header">
            <div>
              <p className="eyebrow">Your interactive notes</p>
              <h1>
                Your notes, ready
                <br />
                <em>to explain themselves.</em>
              </h1>
              <p className="map-subtitle">
                Hover or select a highlighted phrase to see an explanation and
                useful links about that topic.
              </p>
            </div>
            <div className="trace-actions">
              <button
                className="secondary-button"
                disabled={!pageImageDataUrls.some(Boolean)}
                onClick={() => setIsUploadedImagesOpen(true)}
              >
                Uploaded images
              </button>
              <button
                className="secondary-button"
                disabled={!activeAnalysis || graphStatus === "loading"}
                onClick={() => void openConceptGraph()}
              >
                {graphStatus === "loading"
                  ? "Updating graph..."
                  : "Concept graph"}
              </button>
              <button
                className="secondary-button"
                disabled={isGeneratingFlashcards}
                onClick={() => {
                  setFlashcardDrawerMode("review");
                  setIsFlashcardDrawerOpen(true);
                }}
              >
                {isGeneratingFlashcards ? "Preparing cards..." : "Flashcards"}
              </button>
              <button
                className={
                  isAnnotating ? "secondary-button active" : "secondary-button"
                }
                onClick={() => {
                  setIsAnnotating((current) => !current);
                  setIsEditingNotes(false);
                  setSelectedNoteText("");
                  setSelectionPosition(undefined);
                  setAnnotationHint(
                    "Select a short phrase on the page to add a highlighter.",
                  );
                }}
              >
                {isAnnotating ? "Done annotating" : "Annotate"}
              </button>
              <button
                className={
                  isEditingNotes
                    ? "secondary-button active"
                    : "secondary-button"
                }
                onClick={() => {
                  setIsEditingNotes((current) => !current);
                  setIsAnnotating(false);
                  setSelectedNoteText("");
                  setSelectionPosition(undefined);
                  setAnnotationHint(
                    "Select a short phrase on the page to add a highlighter.",
                  );
                }}
              >
                {isEditingNotes ? "Done editing" : "Edit text"}
              </button>
            </div>
          </header>
          <div className="interactive-pdf-layout">
            <section
              className="interactive-pdf-page"
              aria-label="Interactive study notes created from your notebook"
            >
              <header>
                <span>TRACEBACK NOTES</span>
                <span>
                  Page {activePageIndex + 1} of{" "}
                  {Math.max(pageAnalyses.length, 1)}
                </span>
              </header>
              <div className="pdf-page-content">
                <p className="pdf-kicker">EXTRACTED FROM YOUR NOTEBOOK</p>
                <h2
                  className={
                    useCompactNotebookTitle
                      ? "structured-note-page-title"
                      : undefined
                  }
                  onMouseUp={isAnnotating ? captureNoteSelection : undefined}
                >
                  <HighlightableNotebookText
                    text={
                      structuredNotebookLayout?.heading ??
                      extractedNotebookHeading ??
                      activeAnalysis?.pageSummary ??
                      "Cellular respiration"
                    }
                    regions={regions}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </h2>
                {isEditingNotes ? (
                  <>
                    <p className="edit-note-helper">
                      Edit the extracted note text, then choose Done editing to
                      return to reading.
                    </p>
                    <div
                      key={`note-editor-${activePageIndex}`}
                      className="editable-note-text"
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      onInput={(event) =>
                        updateNoteText(event.currentTarget.innerText)
                      }
                      onMouseUp={captureNoteSelection}
                      onKeyUp={captureNoteSelection}
                    >
                      {renderedTypedText}
                    </div>
                  </>
                ) : (
                  <div
                    className={
                      isAnnotating
                        ? "annotatable-note-text active"
                        : "annotatable-note-text"
                    }
                    onMouseUp={isAnnotating ? captureNoteSelection : undefined}
                    onKeyUp={isAnnotating ? captureNoteSelection : undefined}
                  >
                    {isAnnotating ? (
                      <p className="annotation-instruction">{annotationHint}</p>
                    ) : null}
                    <InteractiveNotebookText
                      text={renderedTypedText}
                      regions={regions}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      showHeading={false}
                    />
                  </div>
                )}
                {!regions.length ? (
                  <div className="no-highlight-notice" role="status">
                    <strong>Showing clean extracted text</strong>
                    <span>
                      {hasUnsafeHighlightFallback
                        ? "We could not verify safe highlights for this page."
                        : "No interactive phrases were found for this page."}
                    </span>
                    <button type="button" onClick={beginAnalysis}>
                      Retry analysis
                    </button>
                  </div>
                ) : null}
              </div>
              <footer>
                <span>Highlights added by Traceback</span>
                <span>{regions.length} topics found</span>
              </footer>
            </section>
            {pageAnalyses.length > 1 ? (
              <div className="pdf-page-navigation" aria-label="Notebook pages">
                <button
                  type="button"
                  disabled={activePageIndex === 0}
                  onClick={() => showPage(activePageIndex - 1)}
                >
                  ← Previous page
                </button>
                <span>
                  Page {activePageIndex + 1} / {pageAnalyses.length}
                </span>
                <button
                  type="button"
                  disabled={activePageIndex === pageAnalyses.length - 1}
                  onClick={() => showPage(activePageIndex + 1)}
                >
                  Next page →
                </button>
              </div>
            ) : null}
            {selected ? (
              <aside key={selected.id} className="concept-detail">
                <p className="eyebrow">About this highlight</p>
                <div className="concept-title">
                  <span>
                    {selected.marker === "star"
                      ? "★"
                      : selected.marker === "question"
                        ? "?"
                        : "⌁"}
                  </span>
                  <h2>{selected.label}</h2>
                </div>
                <div className="study-note">
                  <p className="detail-label">Quick explanation</p>
                  <p>
                    {isResolvingManualHighlight
                      ? `Looking up “${selected.label}”…`
                      : conceptDetails?.definition ??
                        selected.explanation ??
                        `You marked "${selected.label}" to revisit. Explore the explanation and links to build on it.`}
                  </p>
                </div>
                <div className="reference-list">
                  <div className="reference-heading">
                    <p className="detail-label">Useful links</p>
                  </div>
                  {visibleSources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>↗</span> {source.title}
                    </a>
                  ))}
                  {!visibleSources.length && sourceStatus === "loading" ? (
                    <p className="reference-loading">
                      Finding reliable sources…
                    </p>
                  ) : null}
                  {!visibleSources.length && sourceStatus === "unavailable" ? (
                    <p className="reference-loading">
                      Links are temporarily unavailable. Try another highlight
                      or keep studying from the extracted text.
                    </p>
                  ) : null}
                </div>
              </aside>
            ) : (
              <aside className="concept-detail empty-concept-detail">
                <p className="eyebrow">Interactive highlights</p>
                <h2>Nothing misleading is highlighted.</h2>
                <p>
                  Traceback kept this page readable because it could not verify
                  a short phrase to attach context and trusted sources to.
                </p>
                <button className="secondary-button" onClick={beginAnalysis}>
                  Retry analysis
                </button>
              </aside>
            )}
          </div>
          {isAnnotating && selectedNoteText && selectionPosition ? (
            <div
              className="selection-popover"
              style={{ left: selectionPosition.x, top: selectionPosition.y }}
              role="dialog"
              aria-label={`Highlight ${selectedNoteText}`}
            >
              <span>{selectedNoteText}</span>
              <div>
                {(["yellow", "red", "pink", "blue"] as HighlightColor[]).map(
                  (color) => (
                    <button
                      key={color}
                      type="button"
                      className={`highlighter-color ${color}`}
                      aria-label={`Highlight selection ${color}`}
                      disabled={
                        !isValidHighlightPhrase(
                          selectedNoteText,
                          renderedTypedText,
                        )
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addManualHighlight(color)}
                    />
                  ),
                )}
              </div>
            </div>
          ) : null}
          {flashcardError ? (
            <p className="flashcard-error">{flashcardError}</p>
          ) : null}
          {isUploadedImagesOpen ? (
            <div
              className="uploaded-images-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Compare uploaded notebook images with generated notes"
            >
              <section className="uploaded-images-panel">
                <header>
                  <div>
                    <p className="eyebrow">Cross-check your scan</p>
                    <h2>Original page, clearer notes.</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setIsUploadedImagesOpen(false)}
                  >
                    Close
                  </button>
                </header>
                <div
                  className="uploaded-image-tabs"
                  aria-label="Uploaded notebook pages"
                >
                  {pageImageDataUrls.map((url, index) => (
                    <button
                      key={`${url.slice(0, 24)}-${index}`}
                      type="button"
                      className={index === activePageIndex ? "active" : ""}
                      onClick={() => showPage(index)}
                    >
                      Page {index + 1}
                    </button>
                  ))}
                </div>
                <div className="uploaded-image-comparison">
                  <article>
                    <p>Uploaded image</p>
                    {pageImageDataUrls[activePageIndex] ? (
                      <img
                        src={pageImageDataUrls[activePageIndex]}
                        alt={`Uploaded notebook page ${activePageIndex + 1}`}
                      />
                    ) : null}
                  </article>
                  <article className="comparison-notes">
                    <p>Generated study notes</p>
                    <h3>
                      {structuredNotebookLayout?.heading ??
                        extractedNotebookHeading ??
                        activeAnalysis?.pageSummary ??
                        `Notebook page ${activePageIndex + 1}`}
                    </h3>
                    <InteractiveNotebookText
                      text={renderedTypedText}
                      regions={regions}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      showHeading={false}
                    />
                  </article>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      )}

      {screen === "graph" && (
        <section className="graph-view">
          <button
            type="button"
            className="secondary-button graph-back-button"
            onClick={() => setScreen("trace")}
          >
            ← Back to scanned notes
          </button>
          <ConceptGraph
            graph={graph}
            status={graphStatus}
            onRetry={() => void retryGraph()}
            onOpenSource={openGraphSource}
          />
        </section>
      )}

      {isFlashcardDrawerOpen ? (
        <FlashcardStudyDeck
          cards={flashcards.filter((card) => card.included)}
          studySet={
            screen === "trace" || screen === "graph"
              ? currentStudySet
              : undefined
          }
          initialMode={flashcardDrawerMode}
          onClose={() => setIsFlashcardDrawerOpen(false)}
          onOpenStudySet={openSavedStudySet}
          onShareStudySet={shareStudySet}
        />
      ) : null}

      {screen === "trace" || screen === "graph" ? <FocusTimer /> : null}

      {screen === "cards" && (
        <section className="cards-view">
          <header className="trace-header">
            <div>
              <p className="eyebrow">Saved annotations</p>
              <h1>
                Keep useful links
                <br />
                <em>close to your notes.</em>
              </h1>
            </div>
            <button
              className="secondary-button"
              onClick={() => setScreen("trace")}
            >
              ← Back to interactive notes
            </button>
          </header>
          <div className="cards-grid">
            {regions
              .filter((region) => region.marker)
              .map((region) => (
                <article
                  key={region.id}
                  className={`study-card ${approved.includes(region.id) ? "approved" : ""}`}
                >
                  <div className="card-top">
                    <span>
                      {region.marker === "star"
                        ? "★ Important topic"
                        : "? Explore later"}
                    </span>
                    <button
                      onClick={() =>
                        setApproved((current) =>
                          current.includes(region.id)
                            ? current.filter((id) => id !== region.id)
                            : [...current, region.id],
                        )
                      }
                    >
                      {approved.includes(region.id) ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                  <p className="card-prompt">
                    Learn more about <b>{region.label}</b>.
                  </p>
                  <div className="card-answer">
                    Open the explanation and links attached to this highlighted
                    phrase in your interactive notes.
                  </div>
                  <footer>
                    Interactive note annotation · Edit before saving
                  </footer>
                </article>
              ))}
            {regions.filter((region) => region.marker).length === 0 ? (
              <p className="empty-cards">
                Select a highlighted phrase in your notes to save it for later.
              </p>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
