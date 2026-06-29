/* ============================================================
   views/admin.js — Panell d'administració d'usuaris
   Gent registrada, sol·licituds pendents, alta i gestió.
   ============================================================ */
import { h, clear, icon, iconEl, openSheet, toast, confirmSheet } from "../ui.js";
import { t } from "../i18n.js";
import {
  state, STAFF_COLORS, initials, roomState,
  addStaff, updateStaff, deleteStaff, approveStaff, pendingStaff,
} from "../store.js";

export function renderAdmin(view) {
  clear(view);
  view.append(h("h1", { class: "view-title" }, t("admin.title")));
  view.append(h("p", { class: "view-sub" }, t("admin.subtitle")));

  // Sol·licituds pendents
  const pend = pendingStaff();
  if (pend.length) {
    view.append(h("div", { class: "section-label" }, t("staff.pending_section")));
    const pc = h("div", { class: "list" });
    pend.forEach((s) => pc.append(h("div", { class: "row", style: "border-color:var(--amber);background:var(--amber-soft)" },
      h("div", { class: "row__avatar", style: `background:${s.color}` }, initials(s.name)),
      h("div", { class: "row__body" }, h("div", { class: "row__title" }, s.name), h("div", { class: "row__meta" }, t("staff.pending_badge"))),
      h("button", { class: "btn btn--sm btn--primary", style: "flex:0 0 auto", onClick: async () => { await approveStaff(s.id); renderAdmin(view); toast(t("staff.approved")); } }, iconEl("check", 16), t("staff.approve")),
      h("button", { class: "icon-sm", style: "color:var(--terra);flex:0 0 auto", onClick: async () => { if (await confirmSheet(t("staff.delete"), t("staff.delete_msg", { name: s.name }), { okLabel: t("common.delete") })) { await deleteStaff(s.id); renderAdmin(view); toast(t("staff.deleted")); } }, html: icon("trash", 17, 2) })
    )));
    view.append(pc);
  }

  // Registrats (aprovats)
  view.append(h("div", { class: "section-label" }, t("admin.registered")));
  const approved = state.staff.filter((s) => !s.pending);
  if (approved.length === 0) {
    view.append(h("div", { class: "empty", style: "padding:24px" }, h("div", { html: icon("user", 44, 1.4) }), h("p", {}, t("staff.none_desc"))));
  } else {
    const list = h("div", { class: "list" });
    approved.forEach((s) => {
      const rooms = state.rooms.filter((r) => roomState(r).staffId === s.id).length;
      list.append(h("div", { class: "row", onClick: () => openUserEditor(s, view) },
        h("div", { class: "row__avatar", style: `background:${s.color}` }, initials(s.name)),
        h("div", { class: "row__body" },
          h("div", { class: "row__title" }, s.name),
          h("div", { class: "row__meta" }, `${t("admin.active")} · ${t("staff.rooms_today", { n: rooms })}${s.password ? " · 🔒" : ""}`)),
        h("div", { class: "row__action", html: icon("chevron", 20) })));
    });
    view.append(list);
  }

  view.append(h("button", { class: "add-tile", style: "margin-top:12px", onClick: () => openUserEditor(null, view) }, iconEl("plus", 18), t("staff.add")));
}

function openUserEditor(s, view) {
  const editing = !!s;
  let color = s?.color || STAFF_COLORS[state.staff.length % STAFF_COLORS.length];
  openSheet({
    title: editing ? s.name : t("staff.new"), size: "dialog",
    body: (el) => {
      const name = h("input", { class: "input", value: s?.name || "", placeholder: t("staff.name_ph"), autocomplete: "off" });
      const pw = h("input", { class: "input", type: "text", value: s?.password || "", placeholder: "••••", autocomplete: "off" });
      el.append(h("div", { class: "field" }, h("label", {}, t("staff.name")), name));
      el.append(h("div", { class: "field" }, h("label", {}, t("staff.set_password")), pw));
      const sw = h("div", { class: "swatch-row" });
      STAFF_COLORS.forEach((c) => { const b = h("button", { type: "button", class: "swatch" + (c === color ? " active" : ""), style: `background:${c}`, onClick: () => { color = c; [...sw.children].forEach((x) => x.classList.remove("active")); b.classList.add("active"); } }); sw.append(b); });
      el.append(h("div", { class: "field" }, h("label", {}, t("staff.color")), sw));
      el.__get = () => ({ name: name.value.trim(), password: pw.value, color });
      setTimeout(() => name.focus(), 140);
    },
    footer: (f, close) => {
      if (editing) f.append(h("button", { class: "btn", style: "flex:0 0 auto;color:var(--terra)", onClick: async () => { if (await confirmSheet(t("staff.delete"), t("staff.delete_msg", { name: s.name }), { okLabel: t("common.delete") })) { await deleteStaff(s.id); close(); renderAdmin(view); toast(t("staff.deleted")); } }, html: icon("trash", 18, 2) }));
      f.append(h("button", { class: "btn btn--primary btn--block", onClick: async (e) => {
        const d = e.target.closest(".sheet").querySelector(".sheet__body").__get();
        if (!d.name) { toast(t("auth.need_name"), "warn"); return; }
        if (editing) await updateStaff(s.id, d);
        else await addStaff(d.name, d.color, { password: d.password, pending: false });
        close(); renderAdmin(view); toast(t("staff.pw_saved"));
      } }, iconEl("check", 18), editing ? t("re.save") : t("re.add")));
    },
  });
}
