/* ============================================================
   store.js — Estat central, constants del domini i accions
   ============================================================ */
import { db, uid } from "./db.js";
import { setLangCode, dateParts, getLang, defaultChecklist, t } from "./i18n.js";

/* ---------- Constants del domini (etiquetes via i18n: t('status.<key>')…) ---------- */

export const STATUSES = [
  { key: "brut", cls: "brut" },
  { key: "en_proces", cls: "en_proces" },
  { key: "net", cls: "net" },
  { key: "revisat", cls: "revisat" },
  { key: "no_molestar", cls: "no_molestar" },
  { key: "fora_servei", cls: "fora_servei" },
];
export const statusOf = (k) => STATUSES.find((s) => s.key === k) || STATUSES[0];

export const ROOM_TYPES = ["individual", "doble", "twin", "suite", "familiar", "altre"];

export const CLEAN_TYPES = [{ key: "daily" }, { key: "checkout" }];

export const INCIDENT_CATS = [
  { key: "manteniment" }, { key: "objecte_perdut" }, { key: "neteja" },
  { key: "subministrament" }, { key: "altres" },
];
export const SEVERITIES = [{ key: "baixa" }, { key: "mitjana" }, { key: "alta" }];

export const STAFF_COLORS = [
  "#0E5249", "#157A6E", "#2F8F6B", "#3E7C4F", "#2F6F8F", "#1F8FB0",
  "#1F5FA8", "#3A5A9C", "#7A5E97", "#9B6BD6", "#A23E5C", "#C2407A",
  "#C2603D", "#E0712E", "#B9821A", "#D4A017", "#B0314B", "#5B6470",
];

/** Plantilla de checklist efectiva per a un tipus: customització de l'usuari
 *  per a l'idioma actual, o la plantilla per defecte traduïda. */
export function checklistTemplate(type) {
  const custom = state.config?.checklists?.[getLang()]?.[type];
  return (custom && custom.length) ? custom.slice() : defaultChecklist(type);
}

/* ---------- Estat en memòria ---------- */

export const state = {
  config: null,
  floors: [],
  rooms: [],
  staff: [],
  tasks: [],        // registres de neteja (un per habitació i dia)
  incidents: [],
  date: todayISO(), // dia de treball seleccionat
  filterStaff: "all",
  filterStatus: "all",
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

/* ---------- Sessió / rol (local, per dispositiu) ---------- */
const SESSION_KEY = "cambra.session";
export function getSession() {
  if (state.session !== undefined) return state.session;
  try { state.session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { state.session = null; }
  return state.session;
}
export function setSession(s) {
  state.session = s;
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch {}
  emit();
}
export function logout() { setSession(null); }
export const isAdmin = () => getSession()?.role === "admin";
export const sessionStaff = () => { const s = getSession(); return s?.role === "staff" && s.staffId ? staffById(s.staffId) : null; };
/** Notifica un re-render manualment (després d'operacions silencioses). */
export function notify() { emit(); }

/* ---------- Utils de data ---------- */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const { days, months } = dateParts();
  return `${days[dt.getDay()]}, ${d} ${months[m - 1]}`;
}

/* ---------- Càrrega inicial ---------- */
export async function loadState() {
  let config = await db.get("meta", "config");
  if (!config) {
    config = { key: "config", hotelName: "El meu hotel", checklists: {}, lang: "ca", onboarded: false };
    await db.put("meta", config);
  }
  // checklists ara són per idioma { ca:{daily,checkout}, ... }; migra l'antic format pla
  if (!config.checklists || Array.isArray(config.checklists.daily) || Array.isArray(config.checklists.checkout)) {
    config.checklists = {};
  }
  config.lang = config.lang || "ca";
  config.appearance = config.appearance || {};
  config.structureTemplates = config.structureTemplates || [];
  config.checklistRequired = config.checklistRequired || { daily: false, checkout: false };
  setLangCode(config.lang);
  state.config = config;
  state.floors = sortByOrder(await db.getAll("floors"));
  state.rooms = sortByOrder(await db.getAll("rooms"));
  state.staff = await db.getAll("staff");
  state.tasks = await db.getAll("tasks");
  state.incidents = await db.getAll("incidents");
}
const sortByOrder = (arr) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/* ---------- Getters ---------- */
export const taskId = (roomId, date) => `${roomId}__${date}`;
export function getTask(roomId, date = state.date) {
  return state.tasks.find((t) => t.id === taskId(roomId, date)) || null;
}
/** Estat efectiu d'una habitació en el dia seleccionat. */
export function roomState(room, date = state.date) {
  const t = getTask(room.id, date);
  return {
    status: t?.status || "brut",
    staffId: t?.staffId || null,
    type: t?.type || "daily",
    task: t,
  };
}
export const roomsOfFloor = (floorId) => state.rooms.filter((r) => r.floorId === floorId);
export const staffById = (id) => state.staff.find((s) => s.id === id) || null;
export const floorById = (id) => state.floors.find((f) => f.id === id) || null;
export const roomById = (id) => state.rooms.find((r) => r.id === id) || null;
export const initials = (name) =>
  (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function openIncidents() {
  return state.incidents.filter((i) => i.status === "open");
}

/** Resum de progrés del dia (opcionalment només d'una cambrera). */
export function dayProgress(date = state.date, staffId = null) {
  const counts = { brut: 0, en_proces: 0, net: 0, revisat: 0, no_molestar: 0, fora_servei: 0 };
  const rooms = staffId ? state.rooms.filter((r) => roomState(r, date).staffId === staffId) : state.rooms;
  rooms.forEach((r) => { counts[roomState(r, date).status]++; });
  const total = rooms.length;
  const actius = total - counts.fora_servei - counts.no_molestar;
  const fets = counts.net + counts.revisat;
  const pct = actius > 0 ? Math.round((fets / actius) * 100) : 0;
  return { counts, total, actius, fets, pct };
}

/* ---------- Accions: config ---------- */
export async function saveConfig(patch) {
  state.config = { ...state.config, ...patch, key: "config" };
  await db.put("meta", state.config);
  emit();
}
/** Desa la configuració sense emetre re-render (per a camps de text en edició,
 *  perquè l'input no es recreï i no perdi el focus). */
export async function saveConfigSilent(patch) {
  state.config = { ...state.config, ...patch, key: "config" };
  await db.put("meta", state.config);
}
export async function setLanguage(code) {
  setLangCode(code);
  state.config = { ...state.config, lang: code, key: "config" };
  await db.put("meta", state.config);
  emit();
}
export async function saveAppearance(patch) {
  state.config = { ...state.config, appearance: { ...(state.config.appearance || {}), ...patch }, key: "config" };
  await db.put("meta", state.config);
  emit();
}
export async function resetAppearance() {
  state.config = { ...state.config, appearance: {}, key: "config" };
  await db.put("meta", state.config);
  emit();
}
/** La checklist d'aquest tipus és obligatòria per finalitzar? */
export function isChecklistRequired(type) { return !!state.config?.checklistRequired?.[type]; }
export async function setChecklistRequired(type, required) {
  const cr = { ...(state.config.checklistRequired || {}), [type]: !!required };
  state.config = { ...state.config, checklistRequired: cr, key: "config" };
  await db.put("meta", state.config);
  emit();
}
export async function saveChecklistTemplate(type, items) {
  const lang = getLang();
  const cl = { ...(state.config.checklists || {}) };
  cl[lang] = { ...(cl[lang] || {}), [type]: items };
  state.config = { ...state.config, checklists: cl, key: "config" };
  await db.put("meta", state.config);
  emit();
}

/* ---------- Plantilles d'estructura (desar/restaurar el plànol) ---------- */
export async function saveStructureTemplate(name) {
  const tpl = {
    id: uid("st_"),
    name: (name || "").trim() || `Estructura ${(state.config.structureTemplates?.length || 0) + 1}`,
    createdAt: Date.now(),
    floors: state.floors.map((f) => ({ name: f.name })),
    rooms: state.rooms.map((r) => ({ floor: state.floors.findIndex((f) => f.id === r.floorId), number: r.number, type: r.type })),
  };
  const list = [...(state.config.structureTemplates || []), tpl];
  state.config = { ...state.config, structureTemplates: list, key: "config" };
  await db.put("meta", state.config);
  emit();
  return tpl;
}
export async function deleteStructureTemplate(id) {
  const list = (state.config.structureTemplates || []).filter((t) => t.id !== id);
  state.config = { ...state.config, structureTemplates: list, key: "config" };
  await db.put("meta", state.config);
  emit();
}
export async function applyStructureTemplate(id) {
  const tpl = (state.config.structureTemplates || []).find((t) => t.id === id);
  if (!tpl) return;
  await db.clear("floors"); await db.clear("rooms"); await db.clear("tasks");
  state.floors = []; state.rooms = []; state.tasks = [];
  const floorIds = [];
  tpl.floors.forEach((f, i) => {
    const fl = { id: uid("f_"), name: f.name, order: i };
    state.floors.push(fl); floorIds[i] = fl.id;
  });
  await db.bulkPut("floors", state.floors);
  const rooms = tpl.rooms.map((r, idx) => ({ id: uid("r_"), floorId: floorIds[r.floor] ?? floorIds[0], number: r.number, type: r.type, order: idx }));
  state.rooms.push(...rooms);
  await db.bulkPut("rooms", rooms);
  emit();
}

/* ---------- Accions: pisos ---------- */
export async function addFloor(name) {
  const f = { id: uid("f_"), name: name.trim() || `Pis ${state.floors.length + 1}`, order: state.floors.length };
  state.floors.push(f);
  await db.put("floors", f);
  emit();
  return f;
}
export async function updateFloor(id, patch) {
  const f = floorById(id); if (!f) return;
  Object.assign(f, patch);
  await db.put("floors", f);
  emit();
}
export async function deleteFloor(id) {
  for (const r of roomsOfFloor(id)) await deleteRoom(r.id);
  state.floors = state.floors.filter((f) => f.id !== id);
  await db.del("floors", id);
  emit();
}

/* ---------- Accions: habitacions ---------- */
export async function addRoom(floorId, number, type = "doble") {
  const r = {
    id: uid("r_"), floorId, number: String(number).trim(),
    type, order: roomsOfFloor(floorId).length,
  };
  state.rooms.push(r);
  await db.put("rooms", r);
  emit();
  return r;
}
export async function addRoomsBulk(floorId, count, startNum, prefix, type) {
  const created = [];
  let base = roomsOfFloor(floorId).length;
  for (let i = 0; i < count; i++) {
    const r = {
      id: uid("r_"), floorId,
      number: `${prefix || ""}${Number(startNum) + i}`,
      type, order: base + i,
    };
    state.rooms.push(r); created.push(r);
  }
  await db.bulkPut("rooms", created);
  emit();
  return created;
}
export async function updateRoom(id, patch) {
  const r = roomById(id); if (!r) return;
  Object.assign(r, patch);
  await db.put("rooms", r);
  emit();
}
export async function deleteRoom(id) {
  state.rooms = state.rooms.filter((r) => r.id !== id);
  state.tasks = state.tasks.filter((t) => t.roomId !== id);
  await db.del("rooms", id);
  emit();
}

/* ---------- Accions: personal ---------- */
export async function addStaff(name, color) {
  const used = state.staff.map((s) => s.color);
  const c = color || STAFF_COLORS.find((x) => !used.includes(x)) || STAFF_COLORS[state.staff.length % STAFF_COLORS.length];
  const s = { id: uid("s_"), name: name.trim(), color: c };
  state.staff.push(s);
  await db.put("staff", s);
  emit();
  return s;
}
export async function updateStaff(id, patch) {
  const s = staffById(id); if (!s) return;
  Object.assign(s, patch);
  await db.put("staff", s);
  emit();
}
export async function deleteStaff(id) {
  state.staff = state.staff.filter((s) => s.id !== id);
  state.tasks.forEach((t) => { if (t.staffId === id) t.staffId = null; });
  await db.del("staff", id);
  emit();
}

/* ---------- Accions: tasques (registre de neteja per dia) ---------- */
function ensureTask(roomId, date = state.date) {
  let t = getTask(roomId, date);
  if (!t) {
    t = {
      id: taskId(roomId, date), roomId, date,
      status: "brut", staffId: null, type: "daily",
      checklist: [], photos: [], notes: "",
      startedAt: null, finishedAt: null,
    };
    state.tasks.push(t);
  }
  return t;
}
async function persistTask(t) { await db.put("tasks", t); emit(); }

export async function setRoomStatus(roomId, status, date = state.date) {
  const t = ensureTask(roomId, date);
  t.status = status;
  if (status === "net" && !t.finishedAt) t.finishedAt = Date.now();
  await persistTask(t);
}
export async function assignRoom(roomId, staffId, date = state.date) {
  const t = ensureTask(roomId, date);
  t.staffId = staffId;
  await persistTask(t);
}
/** Assigna sense emetre re-render (per a operacions d'arrossegament). */
export async function assignRoomSilent(roomId, staffId, date = state.date) {
  const t = ensureTask(roomId, date);
  t.staffId = staffId;
  await db.put("tasks", t);
}
export async function setRoomType(roomId, type, date = state.date) {
  const t = ensureTask(roomId, date);
  t.type = type;
  // recarrega la checklist a partir de la plantilla si encara no s'ha tocat
  if (!t._checklistTouched) {
    t.checklist = checklistTemplate(type).map((label) => ({ label, done: false }));
  }
  await persistTask(t);
}
export async function ensureChecklist(roomId, date = state.date) {
  const t = ensureTask(roomId, date);
  if (!t.checklist.length) {
    t.checklist = checklistTemplate(t.type).map((label) => ({ label, done: false }));
    await persistTask(t);
  }
  return t;
}
export async function toggleCheck(roomId, idx, date = state.date) {
  const t = ensureTask(roomId, date);
  if (!t.checklist[idx]) return;
  t.checklist[idx].done = !t.checklist[idx].done;
  t._checklistTouched = true;
  if (t.status === "brut") t.status = "en_proces";
  if (!t.startedAt) t.startedAt = Date.now();
  await persistTask(t);
}
export async function setTaskNotes(roomId, notes, date = state.date) {
  const t = ensureTask(roomId, date);
  t.notes = notes;
  await persistTask(t);
}
export async function startTask(roomId, date = state.date) {
  const t = ensureTask(roomId, date);
  t.startedAt = t.startedAt || Date.now();
  if (t.status === "brut") t.status = "en_proces";
  await persistTask(t);
}
/** Marca l'inici de manera silenciosa (sense re-render ni canvi d'estat visible). */
export async function beginIfNeeded(roomId, date = state.date) {
  const t = ensureTask(roomId, date);
  if (!t.startedAt) { t.startedAt = Date.now(); await db.put("tasks", t); }
}
export async function finishTask(roomId, date = state.date) {
  const t = ensureTask(roomId, date);
  const now = Date.now();
  t.finishedAt = now;
  if (!t.startedAt) t.startedAt = now;
  // registre per al responsable: qui i quan ha finalitzat (la cambrera no ho veu)
  t.finishedBy = t.staffId || null;
  t.status = "net";
  await persistTask(t);
}
export async function inspectRoom(roomId, date = state.date) {
  const t = ensureTask(roomId, date);
  const now = Date.now();
  if (!t.finishedAt) { t.finishedAt = now; if (!t.startedAt) t.startedAt = now; t.finishedBy = t.staffId || null; }
  t.reviewedAt = now;
  t.status = "revisat";
  await persistTask(t);
}
export async function addTaskPhoto(roomId, photoId, date = state.date) {
  const t = ensureTask(roomId, date);
  t.photos.push(photoId);
  await persistTask(t);
}
export async function removeTaskPhoto(roomId, photoId, date = state.date) {
  const t = ensureTask(roomId, date);
  t.photos = t.photos.filter((p) => p !== photoId);
  await db.del("photos", photoId);
  await persistTask(t);
}

/* ---------- Accions: incidències ---------- */
export async function addIncident(data) {
  const inc = {
    id: uid("i_"), createdAt: Date.now(), status: "open", resolvedAt: null,
    roomId: null, title: "", description: "", category: "manteniment",
    severity: "mitjana", photos: [], staffId: null, ...data,
  };
  state.incidents.unshift(inc);
  await db.put("incidents", inc);
  emit();
  return inc;
}
export async function updateIncident(id, patch) {
  const inc = state.incidents.find((i) => i.id === id); if (!inc) return;
  Object.assign(inc, patch);
  if (patch.status === "resolved" && !inc.resolvedAt) inc.resolvedAt = Date.now();
  await db.put("incidents", inc);
  emit();
}
export async function deleteIncident(id) {
  const inc = state.incidents.find((i) => i.id === id);
  if (inc) for (const p of inc.photos) await db.del("photos", p);
  state.incidents = state.incidents.filter((i) => i.id !== id);
  await db.del("incidents", id);
  emit();
}

/* ---------- Fotos ---------- */
export async function savePhoto(blob) {
  const id = uid("p_");
  await db.put("photos", { id, blob, createdAt: Date.now() });
  return id;
}
const _urlCache = new Map();
export async function photoURL(id) {
  if (_urlCache.has(id)) return _urlCache.get(id);
  const rec = await db.get("photos", id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  _urlCache.set(id, url);
  return url;
}

/* ---------- Canvi de dia / filtres ---------- */
export function setDate(iso) { state.date = iso; emit(); }
export function setFilterStaff(v) { state.filterStaff = v; emit(); }
export function setFilterStatus(v) { state.filterStatus = v; emit(); }

/* ---------- Exportació / importació ---------- */
export async function exportData() {
  const photos = await db.getAll("photos");
  const blobToB64 = (blob) => new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(blob);
  });
  const photosB64 = [];
  for (const p of photos) photosB64.push({ id: p.id, createdAt: p.createdAt, data: await blobToB64(p.blob) });
  return {
    version: 1, exportedAt: new Date().toISOString(),
    config: state.config, floors: state.floors, rooms: state.rooms,
    staff: state.staff, tasks: state.tasks, incidents: state.incidents,
    photos: photosB64,
  };
}
export async function importData(obj) {
  await db.clearAll();
  if (obj.config) await db.put("meta", { ...obj.config, key: "config" });
  await db.bulkPut("floors", obj.floors || []);
  await db.bulkPut("rooms", obj.rooms || []);
  await db.bulkPut("staff", obj.staff || []);
  await db.bulkPut("tasks", obj.tasks || []);
  await db.bulkPut("incidents", obj.incidents || []);
  for (const p of obj.photos || []) {
    const blob = await (await fetch(p.data)).blob();
    await db.put("photos", { id: p.id, blob, createdAt: p.createdAt });
  }
  await loadState();
  emit();
}

/* ---------- Dades d'exemple ---------- */
export async function seedDemo() {
  const f1 = await addFloor(t("struct.floor_default", { n: 1 }));
  const f2 = await addFloor(t("struct.floor_default", { n: 2 }));
  await addRoomsBulk(f1.id, 6, 101, "", "doble");
  await addRoomsBulk(f2.id, 6, 201, "", "doble");
  await updateRoom(state.rooms[2].id, { type: "suite" });
  const s1 = await addStaff("Maria");
  const s2 = await addStaff("Aisha");
  // algunes assignacions i estats d'exemple
  const rs = state.rooms;
  await assignRoom(rs[0].id, s1.id); await setRoomStatus(rs[0].id, "revisat");
  await assignRoom(rs[1].id, s1.id); await setRoomType(rs[1].id, "checkout"); await setRoomStatus(rs[1].id, "en_proces");
  await assignRoom(rs[2].id, s1.id);
  await assignRoom(rs[6].id, s2.id); await setRoomStatus(rs[6].id, "net");
  await assignRoom(rs[7].id, s2.id);
  await setRoomStatus(rs[10].id, "no_molestar");
  await addIncident({ roomId: rs[3].id, title: t("demo.inc_title"), category: "manteniment", severity: "mitjana", description: t("demo.inc_desc") });
  await saveConfig({ hotelName: t("demo.hotel"), onboarded: true });
}
