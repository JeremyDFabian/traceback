# Scan-First Concept Graph Design

**Date:** 2026-07-21
**Status:** Approved design

## Objective

Traceback accepts camera-scanned notebook pages, lets students approve detected concepts, and automatically builds a concept graph across all approved pages in the current study session.

Lecture-PDF upload is not part of this feature. The graph uses only student-approved content extracted from scanned notebook pages.

## Product Rules

- Scanning is the only content-ingestion path in this scope.
- A detected concept must be approved before it can appear in the graph.
- The graph updates automatically after each page is approved.
- AI may infer relationships only from approved concept labels and excerpts.
- Every node and relationship remains traceable to scanned notebook evidence.
- Failure to generate a graph must never discard an approved page.

## Student Flow

1. The student scans a notebook page.
2. Traceback detects concepts and relationships within the page.
3. The student edits, approves, or rejects the detections.
4. Traceback saves the approved page inside the active study session.
5. Graph generation runs automatically across all approved pages in that session.
6. The student opens the Graph view and explores concepts and their scanned-page evidence.
7. Approving, renaming, or rejecting a concept triggers another graph update.

## User Interface

The Graph view uses the approved **Graph + Detail** layout.

- The existing Traceback top navigation gains a `GRAPH` destination alongside notes and cards.
- The graph occupies the primary workspace.
- A persistent right-side detail panel shows the selected concept.
- The detail panel includes the concept label, source page, original excerpt, connected concepts, and actions to open the source page or create flashcards.
- The mobile layout stacks the detail panel beneath the graph.
- Graph nodes use the existing warm-paper, burgundy-ink, and ruled-blue visual system documented in `DESIGN.md`.
- Nodes resemble concise notebook annotations, not dashboard cards.
- Selected nodes use ruled blue plus a visible burgundy outline.
- Low-confidence relationships use a dashed line and the text label `Review`; color is never the only indicator.
- Graph motion is limited to short state transitions and honors reduced-motion preferences.

## Architecture

Extend the existing session analysis and `GET /api/sessions/{session_id}/graph` pipeline. Do not create a separate graph service or frontend-only graph store.

### Approved Page Storage

Each active study session stores an ordered collection of approved notebook pages. Each page contains:

- stable page ID;
- source scan reference;
- approved regions;
- approved within-page relationships;
- page summary;
- approval timestamp.

Region IDs remain stable inside a page. Graph-facing IDs combine page and region identity so regions from different pages cannot collide.

### Graph Generation

After a page or concept edit is approved:

1. Load all approved pages for the session.
2. Build graph nodes from approved regions.
3. Preserve approved within-page relationships.
4. Send the approved labels and excerpts to the cross-page relationship generator.
5. Request labeled relationships with confidence values.
6. Discard relationships whose endpoints do not reference submitted nodes.
7. Merge duplicate concepts for presentation while retaining every source-page reference.
8. Cache the validated graph for the session.

The AI request must not contain rejected or unapproved detections. Automated tests replace the generator and never call an external model.

## API Contract

Continue using:

```text
GET /api/sessions/{session_id}/graph
```

Extend graph nodes with:

- `id`: stable graph-facing concept ID;
- `label`: approved concept label;
- `type`: approved region type;
- `confidence`: concept confidence;
- `sources`: one or more page references containing page ID, region ID, excerpt, and normalized bounding box.

Extend graph edges with:

- `id`: stable relationship ID;
- `source`: source node ID;
- `target`: target node ID;
- `label`: concise relationship label;
- `confidence`: relationship confidence;
- `review_required`: `true` when confidence is below `0.70`.

The frontend reads the cached response. It does not infer or repair graph relationships.

## Duplicate Concepts

Concepts with the same normalized label may be merged into one displayed node. The merged node retains all source references. Differently named concepts are not merged solely because an AI model considers them related; they remain separate nodes connected by a labeled edge.

## Failure and Empty States

- If graph generation fails, keep the last successful cached graph visible.
- Show `Graph update pending` for newly approved content and provide a retry action.
- If no cached graph exists, show the approved pages and a focused retry state.
- If approved concepts exist but no valid relationships are found, show the concepts with an explanation that more scanned pages may reveal connections.
- If a graph response contains invalid endpoints or malformed confidence values, discard those relationships server-side and return the valid remainder.
- Scan approval and graph generation are separate operations; graph failure never rolls back approved notebook data.

## Accessibility

- Meet WCAG 2.2 AA contrast and interaction requirements.
- Every graph node is keyboard focusable and has an accessible concept label.
- Keyboard selection updates the same detail panel as pointer selection.
- Relationship review state uses text and line style in addition to color.
- Source-page actions have explicit accessible names.
- Reduced-motion users receive immediate state changes without animated graph movement.

## Verification

Backend verification covers:

- approved scans create graph nodes;
- unapproved and rejected concepts never enter graph generation;
- regions from different pages receive collision-free graph IDs;
- within-page and cross-page relationships are returned together;
- invalid AI endpoints are discarded;
- duplicate normalized labels merge while retaining all sources;
- relationships below `0.70` set `review_required`;
- graph-generation failure preserves the previous cached graph;
- tests never call an external model.

Frontend verification covers:

- the Graph destination opens the Graph + Detail layout;
- selecting a node displays its page and excerpt;
- source-page navigation opens the correct scanned region;
- low-confidence relationships display both dashed styling and `Review` text;
- graph update pending, empty, retry, and stale-cache states are understandable;
- nodes and source actions are fully keyboard accessible;
- the layout stacks correctly on phone-sized screens;
- reduced-motion preferences are respected.

## Non-Goals

- Lecture-PDF upload, rendering, extraction, or slide matching.
- Relationships based on web sources or external course material.
- Manual free-form graph editing in the first version.
- A separate graph microservice.
- Real-time graph regeneration while the student is still editing detections.
- Specialist graph-analysis controls, metrics dashboards, or decorative graph effects.
