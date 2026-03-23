/**
 * lora_iterator.js
 * When the user changes the "directory" dropdown, fetch the filtered
 * LoRA list from the server and repopulate the "lora_name" dropdown.
 */

import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "LoRAIterator.DynamicDirectory",

    async nodeCreated(node) {
        if (node.comfyClass !== "LoRADirectoryIterator") return;
        setupNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "LoRADirectoryIterator") return;
        setupNode(node);
    },
});

function setupNode(node) {
    const dirWidget  = node.widgets?.find(w => w.name === "directory");
    const loraWidget = node.widgets?.find(w => w.name === "lora_name");

    if (!dirWidget || !loraWidget) return;
    if (dirWidget._loraIteratorWired) return;
    dirWidget._loraIteratorWired = true;

    dirWidget.callback = async function (newDir) {
        const res  = await fetch(`/lora_iterator/loras?directory=${encodeURIComponent(newDir)}`);
        const data = await res.json();
        const loras = data.loras?.length ? data.loras : ["(no loras found)"];

        // Repopulate the combo options and reset selection to first item
        loraWidget.options.values = loras;
        loraWidget.value = loras[0];

        node.setDirtyCanvas(true, true);
    };
}