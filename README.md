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

## In-UI generation loop (Workflow output tab)

The builder's right column has two tabs: **JSON output** (the editable prompt +
Agent Configuration) and **Workflow output**, which lets you generate and
iterate without leaving the builder.

- **Run Workflow** — saves the current JSON to the node and queues the open
  ComfyUI graph; the rendered image streams back into the output box (with a
  progress bar). The builder stays open so you can iterate. There's also an
  **Interrupt** button.
- **Load as reference image** — pushes the latest render into the main reference
  image input (resized ~0.5 MP) so the next round can build on it.
- **On-deck prompt** — a collapsible, editable box (remembers open/closed) that
  holds the prompt for the next round. **Run it!** clears the inputs (keeping any
  locked fields), loads the on-deck text, rebuilds the scene through the full
  agent chain, then fires the generation.

Because the iframe can't talk to ComfyUI directly, the queue + result streaming
is handled by the parent extension (`web/okims_json_builder.js`) over the
ComfyUI websocket; the loop is live while the builder is open (the last render +
on-deck prompt are cached and re-shown if you reopen it).

### Helper nodes (optional)

| Node | Purpose |
| --- | --- |
| `SCG Image Result` | Wire your final image here so the Workflow output tab shows that exact render. Behaves like Preview Image (temp output). If absent, the builder falls back to the last Preview/Save Image of the run. |
| `SCG Next-Round Prompt Catcher` | Catch a STRING produced by your workflow; its value is forwarded into the on-deck prompt box for the next round. |

## SCG Magic JSON BBoxer (headless node)

A second node, **SCG Magic JSON BBoxer** (also under `SCG/Ideogram`), runs the
same agent chain as the visual builder but entirely server-side — no HTML
overlay. Give it a prompt (and optionally a reference image) and it processes
the whole pipeline and returns the finished prompt like any normal node:

1. **Global creative fields** — turns your prompt / image into style, lighting,
   medium, background, etc.
2. **Scene summary** — condenses those into one paragraph of context.
3. **BBox layout** — composes the scene into bounding-box `elements` on the
   normalized 0–1000 canvas.

It emits the same Ideogram JSON shape as the builder.

| Input | Notes |
| --- | --- |
| `prompt` | STRING — drives the whole chain (creative fields + layout). |
| `image` | IMAGE (optional) — reference for style and box placement; boxes still conform to the canvas, not the image frame. |
| `provider` | The AI provider to use (from your `.env`). |
| `bypass` | When **True**, skips every agent call and passes `prompt` straight through to `json_prompt` (no creative/summary/bbox processing). `width`/`height` are still computed from `aspect_ratio`/`megapixels`. Handy for feeding a hand-written JSON prompt through the same wiring. |
| `no_bbox_generation` | When **True**, runs **only** the global creative agent (stage 1) and emits those fields with an empty `elements` list — no summary/bbox stages. A clean "prompt enhancement" mode: Ideogram gets a rich, well-formed prompt and places assets itself. Ignored if `bypass` is on. |
| `aspect_ratio`, `megapixels` | Control the output canvas / `width`·`height`. |
| `temperature`, `max_tokens` | Passed to the provider. |
| `max_boxes` | Cap on how many layout boxes the agent may place. |
| `seed` | **Does nothing to the output.** The chain has no seedable RNG; this field exists only so ComfyUI can cache the node. Set `control_after_generate` to **fixed** to lock the result and skip re-running the agents on subsequent queue runs (Comfy reuses the cached output); randomize/increment to force a fresh pass. |

Outputs are the same as the builder node: `json_prompt`, `width`, `height`.
JSON-schema enforcement and the divisible-by value (8) are fixed defaults here.

## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/SanDiegoDude/scg_json_prompt_agent.git
```

Then **restart ComfyUI** (the node registers two small server routes at startup).
The node appears as **SCG Ideogram4 Prompt Agent** under the `SCG/Ideogram`
category.

### Dependencies

For the common case (OpenAI-compatible endpoints like LM Studio, OpenAI, Grok,
Gemini's OpenAI-compat URL), there is **nothing to install** — the agent calls
are proxied through the ComfyUI server using its bundled `aiohttp`.

The only optional dependency is **`google-auth`**, which is required *only* if
you configure a **Vertex AI** provider (see below). Install it with:

```bash
pip install -r requirements.txt
```

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

### Gemini via Vertex AI

Vertex providers reach Gemini through Vertex's OpenAI-compatible endpoint. They
use a `vertex://PROJECT/LOCATION` base URL and authenticate with Google OAuth
(no static key in the 4th field):

```
AI_PROVIDER_<ID> = Label | model | vertex://PROJECT/LOCATION | [path/to/service-account.json]
```

Replace `PROJECT` with your Google Cloud project id, and `LOCATION` with `global`
(the global endpoint) or a region such as `us-central1`. Leave the 4th field
blank to use Application Default Credentials, or set it to a service-account JSON
path. The server adds the required `google/` model prefix and fetches/refreshes
the OAuth token for you, so nothing sensitive reaches the browser.

**Setup, step by step:**

1. **Enable the API.** In your Google Cloud project, enable the *Vertex AI API*
   and make sure billing is enabled.

2. **Install the auth dependency** into the same environment ComfyUI runs in:

   ```bash
   pip install -r requirements.txt
   ```

3. **Authenticate** — pick one:

   - **Application Default Credentials (simplest).** Install the
     [gcloud CLI](https://cloud.google.com/sdk/docs/install), then run:

     ```bash
     gcloud auth application-default login
     ```

     Leave the 4th `.env` field blank.

   - **Service account.** Create a service account with the *Vertex AI User*
     role, download its JSON key, and put the file path in the 4th `.env` field:

     ```
     AI_PROVIDER_GEMINI = Gemini Vertex | gemini-2.0-flash | vertex://my-project-id/global | /home/me/keys/vertex-sa.json
     ```

4. **Add the provider line** to `.env` (replace the placeholders with your own
   project, region, and model):

   ```
   AI_PROVIDER_GEMINI = Gemini Vertex | gemini-2.0-flash | vertex://my-project-id/us-central1 |
   ```

5. **Restart ComfyUI** once so the provider registers, then select it from the
   picker in **Agent Configuration → Agent settings**. (Later `.env` edits only
   need the **Refresh** button.)

> **Tip:** Gemini "flash/thinking" models spend tokens on internal reasoning, so
> keep **Max tokens** generous (8k+) or replies can come back truncated/empty.

### A note on OpenAI GPT-5 / o-series models

These reasoning models have a slightly different API surface. The server handles
it for you: it sends `reasoning_effort: "low"`, uses `max_completion_tokens`
instead of `max_tokens`, and omits `temperature` (which those models reject).
Other providers use the standard `max_tokens` + `temperature`.

## How it works

- `nodes.py` — the ComfyUI nodes; outputs the cleaned JSON plus `width`/`height`.
- `magic_bboxer.py` — the headless **SCG Magic JSON BBoxer** node (runs the full
  global → summary → bbox agent chain server-side).
- `runtime_nodes.py` — the optional **SCG Image Result** and **SCG Next-Round
  Prompt Catcher** helper nodes for the in-UI generation loop.
- `providers.py` — parses `.env`, registers two routes, and exposes a synchronous
  `chat_completion()` helper used by the headless node:
  - `GET /scg_prompt_agent/providers` — provider list (no secrets).
  - `POST /scg_prompt_agent/chat` — server-side proxy to the selected provider.
- `web/` — the builder UI (iframe over the ComfyUI canvas) plus
  `okims_json_builder.js`, the parent extension that queues runs and streams
  results back into the Workflow output tab.

## Credits

The original HTML bounding-box editor and JSON prompt builder this project was
streamlined from and built on top of was created by **Okims_JSON_Editor**
(shared as a zip on r/StableDiffusion — no GitHub available to link). All credit
for the original builder/bboxer concept goes to them. This fork adds the
provider-backed agent system, the `.env` proxy, the reworked box-drawing UX,
megapixel/dimension outputs, and the overall UI streamlining.
