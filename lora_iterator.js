import { ComfyApp, app } from "../../scripts/app.js";

app.registerExtension({
    name: "LoRAIterator.DynamicDirectory",

    nodeCreated(node, app) {
        if (node.comfyClass !== "LoRADirectoryIterator") return;

        const lora_names_widget = node.widgets[node.widgets.findIndex(obj => obj.name === 'lora_name')];
        var full_lora_list = lora_names_widget.options.values;
        const directory_widget = node.widgets[node.widgets.findIndex(obj => obj.name === 'directory')];

        Object.defineProperty(lora_names_widget.options, "values", {
            set: (x) => {
                full_lora_list = x;
            },
            get: () => {
                if (directory_widget.value === '[All]')
                    return full_lora_list;

                const dir = directory_widget.value;
                const filtered = full_lora_list.filter(x => {
                    const parts = x.replace(/\\/g, '/').split('/');
                    return parts.includes(dir);
                });
                return filtered.length > 0 ? filtered : full_lora_list;
            }
        });
    }
});