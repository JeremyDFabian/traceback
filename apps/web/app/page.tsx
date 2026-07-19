"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Marker = "star" | "question";
type Region = {
  id: string;
  label: string;
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
};

type PageAnalysis = {
  pageSummary: string;
  typedText: string;
  regions: Region[];
};

type ConceptDetails = {
  definition: string;
  sources: Array<{ title: string; url: string }>;
};

type SourceStatus = "idle" | "loading" | "ready" | "unavailable";

type Screen = "setup" | "processing" | "editor" | "trace" | "cards";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const demoTypedText =
  "Cells make usable energy through cellular respiration. This process uses mitochondria to help produce ATP, the energy cells can use for work.";
const seededRegions: Region[] = [
  {
    id: "mitochondria",
    label: "Mitochondria",
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
  "Building your interactive PDF",
];

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
      aria-label="Notebook page with detected interactive-PDF highlights"
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

function InteractiveNotebookText({
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
  const interactiveRegions = regions.filter((region) => region.label.trim());
  if (!interactiveRegions.length) return <p>{text}</p>;

  const escapedLabels = interactiveRegions
    .map((region) => region.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((first, second) => second.length - first.length);
  const segments = text.split(new RegExp(`(${escapedLabels.join("|")})`, "gi"));

  return (
    <p>
      {segments.map((segment, index) => {
        const region = interactiveRegions.find(
          (candidate) =>
            candidate.label.trim().toLocaleLowerCase() ===
            segment.trim().toLocaleLowerCase(),
        );
        if (!region) return <span key={`${segment}-${index}`}>{segment}</span>;

        return (
          <button
            key={region.id}
            type="button"
            className={`pdf-highlight ${selectedId === region.id ? "selected" : ""}`}
            onPointerEnter={() => onSelect(region.id)}
            onFocus={() => onSelect(region.id)}
            onClick={() => onSelect(region.id)}
          >
            {segment}
          </button>
        );
      })}
    </p>
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
  };
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
          <em>an interactive PDF you can learn from.</em>
          <span>No more pages trapped in a folder.</span>
        </h2>
        <p className="what-is-note">
          Traceback extracts the text from your notes, preserves it in a clean
          PDF, and adds hoverable ideas that open helpful context and relevant
          links.
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
            <p>PHOTO READY</p>
          </div>
          <h3>upload one clear photo</h3>
          <p>
            Start with a smartphone photo of a handwritten study page—bullets,
            sketches, and arrows included.
          </p>
        </article>
        <article className="process-card confirm-card">
          <span>Step 02</span>
          <div
            className="process-visual workflow-mockup extraction-mockup"
            aria-hidden="true"
          >
            <div className="mockup-paper">
              <small>EXTRACTING TEXT</small>
              <b>Cellular respiration</b>
              <i />
              <i />
              <i />
              <em>mitochondria → ATP</em>
            </div>
            <div className="ocr-chip">
              OCR <strong>✓</strong>
            </div>
          </div>
          <h3>Traceback reads the page</h3>
          <p>
            OCR extracts the handwriting and turns your page into a clean,
            searchable interactive PDF.
          </p>
        </article>
        <article className="process-card trace-card">
          <span>Step 03</span>
          <div
            className="process-visual workflow-mockup hover-mockup"
            aria-hidden="true"
          >
            <div className="mockup-pdf">
              <small>INTERACTIVE PDF</small>
              <i />
              <i />
              <b>Mitochondria</b>
              <i />
            </div>
            <div className="mockup-context">
              <small>ABOUT THIS TOPIC</small>
              <b>Mitochondria</b>
              <p>Explanation + 3 sources</p>
            </div>
          </div>
          <h3>hover to learn more</h3>
          <p>
            Hover over a highlighted idea for clear context, related
            explanations, and useful websites to explore.
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
  const [stage, setStage] = useState(0);
  const [regions, setRegions] = useState(seededRegions);
  const [selectedId, setSelectedId] = useState("mitochondria");
  const [approved, setApproved] = useState<string[]>([]);
  const [pageAnalyses, setPageAnalyses] = useState<PageAnalysis[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isLiveAnalysis, setIsLiveAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  const [conceptDetails, setConceptDetails] = useState<ConceptDetails>();
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>("idle");
  const [isRepositioning, setIsRepositioning] = useState(false);
  const selected = useMemo(
    () => regions.find((region) => region.id === selectedId) ?? regions[0],
    [regions, selectedId],
  );
  const activeAnalysis = pageAnalyses[activePageIndex];
  const visibleSources =
    conceptDetails?.sources ?? selected?.referenceLinks ?? [];

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  useEffect(() => {
    if (screen !== "processing" || isLiveAnalysis) return;
    const timer = window.setInterval(
      () =>
        setStage((current) => {
          if (current >= stages.length - 1) {
            window.clearInterval(timer);
            window.setTimeout(() => setScreen("trace"), 650);
            return current;
          }
          return current + 1;
        }),
      800,
    );
    return () => window.clearInterval(timer);
  }, [isLiveAnalysis, screen]);
  useEffect(() => {
    if (screen !== "trace" || !selected?.explanation) {
      setConceptDetails(undefined);
      setSourceStatus("idle");
      return;
    }

    const controller = new AbortController();
    setConceptDetails(undefined);
    setSourceStatus("loading");
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
        setConceptDetails(details);
        setSourceStatus("ready");
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") {
          setConceptDetails(undefined);
          setSourceStatus("unavailable");
        }
      });

    return () => controller.abort();
  }, [screen, selected]);

  function selectNotebook(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    if (!notebooks.length) {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(files[0]));
    }
    setNotebooks((current) => [...current, ...files]);
    event.target.value = "";
  }
  function clearNotebooks() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setNotebooks([]);
    setImageUrl(undefined);
  }
  function beginAnalysis() {
    setAnalysisError(undefined);
    setStage(0);

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
      for (const file of notebooks) {
        analyses.push(await analyzeNotebook(file));
        setStage((current) => Math.min(stages.length - 1, current + 1));
      }

      const firstPage = analyses[0];
      if (!firstPage?.regions.length) {
        throw new Error("No readable study phrases were found in those pages.");
      }
      setPageAnalyses(analyses);
      setActivePageIndex(0);
      setRegions(firstPage.regions);
      setSelectedId(firstPage.regions[0].id);
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
    if (!nextPage?.regions.length) return;
    setActivePageIndex(index);
    setRegions(nextPage.regions);
    setSelectedId(nextPage.regions[0].id);
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
  function addRegion() {
    const id = `region-${Date.now()}`;
    setRegions((current) => [
      ...current,
      {
        id,
        label: "New concept",
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
        </div>
        <div className="topbar-actions">
          <a
            className="github-link"
            href="https://github.com/JeremyDFabian/traceback"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <span>↗</span>
          </a>
          <span className="session-status">
            <i /> Demo ready
          </span>
          <button className="demo-button" onClick={beginAnalysis}>
            Run demo <span>↗</span>
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
                alt="Open ruled notebook showing the Traceback interactive-PDF message"
              />
            </div>
            <div id="upload-map" className="setup-card">
              <p className="setup-intro">Your pages, all in one place.</p>
              <div className="setup-heading">
                <div>
                  <p className="eyebrow">Create your study reference</p>
                  <h2>Upload notebook pages</h2>
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
                Create my PDF <span>→</span>
              </button>
              <button className="card-demo-button" onClick={beginAnalysis}>
                View a finished example <span>↗</span>
              </button>
              <p className="privacy-note">
                Your photos are used only to create this interactive PDF.
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
          <p className="eyebrow">Creating your interactive PDF</p>
          <h1>
            Turning your notes into
            <br />
            something you can explore.
          </h1>
          <div className="progress-list">
            {stages.map((item, index) => (
              <div key={item} className={index <= stage ? "done" : ""}>
                <i>{index < stage ? "✓" : index === stage ? "" : ""}</i>
                <span>{item}</span>
                {index === stage ? <small>Working</small> : null}
              </div>
            ))}
          </div>
          <p className="processing-note">Usually takes less than 20 seconds.</p>
        </section>
      )}

      {screen === "editor" && (
        <section className="workspace">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">Step 2 of 3 · Review highlights</p>
              <h1>Review and refine your highlights.</h1>
              <p>
                Pick a phrase, correct the label if needed, then save your
                interactive PDF.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => setScreen("trace")}
            >
              Save &amp; open PDF <span>→</span>
            </button>
          </header>
          <div className="editor-grid">
            <div className="canvas-panel">
              <div className="canvas-toolbar">
                <span>
                  <b>{regions.length}</b> highlights found
                </span>
                <button onClick={addRegion}>＋ Add highlight</button>
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
                    {region.label || "Untitled highlight"}
                  </button>
                ))}
              </div>
              <div className="inspector-divider" />
              <p className="eyebrow">2. Edit the selected phrase</p>
              <label>
                Typed text
                <input
                  value={selected.label}
                  onChange={(event) =>
                    setRegions((current) =>
                      current.map((region) =>
                        region.id === selected.id
                          ? { ...region, label: event.target.value }
                          : region,
                      ),
                    )
                  }
                />
              </label>
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
                                region.marker === "star" ? undefined : "star",
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
                    selected.marker === "question" ? "marker active" : "marker"
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
                    regions.find((region) => region.id !== selected.id)?.id ??
                      "",
                  );
                }}
              >
                {regions.length === 1
                  ? "Keep at least one highlight"
                  : "Remove highlight"}
              </button>
            </aside>
          </div>
        </section>
      )}

      {screen === "trace" && (
        <section className="trace-view interactive-pdf-view">
          <header className="trace-header">
            <div>
              <p className="eyebrow">Your interactive PDF</p>
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
            <button
              className="secondary-button"
              onClick={() => setScreen("editor")}
            >
              Edit highlights
            </button>
          </header>
          <div className="interactive-pdf-layout">
            <section
              className="interactive-pdf-page"
              aria-label="Interactive PDF created from your notebook"
            >
              <header>
                <span>TRACEBACK PDF</span>
                <span>
                  Page {activePageIndex + 1} of{" "}
                  {Math.max(pageAnalyses.length, 1)}
                </span>
              </header>
              <div className="pdf-page-content">
                <p className="pdf-kicker">EXTRACTED FROM YOUR NOTEBOOK</p>
                <h2>{activeAnalysis?.pageSummary ?? "Cellular respiration"}</h2>
                <InteractiveNotebookText
                  text={activeAnalysis?.typedText || demoTypedText}
                  regions={regions}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <p>
                  Hover over any highlighted topic to open a short explanation
                  and trusted places to learn more.
                </p>
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
              <div className="transcription">
                <small>EXTRACTED TEXT</small>
                <p>{selected.transcription ?? selected.label}</p>
              </div>
              <div className="study-note">
                <p className="detail-label">Quick explanation</p>
                <p>
                  {conceptDetails?.definition ??
                    selected.explanation ??
                    `${selected.label} is a key idea in this notebook page.`}
                </p>
              </div>
              <div className="reference-list">
                <div className="reference-heading">
                  <p className="detail-label">Useful links</p>
                  {sourceStatus === "loading" ? <span>Updating…</span> : null}
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
                  <p className="reference-loading">Finding approved sources…</p>
                ) : null}
                {!visibleSources.length && sourceStatus === "unavailable" ? (
                  <p className="reference-loading">
                    Links are temporarily unavailable. Try another highlight or
                    keep studying from the extracted text.
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
        </section>
      )}

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
              ← Back to interactive PDF
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
                    phrase in your interactive PDF.
                  </div>
                  <footer>
                    Interactive PDF annotation · Edit before saving
                  </footer>
                </article>
              ))}
            {regions.filter((region) => region.marker).length === 0 ? (
              <p className="empty-cards">
                Select a highlighted phrase in the PDF to save it for later.
              </p>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
