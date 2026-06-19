import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EXT_NAME = "okims.json.builder";
const BUILDER_URL = new URL("./Okims_JSON_Builder.html", import.meta.url).href;

// Cached across modal open/close so reopening the builder re-shows the latest
// generation image and on-deck prompt from the most recent run.
let lastGenURL = "";
let lastOnDeck = "";

// Only one builder UI may live at a time. Holds { restore() } while open so a
// second "Open Builder" click just restores the existing (possibly minimized)
// instance instead of spawning a duplicate.
let activeBuilder = null;

function viewURLFromImage(img) {
  const p = new URLSearchParams();
  p.set("filename", img.filename || "");
  if (img.subfolder) p.set("subfolder", img.subfolder);
  p.set("type", img.type || "output");
  p.set("t", String(Date.now())); // cache-bust each render
  const path = "/view?" + p.toString();
  try { return api.apiURL ? api.apiURL(path) : path; } catch (_) { return path; }
}

function imageResultNodeIds() {
  const ids = new Set();
  const nodes = app.graph?._nodes || [];
  for (const n of nodes) if (n && n.type === "SCG_Image_Result") ids.add(String(n.id));
  return ids;
}

function findJsonWidget(node) {
  return node.widgets?.find((w) => w.name === "json_prompt") || null;
}

function hideJsonWidget(node) {
  const widget = findJsonWidget(node);
  if (!widget) return;
  widget.serialize = true;
  widget.type = "hidden";
  widget.hidden = true;
  widget.computeSize = () => [0, 0];
  widget.draw = () => {};
  widget.mouse = () => false;
  widget.onMouseDown = () => false;
  widget.onClick = () => false;
  widget.callback = widget.callback || (() => {});
  widget.inputEl?.remove?.();
  widget.element?.remove?.();
  widget.domElement?.remove?.();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStyledNodeButton(widget, ctx, node, widgetWidth, y, widgetHeight) {
  const marginX = 16;
  const buttonX = marginX;
  const buttonW = Math.max(80, widgetWidth - marginX * 2);
  const buttonH = 34;
  const buttonY = y + Math.max(2, Math.round((widgetHeight - buttonH) / 2));
  const radius = 7;

  ctx.save();

  roundRect(ctx, buttonX, buttonY, buttonW, buttonH, radius);
  ctx.fillStyle = widget.name === "Open Builder" ? "#2f3238" : "#25282e";
  ctx.fill();

  ctx.lineWidth = 1.25;
  ctx.strokeStyle = widget.name === "Open Builder" ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.24)";
  ctx.stroke();

  ctx.font = "900 14px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(widget.name, buttonX + buttonW / 2, buttonY + buttonH / 2 + 0.5);

  ctx.restore();
}

function styleNodeButton(widget) {
  if (!widget || widget.__okimsStyledButton) return;
  widget.__okimsStyledButton = true;
  widget.serialize = false;
  widget.computeSize = (width) => [width, 40];
  widget.draw = drawStyledNodeButton.bind(null, widget);
}

function setWidgetValue(node, value) {
  const widget = findJsonWidget(node);
  if (!widget) return false;
  widget.value = value;
  if (typeof widget.callback === "function") {
    try { widget.callback(value); } catch (e) { console.warn("[Okims_JSON_Builder] widget callback failed", e); }
  }
  node.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
  return true;
}

function getWidgetValue(node) {
  const widget = findJsonWidget(node);
  return widget?.value || "";
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `okims-toast okims-toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, 1900);
}

function ensureStyles() {
  if (document.getElementById("okims-json-builder-comfy-style")) return;
  const style = document.createElement("style");
  style.id = "okims-json-builder-comfy-style";
  style.textContent = `
    .okims-modal-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.74);display:flex;align-items:center;justify-content:center;padding:0;box-sizing:border-box;}
    .okims-modal{width:100vw;height:100vh;background:#10131b;border:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column;overflow:hidden;}
    .okims-modal-toolbar{height:58px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:8px 14px;background:#171a22;border-bottom:1px solid rgba(255,255,255,.12);box-sizing:border-box;}
    .okims-modal-title{font:700 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Noto Sans KR,sans-serif;color:#e7eaf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.78;}
    .okims-modal-actions{display:flex;align-items:center;justify-content:center;gap:10px;}
    .okims-modal-spacer{display:flex;align-items:center;justify-content:flex-end;}
    .okims-modal-actions button,.okims-modal-spacer button{font:800 14px/1 system-ui,-apple-system,Segoe UI,Roboto,Noto Sans KR,sans-serif;border:1px solid rgba(255,255,255,.18);background:#202431;color:#e7eaf0;border-radius:10px;padding:12px 16px;cursor:pointer;letter-spacing:.01em;}
    .okims-modal-actions button:hover,.okims-modal-spacer button:hover{border-color:#7aa2ff;filter:brightness(1.08);}
    .okims-modal-actions button.primary{background:#315fc7;border-color:#315fc7;color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.06) inset;}
    .okims-modal-spacer button.close{background:#2c1e25;border-color:#6f2a3a;color:#ffb3bd;}
    .okims-frame{width:100%;height:100%;border:0;background:#0f1117;flex:1 1 auto;}
    .okims-toast{position:fixed;right:18px;bottom:18px;z-index:100000;background:#171a22;color:#e7eaf0;border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:10px 12px;font:700 12px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Noto Sans KR,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);opacity:0;transform:translateY(8px);transition:.18s ease;}
    .okims-toast.show{opacity:1;transform:translateY(0);}
    .okims-toast-ok{border-color:rgba(114,209,143,.45);}
    .okims-toast-warn{border-color:rgba(255,209,102,.55);}
    .okims-toast-err{border-color:rgba(255,107,107,.55);}
    /* Minimized: hide the modal + let the workflow underneath take all clicks. */
    .okims-modal-overlay.okims-minimized{background:transparent;pointer-events:none;}
    .okims-modal-overlay.okims-minimized .okims-modal{display:none;}
    .okims-minbar{position:fixed;left:14px;top:64px;z-index:100001;display:inline-flex;align-items:center;gap:8px;}
    .okims-minbar button{display:inline-flex;align-items:center;gap:6px;background:#171a22;color:#e7eaf0;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:9px 13px;font:800 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Noto Sans KR,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.45);}
    .okims-minbar button:hover{border-color:#7aa2ff;filter:brightness(1.08);}
    .okims-min-run{background:linear-gradient(135deg,#7C5CFF,#C147E9)!important;border-color:#9a6cff!important;color:#fff!important;}
    .okims-min-run:disabled{opacity:.55;cursor:progress;}
    /* Running indicator: a glowing comet of light sweeping around the border. */
    @property --okims-ang{syntax:'<angle>';inherits:false;initial-value:0deg;}
    .okims-min-run.running{position:relative;opacity:1!important;cursor:progress;animation:okims-run-pulse 1.4s ease-in-out infinite;}
    .okims-min-run.running::before{content:"";position:absolute;inset:-2px;border-radius:12px;padding:2px;background:conic-gradient(from var(--okims-ang),transparent 0 64%,#00e5ff 78%,#7C5CFF 88%,#ff6ad5 96%,transparent 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:okims-run-sweep 1.15s linear infinite;filter:drop-shadow(0 0 6px #7C5CFF);pointer-events:none;}
    @keyframes okims-run-sweep{to{--okims-ang:360deg;}}
    @keyframes okims-run-pulse{0%,100%{box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 0 0 rgba(124,92,255,.45);}50%{box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 16px 3px rgba(124,92,255,.7);}}
  `;
  document.head.appendChild(style);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || "");
    toast("JSON copied", "ok");
  } catch (e) {
    toast("Clipboard permission blocked", "warn");
  }
}

function openBuilderModal(node) {
  // Enforce a single living UI: if one is already open (even minimized),
  // restore/focus it instead of creating a second overlay.
  if (activeBuilder) { activeBuilder.restore(); return; }

  ensureStyles();

  const overlay = document.createElement("div");
  overlay.className = "okims-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "okims-modal";

  const iframe = document.createElement("iframe");
  iframe.className = "okims-frame";
  // Cache-bust the builder HTML: ComfyUI serves .html with no Cache-Control,
  // so browsers heuristically cache the iframe document and show a stale UI.
  // A fresh query string on every open forces the latest build to load.
  iframe.src = BUILDER_URL + (BUILDER_URL.includes("?") ? "&" : "?") + "v=" + Date.now();
  iframe.allow = "clipboard-read; clipboard-write";

  modal.append(iframe);
  overlay.append(modal);
  document.body.appendChild(overlay);

  // Minimize: collapse the overlay to a corner bar so the ComfyUI workflow
  // underneath is fully visible and interactable. The bar can still queue a run
  // (so you can watch the graph while it runs) and restores the builder.
  const minBar = document.createElement("div");
  minBar.className = "okims-minbar";
  minBar.style.display = "none";
  const minRunBtn = document.createElement("button");
  minRunBtn.type = "button";
  minRunBtn.className = "okims-min-run";
  minRunBtn.textContent = "▶ Run Workflow";
  minRunBtn.title = "Queue the ComfyUI workflow without restoring the builder";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "okims-restore";
  restoreBtn.textContent = "⤢ Restore";
  restoreBtn.title = "Restore the builder";
  minBar.append(minRunBtn, restoreBtn);
  document.body.appendChild(minBar);
  function setMinimized(on) {
    overlay.classList.toggle("okims-minimized", !!on);
    minBar.style.display = on ? "inline-flex" : "none";
  }
  restoreBtn.addEventListener("click", () => setMinimized(false));
  minRunBtn.addEventListener("click", () => { if (running) return; callFrameAPI("hostRunWorkflow"); });
  activeBuilder = { restore: () => setMinimized(false) };

  function readJSONFromFrame() {
    try {
      const api = iframe.contentWindow?.ideogram4BuilderAPI;
      if (api) return api.getJSON();
      const doc = iframe.contentDocument;
      return doc?.getElementById("jsonOut")?.value || "";
    } catch (e) {
      console.error("[SCG Prompt Agent] Unable to read JSON from iframe", e);
      toast("Could not read builder JSON", "err");
      return "";
    }
  }

  function sendJSON() {
    const json = readJSONFromFrame();
    if (!json.trim()) { toast("Builder JSON is empty", "warn"); return false; }
    setWidgetValue(node, json);
    return true;
  }

  // ---- In-UI generation loop --------------------------------------------
  // The iframe can't reach ComfyUI directly, so we queue the prompt here and
  // stream results back into the builder via window.ideogram4BuilderAPI.
  let running = false;
  let resultIds = new Set();
  let pendingImage = "";
  let pendingImageDedicated = false;

  function callFrameAPI(method, ...args) {
    try {
      const fapi = iframe.contentWindow?.ideogram4BuilderAPI;
      if (fapi && typeof fapi[method] === "function") fapi[method](...args);
    } catch (e) {
      console.warn("[SCG Prompt Agent] frame API call failed:", method, e);
    }
  }

  function runWorkflow() {
    if (running) return;
    if (!sendJSON()) return; // also toasts when the builder JSON is empty
    resultIds = imageResultNodeIds();
    pendingImage = "";
    pendingImageDedicated = false;
    running = true;
    minRunBtn.disabled = true;
    minRunBtn.classList.add("running");
    minRunBtn.textContent = "Running…";
    callFrameAPI("setRunning", true);
    callFrameAPI("setGenerationProgress", 0);
    try {
      Promise.resolve(app.queuePrompt(0, 1)).catch((err) => endRun(String(err?.message || err)));
    } catch (err) {
      endRun(String(err?.message || err));
    }
  }

  function endRun(errMsg) {
    running = false;
    minRunBtn.disabled = false;
    minRunBtn.classList.remove("running");
    minRunBtn.textContent = "▶ Run Workflow";
    callFrameAPI("setRunning", false); // clears busy + hides progress in the frame
    if (errMsg) { callFrameAPI("setGenerationError", errMsg); return; }
    if (pendingImage) { lastGenURL = pendingImage; callFrameAPI("setGenerationResult", lastGenURL); }
  }

  function onProgress(e) {
    if (!running) return;
    const d = e.detail || {};
    if (d.max) callFrameAPI("setGenerationProgress", Math.round((d.value / d.max) * 100));
  }
  function onExecuted(e) {
    const d = e.detail || {};
    const out = d.output || {};
    if (Array.isArray(out.scg_ondeck) && out.scg_ondeck.length) {
      lastOnDeck = String(out.scg_ondeck[out.scg_ondeck.length - 1] ?? "");
      callFrameAPI("setOnDeckPrompt", lastOnDeck);
    }
    if (Array.isArray(out.images) && out.images.length) {
      const nodeId = String(d.node ?? d.display_node ?? "");
      const url = viewURLFromImage(out.images[out.images.length - 1]);
      // Prefer a dedicated SCG_Image_Result; otherwise keep the last image seen.
      if (resultIds.has(nodeId)) { pendingImage = url; pendingImageDedicated = true; }
      else if (!pendingImageDedicated) { pendingImage = url; }
    }
  }
  function onSuccess() { if (running) endRun(); }
  function onApiError(e) {
    const d = e.detail || {};
    endRun(d.exception_message || d.error || "Workflow error — check the ComfyUI console.");
  }

  api.addEventListener("progress", onProgress);
  api.addEventListener("executed", onExecuted);
  api.addEventListener("execution_success", onSuccess);
  api.addEventListener("execution_error", onApiError);

  function close() {
    window.removeEventListener("message", onMessage);
    document.removeEventListener("keydown", onKey);
    api.removeEventListener("progress", onProgress);
    api.removeEventListener("executed", onExecuted);
    api.removeEventListener("execution_success", onSuccess);
    api.removeEventListener("execution_error", onApiError);
    minBar.remove();
    overlay.remove();
    activeBuilder = null;
  }

  // The builder lives in a same-origin iframe and signals us via postMessage.
  function onMessage(e) {
    if (e.source !== iframe.contentWindow) return;
    const type = e.data && e.data.type;
    if (type === "okimsSendClose") { if (sendJSON()) toast("Saved to ComfyUI node", "ok"); close(); }
    else if (type === "okimsClose") { close(); }
    else if (type === "okimsCopy") { copyText(readJSONFromFrame()); }
    else if (type === "scgRunWorkflow") { runWorkflow(); }
    else if (type === "scgInterrupt") { try { api.interrupt(); } catch (_) {} }
    else if (type === "scgMinimize") { setMinimized(true); }
    else if (type === "scgMaximize") { setMinimized(false); }
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  window.addEventListener("message", onMessage);
  document.addEventListener("keydown", onKey);

  iframe.addEventListener("load", () => {
    const current = getWidgetValue(node);
    try {
      const fapi = iframe.contentWindow?.ideogram4BuilderAPI;
      if (fapi && current && current.trim()) fapi.setJSON(current);
    } catch (e) {
      console.warn("[SCG Prompt Agent] Unable to preload JSON into iframe", e);
    }
    // Re-hydrate the latest run's image + on-deck prompt from a prior open.
    if (lastOnDeck) callFrameAPI("setOnDeckPrompt", lastOnDeck);
    if (lastGenURL) callFrameAPI("setGenerationResult", lastGenURL);
  });
}

app.registerExtension({
  name: EXT_NAME,
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "Okims_JSON_Builder") return;

    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      originalOnNodeCreated?.apply(this, arguments);
      hideJsonWidget(this);

      const openWidget = this.addWidget("button", "Open Builder", null, () => openBuilderModal(this));
      const copyWidget = this.addWidget("button", "Copy JSON", null, () => copyText(getWidgetValue(this)));
      styleNodeButton(openWidget);
      styleNodeButton(copyWidget);

      try {
        this.size = [310, 132];
        this.setDirtyCanvas?.(true, true);
      } catch (_) {}

      requestAnimationFrame(() => {
        hideJsonWidget(this);
        this.setDirtyCanvas?.(true, true);
      });
      setTimeout(() => {
        hideJsonWidget(this);
        this.setDirtyCanvas?.(true, true);
      }, 120);
      setTimeout(() => {
        hideJsonWidget(this);
        this.setDirtyCanvas?.(true, true);
      }, 500);
    };
  },
});
