/**
 * lora_iterator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Companion script for the LoRA Iterator custom node.
 *
 * What it does:
 *   1. Finds the plain STRING widget named "lora_name" on every
 *      LoRADirectoryIterator node.
 *   2. Replaces it with a real <select> / combo widget populated from the
 *      server endpoint  GET /lora_iterator/loras?directory=<dir>
 *   3. Wires the "directory" combo so changing it re-fetches and repopulates
 *      the LoRA list automatically.
 *
 * Drop this file next to lora_iterator.py  (same custom_nodes subfolder).
 * ComfyUI loads all *.js files in custom_nodes automatically.
 */

import { app } from "../../scripts/app.js";

const NODE_TYPE = "LoRADirectoryIterator";

/** Fetch LoRA list for a given directory from our Python endpoint. */
async function fetchLoras(directory) {
    const params = new URLSearchParams({ directory });
    const res    = await fetch(`/lora_iterator/loras?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.loras ?? [];
}

/**
 * Given a node, find a widget by name.
 * Returns the widget object or undefined.
 */
function getWidget(node, name) {
    return node.widgets?.find(w => w.name === name);
}

/**
 * Replace the plain STRING lora_name widget with a COMBO widget whose
 * options are populated dynamically from the server.
 */
async function patchNode(node) {
    const dirWidget  = getWidget(node, "directory");
    const loraWidget = getWidget(node, "lora_name");

    if (!dirWidget || !loraWidget) return;   // widgets not ready yet
    if (loraWidget._loraIteratorPatched) return; // already done

    // ── Build a real combo widget in place of the STRING widget ──────────────

    const currentValue = loraWidget.value ?? "";

    // Fetch initial list
    let loras = await fetchLoras(dirWidget.value ?? "[All]");
    if (!loras.length) loras = ["(no loras found)"];

    // Convert the STRING widget into a COMBO widget by swapping its type and
    // adding the combo-specific properties ComfyUI expects.
    loraWidget.type    = "combo";
    loraWidget.options = { values: loras };
    loraWidget.value   = loras.includes(currentValue) ? currentValue : loras[0];

    // ComfyUI combo widgets render via a different draw path; we need to flag
    // the node to re-draw itself.
    node.setDirtyCanvas(true, true);

    // ── Wire directory → refresh LoRA list ───────────────────────────────────

    const origDirCallback = dirWidget.callback;

    dirWidget.callback = async function (newDir) {
        // Call any existing callback first
        if (typeof origDirCallback === "function") origDirCallback.call(this, newDir);

        let newLoras = await fetchLoras(newDir);
        if (!newLoras.length) newLoras = ["(no loras found)"];

        // Update the combo options
        loraWidget.options.values = newLoras;

        // Keep current selection if it still exists, else default to first
        if (!newLoras.includes(loraWidget.value)) {
            loraWidget.value = newLoras[0];
        }

        node.setDirtyCanvas(true, true);
    };

    loraWidget._loraIteratorPatched = true;
}

// ── Register extension ────────────────────────────────────────────────────────

app.registerExtension({
    name: "LoRAIterator.DynamicDirectory",

    async nodeCreated(node) {
        if (node.comfyClass !== NODE_TYPE) return;
        // Widgets may not be populated on the very first tick; defer slightly.
        setTimeout(() => patchNode(node), 0);
    },

    async loadedGraphNode(node) {
        // Called when a saved workflow is loaded — patch restored nodes too.
        if (node.comfyClass !== NODE_TYPE) return;
        setTimeout(() => patchNode(node), 0);
    },
});