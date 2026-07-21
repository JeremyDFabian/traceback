"use client";

import { useState } from "react";

export type GraphSource = {
  page_id: string;
  region_id: string;
  excerpt: string;
  bbox: { x: number; y: number; width: number; height: number };
};

export type ConceptGraphData = {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    confidence: number;
    sources: GraphSource[];
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string | null;
    confidence: number;
    review_required: boolean;
  }>;
};

export type GraphStatus = "idle" | "loading" | "ready" | "pending" | "error";

type ConceptGraphProps = {
  graph: ConceptGraphData | null;
  status: GraphStatus;
  onRetry?: () => void;
  onOpenSource: (pageId: string, regionId: string) => void;
  onCreateFlashcards: (nodeId: string) => void;
};

const positions = [
  { x: 26, y: 18 },
  { x: 68, y: 34 },
  { x: 22, y: 68 },
  { x: 64, y: 76 },
  { x: 46, y: 50 },
];

function pageLabel(pageId: string) {
  return pageId.replace(/^page-/, "page ");
}

export function ConceptGraph({
  graph,
  status,
  onRetry,
  onOpenSource,
  onCreateFlashcards,
}: ConceptGraphProps) {
  const [selectedId, setSelectedId] = useState(graph?.nodes[0]?.id ?? "");
  const selected =
    graph?.nodes.find((node) => node.id === selectedId) ?? graph?.nodes[0];

  if (!graph?.nodes.length) {
    return (
      <section className="concept-graph-empty" aria-labelledby="concept-graph-title">
        <p className="concept-graph-eyebrow">Your notebook connections</p>
        <h2 id="concept-graph-title">Your concept graph</h2>
        <p>
          {status === "loading"
            ? "Building connections from your approved scans."
            : "Scan and approve more notebook concepts to reveal connections."}
        </p>
        {status === "error" && onRetry ? (
          <button type="button" className="secondary-button" onClick={onRetry}>
            Retry graph update
          </button>
        ) : null}
      </section>
    );
  }

  const nodeIndexes = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const connectedLabels = graph.edges
    .filter((edge) => edge.source === selected?.id || edge.target === selected?.id)
    .map((edge) => {
      const otherId = edge.source === selected?.id ? edge.target : edge.source;
      return graph.nodes.find((node) => node.id === otherId)?.label;
    })
    .filter((label): label is string => Boolean(label));

  return (
    <section className="concept-graph-layout" aria-label="Concept graph">
      <div className="concept-graph-canvas">
        <header className="concept-graph-heading">
          <div>
            <p className="concept-graph-eyebrow">Approved scanned pages</p>
            <h1>Your concept graph</h1>
          </div>
          {status === "pending" ? <p role="status">Graph update pending</p> : null}
          {status === "error" && onRetry ? (
            <button type="button" className="secondary-button" onClick={onRetry}>
              Retry graph update
            </button>
          ) : null}
        </header>

        <div className="concept-graph-field">
          <svg viewBox="0 0 100 100" aria-label="Concept relationships">
            {graph.edges.map((edge) => {
              const sourceIndex = nodeIndexes.get(edge.source) ?? 0;
              const targetIndex = nodeIndexes.get(edge.target) ?? 0;
              const source = positions[sourceIndex % positions.length];
              const target = positions[targetIndex % positions.length];
              return (
                <g
                  key={edge.id}
                  data-testid={`edge-${edge.id}`}
                  className={edge.review_required ? "review-required" : undefined}
                >
                  <line
                    className="concept-graph-edge"
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                  <text
                    className="concept-graph-edge-label"
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2 - 2}
                  >
                    {edge.review_required ? "Review" : edge.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {graph.nodes.map((node, index) => {
            const position = positions[index % positions.length];
            const firstSource = node.sources[0];
            return (
              <button
                key={node.id}
                type="button"
                className="concept-graph-node"
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                aria-pressed={node.id === selected?.id}
                aria-label={`${node.label}, ${pageLabel(firstSource.page_id)}`}
                onClick={() => setSelectedId(node.id)}
              >
                <strong>{node.label}</strong>
                <small>{firstSource.page_id.toUpperCase()}</small>
              </button>
            );
          })}
        </div>
      </div>

      {selected ? (
        <aside className="concept-graph-detail" aria-label="Selected concept details">
          <p className="concept-graph-eyebrow">Selected concept</p>
          <h2>{selected.label}</h2>
          <p>
            Connected to {connectedLabels.length} approved concept
            {connectedLabels.length === 1 ? "" : "s"}.
          </p>

          <div className="concept-graph-source">
            <strong>From {pageLabel(selected.sources[0].page_id)}</strong>
            <blockquote>{selected.sources[0].excerpt}</blockquote>
          </div>

          {connectedLabels.length ? (
            <div className="concept-graph-connections">
              <strong>Connected concepts</strong>
              <ul>
                {connectedLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Scan and approve more pages to reveal connections.</p>
          )}

          <div className="concept-graph-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onOpenSource(selected.sources[0].page_id, selected.sources[0].region_id)
              }
            >
              Open scanned {pageLabel(selected.sources[0].page_id)}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => onCreateFlashcards(selected.id)}
            >
              Create flashcards
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
