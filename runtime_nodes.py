"""Runtime helper nodes for the builder's in-UI generation loop.

These two terminal nodes let the builder iframe (via the parent extension)
identify exactly what to surface after a workflow run:

- ``SCG_Image_Result`` marks the image the builder should display in its
  "Workflow output" tab. It behaves like ``PreviewImage`` (saves a temp file and
  reports it in the node's ``ui`` output), so the parent extension can grab it
  from the websocket ``executed`` event by node type.
- ``SCG_NextRound_Prompt`` catches a STRING produced by the workflow and echoes
  it back in its ``ui`` output as ``scg_ondeck``; the parent forwards it into the
  builder's editable on-deck prompt box for the next round.

Both are optional: if no ``SCG_Image_Result`` is wired in, the parent falls back
to the last Preview/Save image of the run.
"""

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}


# Image result marker — subclass PreviewImage so we inherit its temp-file save
# and ui.images reporting, and simply re-category it under SCG/Ideogram.
try:
    from nodes import PreviewImage

    class SCG_Image_Result(PreviewImage):
        """Tag the final image so the builder knows which render to display."""

        CATEGORY = "SCG/Ideogram"
        DESCRIPTION = (
            "Wire your final image here so the SCG builder's Workflow output tab "
            "displays it. Works like Preview Image (temp output)."
        )

    NODE_CLASS_MAPPINGS["SCG_Image_Result"] = SCG_Image_Result
    NODE_DISPLAY_NAME_MAPPINGS["SCG_Image_Result"] = "SCG Image Result"
except Exception:
    pass


class SCG_NextRound_Prompt:
    """Catch a STRING from the workflow and surface it as the next-round prompt."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "catch"
    OUTPUT_NODE = True
    CATEGORY = "SCG/Ideogram"
    DESCRIPTION = (
        "Catch a STRING produced by the workflow and hand it to the SCG builder's "
        "editable on-deck prompt box for the next round."
    )

    def catch(self, text):
        value = text if isinstance(text, str) else ("" if text is None else str(text))
        return {"ui": {"scg_ondeck": [value]}}


NODE_CLASS_MAPPINGS["SCG_NextRound_Prompt"] = SCG_NextRound_Prompt
NODE_DISPLAY_NAME_MAPPINGS["SCG_NextRound_Prompt"] = "SCG Next-Round Prompt Catcher"
