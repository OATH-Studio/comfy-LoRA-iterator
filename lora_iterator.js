import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "LoRAIterator.DynamicDirectory",

    nodeCreated(node, app) {
        if (node.comfyClass !== "LoRADirectoryIterator") return;

        const loraWidget = node.widgets[node.widgets.findIndex(w => w.name === "lora_name")];
        const dirWidget  = node.widgets[node.widgets.findIndex(w => w.name === "directory")];

        var fullLoraList = loraWidget.options.values;

        Object.defineProperty(loraWidget.options, "values", {
            set: (x) => {
                fullLoraList = x;
            },
            get: () => {
                if (dirWidget.value === "[All]") return fullLoraList;
                // Compare only the parent folder of each lora path
                return fullLoraList.filter(x => {
                    const parts = x.split(/[\\/]/);
                    return parts.length > 1 && parts[0] === dirWidget.value;
                });
            }
        });
    }
});