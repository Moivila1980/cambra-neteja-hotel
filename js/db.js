/* ============================================================
   db.js — Capa de persistència local (IndexedDB)
   Una sola base de dades: "cambra". Tot offline-first.
   ============================================================ */

const DB_NAME = "cambra";
const DB_VERSION = 1;

/** Magatzems (object stores) i les seves claus. */
const STORES = {
  meta: { keyPath: "key" },               // configuració global (1 registre "config")
  floors: { keyPath: "id" },              // pisos
  rooms: { keyPath: "id", index: "floorId" },
  staff: { keyPath: "id" },               // cambreres / personal
  tasks: { keyPath: "id", index: "roomId" }, // registre de neteja per habitació
  incidents: { keyPath: "id" },           // incidències
  photos: { keyPath: "id" },              // imatges (blobs)
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: cfg.keyPath });
        if (cfg.index) store.createIndex(cfg.index, cfg.index, { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = "readonly") {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

export const db = {
  async getAll(store) {
    const os = await tx(store);
    return new Promise((res, rej) => {
      const r = os.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },
  async get(store, key) {
    const os = await tx(store);
    return new Promise((res, rej) => {
      const r = os.get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  },
  async put(store, value) {
    const os = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = os.put(value);
      r.onsuccess = () => res(value);
      r.onerror = () => rej(r.error);
    });
  },
  async bulkPut(store, values) {
    const os = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      values.forEach((v) => os.put(v));
      os.transaction.oncomplete = () => res(true);
      os.transaction.onerror = () => rej(os.transaction.error);
    });
  },
  async del(store, key) {
    const os = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = os.delete(key);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  async clear(store) {
    const os = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = os.clear();
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  async clearAll() {
    for (const s of Object.keys(STORES)) await this.clear(s);
  },
};

/** Identificador curt i únic (sense dependències). */
export function uid(prefix = "") {
  const t = Date.now().toString(36);
  const r = Math.floor(performance.now() * 1000).toString(36).slice(-4);
  const x = (crypto.getRandomValues(new Uint32Array(1))[0]).toString(36).slice(0, 4);
  return `${prefix}${t}${r}${x}`;
}
