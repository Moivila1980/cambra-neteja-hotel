/* ============================================================
   views/incidents.js — Registre i gestió d'incidències
   ============================================================ */
import { h, clear, icon, iconEl, openSheet, toast, confirmSheet, pickImage, compressImage, speechSupported, startDictation } from "../ui.js";
import { t, speechLang } from "../i18n.js";
import {
  state, INCIDENT_CATS, SEVERITIES, roomById, floorById,
  addIncident, updateIncident, deleteIncident, savePhoto, photoURL,
  sessionStaff, staffById, initials,
} from "../store.js";
import { db } from "../db.js";

const catLabel = (k) => t("cat." + k);
const sevLabel = (k) => t("sev." + k);

export function renderIncidents(view) {
  clear(view);
  view.append(h("h1", { class: "view-title" }, t("nav.incidents")));
  view.append(h("p", { class: "view-sub" }, t("inc.subtitle")));

  let filter = view.__incFilter || "open";
  const tabs = h("div", { class: "seg", style: "margin-bottom:14px" });
  [["open", t("inc.tab_open")], ["resolved", t("inc.tab_resolved")], ["all", t("inc.tab_all")]]
    .forEach(([k, l]) => tabs.append(h("button", { class: filter === k ? "active" : "", onClick: () => { view.__incFilter = k; renderIncidents(view); } }, l)));
  view.append(tabs);

  let list = state.incidents.slice();
  if (filter !== "all") list = list.filter((i) => i.status === filter);

  if (list.length === 0) {
    view.append(h("div", { class: "empty" },
      h("div", { html: icon("alert", 54, 1.4) }),
      h("h3", {}, filter === "open" ? t("inc.empty_open") : t("inc.empty_any")),
      h("p", {}, t("inc.empty_desc"))));
  } else {
    const wrap = h("div", { class: "list" });
    list.forEach((inc) => wrap.append(incidentCard(inc, view)));
    view.append(wrap);
  }
  view.append(h("button", { class: "fab", "aria-label": t("inc.new"), onClick: () => openIncidentForm({}) }, h("span", { html: icon("plus", 26, 2.4) })));
}

function incidentCard(inc, view) {
  const room = inc.roomId ? roomById(inc.roomId) : null;
  const floor = room ? floorById(room.floorId) : null;
  const card = h("div", { class: `inc sev-${inc.severity}` + (inc.status === "resolved" ? " resolved" : ""), onClick: () => openIncidentDetail(inc, view) });
  card.append(h("div", { class: "inc__body" },
    h("div", { class: "inc__top" }, h("span", { class: "inc__title" }, inc.title || t("inc.untitled")), h("span", { class: "tag" }, catLabel(inc.category))),
    inc.description ? h("div", { class: "inc__desc" }, truncate(inc.description, 110)) : null,
    h("div", { class: "inc__meta" },
      room ? h("span", {}, `🛏 ${t("common.room", { n: room.number })}${floor ? " · " + floor.name : ""}`) : h("span", {}, t("inc.common_zone")),
      h("span", {}, t("inc.gravity", { x: sevLabel(inc.severity) })),
      (inc.photos?.length) ? h("span", {}, `📷 ${inc.photos.length}`) : null)));
  return card;
}
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function openIncidentDetail(inc, view) {
  const room = inc.roomId ? roomById(inc.roomId) : null;
  openSheet({
    title: inc.title || t("nav.incidents"),
    subtitle: catLabel(inc.category) + " · " + sevLabel(inc.severity),
    body: (el) => {
      if (room) el.append(kv(t("inc.f_room"), `${room.number}`));
      el.append(kv(t("inc.f_cat"), catLabel(inc.category)));
      el.append(kv(t("inc.f_sev"), sevLabel(inc.severity)));
      el.append(kv(t("inc.state"), inc.status === "open" ? t("inc.open") : t("inc.resolved")));
      if (inc.staffId && staffById(inc.staffId)) el.append(kv(t("inc.reported_by"), staffById(inc.staffId).name));
      el.append(kv(t("inc.created"), new Date(inc.createdAt).toLocaleString()));
      if (inc.description) el.append(h("div", { class: "rsec" }, h("div", { class: "section-label" }, t("inc.f_desc")), h("p", { style: "font-size:14px;line-height:1.55" }, inc.description)));
      if (inc.photos?.length) {
        const grid = h("div", { class: "photo-grid", style: "margin-top:10px" });
        inc.photos.forEach((pid) => { const t2 = h("div", { class: "photo-thumb" }); photoURL(pid).then((u) => u && t2.append(h("img", { src: u }))); grid.append(t2); });
        el.append(grid);
      }
    },
    footer: (f, close) => {
      f.append(
        h("button", { class: "btn", style: "flex:0 0 auto;color:var(--terra)", onClick: async () => {
          if (await confirmSheet(t("inc.delete"), t("inc.delete_msg"), { okLabel: t("common.delete") })) { await deleteIncident(inc.id); close(); renderIncidents(view); toast(t("inc.deleted")); }
        } }, iconEl("trash", 18)),
        inc.status === "open"
          ? h("button", { class: "btn btn--primary btn--block", onClick: async () => { await updateIncident(inc.id, { status: "resolved" }); close(); renderIncidents(view); toast(t("inc.resolved_toast")); } }, iconEl("check", 18), t("inc.mark_resolved"))
          : h("button", { class: "btn btn--block", onClick: async () => { await updateIncident(inc.id, { status: "open" }); close(); renderIncidents(view); toast(t("inc.reopened_toast")); } }, t("inc.reopen")));
    },
  });
}
function kv(k, v) { return h("div", { class: "kv" }, h("span", { class: "muted" }, k), h("b", {}, v)); }

export function openIncidentForm({ roomId = null }) {
  const me = sessionStaff();
  const data = { roomId, title: "", description: "", category: "manteniment", severity: "mitjana", photos: [], staffId: me?.id || null };
  const room = roomId ? roomById(roomId) : null;
  let voiceCtl = null;
  openSheet({
    onClose: () => { if (voiceCtl) voiceCtl.stop(); },
    title: t("inc.new"),
    subtitle: room ? t("common.room", { n: room.number }) : t("inc.select_zone"),
    body: (el) => {
      // qui ho reporta
      if (me) el.append(h("div", { class: "reporter" },
        h("span", { class: "reporter__av", style: `background:${me.color}` }, initials(me.name)),
        h("div", {}, h("div", { style: "font-size:11px;color:var(--ink-faint);font-weight:700" }, t("inc.reported_by")), h("div", { style: "font-weight:700" }, me.name))));
      const title = h("input", { class: "input", placeholder: t("inc.title_ph") });
      el.append(field(t("inc.f_title"), title));
      if (!roomId) {
        const sel = h("select", { class: "select" });
        sel.append(h("option", { value: "" }, t("inc.zone_opt")));
        state.floors.forEach((fl) => {
          const og = h("optgroup", { label: fl.name });
          state.rooms.filter((r) => r.floorId === fl.id).forEach((r) => og.append(h("option", { value: r.id }, t("common.room", { n: r.number }))));
          if (og.children.length) sel.append(og);
        });
        sel.addEventListener("change", () => data.roomId = sel.value || null);
        el.append(field(t("inc.f_room"), sel));
      }
      const cat = h("select", { class: "select" });
      INCIDENT_CATS.forEach((c) => cat.append(h("option", { value: c.key }, catLabel(c.key))));
      cat.value = data.category;
      cat.addEventListener("change", () => data.category = cat.value);
      const sev = h("div", { class: "seg" });
      SEVERITIES.forEach((s) => sev.append(h("button", { class: data.severity === s.key ? "active" : "", onClick: () => {
        data.severity = s.key; [...sev.children].forEach((b) => b.classList.remove("active")); sev.children[SEVERITIES.indexOf(s)].classList.add("active");
      } }, sevLabel(s.key))));
      el.append(h("div", { class: "field-row" }, field(t("inc.f_cat"), cat), field(t("inc.f_sev"), sev)));

      // descripció amb dictat per veu
      const desc = h("textarea", { class: "textarea", placeholder: t("inc.desc_ph"), style: "min-height:96px" });
      const descField = h("div", { class: "field" });
      const labelRow = h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin:0 2px 6px" },
        h("label", { style: "font-size:12.5px;font-weight:700;color:var(--ink-soft)" }, t("inc.f_desc")));
      let baseText = "";
      const voiceBtn = h("button", { type: "button", class: "voice-btn",
        onClick: () => {
          if (!speechSupported()) { toast(t("voice.unsupported"), "warn"); return; }
          if (voiceCtl) { voiceCtl.stop(); return; }
          baseText = desc.value;
          voiceBtn.classList.add("rec");
          voiceBtn.innerHTML = ""; voiceBtn.append(h("span", { class: "voice-dot" }), h("span", {}, t("voice.listening")));
          voiceCtl = startDictation({
            lang: speechLang(),
            onInterim: (txt) => { desc.value = (baseText ? baseText + " " : "") + txt; },
            onFinal: (txt) => { baseText = (baseText ? baseText + " " : "") + txt.trim(); desc.value = baseText; },
            onEnd: () => { voiceCtl = null; voiceBtn.classList.remove("rec"); voiceBtn.innerHTML = ""; voiceBtn.append(h("span", { html: icon("mic", 16, 2) }), h("span", {}, t("voice.start"))); },
            onError: (err) => { voiceCtl = null; voiceBtn.classList.remove("rec"); toast(err === "not-allowed" ? t("voice.unsupported") : t("voice.unsupported"), "warn"); },
          });
        } },
        h("span", { html: icon("mic", 16, 2) }), h("span", {}, t("voice.start")));
      if (speechSupported()) labelRow.append(voiceBtn);
      descField.append(labelRow, desc);
      el.append(descField);

      const photoGrid = h("div", { class: "photo-grid" });
      const renderPhotos = () => {
        clear(photoGrid);
        data.photos.forEach((pid) => {
          const t2 = h("div", { class: "photo-thumb" }, h("button", { onClick: async () => { await db.del("photos", pid); data.photos = data.photos.filter((x) => x !== pid); renderPhotos(); }, html: "" }));
          t2.lastChild.innerHTML = icon("x", 14, 2.5);
          photoURL(pid).then((u) => u && t2.prepend(h("img", { src: u })));
          photoGrid.append(t2);
        });
        photoGrid.append(h("button", { class: "photo-add", type: "button", onClick: async () => {
          try {
            const file = await pickImage(); if (!file) return;
            const blob = await compressImage(file); if (!blob) { toast(t("photo.error"), "err"); return; }
            const id = await savePhoto(blob);
            data.photos.push(id); renderPhotos();
          } catch (e) { toast(t("photo.error"), "err"); }
        } }, h("span", { html: icon("camera", 24, 1.8) }), t("common.add")));
      };
      renderPhotos();
      el.append(h("div", { class: "field" }, h("label", {}, t("room.photos")), photoGrid));
      el.__getData = () => ({ ...data, title: title.value.trim(), description: desc.value.trim() });
    },
    footer: (f, close) => {
      f.append(
        h("button", { class: "btn", onClick: () => close() }, t("common.cancel")),
        h("button", { class: "btn btn--primary btn--block", onClick: async (e) => {
          const body = e.target.closest(".sheet").querySelector(".sheet__body");
          const d = body.__getData();
          if (!d.title) { toast(t("inc.need_title"), "warn"); return; }
          await addIncident(d); close(); toast(t("inc.saved"));
          const view = document.querySelector("#view");
          if (location.hash === "#incidents") renderIncidents(view);
          else window.__refreshHeader?.();
        } }, iconEl("check", 18), t("inc.save")));
    },
  });
}
function field(label, input) { return h("div", { class: "field" }, h("label", {}, label), input); }
