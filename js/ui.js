/* ============================================================
   ui.js — Helpers de DOM, icones SVG, toasts, sheets i diàlegs
   ============================================================ */
import { t } from "./i18n.js";

/** Crea un element des d'una etiqueta + props + fills. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/** Biblioteca d'icones (stroke). */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bed: '<path d="M3 18V7m0 6h18m0 5V11a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2"/><path d="M7 11V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  note: '<path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/>',
  upload: '<path d="M12 21V9m0 0-4 4m4-4 4 4M5 3h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  dnd: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.7 2.7-2.3-2.3z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
};
export function icon(name, size = 22, stroke = 2) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}
export function iconEl(name, size = 22, stroke = 2) {
  const span = h("span", { class: "i" });
  span.innerHTML = icon(name, size, stroke);
  return span.firstChild;
}

/* ---------- Toast ---------- */
export function toast(msg, kind = "ok") {
  const root = $("#toastRoot");
  const t = h("div", { class: `toast toast--${kind}` }, msg);
  root.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}

/* ---------- Sheet (modal inferior) ---------- */
export function openSheet({ title, subtitle, body, footer, onClose, size }) {
  const root = $("#modalRoot");
  const scrim = h("div", { class: "scrim" });
  const sheet = h("div", { class: "sheet" + (size === "tall" ? " sheet--tall" : "") + (size === "dialog" ? " sheet--dialog" : "") });

  const close = (result) => {
    scrim.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 320);
    onClose && onClose(result);
  };

  const head = h("div", { class: "sheet__head" },
    h("div", {}, h("h2", {}, title), subtitle ? h("p", {}, subtitle) : null),
    h("button", { class: "sheet__close", "aria-label": "Tanca", onClick: () => close() }, iconEl("x", 20))
  );
  const grip = h("div", { class: "sheet__grip" });
  const bodyEl = h("div", { class: "sheet__body" });
  if (typeof body === "function") body(bodyEl, close); else if (body) bodyEl.append(body);

  sheet.append(grip, head, bodyEl);
  if (footer) {
    const f = h("div", { class: "sheet__foot" });
    if (typeof footer === "function") footer(f, close); else f.append(footer);
    sheet.append(f);
  }

  scrim.addEventListener("click", () => close());
  root.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add("show"); sheet.classList.add("show"); });
  return { close, bodyEl };
}

/* ---------- Confirm ---------- */
export function confirmSheet(title, message, { danger = true, okLabel } = {}) {
  okLabel = okLabel || t("common.confirm");
  return new Promise((resolve) => {
    // Guarda perquè close()→onClose no resolgui abans del valor real.
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    openSheet({
      title, size: "dialog",
      body: (el) => el.append(h("p", { class: "muted", style: "font-size:14.5px;line-height:1.55" }, message)),
      footer: (f, close) => {
        f.append(
          h("button", { class: "btn", onClick: () => { done(false); close(); } }, t("common.cancel")),
          h("button", { class: "btn " + (danger ? "btn--terra" : "btn--primary"), onClick: () => { done(true); close(); } }, okLabel)
        );
      },
      onClose: () => done(false),
    });
  });
}

/* ---------- Prompt simple ---------- */
export function promptSheet(title, { label = "Nom", value = "", placeholder = "", okLabel } = {}) {
  return new Promise((resolve) => {
    let input;
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    openSheet({
      title, size: "dialog",
      body: (el) => {
        input = h("input", { class: "input", value, placeholder, autofocus: true });
        el.append(h("div", { class: "field" }, h("label", {}, label), input));
        setTimeout(() => { input.focus(); input.select?.(); }, 140);
      },
      footer: (f, close) => {
        const ok = () => { const v = input.value.trim(); done(v || null); close(); };
        input?.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
        f.append(
          h("button", { class: "btn", onClick: () => { done(null); close(); } }, t("common.cancel")),
          h("button", { class: "btn btn--primary", onClick: ok }, okLabel || t("common.save"))
        );
      },
      onClose: () => done(null),
    });
  });
}

/* ---------- Captura de foto (càmera o galeria) ---------- */
export function pickImage({ capture = false } = {}) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: "image/*" });
    if (capture) input.setAttribute("capture", "environment");
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.remove();
      resolve(file || null);
    });
    document.body.append(input);
    input.click();
  });
}

/** Redimensiona/comprimeix una imatge a un blob JPEG. Retorna null si la
 *  imatge no es pot llegir (p. ex. formats com HEIC que el navegador no obre). */
export function compressImage(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const done = (v) => { try { URL.revokeObjectURL(url); } catch {} resolve(v); };
    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) return done(null);
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale); height = Math.round(height * scale);
        const canvas = h("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => done(blob || null), "image/jpeg", quality);
      } catch { done(null); }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

export function fmtClock(ms) {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60), ss = s % 60;
  if (m >= 60) { const hh = Math.floor(m / 60); return `${hh}:${String(m % 60).padStart(2, "0")}:${String(ss).padStart(2, "0")}`; }
  return `${m}:${String(ss).padStart(2, "0")}`;
}
