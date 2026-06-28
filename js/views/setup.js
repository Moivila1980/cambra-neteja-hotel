/* ============================================================
   views/setup.js — Configuració: idioma, marca, pisos, habitacions,
   personal, assignacions, plantilles de checklist i dades.
   ============================================================ */
import { h, clear, icon, iconEl, openSheet, toast, confirmSheet, promptSheet, pickImage, compressImage } from "../ui.js";
import { t, LANGS, getLang } from "../i18n.js";
import { PRIMARY_SWATCHES, ACCENT_SWATCHES, BG_THEMES, FONT_PAIRS, SCALES, DEFAULT_APPEARANCE } from "../theme.js";
import {
  state, ROOM_TYPES, CLEAN_TYPES, STAFF_COLORS,
  roomsOfFloor, floorById, roomById, staffById, roomState, initials,
  addFloor, updateFloor, deleteFloor,
  addRoom, addRoomsBulk, updateRoom, deleteRoom,
  addStaff, updateStaff, deleteStaff,
  assignRoom, assignRoomSilent, notify, saveConfig, saveConfigSilent, saveChecklistTemplate, setLanguage,
  saveAppearance, resetAppearance, checklistTemplate,
  saveStructureTemplate, applyStructureTemplate, deleteStructureTemplate,
  isChecklistRequired, setChecklistRequired,
  exportData, importData, seedDemo,
} from "../store.js";

const appr = () => ({ ...DEFAULT_APPEARANCE, ...(state.config.appearance || {}) });

let activeSection = "estructura";

export function renderSetup(view) {
  clear(view);
  view.append(h("h1", { class: "view-title" }, t("setup.title")));
  view.append(h("p", { class: "view-sub" }, t("setup.subtitle")));

  view.append(languageCard(view));
  view.append(brandCard(view));

  const tabs = h("div", { class: "subtabs", style: "margin:16px 0" });
  [["estructura", t("setup.tab_structure")], ["personal", t("setup.tab_staff")], ["plantilles", t("setup.tab_templates")], ["aparenca", t("setup.tab_appearance")], ["dades", t("setup.tab_data")]]
    .forEach(([k, l]) => tabs.append(h("button", { class: "subtab" + (activeSection === k ? " active" : ""), onClick: () => { activeSection = k; renderSetup(view); } }, l)));
  view.append(tabs);

  if (activeSection === "estructura") view.append(structureSection(view));
  else if (activeSection === "personal") view.append(personalSection(view));
  else if (activeSection === "plantilles") view.append(templatesSection(view));
  else if (activeSection === "aparenca") view.append(appearanceSection(view));
  else view.append(dataSection(view));
}

/* ---------- Idioma ---------- */
function languageCard(view) {
  const row = h("div", { class: "lang-row" });
  LANGS.forEach((l) => row.append(h("button", { class: "lang-opt" + (getLang() === l.key ? " active" : ""),
    onClick: async () => { await setLanguage(l.key); } },
    h("span", { class: "lang-flag" }, l.flag), h("span", {}, l.label))));
  return h("div", { class: "field", style: "margin-top:8px" }, h("label", {}, t("lang.label")), row);
}

/* ---------- Marca: logo + nom ---------- */
function fileToDataURL(blob) { return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }); }

function brandCard(view) {
  const card = h("div", { class: "card card-pad brand-card", style: "margin-top:8px" });
  const logoBox = h("button", { class: "brand-logo" + (state.config.logo ? " has-img" : ""), "aria-label": "logo", type: "button",
    onClick: async () => {
      try {
        const file = await pickImage({ capture: false }); if (!file) return;
        toast(t("brand.logo_processing"));
        const blob = await compressImage(file, 320, 0.85);
        if (!blob) { toast(t("brand.logo_error"), "err"); return; }
        const dataURL = await fileToDataURL(blob);
        await saveConfig({ logo: dataURL }); window.__refreshHeader?.(); renderSetup(view); toast(t("brand.logo_updated"));
      } catch (e) { toast(t("brand.logo_error"), "err"); }
    } });
  if (state.config.logo) logoBox.append(h("img", { src: state.config.logo, alt: "Logo" }));
  else logoBox.innerHTML = icon("camera", 24, 1.8);
  logoBox.append(h("span", { class: "brand-logo__edit", html: icon(state.config.logo ? "edit" : "plus", 13, 2.5) }));

  const input = h("input", { class: "input", value: state.config.hotelName, placeholder: t("brand.hotel_name"), autocomplete: "off" });
  let to;
  input.addEventListener("input", () => {
    clearTimeout(to);
    // desa SENSE re-render perquè l'input no perdi el focus mentre escrius
    to = setTimeout(async () => { await saveConfigSilent({ hotelName: input.value.trim() || "—" }); window.__refreshHeader?.(); }, 350);
  });

  const right = h("div", { style: "flex:1;min-width:0" },
    h("label", { style: "display:block;font-size:12.5px;font-weight:700;color:var(--ink-soft);margin:0 2px 6px" }, t("brand.hotel_name")),
    input,
    state.config.logo
      ? h("button", { class: "btn btn--sm btn--ghost", style: "margin-top:8px;padding-left:4px", onClick: async () => { await saveConfig({ logo: null }); window.__refreshHeader?.(); renderSetup(view); toast(t("brand.logo_removed")); } }, iconEl("trash", 15), t("brand.remove_logo"))
      : h("p", { class: "muted", style: "font-size:11.5px;margin-top:8px" }, t("brand.tap_logo")));
  card.append(h("div", { style: "display:flex;gap:14px;align-items:flex-start" }, logoBox, right));
  return card;
}

/* ============================================================ ESTRUCTURA ============================================================ */
function promptNewFloor(view) {
  const n = state.floors.length + 1;
  const suggestions = [
    t("struct.floor_default", { n }),
    t("zone.wing_a"), t("zone.wing_b"),
    t("zone.right"), t("zone.left"),
    `${t("zone.wing_a")} · ${t("struct.floor_default", { n })}`,
    `${t("zone.wing_b")} · ${t("struct.floor_default", { n })}`,
  ];
  openSheet({
    title: t("struct.new_floor"), size: "dialog",
    body: (el) => {
      const input = h("input", { class: "input", value: t("struct.floor_default", { n }), placeholder: t("struct.floor_name"), autocomplete: "off" });
      el.append(h("div", { class: "field" }, h("label", {}, t("struct.floor_name")), input));
      el.append(h("p", { class: "muted", style: "font-size:12px;margin:0 2px 8px" }, t("zone.hint")));
      el.append(h("div", { class: "section-label", style: "margin:6px 2px 8px" }, t("zone.quick")));
      const chips = h("div", { class: "chips", style: "flex-wrap:wrap;overflow:visible" });
      suggestions.forEach((s) => chips.append(h("button", { type: "button", class: "chip", onClick: () => { input.value = s; input.focus(); } }, s)));
      el.append(chips);
      setTimeout(() => { input.focus(); input.select?.(); }, 140);
      el.__get = () => input.value.trim();
    },
    footer: (f, close) => f.append(
      h("button", { class: "btn", onClick: () => close() }, t("common.cancel")),
      h("button", { class: "btn btn--primary btn--block", onClick: async (e) => {
        const name = e.target.closest(".sheet").querySelector(".sheet__body").__get();
        await addFloor(name || t("struct.floor_default", { n })); close(); renderSetup(view);
      } }, iconEl("check", 18), t("re.add"))
    ),
  });
}

function structureSection(view) {
  const frag = h("div");
  // capçalera amb acció ràpida d'afegir pis
  frag.append(h("div", { class: "sec-head", style: "margin-top:6px" },
    h("div", { class: "section-label", style: "margin:0" }, t("struct.floors_rooms")),
    state.floors.length ? h("button", { class: "btn btn--sm btn--primary", onClick: () => promptNewFloor(view) }, iconEl("plus", 16), t("struct.add_floor")) : null
  ));
  if (state.floors.length === 0) frag.append(h("div", { class: "empty", style: "padding:30px 20px" },
    h("div", { html: icon("layers", 46, 1.4) }), h("h3", {}, t("struct.no_floors")), h("p", {}, t("struct.no_floors_desc"))));
  state.floors.forEach((floor) => frag.append(floorBlock(floor, view)));
  frag.append(h("button", { class: "add-tile", style: "margin-top:12px", onClick: () => promptNewFloor(view) }, iconEl("plus", 18), t("struct.add_floor")));
  frag.append(structureTemplatesCard(view));
  return frag;
}

function structureTemplatesCard(view) {
  const templates = state.config.structureTemplates || [];
  const card = h("div", { class: "card card-pad", style: "margin-top:18px" });
  card.append(h("div", { class: "floor-head", style: "margin:0 0 4px" }, h("h3", { style: "font-size:16px" }, t("tplstr.section"))));
  card.append(h("p", { class: "muted", style: "font-size:12.5px;margin:0 0 12px" }, t("tplstr.hint")));

  // desar estructura actual
  card.append(h("button", { class: "btn btn--primary btn--block", onClick: async () => {
    if (!state.floors.length) { toast(t("tplstr.empty"), "warn"); return; }
    const name = await promptSheet(t("tplstr.save"), { label: t("tplstr.name"), placeholder: t("tplstr.name_ph"), value: state.config.hotelName || "" });
    if (name === null) return;
    await saveStructureTemplate(name); renderSetup(view); toast(t("tplstr.saved"));
  } }, iconEl("download", 18), t("tplstr.save")));

  // llista de plantilles desades
  if (templates.length) {
    const list = h("div", { class: "list", style: "margin-top:12px" });
    templates.slice().reverse().forEach((tpl) => {
      list.append(h("div", { class: "row" },
        h("div", { class: "row__avatar", style: "background:var(--teal)", html: icon("layers", 20, 2) }),
        h("div", { class: "row__body" },
          h("div", { class: "row__title" }, tpl.name),
          h("div", { class: "row__meta" }, t("tplstr.meta", { f: tpl.floors.length, r: tpl.rooms.length }))),
        h("button", { class: "btn btn--sm", style: "flex:0 0 auto", onClick: async () => {
          if (state.floors.length && !(await confirmSheet(t("tplstr.apply"), t("tplstr.apply_confirm"), { okLabel: t("tplstr.apply") }))) return;
          await applyStructureTemplate(tpl.id); renderSetup(view); toast(t("tplstr.applied"));
        } }, iconEl("upload", 15), t("tplstr.apply")),
        h("button", { class: "icon-sm", style: "color:var(--terra);flex:0 0 auto", onClick: async () => {
          if (await confirmSheet(t("tplstr.section"), t("tplstr.del_confirm"), { okLabel: t("common.delete") })) { await deleteStructureTemplate(tpl.id); renderSetup(view); toast(t("tplstr.deleted")); }
        }, html: icon("trash", 17, 2) })
      ));
    });
    card.append(list);
  } else {
    card.append(h("p", { class: "muted", style: "font-size:12.5px;text-align:center;margin-top:12px" }, t("tplstr.none")));
  }
  return card;
}

function floorBlock(floor, view) {
  const rooms = roomsOfFloor(floor.id);
  const block = h("div", { class: "card card-pad", style: "margin-bottom:12px" });
  block.append(h("div", { class: "floor-head", style: "margin:0 0 10px" },
    h("h3", { style: "font-size:17px" }, floor.name),
    h("div", { style: "display:flex;gap:6px" },
      iconBtn("edit", async () => { const n = await promptSheet(t("struct.rename_floor"), { label: t("struct.name"), value: floor.name }); if (n) { await updateFloor(floor.id, { name: n }); renderSetup(view); } }),
      iconBtn("trash", async () => { if (await confirmSheet(t("struct.delete_floor"), t("struct.delete_floor_msg", { name: floor.name, n: rooms.length }), { okLabel: t("common.delete") })) { await deleteFloor(floor.id); renderSetup(view); toast(t("struct.floor_deleted")); } }, "var(--terra)"))));

  if (rooms.length) {
    const grid = h("div", { class: "room-grid" });
    rooms.forEach((r) => grid.append(h("button", { class: "mini-room", onClick: () => openRoomEditor(r, view) },
      h("span", { class: "mini-room__num" }, r.number), h("span", { class: "mini-room__type" }, t("type." + r.type)))));
    block.append(grid);
  } else block.append(h("p", { class: "muted", style: "font-size:13px;margin:4px 0 10px" }, t("struct.no_rooms")));

  block.append(h("div", { style: "display:flex;gap:8px;margin-top:12px" },
    h("button", { class: "btn btn--sm btn--primary btn--block", onClick: () => openBulkRooms(floor, view) }, iconEl("copy", 16), t("struct.add_bulk")),
    h("button", { class: "btn btn--sm", style: "flex:0 0 auto", onClick: () => openRoomEditor(null, view, floor.id) }, iconEl("plus", 16))));
  return block;
}

function openRoomEditor(room, view, floorId) {
  const editing = !!room;
  let type = room?.type || "doble";
  openSheet({
    title: editing ? t("room.title", { n: room.number }) : t("re.new"),
    body: (el) => {
      const num = h("input", { class: "input", value: room?.number || "", placeholder: t("re.number_ph") });
      el.append(h("div", { class: "field" }, h("label", {}, t("re.number")), num));
      el.append(h("div", { class: "field" }, h("label", {}, t("re.type")), typePicker(type, (x) => type = x)));
      el.__get = () => ({ number: num.value.trim(), type });
    },
    footer: (f, close) => {
      if (editing) f.append(iconBtnLg("trash", "var(--terra)", async () => { if (await confirmSheet(t("re.delete"), t("re.delete_msg", { n: room.number }), { okLabel: t("common.delete") })) { await deleteRoom(room.id); close(); renderSetup(view); toast(t("re.deleted")); } }));
      f.append(h("button", { class: "btn btn--primary btn--block", onClick: async (e) => {
        const d = e.target.closest(".sheet").querySelector(".sheet__body").__get();
        if (!d.number) { toast(t("re.need_number"), "warn"); return; }
        if (editing) await updateRoom(room.id, d); else await addRoom(floorId, d.number, d.type);
        close(); renderSetup(view);
      } }, iconEl("check", 18), editing ? t("re.save") : t("re.add")));
    },
  });
}

function openBulkRooms(floor, view) {
  openSheet({
    title: t("bulk.title"), subtitle: floor.name,
    body: (el) => {
      const count = h("input", { class: "input input--num", type: "number", value: "10", min: "1", max: "500", inputmode: "numeric" });
      const start = h("input", { class: "input", type: "number", value: "101", inputmode: "numeric" });
      const prefix = h("input", { class: "input", placeholder: t("bulk.prefix_ph") });
      let type = "doble";
      const presets = h("div", { class: "chips", style: "margin-top:8px" });
      const syncPresets = () => [...presets.children].forEach((c) => c.classList.toggle("active", c.textContent === String(count.value).trim()));
      [5, 10, 15, 20, 30, 50, 100].forEach((n) => presets.append(h("button", { type: "button", class: "chip", onClick: () => { count.value = String(n); syncPresets(); } }, String(n))));
      count.addEventListener("input", syncPresets);
      syncPresets();
      // camp editable PROMINENT + dreceres ràpides
      el.append(h("div", { class: "field" }, h("label", {}, t("bulk.how_many")), count, presets));
      el.append(h("div", { class: "field" }, h("label", {}, t("bulk.start")), start));
      el.append(h("div", { class: "field" }, h("label", {}, t("bulk.prefix")), prefix));
      el.append(h("div", { class: "field" }, h("label", {}, t("bulk.type")), typePicker(type, (x) => type = x)));
      el.append(h("div", { class: "note-box" }, t("bulk.note")));
      el.__get = () => ({ count: Math.max(1, Number(count.value) || 1), start: Number(start.value) || 1, prefix: prefix.value.trim(), type });
    },
    footer: (f, close) => f.append(
      h("button", { class: "btn", onClick: () => close() }, t("common.cancel")),
      h("button", { class: "btn btn--primary btn--block", onClick: async (e) => {
        const d = e.target.closest(".sheet").querySelector(".sheet__body").__get();
        await addRoomsBulk(floor.id, d.count, d.start, d.prefix, d.type); close(); renderSetup(view); toast(t("bulk.created", { n: d.count }));
      } }, iconEl("check", 18), t("bulk.create"))),
  });
}

function typePicker(current, onChange) {
  const sel = h("select", { class: "select" });
  ROOM_TYPES.forEach((ty) => sel.append(h("option", { value: ty }, t("type." + ty))));
  sel.value = current;
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

/* ============================================================ PERSONAL ============================================================ */
function personalSection(view) {
  const frag = h("div");
  frag.append(h("div", { class: "section-label", style: "margin-top:6px" }, t("staff.section")));
  if (state.staff.length === 0) frag.append(h("div", { class: "empty", style: "padding:30px 20px" },
    h("div", { html: icon("user", 46, 1.4) }), h("h3", {}, t("staff.none")), h("p", {}, t("staff.none_desc"))));

  const list = h("div", { class: "list" });
  state.staff.forEach((s) => {
    const assigned = state.rooms.filter((r) => roomState(r).staffId === s.id).length;
    list.append(h("div", { class: "row", onClick: () => openStaffEditor(s, view) },
      h("div", { class: "row__avatar", style: `background:${s.color}` }, initials(s.name)),
      h("div", { class: "row__body" }, h("div", { class: "row__title" }, s.name), h("div", { class: "row__meta" }, t("staff.rooms_today", { n: assigned }))),
      h("div", { class: "row__action", html: icon("chevron", 20) })));
  });
  frag.append(list);
  frag.append(h("button", { class: "add-tile", style: "margin-top:12px", onClick: async () => { const name = await promptSheet(t("staff.new"), { label: t("staff.name"), placeholder: t("staff.name_ph") }); if (!name) return; await addStaff(name); renderSetup(view); } }, iconEl("plus", 18), t("staff.add")));

  if (state.staff.length && state.rooms.length) {
    frag.append(h("div", { class: "section-label" }, t("staff.quick_assign")));
    frag.append(h("p", { class: "muted", style: "font-size:13px;margin:0 4px 10px" }, t("staff.quick_hint")));
    frag.append(quickAssign(view));
  }
  return frag;
}

function openStaffEditor(s, view) {
  let color = s.color;
  openSheet({
    title: t("staff.edit"),
    body: (el) => {
      const name = h("input", { class: "input", value: s.name });
      el.append(h("div", { class: "field" }, h("label", {}, t("staff.name")), name));
      const swWrap = h("div");
      const renderSw = () => { clear(swWrap); swWrap.append(colorRow(STAFF_COLORS, color, color, (c) => { color = c; renderSw(); })); };
      renderSw();
      el.append(h("div", { class: "field" }, h("label", {}, t("staff.color")), swWrap));
      el.__get = () => ({ name: name.value.trim() || s.name, color });
    },
    footer: (f, close) => f.append(
      iconBtnLg("trash", "var(--terra)", async () => { if (await confirmSheet(t("staff.delete"), t("staff.delete_msg", { name: s.name }), { okLabel: t("common.delete") })) { await deleteStaff(s.id); close(); renderSetup(view); toast(t("staff.deleted")); } }),
      h("button", { class: "btn btn--primary btn--block", onClick: async (e) => { const d = e.target.closest(".sheet").querySelector(".sheet__body").__get(); await updateStaff(s.id, d); close(); renderSetup(view); } }, iconEl("check", 18), t("common.save"))),
  });
}

let quickStaffId = null;
function quickAssign(view) {
  const wrap = h("div", { class: "card card-pad" });
  if (!quickStaffId || !staffById(quickStaffId)) quickStaffId = state.staff[0]?.id;

  const chips = h("div", { class: "chips" });
  const renderChips = () => {
    clear(chips);
    state.staff.forEach((s) => chips.append(h("button", { class: "chip" + (quickStaffId === s.id ? " active" : ""),
      style: quickStaffId === s.id ? `background:${s.color};border-color:${s.color};color:#fff` : "",
      onClick: () => { quickStaffId = s.id; renderChips(); renderRooms(); } },
      h("span", { class: "dot", style: `background:${quickStaffId === s.id ? "#fff" : s.color}` }), s.name)));
  };
  const hint = h("p", { class: "muted", style: "font-size:12px;margin:10px 4px 4px" }, t("staff.drag_hint"));
  const roomsWrap = h("div", { style: "margin-top:6px", class: "assign-area" });

  let dragging = false, dragMode = null;
  const touched = new Set();
  const tileOf = (x, y) => { const el = document.elementFromPoint(x, y); return el ? el.closest(".mini-room[data-room-id]") : null; };
  const tintTile = (tile, staff) => {
    if (staff) {
      tile.style.background = `color-mix(in srgb, ${staff.color} 22%, var(--surface-2))`;
      tile.style.borderColor = staff.color;
      const num = tile.querySelector(".mini-room__num"); if (num) num.style.color = staff.color;
    } else {
      tile.style.background = ""; tile.style.borderColor = "";
      const num = tile.querySelector(".mini-room__num"); if (num) num.style.color = "";
    }
  };
  const paintTile = (tile, staffId) => {
    const staff = staffId ? staffById(staffId) : null;
    tile.classList.toggle("mini-room--sel", staffId === quickStaffId);
    tintTile(tile, staff);
  };
  const applyTile = async (tile) => {
    if (!tile || touched.has(tile)) return;
    touched.add(tile);
    const target = dragMode === "add" ? quickStaffId : null;
    await assignRoomSilent(tile.dataset.roomId, target);
    paintTile(tile, target);
  };
  // moviment a nivell de document amb interpolació: marca TOTES les habitacions del
  // recorregut encara que moguis ràpid (mostreja punts entre l'última posició i l'actual).
  let lastX = null, lastY = null;
  const sampleLine = (x, y) => {
    if (lastX != null) {
      const steps = Math.max(1, Math.round(Math.hypot(x - lastX, y - lastY) / 8));
      for (let i = 1; i <= steps; i++) { const tile = tileOf(lastX + (x - lastX) * i / steps, lastY + (y - lastY) * i / steps); if (tile) applyTile(tile); }
    } else { const tile = tileOf(x, y); if (tile) applyTile(tile); }
    lastX = x; lastY = y;
  };
  const onMove = (e) => { if (!dragging) return; sampleLine(e.clientX, e.clientY); };
  const onOver = (e) => { if (!dragging) return; const tile = e.target?.closest?.(".mini-room[data-room-id]"); if (tile) applyTile(tile); };
  const onUp = () => {
    if (!dragging) return;
    dragging = false; touched.clear(); lastX = lastY = null;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    notify();
  };
  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return; // només botó esquerre
    if (!quickStaffId) { toast(t("staff.pick"), "warn"); return; }
    const tile = e.target.closest(".mini-room[data-room-id]"); if (!tile) return;
    e.preventDefault(); dragging = true; touched.clear();
    lastX = e.clientX; lastY = e.clientY;
    const mine = roomState(roomById(tile.dataset.roomId)).staffId === quickStaffId;
    dragMode = mine ? "remove" : "add";
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    applyTile(tile);
  };
  roomsWrap.addEventListener("pointerdown", onDown);
  roomsWrap.addEventListener("pointerover", onOver);

  const renderRooms = () => {
    clear(roomsWrap);
    state.floors.forEach((fl) => {
      const rooms = roomsOfFloor(fl.id); if (!rooms.length) return;
      const mineCount = rooms.filter((r) => roomState(r).staffId === quickStaffId).length;
      roomsWrap.append(h("div", { class: "floor-head assign-floor", style: "margin:12px 4px 8px" },
        h("h3", { style: "font-size:14px" }, fl.name),
        h("button", { class: "btn btn--sm btn--ghost", style: "padding:4px 8px",
          onClick: async () => { const all = mineCount === rooms.length; for (const r of rooms) await assignRoomSilent(r.id, all ? null : quickStaffId); notify(); } },
          mineCount === rooms.length ? t("staff.remove_floor") : t("staff.whole_floor"))));
      const grid = h("div", { class: "room-grid" });
      rooms.forEach((r) => {
        const rs = roomState(r);
        const staff = rs.staffId ? staffById(rs.staffId) : null;
        const tile = h("div", { class: "mini-room" + (rs.staffId === quickStaffId ? " mini-room--sel" : ""), dataset: { roomId: r.id } },
          h("span", { class: "mini-room__num" }, r.number));
        tintTile(tile, staff);
        grid.append(tile);
      });
      roomsWrap.append(grid);
    });
  };
  renderChips(); renderRooms();
  wrap.append(chips, hint, roomsWrap);
  return wrap;
}

/* ============================================================ PLANTILLES ============================================================ */
function templatesSection(view) {
  const frag = h("div");
  frag.append(h("p", { class: "muted", style: "font-size:13px;margin:6px 4px 12px" }, t("tpl.hint")));
  CLEAN_TYPES.forEach((ct) => frag.append(templateCard(ct, view)));
  return frag;
}
function templateCard(type, view) {
  const items = checklistTemplate(type.key);
  const card = h("div", { class: "card card-pad", style: "margin-bottom:14px" });
  card.append(h("div", { class: "floor-head", style: "margin:0 0 10px" },
    h("h3", { style: "font-size:16px" }, t("tpl.cleaning_x", { x: t("clean." + type.key).toLowerCase() })), h("span", {}, t("tpl.tasks", { n: items.length }))));

  // opcional / obligatòria
  const required = isChecklistRequired(type.key);
  const seg = h("div", { class: "seg", style: "margin-bottom:8px" });
  seg.append(
    h("button", { class: !required ? "active" : "", onClick: async () => { await setChecklistRequired(type.key, false); renderSetup(view); } }, t("req.optional")),
    h("button", { class: required ? "active" : "", onClick: async () => { await setChecklistRequired(type.key, true); renderSetup(view); } }, t("req.required"))
  );
  card.append(seg);
  card.append(h("p", { class: "muted", style: "font-size:11.5px;margin:0 0 12px" }, t("req.hint")));

  const list = h("div", { class: "check-list" });
  const persist = () => saveChecklistTemplate(type.key, items.slice());
  items.forEach((label, idx) => list.append(h("div", { class: "check", style: "background:var(--surface-2)" },
    h("span", { class: "row__body", style: "font-size:14px;font-weight:600" }, label),
    h("button", { class: "check__del", onClick: async () => { items.splice(idx, 1); await persist(); renderSetup(view); }, html: icon("trash", 16, 2) }))));
  card.append(list);
  card.append(h("button", { class: "add-tile", style: "margin-top:10px", onClick: async () => { const tk = await promptSheet(t("tpl.new_task"), { label: t("tpl.task_label"), placeholder: t("tpl.task_ph") }); if (!tk) return; items.push(tk); await persist(); renderSetup(view); } }, iconEl("plus", 16), t("tpl.add_task")));
  return card;
}

/* ============================================================ DADES ============================================================ */
function dataSection(view) {
  const frag = h("div");
  frag.append(h("div", { class: "section-label", style: "margin-top:6px" }, t("data.backup")));
  frag.append(h("div", { class: "list" },
    actionRow("download", t("data.export"), t("data.export_desc"), async () => {
      toast(t("data.exporting"));
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = h("a", { href: URL.createObjectURL(blob), download: `cambra-backup-${state.date}.json` });
      document.body.append(a); a.click(); a.remove(); toast(t("data.exported"));
    }),
    actionRow("upload", t("data.import"), t("data.import_desc"), () => importFlow(view))));

  frag.append(h("div", { class: "section-label" }, t("data.tools")));
  frag.append(h("div", { class: "list" },
    actionRow("sparkle", t("data.demo"), t("data.demo_desc"), async () => {
      if (state.rooms.length && !(await confirmSheet(t("data.demo"), t("data.demo_confirm"), { danger: false, okLabel: t("common.add") }))) return;
      await seedDemo(); renderSetup(view); window.__refreshHeader?.(); toast(t("data.demo_loaded"));
    }),
    actionRow("trash", t("data.wipe"), t("data.wipe_desc"), async () => {
      if (await confirmSheet(t("data.wipe"), t("data.wipe_confirm"), { okLabel: t("data.wipe_ok") })) {
        const { db } = await import("../db.js"); await db.clearAll();
        const { loadState } = await import("../store.js"); await loadState(); renderSetup(view); window.__refreshHeader?.(); toast(t("data.wiped"));
      }
    }, "var(--terra)")));

  frag.append(h("p", { class: "muted", style: "text-align:center;font-size:12px;margin-top:20px" }, t("data.footer")));
  return frag;
}

function importFlow(view) {
  const input = h("input", { type: "file", accept: "application/json", style: "display:none" });
  input.addEventListener("change", async () => {
    const file = input.files?.[0]; input.remove(); if (!file) return;
    if (!(await confirmSheet(t("data.import"), t("data.import_confirm"), { okLabel: t("data.import") }))) return;
    try { const obj = JSON.parse(await file.text()); await importData(obj); renderSetup(view); window.__refreshHeader?.(); toast(t("data.imported")); }
    catch (e) { toast(t("data.invalid"), "err"); }
  });
  document.body.append(input); input.click();
}

/* ============================================================ APARENÇA ============================================================ */
function appearanceSection(view) {
  const a = appr();
  const frag = h("div");
  frag.append(h("p", { class: "muted", style: "font-size:13px;margin:6px 4px 14px" }, t("ap.intro")));

  // Color principal
  frag.append(h("div", { class: "section-label", style: "margin-top:4px" }, t("ap.primary")));
  frag.append(colorRow(PRIMARY_SWATCHES, a.primary, "#0E5249", async (c) => { await saveAppearance({ primary: c }); renderSetup(view); }));

  // Color d'accent
  frag.append(h("div", { class: "section-label" }, t("ap.accent")));
  frag.append(colorRow(ACCENT_SWATCHES, a.accent, "#C2603D", async (c) => { await saveAppearance({ accent: c }); renderSetup(view); }));

  // Fons
  frag.append(h("div", { class: "section-label" }, t("ap.background")));
  const bgRow = h("div", { class: "theme-grid" });
  Object.keys(BG_THEMES).forEach((key) => {
    const v = BG_THEMES[key].vars;
    bgRow.append(h("button", { class: "theme-card" + (a.bg === key ? " active" : ""), onClick: async () => { await saveAppearance({ bg: key }); renderSetup(view); } },
      h("span", { class: "theme-prev", style: `background:${v["--linen"]};border-color:${v["--line"]}` },
        h("span", { style: `background:${v["--surface-2"]};border:1px solid ${v["--line"]}` }),
        h("span", { class: "theme-prev__dot", style: `background:${a.primary}` })),
      h("span", { class: "theme-card__lbl" }, t("ap.bg." + key))));
  });
  // fons de color personalitzat
  const bgCustomColor = a.bgColor || "#0E5249";
  const customCard = h("label", { class: "theme-card" + (a.bg === "custom" ? " active" : "") },
    h("span", { class: "theme-prev", style: `background:color-mix(in srgb, ${bgCustomColor} 12%, #fff);border-color:color-mix(in srgb, ${bgCustomColor} 24%, #fff)` },
      h("span", { style: "background:#fff;border:1px solid var(--line)" }),
      h("span", { class: "theme-prev__dot", style: `background:${bgCustomColor}` })),
    h("span", { class: "theme-card__lbl" }, t("ap.custom")));
  const bgInput = h("input", { type: "color", value: bgCustomColor, class: "color-input" });
  bgInput.addEventListener("input", async () => { await saveAppearance({ bg: "custom", bgColor: bgInput.value }); renderSetup(view); });
  customCard.prepend(bgInput);
  bgRow.append(customCard);
  frag.append(bgRow);

  // Tipografia
  frag.append(h("div", { class: "section-label" }, t("ap.font")));
  const fontRow = h("div", { class: "list" });
  Object.keys(FONT_PAIRS).forEach((key) => {
    const fp = FONT_PAIRS[key];
    fontRow.append(h("button", { class: "font-card" + (a.font === key ? " active" : ""), onClick: async () => { await saveAppearance({ font: key }); renderSetup(view); } },
      h("span", { style: `font-family:${fp.display};font-size:21px;font-weight:600` }, "Ag"),
      h("div", { style: "flex:1;text-align:left;min-width:0" },
        h("div", { style: `font-family:${fp.display};font-weight:700;font-size:15px` }, t("ap.font." + key)),
        h("div", { style: `font-family:${fp.body};font-size:12px;color:var(--ink-faint)`, }, t("ap.sample"))),
      a.font === key ? h("span", { class: "font-check", html: icon("check", 16, 3) }) : null));
  });
  frag.append(fontRow);

  // Mida del text
  frag.append(h("div", { class: "section-label" }, t("ap.size")));
  const sizeSeg = h("div", { class: "seg" });
  Object.keys(SCALES).forEach((key) => sizeSeg.append(h("button", { class: a.scale === key ? "active" : "", onClick: async () => { await saveAppearance({ scale: key }); renderSetup(view); } }, t("ap.size." + key))));
  frag.append(sizeSeg);

  // Restablir
  frag.append(h("button", { class: "btn btn--block", style: "margin-top:20px;color:var(--terra)", onClick: async () => { await resetAppearance(); renderSetup(view); toast(t("ap.reset_done")); } }, iconEl("trash", 17), t("ap.reset")));
  return frag;
}

function colorRow(swatches, current, def, onPick) {
  const row = h("div", { class: "swatch-row", style: "align-items:center" });
  swatches.forEach((c) => row.append(h("button", { class: "swatch swatch--lg" + (current?.toLowerCase() === c.toLowerCase() ? " active" : ""), style: `background:${c}`, onClick: () => onPick(c) })));
  // selector lliure
  const custom = h("input", { type: "color", value: current || def, class: "color-input", title: t("ap.custom") });
  custom.addEventListener("input", () => onPick(custom.value));
  row.append(h("label", { class: "swatch swatch--lg swatch--custom" }, custom, h("span", { html: icon("edit", 15, 2) })));
  return row;
}

/* ---------- Helpers ---------- */
function actionRow(ic, title, meta, onClick, color) {
  return h("div", { class: "row", onClick },
    h("div", { class: "row__avatar", style: `background:${color || "var(--teal)"}`, html: icon(ic, 20, 2) }),
    h("div", { class: "row__body" }, h("div", { class: "row__title" }, title), h("div", { class: "row__meta" }, meta)),
    h("div", { class: "row__action", html: icon("chevron", 20) }));
}
function iconBtn(name, onClick, color) { return h("button", { class: "icon-sm", style: color ? `color:${color}` : "", onClick: (e) => { e.stopPropagation(); onClick(); }, html: icon(name, 18, 2) }); }
function iconBtnLg(name, color, onClick) { return h("button", { class: "btn", style: `flex:0 0 auto;color:${color}`, onClick, html: icon(name, 18, 2) }); }
