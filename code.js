figma.showUI(__html__, { width: 300, height: 480, themeColors: false });

// ── Colour math ───────────────────────────────────────
function linearize(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(r, g, b) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}
function to255(color) {
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
  };
}

function notifyError(message) {
  figma.notify(message, { error: true });
}

// ── Variable loading ──────────────────────────────────
async function resolveColor(variable) {
  var value = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
  var depth = 0;
  while (value && value.type === 'VARIABLE_ALIAS' && depth < 10) {
    var aliased = await figma.variables.getVariableByIdAsync(value.id);
    if (!aliased) break;
    value = aliased.valuesByMode[Object.keys(aliased.valuesByMode)[0]];
    depth++;
  }
  if (!value || value.type === 'VARIABLE_ALIAS') return null;
  return to255(value);
}

// Library variables must be imported before their values can be read
async function loadLibraryVariables() {
  try {
    var collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    var lists = await Promise.all(collections.map(function(c) {
      return figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key);
    }));
    var colorVars = [];
    for (var i = 0; i < lists.length; i++) {
      for (var j = 0; j < lists[i].length; j++) {
        if (lists[i][j].resolvedType === 'COLOR') colorVars.push(lists[i][j]);
      }
    }
    var imported = await Promise.all(colorVars.map(function(v) {
      return figma.variables.importVariableByKeyAsync(v.key).catch(function(e) {
        console.warn('[FOF Colour] Skipped library variable "' + v.name + '": ' + e.message);
        return null;
      });
    }));
    return imported.filter(Boolean);
  } catch (e) {
    notifyError('Couldn\'t load library colours: ' + e.message);
    return [];
  }
}

async function loadColors() {
  var local = await figma.variables.getLocalVariablesAsync('COLOR');
  var variables = local.concat(await loadLibraryVariables());
  var resolved = await Promise.all(variables.map(function(v) { return resolveColor(v); }));

  var colors = [];
  var seenIds = {};
  for (var i = 0; i < variables.length; i++) {
    var rgb = resolved[i];
    if (!rgb || seenIds[variables[i].id]) continue;
    seenIds[variables[i].id] = true;
    colors.push({ id: variables[i].id, name: variables[i].name,
      r: rgb.r, g: rgb.g, b: rgb.b, lum: luminance(rgb.r, rgb.g, rgb.b) });
  }
  return colors;
}

// ── Selection colour detection ────────────────────────
function getVariableIdFromPaint(paint) {
  if (paint.boundVariables && paint.boundVariables.color && paint.boundVariables.color.id) {
    return paint.boundVariables.color.id;
  }
  return null;
}

// Variable ID takes priority so two variables with the same RGB stay distinct
function colorKey(variableId, rgb) {
  if (variableId) return 'var:' + variableId;
  return 'rgb:' + rgb.r + ':' + rgb.g + ':' + rgb.b;
}

// findAll() + skipping masks mirrors Figma's own "Selection colours" traversal
function collectPaints(selectedNodes) {
  var out = [];

  var allNodes = [];
  for (var i = 0; i < selectedNodes.length; i++) {
    allNodes.push(selectedNodes[i]);
    if (typeof selectedNodes[i].findAll === 'function') {
      allNodes = allNodes.concat(selectedNodes[i].findAll());
    }
  }

  var props = ['fills', 'strokes'];
  for (var n = 0; n < allNodes.length; n++) {
    var node = allNodes[n];
    if (node.isMask) continue;

    for (var p = 0; p < props.length; p++) {
      var prop = props[p];
      var paints = node[prop];
      if (!Array.isArray(paints)) continue;
      for (var j = 0; j < paints.length; j++) {
        var paint = paints[j];
        if (paint.type !== 'SOLID' || paint.visible === false || paint.opacity === 0) continue;
        var varId = getVariableIdFromPaint(paint);
        var rgb = to255(paint.color);
        out.push({ node: node, prop: prop, paintIndex: j,
          variableId: varId, r: rgb.r, g: rgb.g, b: rgb.b,
          key: colorKey(varId, rgb) });
      }
    }
  }

  return out;
}

// Reads the live selection. slots = [lightest, darkest] unique colours;
// mid-tones are left alone so they don't steal a slot.
function readSelection() {
  var sel = figma.currentPage.selection;
  var paints = collectPaints(sel);

  var seenKeys = {};
  var unique = [];
  for (var i = 0; i < paints.length; i++) {
    var p = paints[i];
    if (!seenKeys[p.key]) {
      seenKeys[p.key] = true;
      unique.push(p);
    }
  }
  unique.sort(function(a, b) {
    return luminance(b.r, b.g, b.b) - luminance(a.r, a.g, a.b);
  });

  var slots = unique.length > 1 ? [unique[0], unique[unique.length - 1]] : unique;
  return { sel: sel, paints: paints, slots: slots };
}

function sendSelectionInfo() {
  var state = readSelection();
  var sel = state.sel;
  if (sel.length === 0) {
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', selection: null });
    return;
  }

  figma.ui.postMessage({
    type: 'SELECTION_CHANGED',
    selection: {
      key: sel.map(function(n) { return n.id; }).join(','),
      count: sel.length,
      name: sel.length === 1 ? sel[0].name : sel.length + ' objects',
      colors: state.slots.map(function(c) {
        return { r: c.r, g: c.g, b: c.b, variableId: c.variableId };
      }),
    },
  });
}

figma.on('selectionchange', sendSelectionInfo);

// ── Applying a combo ──────────────────────────────────
async function applyCombo(msg) {
  // Re-read so edits made since the last selectionchange are respected
  var state = readSelection();
  if (state.slots.length === 0) {
    notifyError('No solid colours found in the selection.');
    return;
  }

  // slot 0 (lightest) gets color1, slot 1 (darkest) gets color2 — or reversed when swapped
  var slot0Var = await figma.variables.getVariableByIdAsync(msg.swapped ? msg.color2Id : msg.color1Id);
  var slot1Var = await figma.variables.getVariableByIdAsync(msg.swapped ? msg.color1Id : msg.color2Id);
  if (!slot0Var || !slot1Var) {
    notifyError('Colour variable not found — try reopening the plugin.');
    return;
  }

  var varByKey = {};
  varByKey[state.slots[0].key] = slot0Var;
  if (state.slots.length > 1) varByKey[state.slots[1].key] = slot1Var;

  // Batch per node+prop so each paint array is written once
  var nodeMap = {};
  for (var i = 0; i < state.paints.length; i++) {
    var paintRef = state.paints[i];
    var targetVar = varByKey[paintRef.key];
    if (!targetVar) continue;

    var mapKey = paintRef.node.id + '|' + paintRef.prop;
    if (!nodeMap[mapKey]) nodeMap[mapKey] = { node: paintRef.node, prop: paintRef.prop, updates: {} };
    nodeMap[mapKey].updates[paintRef.paintIndex] = targetVar;
  }

  for (var key in nodeMap) {
    var entry = nodeMap[key];
    var paintsCopy = entry.node[entry.prop].slice();
    for (var idx in entry.updates) {
      var pi = parseInt(idx, 10);
      paintsCopy[pi] = figma.variables.setBoundVariableForPaint(paintsCopy[pi], 'color', entry.updates[idx]);
    }
    entry.node[entry.prop] = paintsCopy;
  }

  sendSelectionInfo();
}

// ── Message handling ──────────────────────────────────
figma.ui.onmessage = async function(msg) {
  if (msg.type === 'GET_COLORS') {
    try {
      figma.ui.postMessage({ type: 'COLORS_LOADED', colors: await loadColors() });
      sendSelectionInfo();
    } catch (e) {
      notifyError('Couldn\'t load colours: ' + e.message);
    }
  }

  else if (msg.type === 'APPLY_COMBO') {
    try {
      await applyCombo(msg);
    } catch (e) {
      notifyError('Couldn\'t apply colours: ' + e.message);
    }
  }
};
