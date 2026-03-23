/**
 * lora_iterator.js
 * Hooks the "directory" combo so changing it repopulates the "lora_name" combo.
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_TYPE = "LoRADirectoryIterator";

async function fetchLoras(directory) {
    const res = await fetch(`/lora_iterator/loras?directory=${encodeURIComponent(directory)}`);
    const data = await res.json();
    return data.loras?.length ? data.loras : ["(no loras found)"];
}

function patchNode(node) {
    const dirWidget  = node.widgets?.find(w => w.name === "directory");
    const loraWidget = node.widgets?.find(w => w.name === "lora_name");
    if (!dirWidget || !loraWidget || dirWidget._loraPatch) return;
    dirWidget._loraPatch = true;

    // Store original callback if any
    const origCallback = dirWidget.callback;

    dirWidget.callback = async function(value) {
        if (origCallback) origCallback.call(this, value);

        const loras = await fetchLoras(value);

        // Update every property ComfyUI uses to render the combo list
        loraWidget.options.values = loras;
        loraWidget.value = loras[0];

        // Force LiteGraph to re-render the node
        node.graph?.setDirtyCanvas(true, true);
    };
}

app.registerExtension({
    name: "LoRAIterator.DynamicDirectory",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // Patch onNodeCreated on the prototype so it runs for every instance
        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            if (origOnCreated) origOnCreated.apply(this, arguments);
            patchNode(this);
        };
    },
});