/* ============================================================
   app.js — Punt d'entrada, router i orquestració de l'app Cambra
   ============================================================ */
import { $, h, icon } from "./ui.js";
import { t } from "./i18n.js";
import { applyAppearance } from "./theme.js";
import { state, loadState, onChange, openIncidents, initials } from "./store.js";
import { renderBoard } from "./views/board.js";
import { renderIncidents } from "./views/incidents.js";
import { renderReport } from "./views/report.js";
import { renderSetup } from "./views/setup.js";

const ROUTES = {
  board: renderBoard,
  incidents: renderIncidents,
  report: renderReport,
  setup: renderSetup,
};

let current = "board";

function currentRoute() {
  const r = location.hash.replace("#", "");
  return ROUTES[r] ? r : "board";
}

function render() {
  const view = $("#view");
  current = currentRoute();
  ROUTES[current](view);
  injectFsBanner();
  syncNav();
  refreshHeader();
  view.scrollIntoView({ block: "start" });
}

function navigate(route) {
  if (location.hash === "#" + route) { render(); return; }
  location.hash = "#" + route;
}

function syncNav() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.route === current);
    const label = tab.querySelector("span:not(.tab-badge)");
    if (label) label.textContent = t("nav." + tab.dataset.route);
  });
  // etiquetes accessibles dels botons de capçalera
  const fb = $("#fullscreenBtn"); if (fb) fb.setAttribute("aria-label", t("a11y.fullscreen"));
  const ib = $("#installBtn"); if (ib) ib.setAttribute("aria-label", t("a11y.install"));
}

function refreshHeader() {
  $("#hotelName").textContent = state.config?.hotelName || "Cambra";
  // logo personalitzat de l'hotel
  const logoSlot = $("#appHeader .app-header__logo");
  if (logoSlot) {
    if (state.config?.logo) {
      logoSlot.classList.add("app-header__logo--img");
      logoSlot.innerHTML = `<img src="${state.config.logo}" alt="Logo">`;
    } else if (logoSlot.classList.contains("app-header__logo--img")) {
      logoSlot.classList.remove("app-header__logo--img");
      logoSlot.innerHTML = `<svg viewBox="0 0 64 64" width="26" height="26"><rect x="13" y="29" width="38" height="14" rx="3" fill="currentColor"/><rect x="9" y="22" width="6" height="24" rx="2" fill="currentColor"/><rect x="13" y="38" width="38" height="5" rx="2" fill="#C2603D"/><path d="M45 14l2.4 5.6L53 22l-5.6 2.4L45 30l-2.4-5.6L37 22l5.6-2.4z" fill="currentColor"/></svg>`;
    }
  }
  const sub = $("#headerSub");
  const open = openIncidents().length;
  sub.textContent = current === "incidents" ? t("sub.incidents", { n: open }) : t("sub." + current);
  refreshFsLabels();
  // badge d'incidències
  const badge = $("#incBadge");
  if (open > 0) { badge.hidden = false; badge.textContent = String(open); }
  else badge.hidden = true;
}
window.__refreshHeader = refreshHeader;

/* ---------- Onboarding ---------- */
function maybeOnboard() {
  if (state.config?.onboarded || state.rooms.length || state.floors.length) return;
  // primer ús: porta a configuració
  location.hash = "#setup";
}

/* ---------- Instal·lació PWA ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#installBtn").hidden = false;
});
$("#installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("#installBtn").hidden = true;
});

/* ---------- Pantalla completa ---------- */
const fsBtn = $("#fullscreenBtn");
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (e) { /* navegador sense suport */ }
}
fsBtn?.addEventListener("click", toggleFullscreen);

let _fsDismissed = (() => { try { return localStorage.getItem("cambra.fsHint") === "1"; } catch { return false; } })();
function fsBannerShouldShow() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const wide = window.matchMedia("(min-width: 760px)").matches;
  return wide && !standalone && !document.fullscreenElement && !_fsDismissed && document.fullscreenEnabled;
}
/** Insereix l'avís de pantalla completa al capdamunt de la vista actual. */
function injectFsBanner() {
  if (!fsBannerShouldShow()) return;
  const view = $("#view");
  const banner = h("div", { class: "fs-banner" },
    h("span", { class: "fs-banner__txt" }, t("fs.prompt")),
    h("button", { class: "fs-banner__go", onClick: () => { toggleFullscreen(); _fsDismissed = true; try { localStorage.setItem("cambra.fsHint", "1"); } catch {} banner.remove(); } }, t("fs.activate")),
    h("button", { class: "fs-banner__close", "aria-label": "Tanca", html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      onClick: () => { _fsDismissed = true; try { localStorage.setItem("cambra.fsHint", "1"); } catch {} banner.remove(); } }));
  view.prepend(banner);
}
function refreshFsLabels() {
  const lbl = $("#fullscreenLabel");
  if (lbl) lbl.textContent = document.fullscreenElement ? t("fs.exit") : t("fs.label");
}
document.addEventListener("fullscreenchange", () => {
  document.body.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  refreshFsLabels();
  render();
});

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------- Arrencada ---------- */
async function boot() {
  await loadState();
  applyAppearance(state.config?.appearance);

  // navegació
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => navigate(t.dataset.route)));
  window.addEventListener("hashchange", render);

  // re-render quan canvia l'estat (només la vista activa)
  onChange(() => {
    applyAppearance(state.config?.appearance);
    ROUTES[current]($("#view"));
    injectFsBanner();
    syncNav();
    refreshHeader();
  });

  // mostra UI
  $("#appHeader").hidden = false;
  $("#tabbar").hidden = false;

  maybeOnboard();
  render();

  // amaga splash
  setTimeout(() => {
    const sp = $("#splash");
    sp.classList.add("hide");
    setTimeout(() => sp.remove(), 600);
  }, 650);
}

boot().catch((err) => {
  console.error(err);
  $("#splash").innerHTML = `<p style="color:#fff;padding:24px;text-align:center">Error en iniciar l'app.<br><small>${err.message}</small></p>`;
});
