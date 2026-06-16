import json


class Okims_JSON_Builder:
    """ComfyUI node that outputs the JSON prompt created by the visual builder."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "json_prompt": (
                    "STRING",
                    {
                        "multiline": False,
                        "default": json.dumps(
                            {
                                "high_level_description": "",
                                "style_description": {
                                    "medium": "photograph",
                                    "aesthetics": "",
                                    "lighting": "",
                                    "photo": ""
                                },
                                "compositional_deconstruction": {
                                    "background": "",
                                    "elements": []
                                }
                            },
                            ensure_ascii=False,
                            indent=2,
                        ),
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING", "INT", "INT")
    RETURN_NAMES = ("json_prompt", "width", "height")
    FUNCTION = "build"
    CATEGORY = "SCG/Ideogram"

    def build(self, json_prompt: str):
        if json_prompt is None:
            json_prompt = ""

        out = str(json_prompt)
        width, height = 1024, 1024

        # The builder embeds render dimensions under a "render" key so the node
        # can expose width/height as integers. We parse them out and strip the
        # metadata from the emitted prompt so the JSON stays clean for the model.
        try:
            data = json.loads(out)
            if isinstance(data, dict) and isinstance(data.get("render"), dict):
                render = data["render"]
                width = int(round(float(render.get("width", width))))
                height = int(round(float(render.get("height", height))))
                data.pop("render", None)
                out = json.dumps(data, ensure_ascii=False, indent=2)
        except (ValueError, TypeError):
            pass

        width = max(1, width)
        height = max(1, height)
        return (out, width, height)


NODE_CLASS_MAPPINGS = {
    "Okims_JSON_Builder": Okims_JSON_Builder,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Okims_JSON_Builder": "SCG Ideogram4 Prompt Agent",
}
