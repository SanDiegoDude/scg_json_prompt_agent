# SCG Ideogram4 Prompt Agent

A ComfyUI custom node for authoring **structured JSON prompts** (Ideogram-style)
with a visual, drag-to-draw **bounding-box layout editor** and a set of optional
**VLM/LLM agents** that fill in the creative fields and lay out the scene for you.

<img width="1272" height="632" alt="image" src="https://github.com/user-attachments/assets/bf9fcdfa-491d-4fa7-a7c0-92ad23d58d3c" />
<img width="792" height="632" alt="image" src="https://github.com/user-attachments/assets/55282b6b-6699-4cf2-93e2-bad932569180" />



It opens a full-screen builder over the ComfyUI canvas where you can:

- Compose the **creative fields** (medium, aesthetics, lighting, photo, subject,
  style, background, etc.).
- **Draw, duplicate, label, and describe bounding boxes** directly on the canvas
  (alt-drag to duplicate, double-click to rename, reorder layers, snap/grid-snap).
- Pick an output resolution with a **megapixel + divisible-by** selector; the node
  exposes the computed `width` / `height` as integer outputs.
- Optionally drive the whole thing with an agent:
  - **Generate fields** — fills the creative fields from a prompt and/or a
    reference image (layout boxes are left untouched).
  - **Reprocess with instruction** — targeted edits to existing fields without
    rewriting everything.
  - **BBox layout agent** — places labeled/described boxes for the described
    scene, capped at a configurable max, with full undo/redo.
  - **Feeling Lucky** — daisy-chains prompt → fields → summary → bbox layout.

Everything is editable, including the agent system prompts ("rulesets") and the
JSON schemas, under the **Agent Configuration** panel.

## Node outputs

| Output | Type | Notes |
| --- | --- | --- |
| `json_prompt` | STRING | The clean structured prompt (the render metadata is stripped out). |
| `width` | INT | Computed from the megapixel / divisible-by selector. |
| `height` | INT | Computed from the megapixel / divisible-by selector. |

## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/SanDiegoDude/scg_json_prompt_agent.git
```

Then **restart ComfyUI** (the node registers two small server routes at startup).
The node appears as **SCG Ideogram4 Prompt Agent** under the `SCG/Ideogram`
category.

### Dependencies

None beyond what ComfyUI already ships. The agent calls are proxied through the
ComfyUI server using its bundled `aiohttp`; there is **no `openai` package or
other pip dependency** to install, so there is no `requirements.txt`.

## Configuring AI providers (`.env`)

The agents talk to any **OpenAI-compatible** chat-completions endpoint (LM Studio,
OpenAI, x.ai/Grok, Gemini's OpenAI-compat endpoint, etc.). Providers are declared
in a local `.env` file so that **API keys stay on the server and are never sent to
the browser** — the UI only ever sees each provider's id/label/model and asks the
ComfyUI server to make the call on its behalf.

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Add one provider per line:

   ```
   AI_PROVIDER_<ID> = Label | model | base_url (blank = official OpenAI) | api_key
   ```

   Examples:

   ```
   AI_PROVIDER_OPENAI = OpenAI (gpt-5.4-mini) | gpt-5.4-mini |  | sk-...
   AI_PROVIDER_GROK   = grok-4.3 | grok-4.3 | https://api.x.ai/v1 | xai-...
   AI_PROVIDER_GEMINI = Gemini 3.5 Flash | gemini-3.5-flash | https://generativelanguage.googleapis.com/v1beta/openai | ...
   AI_PROVIDER_LOCAL  = Local (qwen3) | qwen3-... | http://192.168.0.180:1234 | 123
   ```

   - Leave the `base_url` blank to use the official OpenAI endpoint.
   - A bare host (e.g. `http://192.168.0.180:1234`, LM Studio) automatically gets
     `/v1` appended.
   - Comment a line out with `#` to hide that provider.

3. In the builder UI (**Agent Configuration → Agent settings**), pick your
   provider from the dropdown. After editing `.env`, click **Refresh** to reload
   providers live — no restart needed.

> **Security:** `.env` is git-ignored. Never commit your keys. The proxy only
> exposes provider id/label/model to the browser; URLs and keys remain server-side.

### A note on OpenAI GPT-5 / o-series models

These reasoning models have a slightly different API surface. The server handles
it for you: it sends `reasoning_effort: "low"`, uses `max_completion_tokens`
instead of `max_tokens`, and omits `temperature` (which those models reject).
Other providers use the standard `max_tokens` + `temperature`.

## How it works

- `nodes.py` — the ComfyUI node; outputs the cleaned JSON plus `width`/`height`.
- `providers.py` — parses `.env` and registers two routes:
  - `GET /scg_prompt_agent/providers` — provider list (no secrets).
  - `POST /scg_prompt_agent/chat` — server-side proxy to the selected provider.
- `web/` — the builder UI (loaded in an iframe over the ComfyUI canvas).

## Credits

The original HTML bounding-box editor and JSON prompt builder this project was
streamlined from and built on top of was created by **Okims_JSON_Editor**
(shared as a zip on r/StableDiffusion — no GitHub available to link). All credit
for the original builder/bboxer concept goes to them. This fork adds the
provider-backed agent system, the `.env` proxy, the reworked box-drawing UX,
megapixel/dimension outputs, and the overall UI streamlining.
