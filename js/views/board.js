/* ============================================================
   views/board.js — Tauler diari: progrés + graella d'habitacions
   ============================================================ */
import { h, clear, icon, iconEl } from "../ui.js";
import { t } from "../i18n.js";
import {
  state, STATUSES, statusOf, dayProgress, roomState, roomsOfFloor,
  staffById, initials, fmtDate, todayISO, setDate, setFilterStaff, setFilterStatus,
  sessionStaff,
} from "../store.js";
import { openRoom } from "./room.js";

export function renderBoard(view) {
  clear(view);
  const me = sessionStaff();
  if (state.rooms.length === 0) { view.append(emptyBoard()); return; }
  view.append(dateBar());
  view.append(progressCard(me));
  if (!me) view.append(staffFilter());
  view.append(statusFilter(me));
  view.append(floorsGrid(me));
}

/* ---------- Barra de data ---------- */
function dateBar() {
  const input = h("input", {
    type: "date", class: "input", value: state.date,
    style: "position:absolute;inset:0;opacity:0;cursor:pointer",
    onChange: (e) => setDate(e.target.value || todayISO()),
  });
  const picker = h("div", { class: "date-pick" }, iconEl("calendar", 18), h("span", {}, fmtDate(state.date)), input);
  const isToday = state.date === todayISO();
  return h("div", { class: "date-bar" }, picker,
    !isToday ? h("button", { class: "btn btn--sm btn--ghost", onClick: () => setDate(todayISO()) }, t("board.today")) : null);
}

/* ---------- Targeta de progrés ---------- */
function progressCard(me) {
  const p = dayProgress(state.date, me?.id || null);
  return h("div", { class: "progress-card" },
    h("h2", {}, `${t("board.cleaning")} · ${fmtDate(state.date)}`),
    h("div", { class: "progress-big" }, String(p.pct), h("small", {}, "%")),
    h("div", { class: "progress-bar" }, h("span", { style: `width:${p.pct}%` })),
    h("div", { class: "progress-stats" },
      stat(p.fets, t("board.done")),
      stat(p.actius - p.fets, t("board.pending")),
      stat(p.counts.en_proces, t("board.inprogress")),
      stat(p.total, t("board.total")),
    ));
}
const stat = (n, label) => h("div", {}, h("b", {}, String(n)), h("span", {}, label));

/* ---------- Filtre per cambrera ---------- */
function staffFilter() {
  if (state.staff.length === 0) return h("div");
  const wrap = h("div", { class: "chips" });
  const mk = (key, label, color) => h("button", { class: "chip" + (state.filterStaff === key ? " active" : ""), onClick: () => setFilterStaff(key) },
    color ? h("span", { class: "dot", style: `background:${color}` }) : null, label);
  wrap.append(mk("all", t("board.all_staff")));
  state.staff.forEach((s) => {
    const n = state.rooms.filter((r) => roomState(r).staffId === s.id).length;
    wrap.append(mk(s.id, s.name, s.color));
    if (n) wrap.lastChild.append(h("span", { class: "chip-count" }, String(n)));
  });
  wrap.append(mk("none", t("board.unassigned")));
  return wrap;
}

/* ---------- Filtre per estat ---------- */
function statusFilter(me) {
  const wrap = h("div", { class: "chips", style: "margin-top:2px" });
  const counts = dayProgress(state.date, me?.id || null).counts;
  const colorMap = { brut: "#C2603D", en_proces: "#B9821A", net: "#2F6F8F", revisat: "#3E7C4F", fora_servei: "#7E8884", no_molestar: "#7A5E97" };
  const mk = (key, label, color) => h("button", { class: "chip" + (state.filterStatus === key ? " active" : ""), onClick: () => setFilterStatus(key) },
    color ? h("span", { class: "dot", style: `background:${color}` }) : null, label);
  wrap.append(mk("all", t("board.all_status")));
  STATUSES.forEach((s) => { if (counts[s.key]) wrap.append(mk(s.key, `${t("status." + s.key)} ${counts[s.key]}`, colorMap[s.cls])); });
  return wrap;
}

/* ---------- Graella per pisos ---------- */
function floorsGrid(me) {
  const frag = h("div");
  let anyVisible = false;
  state.floors.forEach((floor) => {
    let rooms = roomsOfFloor(floor.id).filter((r) => {
      const rs = roomState(r);
      if (me && rs.staffId !== me.id) return false; // cambrera: només les seves
      if (state.filterStaff === "none" && rs.staffId) return false;
      if (state.filterStaff !== "all" && state.filterStaff !== "none" && rs.staffId !== state.filterStaff) return false;
      if (state.filterStatus !== "all" && rs.status !== state.filterStatus) return false;
      return true;
    });
    if (rooms.length === 0) return;
    anyVisible = true;
    const group = h("div", { class: "floor-group" });
    group.append(h("div", { class: "floor-head" }, h("h3", {}, floor.name), h("span", {}, t("board.rooms_count", { n: rooms.length }))));
    const grid = h("div", { class: "room-grid" });
    rooms.forEach((r) => grid.append(roomCard(r)));
    group.append(grid);
    frag.append(group);
  });
  if (!anyVisible) frag.append(h("div", { class: "empty" },
    h("div", { html: icon("search", 54, 1.5) }), h("h3", {}, t("board.no_rooms")), h("p", {}, t("board.no_rooms_desc"))));
  return frag;
}

/* ---------- Targeta d'habitació ---------- */
function roomCard(room) {
  const rs = roomState(room);
  const st = statusOf(rs.status);
  const staff = rs.staffId ? staffById(rs.staffId) : null;
  const task = rs.task;
  const photos = task?.photos?.length || 0;
  const noteFlag = !!(task?.notes || "").trim();

  const card = h("div", { class: `room st-${st.cls}` + (rs.type === "checkout" ? " is-checkout" : ""), role: "button", tabindex: "0", onClick: () => openRoom(room.id) });
  card.style.setProperty("--checkout-label", `"${t("tag.checkout")}"`);

  const icons = h("div", { class: "room__icons" });
  if (photos) icons.append(badgeIcon("camera"));
  if (noteFlag) icons.append(badgeIcon("note"));
  if (icons.children.length) card.append(icons);

  card.append(
    h("div", {}, h("div", { class: "room__num" }, room.number), h("div", { class: "room__type" }, t("type." + room.type))),
    h("div", { class: "room__foot" },
      h("span", { class: "room__st" }, t("short." + rs.status)),
      staff ? h("span", { class: "room__staff", style: `background:${staff.color}`, title: staff.name }, initials(staff.name)) : h("span"))
  );
  return card;
}
function badgeIcon(name) {
  const s = h("span", { style: "color:var(--ink-faint)" });
  s.innerHTML = icon(name, 14, 2);
  return s;
}

/* ---------- Estat buit ---------- */
function emptyBoard() {
  return h("div", { class: "empty", style: "padding-top:64px" },
    h("div", { html: icon("bed", 56, 1.4) }),
    h("h3", {}, t("board.empty_title")),
    h("p", {}, t("board.empty_desc")),
    h("button", { class: "btn btn--primary", onClick: () => { location.hash = "#setup"; } }, iconEl("plus", 18), t("board.setup_cta")));
}
