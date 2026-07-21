---
name: Traceback
description: A calm connected notebook for turning scanned handwritten pages into study tools.
colors:
  ink: "#3f3b36"
  muted-ink: "#746d65"
  burgundy: "#4d0e12"
  ruled-blue: "#a5bcd6"
  soft-blue: "#c7d2df"
  paper: "#f7f3ed"
  paper-bright: "#fffdf8"
  warm-line: "#d9cec0"
  clay: "#bd7868"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "48px"
    fontWeight: 400
    lineHeight: 0.98
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "25px"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  highlight: "3px"
  control: "8px"
  button: "12px"
  panel: "22px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "30px"
components:
  button-primary:
    backgroundColor: "{colors.burgundy}"
    textColor: "{colors.paper-bright}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "15px 18px"
  button-secondary:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.burgundy}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "13px 17px"
  input:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px"
  panel:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
---

# Design System: Traceback

## Overview

**Creative North Star: "The Connected Notebook"**

Traceback should feel like a carefully organized notebook coming alive. Warm paper, faint ruled structure, burgundy ink, and soft blue marks preserve the familiarity of handwritten study while making relationships clear and interactive. Product surfaces remain calm and task-focused, with expressive Georgia italics reserved for notebook-like titles and the system sans used for controls and dense information.

The interface rejects dense analytics dashboards, generic AI interfaces, decorative complexity, and specialist graph-tool chrome. Connections must be legible before they are visually impressive.

**Key Characteristics:**

- Warm stationery surfaces with restrained academic color.
- Familiar product controls paired with notebook-specific details.
- Clear selected states and readable relationship lines.
- Ambient depth around major work surfaces, not every element.

## Colors

The palette combines graphite text, burgundy ink, ruled blue, and warm paper.

### Primary

- **Burgundy Ink:** Primary actions, active connections, focus outlines, and decisive labels.

### Secondary

- **Ruled Blue:** Scan regions, selected concepts, graph emphasis, and notebook structure.
- **Clay Annotation:** Sparse warnings, markers, and warm secondary emphasis.

### Neutral

- **Graphite:** Primary text.
- **Muted Pencil:** Secondary copy and metadata.
- **Notebook Paper:** Page and app backgrounds.
- **Bright Paper:** Interactive work surfaces.
- **Warm Rule:** Borders and dividers.

**The Ink-and-Rule Rule.** Burgundy signals action or connection; blue signals detected or selected notebook material. Neither is decorative filler.

## Typography

**Display Font:** Georgia (with serif fallback)
**Body Font:** Arial (with Helvetica and sans-serif fallbacks)

**Character:** A practical system sans keeps the product direct. Georgia italic adds a quiet notebook voice only to prominent study titles.

### Hierarchy

- **Display** (400, 48px, 0.98): Notebook titles and major study-view headings.
- **Title** (800, 25px, 1.25): Screen and panel headings.
- **Body** (400, 16px, 1.65): Study text, descriptions, and explanations; keep prose near 65–75 characters per line.
- **Label** (800, 11px, 0.08em): Uppercase navigation, states, and compact controls.

**The Handwritten Accent Rule.** Serif italics identify notebook content; they never label controls, navigation, or graph tooling.

## Elevation

The system is flat by default with ambient shadows around primary work surfaces, drawers, and floating editing tools. Borders and tonal layering carry most structure; small controls do not receive independent shadows unless raised by interaction.

### Shadow Vocabulary

- **Workspace Ambient** (`0 18px 46px #4d0e1215`): Notebook pages and major detail panels.
- **Raised Control** (`0 12px 22px #4d0e1228`): Primary actions and small floating tools.
- **Drawer** (`-16px 0 40px #2318152d`): Right-side review or concept details.

**The One-Surface Rule.** Elevate the active workspace, not every node, row, or label.

## Components

### Buttons

- **Shape:** Gently rounded rectangle (12px).
- **Primary:** Burgundy ink with bright-paper text and compact bold labeling.
- **Hover / Focus:** A slight upward shift, stronger ambient shadow, and a 3px burgundy focus outline.
- **Secondary:** Bright paper, burgundy text, and a warm border.

### Chips

- **Style:** Compact paper or soft-blue labels with burgundy text and fully rounded ends only when the item is truly tag-like.
- **State:** Selected concepts combine color with a visible outline or check mark.

### Cards / Containers

- **Corner Style:** Broad work-surface rounding (22px); smaller content groups use 12–14px.
- **Background:** Bright paper over warm notebook paper.
- **Shadow Strategy:** Ambient only for the active workspace.
- **Border:** One-pixel warm rule.
- **Internal Padding:** 18–30px based on information density.

### Inputs / Fields

- **Style:** Bright paper, one-pixel warm border, and 8px corners.
- **Focus:** Burgundy border with a soft ruled-blue focus ring.
- **Error / Disabled:** Error copy is explicit; disabled controls lower contrast while retaining readable labels.

### Navigation

Navigation uses uppercase 11px labels with wide tracking. Active destinations use burgundy; inactive destinations use muted pencil. Mobile layouts collapse secondary navigation before shrinking labels.

### Concept Graph

Nodes resemble concise notebook annotations, not dashboard cards. Relationships use thin burgundy or muted warm lines with text labels where meaning is not obvious. The selected concept uses ruled blue plus a non-color outline, and its source page appears in a bright-paper detail area.

## Do's and Don'ts

### Do:

- **Do** preserve the warm paper, burgundy ink, ruled-blue, and graphite hierarchy.
- **Do** use standard buttons, tabs, drawers, and keyboard navigation.
- **Do** keep graph nodes concise and reveal detail on selection.
- **Do** pair color with labels, outlines, or shapes.

### Don't:

- **Don't** build dense analytics dashboards.
- **Don't** use generic AI interfaces or decorative complexity.
- **Don't** make the concept graph feel like a specialist data-analysis tool.
- **Don't** place every node inside a shadowed card.
- **Don't** use gradients, glassmorphism, neon graph lines, or decorative motion.
