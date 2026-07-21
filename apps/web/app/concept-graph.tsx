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
  onCreateFlashcards?: (nodeId: string) => void;
};

function positionForNode(index: number, count: number) {
  if (count === 1) return { x: 50, y: 50 };
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const radiusX = count > 6 ? 36 : 30;
  const radiusY = count > 6 ? 35 : 29;
  return {
    x: 50 + Math.cos(angle) * radiusX,
    y: 50 + Math.sin(angle) * radiusY,
  };
}

function pageLabel(pageId: string) {
  return pageId.replace(/^page-/, "page ");
}

export function ConceptGraph({
  graph,
  status,
  onRetry,
  onOpenSource,
}: ConceptGraphProps) {
  const [selectedId, setSelectedId] = useState(graph?.nodes[0]?.id ?? "");
  const selected =
    graph?.nodes.find((node) => node.id === selectedId) ?? graph?.nodes[0];

  if (!graph?.nodes.length) {
    return (
      <section
        className="concept-graph-empty"
        aria-labelledby="concept-graph-title"
      >
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

  const nodeIndexes = new Map(
    graph.nodes.map((node, index) => [node.id, index]),
  );
  const connections = graph.edges
    .filter(
      (edge) => edge.source === selected?.id || edge.target === selected?.id,
    )
    .map((edge) => {
      const otherId = edge.source === selected?.id ? edge.target : edge.source;
      const otherNode = graph.nodes.find((node) => node.id === otherId);
      return otherNode
        ? {
            node: otherNode,
            relation: edge.review_required
              ? "Connection to review"
              : edge.label || "Related concept",
          }
        : undefined;
    })
    .filter(
      (
        connection,
      ): connection is { node: ConceptGraphData["nodes"][number]; relation: string } =>
        Boolean(connection),
    );
  const reviewCount = graph.edges.filter((edge) => edge.review_required).length;

  return (
    <section className="concept-graph-layout" aria-label="Concept graph">
      <div className="concept-graph-canvas">
        <header className="concept-graph-heading">
          <div>
            <p className="concept-graph-eyebrow">Approved scanned pages</p>
            <h1>Your concept graph</h1>
            <p className="concept-graph-summary">
              {graph.nodes.length} concepts · {graph.edges.length} relationships
              {reviewCount ? ` · ${reviewCount} to review` : ""}
            </p>
          </div>
          {status === "pending" ? (
            <p role="status">Graph update pending</p>
          ) : null}
          {status === "error" && onRetry ? (
            <button
              type="button"
              className="secondary-button"
              onClick={onRetry}
            >
              Retry graph update
            </button>
          ) : null}
        </header>

        <div className="concept-graph-field">
          <svg viewBox="0 0 100 100" aria-label="Concept relationships">
            {graph.edges.map((edge) => {
              const sourceIndex = nodeIndexes.get(edge.source) ?? 0;
              const targetIndex = nodeIndexes.get(edge.target) ?? 0;
              const source = positionForNode(sourceIndex, graph.nodes.length);
              const target = positionForNode(targetIndex, graph.nodes.length);
              return (
                <g
                  key={edge.id}
                  data-testid={`edge-${edge.id}`}
                  className={
                    edge.review_required ? "review-required" : undefined
                  }
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
                    {edge.review_required ? "Review" : edge.label || "Related"}
                  </text>
                </g>
              );
            })}
          </svg>

          {graph.nodes.map((node, index) => {
            const position = positionForNode(index, graph.nodes.length);
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
        <aside
          className="concept-graph-detail"
          aria-label="Selected concept details"
        >
          <p className="concept-graph-eyebrow">Selected concept</p>
          <h2>{selected.label}</h2>
          <p>
            Connected to {connections.length} approved concept
            {connections.length === 1 ? "" : "s"}.
          </p>

          <div className="concept-graph-source">
            <strong>From {pageLabel(selected.sources[0].page_id)}</strong>
            <blockquote>{selected.sources[0].excerpt}</blockquote>
          </div>

          {connections.length ? (
            <div className="concept-graph-connections">
              <strong>Connected concepts</strong>
              <ul>
                {connections.map(({ node, relation }) => (
                  <li key={node.id}>
                    <button type="button" onClick={() => setSelectedId(node.id)}>
                      {node.label}
                    </button>
                    <small>{relation}</small>
                  </li>
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
                onOpenSource(
                  selected.sources[0].page_id,
                  selected.sources[0].region_id,
                )
              }
            >
              Open scanned {pageLabel(selected.sources[0].page_id)}
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
