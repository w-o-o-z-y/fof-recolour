# AGENTS.md

Guidance for coding agents working in this repository.

## What this is

A Figma plugin (no build step) that generates accessible foreground/background colour combinations from a document's colour variables, and applies them to selected objects.

## Loading the plugin

In Figma desktop: **Plugins → Development → Import plugin from manifest** → select `manifest.json`. Re-run from the same menu to pick up changes to `code.js` / `ui.html`. Changes to `manifest.json` (e.g. permissions) require re-importing.

## Files

| File | Runs in | Purpose |
|------|---------|---------|
| `code.js` | Figma plugin sandbox (QuickJS) | Reads variables, walks selection, applies colour variables to fills/strokes |
| `ui.html` | Browser iframe | All UI — HTML, CSS, and JS in one file |
| `manifest.json` | — | Plugin metadata. `documentAccess: dynamic-page` is required for async variable APIs; `permissions: ["teamlibrary"]` (singular — `teamlibraries` is rejected) is required for `figma.teamLibrary` |

## JavaScript constraints

`code.js` runs in **QuickJS**, not V8. Avoid:
- Optional chaining (`?.`) and nullish coalescing (`??`)
- `const`/`let` in some contexts — prefer `var`
- Arrow functions in top-level handlers

`ui.html` runs in a normal browser iframe — modern JS is fine there.

## Architecture

### Message passing

```
ui.html  →  parent.postMessage({ pluginMessage: { type, ...} }, '*')
code.js  →  figma.ui.postMessage({ type, ... })
```

Message types:
- `GET_COLORS` → `COLORS_LOADED` — reads local `COLOR` variables plus those in enabled team libraries (imported via `importVariableByKeyAsync` to read their values), resolves aliases using each collection's first mode, sends RGB arrays to UI. Sent once on UI startup.
- `APPLY_COMBO` — applies two colour variables (by ID) to all matching fills/strokes in the selection
- `SELECTION_CHANGED` — sent by code.js whenever selection changes; carries unique detected colours

### Colour detection (`collectPaints` in code.js)

Uses `node.findAll()` (Figma's own traversal) on each selected node, then skips `node.isMask === true` nodes. Collects both `fills` and `strokes`, skipping non-SOLID, `visible === false` and `opacity === 0` paints. This mirrors Figma's "Selection colours" panel behaviour.

Unique colours are deduplicated by variable ID (preferred) or RGB value. The two slots are the **lightest** (slot 0) and **darkest** (slot 1); mid-tones are left untouched. `APPLY_COMBO` re-reads the live selection before applying, so edits made since the last `selectionchange` are respected.

Errors are shown to the user with `figma.notify` from code.js; the UI has no error channel.

### Combo generation (ui.html)

Pairs are generated with `i < j` (each unordered pair appears once). Contrast is WCAG relative luminance. The `swapped` flag in `APPLY_COMBO` reverses which combo colour maps to which detected slot — it does not generate a new pair. The UI keeps no swap state of its own: `isSwapped(combo)` reads the current orientation off the selection (slot 0 holding `color2` means swapped), and Swap / re-click / Random apply the opposite or a different option. Contrast uses the `lum` value code.js sends with each colour.

### Applying colours

`APPLY_COMBO` in code.js batches updates per node+prop (fills vs strokes separately) to avoid multiple writes to the same paint array. Uses `figma.variables.setBoundVariableForPaint()` to bind variable references rather than hardcoding RGB values.
