import { app } from "../../scripts/app.js";

const EXT_NAME = "okims.json.builder";
const BUILDER_URL = new URL("./Okims_JSON_Builder.html", import.meta.url).href;

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

  function close() {
    window.removeEventListener("message", onMessage);
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  }

  // The builder lives in a same-origin iframe and signals us via postMessage.
  function onMessage(e) {
    if (e.source !== iframe.contentWindow) return;
    const type = e.data && e.data.type;
    if (type === "okimsSendClose") { if (sendJSON()) toast("Sent to ComfyUI node", "ok"); close(); }
    else if (type === "okimsClose") { close(); }
    else if (type === "okimsCopy") { copyText(readJSONFromFrame()); }
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  window.addEventListener("message", onMessage);
  document.addEventListener("keydown", onKey);

  iframe.addEventListener("load", () => {
    const current = getWidgetValue(node);
    try {
      const api = iframe.contentWindow?.ideogram4BuilderAPI;
      if (api && current && current.trim()) api.setJSON(current);
    } catch (e) {
      console.warn("[SCG Prompt Agent] Unable to preload JSON into iframe", e);
    }
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
