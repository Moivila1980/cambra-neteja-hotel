/* ============================================================
   views/room.js — Detall d'habitació i flux de neteja
   ============================================================ */
import { h, clear, icon, iconEl, openSheet, toast, pickImage, compressImage, confirmSheet } from "../ui.js";
import { t } from "../i18n.js";
import {
  state, STATUSES, CLEAN_TYPES,
  roomById, floorById, roomState, getTask,
  setRoomStatus, assignRoom, setRoomType, ensureChecklist, toggleCheck,
  setTaskNotes, finishTask, inspectRoom, beginIfNeeded, isChecklistRequired,
  savePhoto, photoURL, addTaskPhoto, removeTaskPhoto, fmtDate,
} from "../store.js";
import { openIncidentForm } from "./incidents.js";

export async function openRoom(roomId) {
  const room = roomById(roomId);
  if (!room) return;
  await ensureChecklist(roomId);
  const rs0 = roomState(room);
  if (rs0.status !== "fora_servei" && rs0.status !== "no_molestar") await beginIfNeeded(roomId);
  const floor = floorById(room.floorId);

  openSheet({
    title: t("room.title", { n: room.number }),
    subtitle: `${floor?.name || ""} · ${fmtDate(state.date)}`,
    body: (el) => { el.__rerender = () => rerender(el); rerender(el); },
  });

  function rerender(el) {
    clear(el);
    el.__rerender = () => rerender(el);
    const rs = roomState(room);
    const task = getTask(roomId) || {};
    el.append(statusSection(room, rs, rerender, el));
    el.append(assignSection(room, rs, rerender, el));
    el.append(typeSection(room, rs, rerender, el));
    el.append(checklistSection(room, task, rerender, el));
    el.append(photosSection(room, task, rerender, el));
    el.append(notesSection(room, task));
    el.append(incidentBtn(room));
    el.append(actionRow(room, rs, rerender, el));
  }
}

/* ---------- Estat ---------- */
function statusSection(room, rs, rerender, el) {
  const sec = h("div", { class: "rsec" });
  sec.append(h("div", { class: "section-label", style: "margin-top:0" }, t("room.status_label")));
  const grid = h("div", { class: "status-grid" });
  STATUSES.forEach((s) => {
    grid.append(h("button", { class: `status-opt st-${s.cls}` + (rs.status === s.key ? " active" : ""),
      onClick: async () => { await setRoomStatus(room.id, s.key); rerender(el); } },
      h("span", { class: "status-opt__dot" }), t("status." + s.key)));
  });
  sec.append(grid);
  return sec;
}

/* ---------- Assignació ---------- */
function assignSection(room, rs, rerender, el) {
  const sec = h("div", { class: "rsec" });
  sec.append(h("div", { class: "section-label" }, t("room.assigned")));
  if (state.staff.length === 0) { sec.append(h("p", { class: "muted", style: "font-size:13px" }, t("room.no_staff"))); return sec; }
  const row = h("div", { class: "chips" });
  const mk = (id, label, color) => h("button", { class: "chip" + (rs.staffId === id ? " active" : ""),
    onClick: async () => { await assignRoom(room.id, id); rerender(el); } },
    color ? h("span", { class: "dot", style: `background:${color}` }) : null, label);
  row.append(mk(null, t("board.unassigned")));
  state.staff.forEach((s) => row.append(mk(s.id, s.name, s.color)));
  sec.append(row);
  return sec;
}

/* ---------- Tipus de neteja ---------- */
function typeSection(room, rs, rerender, el) {
  const sec = h("div", { class: "rsec" });
  sec.append(h("div", { class: "section-label" }, t("room.clean_type")));
  const seg = h("div", { class: "seg" });
  CLEAN_TYPES.forEach((ct) => {
    seg.append(h("button", { class: rs.type === ct.key ? "active" : "",
      onClick: async () => {
        if (rs.type === ct.key) return;
        const task = getTask(room.id);
        if (task && task._checklistTouched) {
          const ok = await confirmSheet(t("room.change_type_title"), t("room.change_type_msg"), { danger: true, okLabel: t("common.change") });
          if (!ok) return;
          task._checklistTouched = false;
        }
        await setRoomType(room.id, ct.key);
        await ensureChecklist(room.id);
        rerender(el);
      } },
      h("div", {}, h("div", { style: "font-weight:800" }, t("clean." + ct.key)), h("div", { style: "font-size:10.5px;font-weight:600;opacity:.7" }, t("clean." + ct.key + "_desc")))));
  });
  sec.append(seg);
  return sec;
}

/* ---------- Checklist ---------- */
function checklistSection(room, task, rerender, el) {
  const sec = h("div", { class: "rsec" });
  const items = task.checklist || [];
  const done = items.filter((i) => i.done).length;
  sec.append(h("div", { class: "section-label", style: "display:flex;justify-content:space-between;align-items:center" },
    h("span", {}, t("room.checklist")), h("span", { style: "color:var(--teal);font-weight:800" }, `${done}/${items.length}`)));
  const list = h("div", { class: "check-list" });
  items.forEach((it, idx) => {
    list.append(h("button", { class: "check" + (it.done ? " done" : ""), onClick: async () => { await toggleCheck(room.id, idx); rerender(el); } },
      h("span", { class: "check__box", html: it.done ? icon("check", 16, 3) : "" }), h("span", { class: "check__label" }, it.label)));
  });
  sec.append(list);
  return sec;
}

/* ---------- Fotos ---------- */
function photosSection(room, task, rerender, el) {
  const sec = h("div", { class: "rsec" });
  sec.append(h("div", { class: "section-label" }, t("room.photos")));
  const grid = h("div", { class: "photo-grid" });
  (task.photos || []).forEach((pid) => {
    const thumb = h("div", { class: "photo-thumb" },
      h("button", { "aria-label": t("common.delete"), onClick: async (e) => { e.stopPropagation(); await removeTaskPhoto(room.id, pid); rerender(el); } }, h("span", { html: icon("x", 14, 2.5) })));
    photoURL(pid).then((url) => { if (url) thumb.prepend(h("img", { src: url, loading: "lazy", onClick: () => openPhoto(url) })); });
    grid.append(thumb);
  });
  grid.append(h("button", { class: "photo-add", type: "button", onClick: async () => {
    try {
      const file = await pickImage(); if (!file) return;
      const blob = await compressImage(file); if (!blob) { toast(t("photo.error"), "err"); return; }
      const id = await savePhoto(blob);
      await addTaskPhoto(room.id, id); rerender(el); toast(t("room.photo_added"));
    } catch (e) { toast(t("photo.error"), "err"); }
  } }, h("span", { html: icon("camera", 24, 1.8) }), t("common.add")));
  sec.append(grid);
  return sec;
}
function openPhoto(url) { openSheet({ title: t("room.photo"), body: (el) => el.append(h("img", { src: url, style: "width:100%;border-radius:14px" })) }); }

/* ---------- Notes ---------- */
function notesSection(room, task) {
  const sec = h("div", { class: "rsec" });
  sec.append(h("div", { class: "section-label" }, t("room.notes")));
  const ta = h("textarea", { class: "textarea", placeholder: t("room.notes_ph") }, task.notes || "");
  let to;
  ta.addEventListener("input", () => { clearTimeout(to); to = setTimeout(() => setTaskNotes(room.id, ta.value), 400); });
  sec.append(ta);
  return sec;
}

/* ---------- Incidència ---------- */
function incidentBtn(room) {
  return h("button", { class: "btn btn--block", style: "margin-top:8px;color:var(--terra);border-color:var(--terra-soft)",
    onClick: () => openIncidentForm({ roomId: room.id }) }, iconEl("alert", 18), t("room.report_incident"));
}

/* ---------- Accions finals ---------- */
function actionRow(room, rs, rerender, el) {
  const wrap = h("div", { style: "margin-top:16px" });
  const done = ["net", "revisat"].includes(rs.status);
  if (done) {
    wrap.append(h("div", { class: "finish-done" },
      h("span", { class: "finish-done__check", html: icon("check", 22, 3) }),
      h("div", {}, h("div", { style: "font-weight:800" }, rs.status === "revisat" ? t("room.reviewed") : t("room.finished")),
        h("div", { style: "font-size:12.5px;opacity:.8" }, t("room.record_saved")))));
    if (rs.status === "net") wrap.append(h("button", { class: "btn btn--block", style: "margin-top:10px;color:var(--green);border-color:var(--green-soft)",
      onClick: async () => { await inspectRoom(room.id); rerender(el); toast(t("room.toast_reviewed")); } }, iconEl("sparkle", 18), t("room.mark_reviewed")));
    wrap.append(h("button", { class: "btn btn--ghost btn--block", style: "margin-top:6px",
      onClick: async () => { await setRoomStatus(room.id, "en_proces"); rerender(el); toast(t("room.toast_reopened")); } }, t("room.reopen")));
  } else {
    const task = getTask(room.id) || {};
    const items = task.checklist || [];
    const doneCount = items.filter((i) => i.done).length;
    const blocked = isChecklistRequired(rs.type) && items.length > 0 && doneCount < items.length;
    wrap.append(h("button", { class: "btn btn--primary btn--block btn--lg finish-btn" + (blocked ? " is-blocked" : ""),
      onClick: async () => {
        if (blocked) { toast(t("room.checklist_incomplete", { a: doneCount, b: items.length }), "warn"); return; }
        await finishTask(room.id); rerender(el); toast(t("room.toast_finished"));
      } }, iconEl("check", 20), t("room.finish")));
    if (blocked) wrap.append(h("p", { style: "text-align:center;font-size:12px;margin-top:8px;color:var(--amber);font-weight:700" }, t("room.checklist_incomplete", { a: doneCount, b: items.length })));
  }
  return wrap;
}
