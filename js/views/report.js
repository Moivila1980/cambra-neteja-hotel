/* ============================================================
   views/report.js — Informe del dia (dades del responsable)
   ============================================================ */
import { h, clear, icon, iconEl, toast, fmtClock } from "../ui.js";
import { t } from "../i18n.js";
import {
  state, STATUSES, statusOf, dayProgress, roomState, staffById, initials,
  fmtDate, floorById, getTask, openIncidents,
} from "../store.js";

export function renderReport(view) {
  clear(view);
  view.append(h("h1", { class: "view-title" }, t("report.title")));
  view.append(h("p", { class: "view-sub" }, fmtDate(state.date)));

  if (state.rooms.length === 0) {
    view.append(h("div", { class: "empty" }, h("div", { html: icon("note", 54, 1.4) }), h("h3", {}, t("report.no_data")), h("p", {}, t("report.no_data_desc"))));
    return;
  }
  const p = dayProgress();
  view.append(progressOverview(p));
  view.append(statusBreakdown(p));
  view.append(staffBreakdown());
  view.append(finishLog());
  view.append(exportRow(p));
}

function progressOverview(p) {
  return h("div", { class: "progress-card" },
    h("h2", {}, t("report.global")),
    h("div", { class: "progress-big" }, String(p.pct), h("small", {}, "%")),
    h("div", { class: "progress-bar" }, h("span", { style: `width:${p.pct}%` })),
    h("div", { class: "progress-stats" },
      h("div", {}, h("b", {}, String(p.fets)), h("span", {}, t("report.completed"))),
      h("div", {}, h("b", {}, String(p.actius - p.fets)), h("span", {}, t("report.pending"))),
      h("div", {}, h("b", {}, String(openIncidents().length)), h("span", {}, t("report.incidents")))));
}

function statusBreakdown(p) {
  const sec = h("div", {});
  sec.append(h("div", { class: "section-label" }, t("report.by_status")));
  const card = h("div", { class: "card card-pad" });
  STATUSES.forEach((s) => {
    const n = p.counts[s.key];
    const pct = p.total ? Math.round((n / p.total) * 100) : 0;
    card.append(h("div", { class: "bar-row" },
      h("div", { class: "bar-row__head" },
        h("span", { class: `pill pill--${s.cls}` }, h("span", { class: "dot", style: `background:var(--${barColor(s.cls)})` }), t("status." + s.key)), h("b", {}, String(n))),
      h("div", { class: "bar-track" }, h("span", { class: `bar-fill bf-${s.cls}`, style: `width:${pct}%` }))));
  });
  sec.append(card);
  return sec;
}
const barColor = (cls) => ({ brut: "terra", en_proces: "amber", net: "blue", revisat: "green", fora_servei: "grey", no_molestar: "violet" }[cls]);

function staffBreakdown() {
  if (state.staff.length === 0) return h("div");
  const sec = h("div", {});
  sec.append(h("div", { class: "section-label" }, t("report.by_staff")));
  const list = h("div", { class: "list" });
  state.staff.forEach((s) => {
    const rooms = state.rooms.filter((r) => roomState(r).staffId === s.id);
    const fets = rooms.filter((r) => ["net", "revisat"].includes(roomState(r).status)).length;
    const pct = rooms.length ? Math.round((fets / rooms.length) * 100) : 0;
    let total = 0;
    rooms.forEach((r) => { const tk = getTask(r.id); if (tk?.startedAt && tk?.finishedAt) total += tk.finishedAt - tk.startedAt; });
    list.append(h("div", { class: "row" },
      h("div", { class: "row__avatar", style: `background:${s.color}` }, initials(s.name)),
      h("div", { class: "row__body" },
        h("div", { class: "row__title" }, s.name),
        h("div", { class: "row__meta" }, `${t("report.done_count", { a: fets, b: rooms.length })}${total ? " · " + fmtClock(total) : ""}`),
        h("div", { class: "bar-track", style: "margin-top:6px" }, h("span", { class: "bar-fill bf-revisat", style: `width:${pct}%` }))),
      h("b", { style: "font-family:var(--font-display);font-size:18px;color:var(--teal)" }, `${pct}%`)));
  });
  const unassigned = state.rooms.filter((r) => !roomState(r).staffId).length;
  if (unassigned) list.append(h("div", { class: "row" },
    h("div", { class: "row__avatar", style: "background:var(--grey)" }, "?"),
    h("div", { class: "row__body" }, h("div", { class: "row__title" }, t("report.unassigned")), h("div", { class: "row__meta" }, t("report.rooms_n", { n: unassigned })))));
  sec.append(list);
  return sec;
}

function finishLog() {
  const rows = [];
  state.rooms.forEach((r) => { const tk = getTask(r.id); if (tk?.finishedAt) rows.push({ room: r, tk }); });
  rows.sort((a, b) => b.tk.finishedAt - a.tk.finishedAt);
  const sec = h("div", {});
  sec.append(h("div", { class: "section-label" }, t("report.finish_log")));
  if (rows.length === 0) { sec.append(h("div", { class: "card card-pad muted", style: "font-size:13px" }, t("report.no_finish"))); return sec; }
  const card = h("div", { class: "card card-pad" });
  rows.forEach(({ room, tk }) => {
    const who = (tk.finishedBy && staffById(tk.finishedBy)?.name) || (tk.staffId && staffById(tk.staffId)?.name) || "—";
    const hora = new Date(tk.finishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dur = tk.startedAt && tk.finishedAt ? fmtClock(tk.finishedAt - tk.startedAt) : "—";
    const reviewed = tk.reviewedAt ? t("report.reviewed_suffix") : "";
    card.append(h("div", { class: "log-row" },
      h("span", { class: "log-time" }, hora),
      h("div", { style: "min-width:0" }, h("div", { class: "log-room" }, t("common.room", { n: room.number })), h("div", { class: "log-meta" }, `${who}${reviewed}`)),
      h("span", { class: "log-dur" }, dur)));
  });
  sec.append(card);
  return sec;
}

function exportRow(p) {
  return h("button", { class: "btn btn--block", style: "margin-top:20px", onClick: () => exportReport(p) }, iconEl("download", 18), t("report.export_csv"));
}
function exportReport() {
  const head = [t("csv.floor"), t("inc.f_room"), t("re.type"), t("inc.state"), t("room.clean_type"), t("report.by_staff"), t("csv.start"), t("csv.end"), t("csv.dur"), t("room.notes")];
  const rows = [head];
  state.rooms.forEach((r) => {
    const rs = roomState(r);
    const tk = getTask(r.id);
    const staff = rs.staffId ? staffById(rs.staffId)?.name : "";
    const floor = floorById(r.floorId)?.name || "";
    const ini = tk?.startedAt ? new Date(tk.startedAt).toLocaleTimeString() : "";
    const fi = tk?.finishedAt ? new Date(tk.finishedAt).toLocaleTimeString() : "";
    const dur = tk?.startedAt && tk?.finishedAt ? fmtClock(tk.finishedAt - tk.startedAt) : "";
    rows.push([floor, r.number, t("type." + r.type), t("status." + rs.status), t("clean." + rs.type), staff, ini, fi, dur, (tk?.notes || "").replace(/[\n;]/g, " ")]);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `informe-${state.date}.csv` });
  document.body.append(a); a.click(); a.remove();
  toast(t("report.csv_done"));
}
