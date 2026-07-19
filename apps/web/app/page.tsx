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

const stages = ["Reading handwriting with OCR", "Extracting clean typed text", "Finding key topics to highlight", "Building your interactive PDF"];

function UploadField({ label, detail, accept, capture, file, onChange }: { label: string; detail: string; accept: string; capture?: boolean; file?: File; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <label className="upload-card">
    <input className="sr-only" type="file" accept={accept} capture={capture ? "environment" : undefined} onChange={onChange} />
    <span className="upload-icon" aria-hidden="true">{accept === "application/pdf" ? "↗" : "⌁"}</span>
    <span><strong>{file ? file.name : label}</strong><small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB ready` : detail}</small></span>
    <span className="upload-action">{file ? "Replace" : "Choose"}</span>
  </label>;
}

function OpeningNotebook() {
  return <div className="opening-notebook" aria-hidden="true"><div className="notebook-spine" /><div className="notebook-cover"><span>trace</span></div><div className="notebook-page left"><i /><i /><i /></div><div className="notebook-page right"><i /><i /><i /></div><div className="notebook-spark one">✦</div><div className="notebook-spark two">✦</div></div>;
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
  return <div className="notebook-surface" aria-label="Notebook page with detected interactive-PDF highlights">
    {imageUrl ? <img src={imageUrl} alt="Uploaded notebook page" className="notebook-image" /> : <div className="notebook-demo" aria-hidden="true"><span className="scribble s1">CELLULAR RESPIRATION</span><span className="scribble s2">mitochondria → ATP</span><span className="scribble s3">energy for the cell</span><span className="scribble s4">where does it happen?</span><span className="scribble star">★</span></div>}
    <div className="notebook-lines" aria-hidden="true" />
    {regions.map((region) => <button key={region.id} type="button" className={`region ${selected === region.id ? "is-selected" : ""}`} style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%` }} onClick={() => onSelect(region.id)} onPointerDown={(event) => move(event, region)} onPointerMove={moving} onPointerUp={() => { drag.current = undefined; }}>
      <span>{region.marker === "star" ? "★ " : region.marker === "question" ? "? " : ""}{region.label}</span>
      {selected === region.id && editable ? <i className="drag-handle">↕</i> : null}
    </button>)}
  </div>;
}

function WhatIsTraceback() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.32 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return <section id="what-it-is" ref={sectionRef} className={`what-is-traceback ${isVisible ? "is-visible" : ""}`} aria-labelledby="what-is-traceback-title"><p className="eyebrow">What is Traceback?</p><h2 id="what-is-traceback-title"><span>A notebook photo becomes</span><em>an interactive PDF you can learn from.</em><span>No more pages trapped in a folder.</span></h2><p className="what-is-note">Traceback extracts the text from your notes, preserves it in a clean PDF, and adds hoverable ideas that open helpful context and relevant links.</p></section>;
}

function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.22 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return <section id="how-it-works" ref={sectionRef} className={`how-it-works ${isVisible ? "is-visible" : ""}`} aria-labelledby="how-it-works-title"><p className="eyebrow" id="how-it-works-title">How Traceback works</p><div className="how-it-works-grid"><article className="process-card capture-card"><span>Step 01</span><div className="process-visual workflow-mockup capture-mockup" aria-hidden="true"><div className="mockup-phone"><div className="phone-camera" /><div className="phone-note"><i /><i /><i /><b>→</b></div><div className="camera-corners" /></div><p>PHOTO READY</p></div><h3>upload one clear photo</h3><p>Start with a smartphone photo of a handwritten study page—bullets, sketches, and arrows included.</p></article><article className="process-card confirm-card"><span>Step 02</span><div className="process-visual workflow-mockup extraction-mockup" aria-hidden="true"><div className="mockup-paper"><small>EXTRACTING TEXT</small><b>Cellular respiration</b><i /><i /><i /><em>mitochondria → ATP</em></div><div className="ocr-chip">OCR <strong>✓</strong></div></div><h3>Traceback reads the page</h3><p>OCR extracts the handwriting and turns your page into a clean, searchable interactive PDF.</p></article><article className="process-card trace-card"><span>Step 03</span><div className="process-visual workflow-mockup hover-mockup" aria-hidden="true"><div className="mockup-pdf"><small>INTERACTIVE PDF</small><i /><i /><b>Mitochondria</b><i /></div><div className="mockup-context"><small>ABOUT THIS TOPIC</small><b>Mitochondria</b><p>Explanation + 3 sources</p></div></div><h3>hover to learn more</h3><p>Hover over a highlighted idea for clear context, related explanations, and useful websites to explore.</p></article></div></section>;
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("setup");
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
      if (current >= stages.length - 1) { window.clearInterval(timer); window.setTimeout(() => setScreen("trace"), 650); return current; }
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
  function navigateTo(sectionId: "what-it-is" | "how-it-works") {
    setScreen("setup");
    window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }), 0);
  }
  function addRegion() {
    const id = `region-${Date.now()}`;
    setRegions((current) => [...current, { id, label: "New concept", type: "concept", x: 35, y: 38, width: 24, height: 9, confidence: 100 }]); setSelectedId(id);
  }
  return <main className="app-shell">
    <nav className="topbar"><button className="brand" onClick={() => setScreen("setup")} aria-label="Traceback home"><img src="/traceback-logo-cropped.png" alt="Traceback" /></button><div className="nav-steps"><a href="#what-it-is" onClick={(event) => { event.preventDefault(); navigateTo("what-it-is"); }}>What it is</a><a href="#how-it-works" onClick={(event) => { event.preventDefault(); navigateTo("how-it-works"); }}>How it works</a></div><div className="topbar-actions"><span className="session-status"><i /> Session saved</span><button className="demo-button" onClick={beginAnalysis}>Run demo <span>↗</span></button></div></nav>

    {screen === "setup" && <><section className="landing"><div className="landing-notebook-stage"><img className="landing-notebook-image" src="/landing-notebook.png" alt="Open ruled notebook showing the Traceback interactive-PDF message" /></div><div id="upload-map" className="setup-card"><p className="setup-intro">Turn every study page into a smarter reference.</p><div className="setup-heading"><span className="step-number">01</span><div><p className="eyebrow">Create an interactive PDF</p><h2>Upload a notebook photo</h2></div></div><div className="upload-flow" aria-label="Upload flow"><span><b>1</b> Add photo</span><i>→</i><span><b>2</b> We create your PDF</span></div><UploadField label="Choose a clear notebook photo" detail="JPG, PNG, or take a photo · Include arrows if you have them" accept="image/*" capture file={notebook} onChange={selectNotebook} /><div className="pdf-preview"><i>⌁</i><span><b>Interactive PDF</b><small>Highlights + linked context</small></span><em>Preview</em></div><button className="primary-button" disabled={!notebook} onClick={beginAnalysis}>Create my PDF <span>→</span></button><button className="card-demo-button" onClick={beginAnalysis}>Run demo <span>↗</span></button><p className="privacy-note">Your photo is used only to create this interactive PDF.</p></div></section><WhatIsTraceback /><HowItWorks /></>}

    {screen === "processing" && <section className="processing-screen"><div className="processing-notebook"><OpeningNotebook /></div><p className="eyebrow">Creating your interactive PDF</p><h1>Turning your notes into<br />something you can explore.</h1><div className="progress-list">{stages.map((item, index) => <div key={item} className={index <= stage ? "done" : ""}><i>{index < stage ? "✓" : index === stage ? "" : ""}</i><span>{item}</span>{index === stage ? <small>Working</small> : null}</div>)}</div><p className="processing-note">Usually takes less than 20 seconds.</p></section>}

    {screen === "editor" && <section className="workspace"><header className="workspace-header"><div><p className="eyebrow">Step 2 of 3 · Review highlights</p><h1>Does this look right?</h1><p>Select a highlight to correct its typed text, move it, or add another.</p></div><button className="primary-button" onClick={() => setScreen("trace")}>Publish interactive PDF <span>→</span></button></header><div className="editor-grid"><div className="canvas-panel"><div className="canvas-toolbar"><span><b>{regions.length}</b> highlights found</span><button onClick={addRegion}>＋ Add highlight</button><span className="canvas-hint">Drag highlights to refine</span></div><NotebookPreview imageUrl={imageUrl} regions={regions} selected={selectedId} onSelect={setSelectedId} editable onRegionChange={(changed) => setRegions((current) => current.map((region) => region.id === changed.id ? changed : region))} /></div><aside className="inspector"><p className="eyebrow">Selected highlight</p><label>Typed text<input value={selected.label} onChange={(event) => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, label: event.target.value } : region))} /></label><label>Highlight type<select value={selected.type} onChange={(event) => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, type: event.target.value as Region["type"] } : region))}><option value="concept">Topic</option><option value="definition">Definition</option><option value="question">Question</option></select></label><div className="marker-row"><span>Study marker</span><button className={selected.marker === "star" ? "marker active" : "marker"} onClick={() => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, marker: region.marker === "star" ? undefined : "star" } : region))}>★ Important</button><button className={selected.marker === "question" ? "marker active" : "marker"} onClick={() => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, marker: region.marker === "question" ? undefined : "question" } : region))}>? Ask later</button></div><div className="confidence"><span>Text detection confidence</span><strong>{selected.confidence}%</strong><div><i style={{ width: `${selected.confidence}%` }} /></div></div><button className="text-button danger" onClick={() => { setRegions((current) => current.filter((region) => region.id !== selected.id)); setSelectedId(regions.find((region) => region.id !== selected.id)?.id ?? ""); }}>Remove highlight</button></aside></div></section>}

    {screen === "trace" && <section className="trace-view interactive-pdf-view"><header className="trace-header"><div><p className="eyebrow">Your interactive PDF</p><h1>Your notes, ready<br /><em>to explain themselves.</em></h1><p className="map-subtitle">Hover or select a highlighted phrase to see an explanation and useful links about that topic.</p></div><button className="secondary-button" onClick={() => setScreen("editor")}>Edit highlights</button></header><div className="interactive-pdf-layout"><section className="interactive-pdf-page" aria-label="Interactive PDF created from your notebook"><header><span>TRACEBACK PDF</span><span>Page 1 of 1</span></header><div className="pdf-page-content"><p className="pdf-kicker">EXTRACTED FROM YOUR NOTEBOOK</p><h2>Cellular respiration</h2><p>Cells make usable energy through <button type="button" className={`pdf-highlight ${selectedId === "respiration" ? "selected" : ""}`} onPointerEnter={() => setSelectedId("respiration")} onFocus={() => setSelectedId("respiration")} onClick={() => setSelectedId("respiration")}>cellular respiration</button>. This process uses <button type="button" className={`pdf-highlight ${selectedId === "mitochondria" ? "selected" : ""}`} onPointerEnter={() => setSelectedId("mitochondria")} onFocus={() => setSelectedId("mitochondria")} onClick={() => setSelectedId("mitochondria")}>mitochondria</button> to help produce <button type="button" className={`pdf-highlight ${selectedId === "atp" ? "selected" : ""}`} onPointerEnter={() => setSelectedId("atp")} onFocus={() => setSelectedId("atp")} onClick={() => setSelectedId("atp")}>ATP</button>, the energy cells can use for work.</p><p>Hover over any highlighted topic to open a short explanation and trusted places to learn more.</p></div><footer><span>Highlights added by Traceback</span><span>{regions.length} topics found</span></footer></section><aside className="concept-detail"><p className="eyebrow">About this highlight</p><div className="concept-title"><span>{selected.marker === "star" ? "★" : selected.marker === "question" ? "?" : "⌁"}</span><h2>{selected.label}</h2></div><div className="transcription"><small>EXTRACTED TEXT</small><p>{selected.label}</p></div><div className="study-note"><p className="detail-label">Quick explanation</p><p><b>{selected.label}</b> is a key topic in how cells convert food into usable energy. Use this short context to reconnect the phrase to the rest of your notes.</p></div><div className="reference-list"><p className="detail-label">Useful links</p><a href="https://en.wikipedia.org/wiki/Cellular_respiration" target="_blank" rel="noreferrer"><span>↗</span> Cellular respiration · Wikipedia</a><a href="https://openstax.org/books/biology-2e/pages/7-introduction" target="_blank" rel="noreferrer"><span>↗</span> Energy and metabolism · OpenStax</a><a href="https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation" target="_blank" rel="noreferrer"><span>↗</span> Cellular respiration · Khan Academy</a></div></aside></div></section>}

    {screen === "cards" && <section className="cards-view"><header className="trace-header"><div><p className="eyebrow">Saved annotations</p><h1>Keep useful links<br /><em>close to your notes.</em></h1></div><button className="secondary-button" onClick={() => setScreen("trace")}>← Back to interactive PDF</button></header><div className="cards-grid">{regions.filter((region) => region.marker).map((region) => <article key={region.id} className={`study-card ${approved.includes(region.id) ? "approved" : ""}`}><div className="card-top"><span>{region.marker === "star" ? "★ Important topic" : "? Explore later"}</span><button onClick={() => setApproved((current) => current.includes(region.id) ? current.filter((id) => id !== region.id) : [...current, region.id])}>{approved.includes(region.id) ? "Saved ✓" : "Save"}</button></div><p className="card-prompt">Learn more about <b>{region.label}</b>.</p><div className="card-answer">Open the explanation and links attached to this highlighted phrase in your interactive PDF.</div><footer>Interactive PDF annotation · Edit before saving</footer></article>)}{regions.filter((region) => region.marker).length === 0 ? <p className="empty-cards">Select a highlighted phrase in the PDF to save it for later.</p> : null}</div></section>}
  </main>;
}
