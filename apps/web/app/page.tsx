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
};

type Screen = "setup" | "processing" | "editor" | "trace" | "cards";

const seededRegions: Region[] = [
  { id: "mitochondria", label: "Mitochondria", type: "concept", x: 12, y: 24, width: 34, height: 10, confidence: 96 },
  { id: "atp", label: "ATP", type: "concept", x: 56, y: 45, width: 19, height: 10, marker: "star", confidence: 91 },
  { id: "respiration", label: "Cellular respiration", type: "definition", x: 23, y: 66, width: 47, height: 10, marker: "question", confidence: 84 },
];

const stages = ["Correcting your page", "Finding ideas and labels", "Tracing arrows and markers", "Preparing your study surface"];

function UploadField({ label, detail, accept, capture, file, onChange }: { label: string; detail: string; accept: string; capture?: boolean; file?: File; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <button type="button" className="upload-card" onClick={() => inputRef.current?.click()}>
    <input ref={inputRef} className="sr-only" type="file" accept={accept} capture={capture ? "environment" : undefined} onChange={onChange} />
    <span className="upload-icon" aria-hidden="true">{accept === "application/pdf" ? "↗" : "⌁"}</span>
    <span><strong>{file ? file.name : label}</strong><small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB ready` : detail}</small></span>
    <span className="upload-action">{file ? "Replace" : "Choose"}</span>
  </button>;
}

function NotebookPreview({ imageUrl, regions, selected, onSelect, editable, onRegionChange }: { imageUrl?: string; regions: Region[]; selected?: string; onSelect: (id: string) => void; editable?: boolean; onRegionChange?: (region: Region) => void }) {
  const drag = useRef<{ id: string; startX: number; startY: number; regionX: number; regionY: number } | undefined>(undefined);
  function move(event: React.PointerEvent<HTMLButtonElement>, region: Region) {
    if (!editable) return;
    drag.current = { id: region.id, startX: event.clientX, startY: event.clientY, regionX: region.x, regionY: region.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moving(event: React.PointerEvent<HTMLButtonElement>) {
    const action = drag.current;
    if (!action || !onRegionChange) return;
    const host = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!host) return;
    onRegionChange({ ...regions.find((region) => region.id === action.id)!, x: Math.max(0, Math.min(100 - 12, action.regionX + ((event.clientX - action.startX) / host.width) * 100)), y: Math.max(0, Math.min(100 - 8, action.regionY + ((event.clientY - action.startY) / host.height) * 100)) });
  }
  return <div className="notebook-surface" aria-label="Notebook page with detected study regions">
    {imageUrl ? <img src={imageUrl} alt="Uploaded notebook page" className="notebook-image" /> : <div className="notebook-demo" aria-hidden="true"><span className="scribble s1">CELLULAR RESPIRATION</span><span className="scribble s2">mitochondria → ATP</span><span className="scribble s3">energy for the cell</span><span className="scribble s4">where does it happen?</span><span className="scribble star">★</span></div>}
    <div className="notebook-lines" aria-hidden="true" />
    {regions.map((region) => <button key={region.id} type="button" className={`region ${selected === region.id ? "is-selected" : ""}`} style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%` }} onClick={() => onSelect(region.id)} onPointerDown={(event) => move(event, region)} onPointerMove={moving} onPointerUp={() => { drag.current = undefined; }}>
      <span>{region.marker === "star" ? "★ " : region.marker === "question" ? "? " : ""}{region.label}</span>
      {selected === region.id && editable ? <i className="drag-handle">↕</i> : null}
    </button>)}
  </div>;
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [deck, setDeck] = useState<File>();
  const [notebook, setNotebook] = useState<File>();
  const [imageUrl, setImageUrl] = useState<string>();
  const [stage, setStage] = useState(0);
  const [regions, setRegions] = useState(seededRegions);
  const [selectedId, setSelectedId] = useState("mitochondria");
  const [approved, setApproved] = useState<string[]>([]);
  const selected = useMemo(() => regions.find((region) => region.id === selectedId) ?? regions[0], [regions, selectedId]);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => {
    if (screen !== "processing") return;
    const timer = window.setInterval(() => setStage((current) => {
      if (current >= stages.length - 1) { window.clearInterval(timer); window.setTimeout(() => setScreen("editor"), 650); return current; }
      return current + 1;
    }), 800);
    return () => window.clearInterval(timer);
  }, [screen]);

  function selectNotebook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setNotebook(file); setImageUrl(URL.createObjectURL(file));
  }
  function beginAnalysis() { setStage(0); setScreen("processing"); }
  function addRegion() {
    const id = `region-${Date.now()}`;
    setRegions((current) => [...current, { id, label: "New concept", type: "concept", x: 35, y: 38, width: 24, height: 9, confidence: 100 }]); setSelectedId(id);
  }

  return <main className="app-shell">
    <nav className="topbar"><button className="brand" onClick={() => setScreen("setup")}><span className="brand-mark">t</span> traceback</button><div className="nav-steps"><span className={screen === "setup" ? "active" : ""}>Set up</span><span className={screen === "editor" ? "active" : ""}>Verify</span><span className={["trace", "cards"].includes(screen) ? "active" : ""}>Trace</span></div><span className="session-status"><i /> Session saved</span></nav>

    {screen === "setup" && <section className="landing"><div className="hero-copy"><p className="eyebrow">Your notes, connected</p><h1>Make every margin<br /><em>mean something.</em></h1><p className="hero-description">Traceback links the ideas on your notebook page to the lecture slides behind them — so you can study from the way you actually learn.</p><div className="trust-row"><span>✦ Editable AI results</span><span>◌ Your source stays visible</span></div></div><div className="setup-card"><div className="setup-heading"><span className="step-number">01</span><div><p className="eyebrow">Start a study session</p><h2>Bring your materials</h2></div></div><UploadField label="Upload lecture slides" detail="PDF · Your reference material" accept="application/pdf" file={deck} onChange={(event) => setDeck(event.target.files?.[0])} /><UploadField label="Photograph a notebook page" detail="JPG, PNG, or take a photo" accept="image/*" capture file={notebook} onChange={selectNotebook} /><button className="primary-button" disabled={!deck || !notebook} onClick={beginAnalysis}>Find connections <span>→</span></button><p className="privacy-note">Your files are used only for this study session.</p></div></section>}

    {screen === "processing" && <section className="processing-screen"><div className="processing-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="page-glyph">⌁</div></div><p className="eyebrow">Creating your trace</p><h1>Reading the connections<br />in your notes.</h1><div className="progress-list">{stages.map((item, index) => <div key={item} className={index <= stage ? "done" : ""}><i>{index < stage ? "✓" : index === stage ? "" : ""}</i><span>{item}</span>{index === stage ? <small>Working</small> : null}</div>)}</div><p className="processing-note">Usually takes less than 20 seconds.</p></section>}

    {screen === "editor" && <section className="workspace"><header className="workspace-header"><div><p className="eyebrow">Step 2 of 3 · Verify your page</p><h1>Does this look right?</h1><p>Tap a region to rename it, move it, or add your own.</p></div><button className="primary-button" onClick={() => setScreen("trace")}>Approve &amp; trace <span>→</span></button></header><div className="editor-grid"><div className="canvas-panel"><div className="canvas-toolbar"><span><b>{regions.length}</b> regions found</span><button onClick={addRegion}>＋ Add region</button><span className="canvas-hint">Drag regions to refine</span></div><NotebookPreview imageUrl={imageUrl} regions={regions} selected={selectedId} onSelect={setSelectedId} editable onRegionChange={(changed) => setRegions((current) => current.map((region) => region.id === changed.id ? changed : region))} /></div><aside className="inspector"><p className="eyebrow">Selected region</p><label>Label<input value={selected.label} onChange={(event) => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, label: event.target.value } : region))} /></label><label>Type<select value={selected.type} onChange={(event) => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, type: event.target.value as Region["type"] } : region))}><option value="concept">Concept</option><option value="definition">Definition</option><option value="question">Question</option></select></label><div className="marker-row"><span>Study marker</span><button className={selected.marker === "star" ? "marker active" : "marker"} onClick={() => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, marker: region.marker === "star" ? undefined : "star" } : region))}>★ Important</button><button className={selected.marker === "question" ? "marker active" : "marker"} onClick={() => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, marker: region.marker === "question" ? undefined : "question" } : region))}>? Ask later</button></div><div className="confidence"><span>Detection confidence</span><strong>{selected.confidence}%</strong><div><i style={{ width: `${selected.confidence}%` }} /></div></div><button className="text-button danger" onClick={() => { setRegions((current) => current.filter((region) => region.id !== selected.id)); setSelectedId(regions.find((region) => region.id !== selected.id)?.id ?? ""); }}>Remove region</button></aside></div></section>}

    {screen === "trace" && <section className="trace-view"><header className="trace-header"><div><p className="eyebrow">Trace view · Your confirmed connections</p><h1>Follow an idea back<br />to its <em>source.</em></h1></div><div className="trace-tabs"><button className="active">Trace</button><button onClick={() => setScreen("cards")}>Flashcards <b>{regions.filter((region) => region.marker).length}</b></button></div></header><div className="trace-grid"><aside className="concept-list"><p className="list-title">From your notebook</p>{regions.map((region) => <button key={region.id} className={selectedId === region.id ? "concept-item selected" : "concept-item"} onClick={() => setSelectedId(region.id)}><span>{region.marker === "star" ? "★" : region.marker === "question" ? "?" : "○"}</span><div><b>{region.label}</b><small>{region.type}</small></div><i>→</i></button>)}<button className="back-to-editor" onClick={() => setScreen("editor")}>← Edit overlays</button></aside><div className="trace-content"><div className="trace-link"><div className="mini-note"><span>{selected.marker === "star" ? "★" : "⌁"}</span><b>{selected.label}</b><small>From your notebook</small></div><div className="link-line"><i>↗</i><span>92% match</span></div><div className="match-reason"><p><b>{selected.label}</b> is explained in the energy conversion section of your lecture.</p></div></div><article className="slide-card"><div className="slide-top"><span>LECTURE 03 · CELLULAR RESPIRATION</span><button aria-label="Open full slide">↗</button></div><div className="slide-body"><p className="slide-overline">Energy and cells</p><h2>How cells make<br /><mark>usable energy</mark></h2><div className="slide-diagram"><span>Glucose</span><i>→</i><strong>ATP</strong><i>→</i><span>Cell work</span></div><p className="slide-copy">The <mark>mitochondrion is the primary site of aerobic ATP production.</mark> Through cellular respiration, it converts energy stored in glucose into a form the cell can use.</p></div><footer><span>Slide 7 of 24</span><button>View slide context →</button></footer></article></div></div></section>}

    {screen === "cards" && <section className="cards-view"><header className="trace-header"><div><p className="eyebrow">Study queue</p><h1>Turn your marks into<br /><em>moments of recall.</em></h1></div><button className="secondary-button" onClick={() => setScreen("trace")}>← Back to trace</button></header><div className="cards-grid">{regions.filter((region) => region.marker).map((region) => <article key={region.id} className={`study-card ${approved.includes(region.id) ? "approved" : ""}`}><div className="card-top"><span>{region.marker === "star" ? "★ Important" : "? Clarify this"}</span><button onClick={() => setApproved((current) => current.includes(region.id) ? current.filter((id) => id !== region.id) : [...current, region.id])}>{approved.includes(region.id) ? "Approved ✓" : "Approve"}</button></div><p className="card-prompt">What is the role of <b>{region.label}</b> in cellular respiration?</p><div className="card-answer">It helps cells create and use ATP, the energy that powers cell work.</div><footer>Grounded in Slide 7 · Edit before saving</footer></article>)}{regions.filter((region) => region.marker).length === 0 ? <p className="empty-cards">Add a star or question mark in the editor to create a study card.</p> : null}</div></section>}
  </main>;
}
