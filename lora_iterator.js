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
        const res   = await fetch(`/lora_iterator/loras?directory=${encodeURIComponent(newDir)}`);
        const data  = await res.json();
        const loras = data.loras?.length ? data.loras : ["(no loras found)"];

        // These are ALL the places ComfyUI stores combo values — update every one
        loraWidget.options.values = loras;
        loraWidget.values         = loras;
        loraWidget.value          = loras[0];

        node.setDirtyCanvas(true, true);
    };
}