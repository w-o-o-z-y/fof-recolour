# FOF Recolour

A Figma plugin that generates accessible foreground/background colour pairs from your colour variables (local and team library) and applies them to selected objects.
This was made specifically to recolour Friends of Figma stickers, but feel free to use it wherever it works.

## Installation

The plugin needs just three files from this repo:

| File | What it is |
|------|------------|
| [`manifest.json`](manifest.json) | Plugin definition — this is the file you import into Figma |
| [`code.js`](code.js) | Plugin logic |
| [`ui.html`](ui.html) | Plugin panel |

Everything else in the repo is documentation and can be ignored.

1. **Get the files.** Either click **Code → Download ZIP** at the top of this page and unzip it, or clone the repo:
   ```bash
   git clone https://github.com/w-o-o-z-y/fof-recolour.git
   ```
   Keep the three files together in one folder, somewhere permanent — Figma loads them from that location every time the plugin runs.
2. Open any design file in the **Figma desktop app** (development plugins can't be imported in the browser).
3. Go to **Menu → Plugins → Development → Import plugin from manifest…**
4. Select `manifest.json`.
5. Run it from **Plugins → Development → FOF Recolour**.

## Usage

1. Set a minimum contrast with the slider, number box, or presets (**All / A / AA / AAA**).
2. Click **Generate combinations**.
3. Select an object on the canvas, then click a combination to recolour it. The lightest and darkest colours in the selection are replaced.
4. Click the same combination again (or **Swap**) to flip the two colours. **Random** picks a different combination.

Library colours only appear if the library is enabled for the file (**Assets panel → Libraries**). If a colour fails to load or apply, Figma shows an error message at the bottom of the screen.

## Updating

Pull or re-download the latest files into the same folder, then:

- If only `code.js` or `ui.html` changed, close and re-run the plugin.
- If `manifest.json` changed, import it again (step 3) before running.
