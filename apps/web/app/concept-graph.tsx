/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type CanvasGroup =
  "ungrouped" | "process" | "definition" | "example" | "review";
type CanvasNode = ConceptGraphData["nodes"][number] & {
  x: number;
  y: number;
  group: CanvasGroup;
};
type CanvasEdge = ConceptGraphData["edges"][number];

type ConceptGraphProps = {
  graph: ConceptGraphData | null;
  status: GraphStatus;
  onRetry?: () => void;
  onOpenSource: (pageId: string, regionId: string) => void;
  onCreateFlashcards?: (nodeId: string) => void;
};

const AUTO_LINK_CONFIDENCE = 0.7;
const GROUP_OPTIONS: Array<{ value: CanvasGroup; label: string }> = [
  { value: "ungrouped", label: "Ungrouped" },
  { value: "process", label: "Process" },
  { value: "definition", label: "Definitions" },
  { value: "example", label: "Examples" },
  { value: "review", label: "Review later" },
];

function initialPosition(index: number, count: number) {
  if (count === 1) return { x: 50, y: 48 };
  const columns = Math.min(3, Math.ceil(Math.sqrt(count)));
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rows = Math.ceil(count / columns);
  return {
    x: 17 + (column / Math.max(columns - 1, 1)) * 66,
    y: 18 + (row / Math.max(rows - 1, 1)) * 64,
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
  const graphKey = graph
    ? `${graph.nodes.map((node) => node.id).join("|")}::${graph.edges.map((edge) => edge.id).join("|")}`
    : "";
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const drag = useRef<
    | {
        id: string;
        startX: number;
        startY: number;
        nodeX: number;
        nodeY: number;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    const nextNodes = (graph?.nodes ?? []).map((node, index, allNodes) => ({
      ...node,
      ...initialPosition(index, allNodes.length),
      group: "ungrouped" as CanvasGroup,
    }));
    setNodes(nextNodes);
    setEdges(
      (graph?.edges ?? []).filter(
        (edge) =>
          !edge.review_required && edge.confidence >= AUTO_LINK_CONFIDENCE,
      ),
    );
    setSelectedId(nextNodes[0]?.id ?? "");
  }, [graphKey, graph]);

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const selected = nodeById.get(selectedId) ?? nodes[0];
  const selectedLinks = edges.filter(
    (edge) => edge.source === selected?.id || edge.target === selected?.id,
  );

  if (!graph?.nodes.length) {
    return (
      <section
        className="concept-graph-empty"
        aria-labelledby="concept-graph-title"
      >
        <p className="concept-graph-eyebrow">Your notebook connections</p>
        <h2 id="concept-graph-title">Your study canvas</h2>
        <p>
          {status === "loading"
            ? "Preparing concepts from your approved scan."
            : "Scan and approve notebook concepts to start a study canvas."}
        </p>
        {status === "error" && onRetry ? (
          <button type="button" className="secondary-button" onClick={onRetry}>
            Retry canvas update
          </button>
        ) : null}
      </section>
    );
  }

  function startDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    node: CanvasNode,
  ) {
    drag.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveNode(event: React.PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    const host = event.currentTarget
      .closest(".study-canvas-field")
      ?.getBoundingClientRect();
    if (!active || !host) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === active.id
          ? {
              ...node,
              x: Math.max(
                8,
                Math.min(
                  92,
                  active.nodeX +
                    ((event.clientX - active.startX) / host.width) * 100,
                ),
              ),
              y: Math.max(
                10,
                Math.min(
                  90,
                  active.nodeY +
                    ((event.clientY - active.startY) / host.height) * 100,
                ),
              ),
            }
          : node,
      ),
    );
  }

  function deleteSelected() {
    if (!selected) return;
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== selected.id && edge.target !== selected.id,
      ),
    );
    setSelectedId(nodes.find((node) => node.id !== selected.id)?.id ?? "");
  }

  function deleteLink(edgeId: string) {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
  }

  return (
    <section className="study-canvas-layout" aria-label="Study canvas">
      <div className="study-canvas-main">
        <header className="study-canvas-heading">
          <div>
            <p className="concept-graph-eyebrow">
              OpenAI-assessed notebook concepts
            </p>
            <h1>Your study canvas</h1>
            <p>
              OpenAI adds only high-confidence connections supported by your
              notes. Drag cards or remove anything that does not help.
            </p>
          </div>
          {status === "pending" ? (
            <p role="status">Canvas update pending</p>
          ) : null}
          {status === "error" && onRetry ? (
            <button
              type="button"
              className="secondary-button"
              onClick={onRetry}
            >
              Retry canvas update
            </button>
          ) : null}
        </header>

        <div className="study-canvas-field">
          <svg viewBox="0 0 100 100" aria-label="Verified study connections">
            {edges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;
              return (
                <g key={edge.id} data-testid={`edge-${edge.id}`}>
                  <line
                    className="study-canvas-edge"
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                  <text
                    className="study-canvas-edge-label"
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2 - 2}
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`study-canvas-node group-${node.group} ${node.id === selected?.id ? "is-selected" : ""}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              aria-pressed={node.id === selected?.id}
              aria-label={`${node.label}, ${pageLabel(node.sources[0].page_id)}`}
              onClick={() => setSelectedId(node.id)}
              onPointerDown={(event) => startDrag(event, node)}
              onPointerMove={moveNode}
              onPointerUp={() => {
                drag.current = undefined;
              }}
            >
              <strong>{node.label}</strong>
              <small>
                {["theme", "category", "outcome"].includes(node.type)
                  ? node.type
                  : node.group === "ungrouped"
                    ? node.sources[0].page_id.toUpperCase()
                    : node.group}
              </small>
            </button>
          ))}
        </div>
      </div>

      <aside className="study-canvas-panel" aria-label="Study canvas controls">
        {selected ? (
          <>
            <p className="concept-graph-eyebrow">
              {["theme", "category", "outcome"].includes(selected.type)
                ? "Learning connection"
                : "From your notes"}
            </p>
            <h2>{selected.label}</h2>
            <p className="study-canvas-source">{selected.sources[0].excerpt}</p>
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
            <button
              type="button"
              className="canvas-delete"
              onClick={deleteSelected}
            >
              Remove concept
            </button>
            <div className="study-canvas-links">
              <strong>Verified connections</strong>
              {selectedLinks.length ? (
                <ul>
                  {selectedLinks.map((edge) => {
                    const other = nodeById.get(
                      edge.source === selected.id ? edge.target : edge.source,
                    );
                    return (
                      <li key={edge.id}>
                        <span>
                          {edge.label}{" "}
                          <button
                            type="button"
                            onClick={() => other && setSelectedId(other.id)}
                          >
                            {other?.label}
                          </button>
                        </span>
                        <button
                          type="button"
                          className="canvas-delete"
                          onClick={() => deleteLink(edge.id)}
                        >
                          Remove link
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="study-canvas-empty">
                  No verified relationships found in these notes yet.
                </p>
              )}
            </div>
          </>
        ) : null}
      </aside>
    </section>
  );
}
