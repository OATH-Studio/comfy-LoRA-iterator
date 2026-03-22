"""
LoRA Iterator Node for ComfyUI
-----------------------------------------
Takes a model + clip, applies one LoRA, outputs the patched pair.

"control_after_generate" controls which LoRA is picked on the NEXT run:

    fixed      — always use the same LoRA
    increment  — step forward one LoRA each run
    decrement  — step backward one LoRA each run
    randomize  — pick a random LoRA each run

Queue 10 runs with increment and it walks through 10 LoRAs automatically.

Install:
    Drop this folder into ComfyUI/custom_nodes/ and restart.
    Node appears under "loaders/lora" as "LoRA Iterator"
"""

import os
import random as _random
import folder_paths
import comfy.sd
import comfy.utils

CONTROL_MODES = ["fixed", "increment", "decrement", "randomize"]

# Per-instance LoRA index state, keyed by node unique_id
_state: dict[str, int] = {}


# ── helpers ───────────────────────────────────────────────────────────────────

def _scan_directories() -> list[str]:
    root_dirs = folder_paths.get_folder_paths("loras")
    root = root_dirs[0] if root_dirs else ""
    dirs = ["[All]"]
    if root and os.path.isdir(root):
        for entry in sorted(os.scandir(root), key=lambda e: e.name.lower()):
            if entry.is_dir():
                dirs.append(entry.name)
    return dirs


def _scan_loras(directory_filter: str) -> list[str]:
    all_loras = folder_paths.get_filename_list("loras")
    if directory_filter == "[All]":
        return sorted(all_loras, key=lambda p: p.lower())
    prefix = directory_filter.lower() + os.sep
    return sorted(
        [p for p in all_loras
         if p.lower().startswith(prefix) or
            os.path.dirname(p).lower() == directory_filter.lower()],
        key=lambda p: p.lower()
    )


def _resolve_index(node_id: str, lora_list: list[str], current_lora: str, mode: str) -> int:
    """
    Return the index to use THIS run, then update state for the NEXT run.
    Initialises from the dropdown selection on first call.
    """
    total = len(lora_list)

    if node_id not in _state:
        _state[node_id] = lora_list.index(current_lora) if current_lora in lora_list else 0

    idx = _state[node_id]

    if mode == "fixed":
        return idx

    if mode == "increment":
        _state[node_id] = (idx + 1) % total
        return idx

    if mode == "decrement":
        _state[node_id] = (idx - 1) % total
        return idx

    if mode == "randomize":
        chosen = _random.randint(0, total - 1)
        _state[node_id] = _random.randint(0, total - 1)
        return chosen

    return idx


# ── node ──────────────────────────────────────────────────────────────────────

class LoRADirectoryIterator:

    @classmethod
    def INPUT_TYPES(cls):
        directories   = _scan_directories()
        default_dir   = directories[1] if len(directories) > 1 else "[All]"
        default_loras = _scan_loras(default_dir)
        default_lora  = default_loras[0] if default_loras else ""

        return {
            "required": {
                "model": ("MODEL",),
                "clip":  ("CLIP",),

                "directory": (directories, {"default": default_dir}),
                "lora_name": (
                    default_loras if default_loras else ["(no loras found)"],
                    {"default": default_lora},
                ),

                "strength_model": ("FLOAT", {
                    "default": 1.0, "min": -10.0, "max": 10.0,
                    "step": 0.01, "display": "slider",
                }),
                "strength_clip": ("FLOAT", {
                    "default": 1.0, "min": -10.0, "max": 10.0,
                    "step": 0.01, "display": "slider",
                }),

                "control_after_generate": (CONTROL_MODES, {"default": "increment"}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES  = ("MODEL", "CLIP", "STRING", "INT", "INT")
    RETURN_NAMES  = ("model", "clip", "lora_name", "current_index", "total_loras")
    FUNCTION      = "load_lora"
    CATEGORY      = "loaders/lora"
    DESCRIPTION   = (
        "Loads one LoRA and patches model + CLIP. "
        "control_after_generate advances the LoRA selection after each run: "
        "fixed / increment / decrement / randomize."
    )

    @classmethod
    def IS_CHANGED(cls, directory, lora_name, strength_model, strength_clip,
                   control_after_generate, unique_id="default"):
        # fixed mode: return stable hash so ComfyUI can still cache the model
        if control_after_generate == "fixed":
            return f"{directory}:{lora_name}:{strength_model}:{strength_clip}"
        # all other modes: return random float so node always re-executes
        import random
        return random.random()


    def load_lora(
        self,
        model,
        clip,
        directory: str,
        lora_name: str,
        strength_model: float,
        strength_clip: float,
        control_after_generate: str,
        unique_id: str = "default",
    ):
        lora_list = _scan_loras(directory)

        if not lora_list:
            print(f"[LoRADirectoryIterator] No LoRAs found in: {directory!r}")
            return (model, clip, "", 0, 0)

        total = len(lora_list)
        idx   = _resolve_index(unique_id, lora_list, lora_name, control_after_generate)
        name  = lora_list[idx]

        print(
            f"[LoRADirectoryIterator] [{idx + 1}/{total}] {name} | "
            f"strength_model={strength_model} strength_clip={strength_clip} | "
            f"mode={control_after_generate}"
        )

        lora_path = folder_paths.get_full_path("loras", name)
        if lora_path is None or not os.path.isfile(lora_path):
            print(f"[LoRADirectoryIterator] ERROR: file not found: {name!r}")
            return (model, clip, name, idx, total)

        lora_weights = comfy.utils.load_torch_file(lora_path, safe_load=True)

        model_patched, clip_patched = comfy.sd.load_lora_for_models(
            model, clip, lora_weights, strength_model, strength_clip,
        )

        return (model_patched, clip_patched, name, idx, total)


# ── registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS        = {"LoRADirectoryIterator": LoRADirectoryIterator}
NODE_DISPLAY_NAME_MAPPINGS = {"LoRADirectoryIterator": "LoRA Iterator"}