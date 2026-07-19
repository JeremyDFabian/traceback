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

const stages = ["Reading handwriting with OCR", "Finding concepts and key terms", "Mapping arrows and visual connections", "Building your interactive study map"];

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
  return <div className="notebook-surface" aria-label="Notebook page with detected study regions">
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

  return <section id="what-it-is" ref={sectionRef} className={`what-is-traceback ${isVisible ? "is-visible" : ""}`} aria-labelledby="what-is-traceback-title"><p className="eyebrow">What is Traceback?</p><h2 id="what-is-traceback-title"><span>A notebook photo becomes</span><em>a clickable map of how your ideas connect.</em><span>No more pages trapped in a folder.</span></h2><p className="what-is-note">Traceback uses OCR and visual layout analysis to read your words, identify the arrows between concepts, and turn each handwritten idea into a clean, explorable node.</p></section>;
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

  return <section id="how-it-works" ref={sectionRef} className={`how-it-works ${isVisible ? "is-visible" : ""}`} aria-labelledby="how-it-works-title"><p className="eyebrow" id="how-it-works-title">How Traceback works</p><div className="how-it-works-grid"><article className="process-card capture-card"><span>Step 01</span><div className="process-visual camera-visual"><i /><b>⌁</b></div><h3>upload one clear photo</h3><p>Start with a smartphone photo of a handwritten study page—bullets, sketches, and arrows included.</p></article><article className="process-card confirm-card"><span>Step 02</span><div className="process-visual region-visual"><i>mitochondria → ATP</i><i>ATP ★</i><i>cellular respiration ?</i></div><h3>AI reads the layout</h3><p>OCR captures the text while visual analysis finds concepts and the relationships you drew between them.</p></article><article className="process-card trace-card"><span>Step 03</span><div className="process-visual slide-visual"><small>YOUR STUDY MAP</small><b>How cells make<br /><mark>usable energy</mark></b><i>3 references added</i></div><h3>explore the map</h3><p>Click any node for typed notes, a concise summary, and useful reference links to keep studying.</p></article></div></section>;
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
  function mapPosition(id: string, index: number) {
    if (id === "respiration") return { left: "50%", top: "23%" };
    if (id === "mitochondria") return { left: "27%", top: "64%" };
    if (id === "atp") return { left: "72%", top: "64%" };
    return { left: `${24 + (index % 3) * 25}%`, top: `${42 + Math.floor(index / 3) * 24}%` };
  }

  return <main className="app-shell">
    <nav className="topbar"><button className="brand" onClick={() => setScreen("setup")} aria-label="Traceback home"><img src="/traceback-logo-cropped.png" alt="Traceback" /></button><div className="nav-steps"><a href="#what-it-is" onClick={(event) => { event.preventDefault(); navigateTo("what-it-is"); }}>What it is</a><a href="#how-it-works" onClick={(event) => { event.preventDefault(); navigateTo("how-it-works"); }}>How it works</a></div><div className="topbar-actions"><span className="session-status"><i /> Session saved</span><button className="demo-button" onClick={beginAnalysis}>Run demo <span>↗</span></button></div></nav>

    {screen === "setup" && <><section className="landing"><div className="hero-copy"><p className="eyebrow">Notebook photo → study map</p><h1>Your notes already<br /><em>have a map inside.</em></h1><p className="hero-description">Upload one clear smartphone photo. Traceback reads the handwriting and the arrows you drew, then turns the page into an interactive concept map.</p><div className="hero-actions"><button className="hero-demo-button" onClick={beginAnalysis}>Run the demo <span>→</span></button><a href="#upload-map">Upload a page</a></div><div className="trust-row"><span>✦ OCR + visual layout analysis</span><span>◌ Typed notes &amp; AI references</span></div></div><div id="upload-map" className="setup-card"><div className="setup-heading"><span className="step-number">01</span><div><p className="eyebrow">Create a study map</p><h2>Upload a notebook photo</h2></div></div><UploadField label="Choose a clear notebook photo" detail="JPG, PNG, or take a photo · Include arrows if you have them" accept="image/*" capture file={notebook} onChange={selectNotebook} /><button className="primary-button" disabled={!notebook} onClick={beginAnalysis}>Create my map <span>→</span></button><p className="privacy-note">Your photo is used only to create this study map.</p></div></section><WhatIsTraceback /><HowItWorks /></>}

    {screen === "processing" && <section className="processing-screen"><div className="processing-notebook"><OpeningNotebook /></div><p className="eyebrow">Creating your trace</p><h1>Reading the connections<br />in your notes.</h1><div className="progress-list">{stages.map((item, index) => <div key={item} className={index <= stage ? "done" : ""}><i>{index < stage ? "✓" : index === stage ? "" : ""}</i><span>{item}</span>{index === stage ? <small>Working</small> : null}</div>)}</div><p className="processing-note">Usually takes less than 20 seconds.</p></section>}

    {screen === "editor" && <section className="workspace"><header className="workspace-header"><div><p className="eyebrow">Step 2 of 3 · Verify your page</p><h1>Does this look right?</h1><p>Tap a region to rename it, move it, or add your own.</p></div><button className="primary-button" onClick={() => setScreen("trace")}>Approve &amp; trace <span>→</span></button></header><div className="editor-grid"><div className="canvas-panel"><div className="canvas-toolbar"><span><b>{regions.length}</b> regions found</span><button onClick={addRegion}>＋ Add region</button><span className="canvas-hint">Drag regions to refine</span></div><NotebookPreview imageUrl={imageUrl} regions={regions} selected={selectedId} onSelect={setSelectedId} editable onRegionChange={(changed) => setRegions((current) => current.map((region) => region.id === changed.id ? changed : region))} /></div><aside className="inspector"><p className="eyebrow">Selected region</p><label>Label<input value={selected.label} onChange={(event) => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, label: event.target.value } : region))} /></label><label>Type<select value={selected.type} onChange={(event) => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, type: event.target.value as Region["type"] } : region))}><option value="concept">Concept</option><option value="definition">Definition</option><option value="question">Question</option></select></label><div className="marker-row"><span>Study marker</span><button className={selected.marker === "star" ? "marker active" : "marker"} onClick={() => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, marker: region.marker === "star" ? undefined : "star" } : region))}>★ Important</button><button className={selected.marker === "question" ? "marker active" : "marker"} onClick={() => setRegions((current) => current.map((region) => region.id === selected.id ? { ...region, marker: region.marker === "question" ? undefined : "question" } : region))}>? Ask later</button></div><div className="confidence"><span>Detection confidence</span><strong>{selected.confidence}%</strong><div><i style={{ width: `${selected.confidence}%` }} /></div></div><button className="text-button danger" onClick={() => { setRegions((current) => current.filter((region) => region.id !== selected.id)); setSelectedId(regions.find((region) => region.id !== selected.id)?.id ?? ""); }}>Remove region</button></aside></div></section>}

    {screen === "trace" && <section className="trace-view mind-map-view"><header className="trace-header"><div><p className="eyebrow">Your interactive study map</p><h1>Your handwritten ideas,<br /><em>made explorable.</em></h1><p className="map-subtitle">Select a node to see a clean transcription, a short study note, and AI-curated places to go deeper.</p></div><button className="secondary-button" onClick={() => setScreen("editor")}>Edit detected ideas</button></header><div className="mind-map-layout"><section className="mind-map-canvas" aria-label="Interactive concept map generated from your notebook"><div className="map-canvas-label"><span>FROM YOUR NOTEBOOK</span><b>{regions.length} connected concepts</b></div><svg className="map-lines" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true"><path d="M500 180 C390 260,310 335,270 425" /><path d="M500 180 C610 260,690 335,730 425" /><path d="M270 425 C430 510,590 510,730 425" /></svg>{regions.map((region, index) => <button key={region.id} type="button" className={`mind-node ${region.id === "respiration" ? "root" : ""} ${selectedId === region.id ? "selected" : ""}`} style={mapPosition(region.id, index)} onClick={() => setSelectedId(region.id)}><span>{region.marker === "star" ? "★" : region.marker === "question" ? "?" : "⌁"}</span><b>{region.label}</b><small>{region.type}</small></button>)}<div className="map-key"><i /> Relationship detected from your page</div></section><aside className="concept-detail"><p className="eyebrow">Selected concept</p><div className="concept-title"><span>{selected.marker === "star" ? "★" : selected.marker === "question" ? "?" : "⌁"}</span><h2>{selected.label}</h2></div><div className="transcription"><small>HANDWRITTEN → TYPED</small><p>{selected.label} {selected.id === "mitochondria" ? "→ ATP" : "is part of cellular respiration"}</p></div><div className="study-note"><p className="detail-label">AI study note</p><p><b>{selected.label}</b> is a key idea in how cells convert food into usable energy. It connects directly to the concepts drawn around it in your page.</p></div><div className="reference-list"><p className="detail-label">Explore further</p><a href="https://en.wikipedia.org/wiki/Cellular_respiration" target="_blank" rel="noreferrer"><span>↗</span> Cellular respiration · Wikipedia</a><a href="https://openstax.org/books/biology-2e/pages/7-introduction" target="_blank" rel="noreferrer"><span>↗</span> Energy and metabolism · OpenStax</a><a href="https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation" target="_blank" rel="noreferrer"><span>↗</span> Cellular respiration · Khan Academy</a></div></aside></div></section>}

    {screen === "cards" && <section className="cards-view"><header className="trace-header"><div><p className="eyebrow">Study queue</p><h1>Turn your marks into<br /><em>moments of recall.</em></h1></div><button className="secondary-button" onClick={() => setScreen("trace")}>← Back to trace</button></header><div className="cards-grid">{regions.filter((region) => region.marker).map((region) => <article key={region.id} className={`study-card ${approved.includes(region.id) ? "approved" : ""}`}><div className="card-top"><span>{region.marker === "star" ? "★ Important" : "? Clarify this"}</span><button onClick={() => setApproved((current) => current.includes(region.id) ? current.filter((id) => id !== region.id) : [...current, region.id])}>{approved.includes(region.id) ? "Approved ✓" : "Approve"}</button></div><p className="card-prompt">What is the role of <b>{region.label}</b> in cellular respiration?</p><div className="card-answer">It helps cells create and use ATP, the energy that powers cell work.</div><footer>Grounded in Slide 7 · Edit before saving</footer></article>)}{regions.filter((region) => region.marker).length === 0 ? <p className="empty-cards">Add a star or question mark in the editor to create a study card.</p> : null}</div></section>}
  </main>;
}
