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
                return fullLoraList.filter(x => x.startsWith(dirWidget.value + "/") || x.startsWith(dirWidget.value + "\\"));
            }
        });
    }
});