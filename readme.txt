FOF Recolour — Figma plugin
===========================

Generates accessible foreground/background colour pairs from your colour
variables (local and team library) and applies them to selected objects.


INSTALLATION
------------
Requires the Figma desktop app (development plugins can't be imported in
the browser).

1. Put this folder somewhere permanent (e.g. Documents/Figma plugins/).
   Figma loads the files from this location every time the plugin runs.
2. Open any design file in the Figma desktop app.
3. Menu > Plugins > Development > Import plugin from manifest...
4. Select manifest.json in this folder.
5. Run it from Plugins > Development > FOF Recolour.

If a colour fails to load or apply, Figma shows an error message at the
bottom of the screen.


UPDATING
--------
- Changes to code.js or ui.html: just close and re-run the plugin.
- Changes to manifest.json: import it again (step 3) before running.


USING THE PLUGIN
----------------
1. Set a minimum contrast with the slider, number box, or presets
   (All / A / AA / AAA).
2. Click "Generate combinations".
3. Select an object on the canvas, then click a combination to recolour it.
   The lightest and darkest colours in the selection are replaced.
4. Click the same combination again (or "Swap") to flip the two colours.
   "Random" picks a different combination.

Library colours only appear if the library is enabled for the file
(Assets panel > Libraries).
