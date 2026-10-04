// Records live in the phone's own browser database (IndexedDB). Nothing is sent anywhere.
const DB_NAME = 'kia-tumbuh';
const STORE = 'records';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function run(mode, work) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(result && 'result' in result ? result.result : undefined); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Database transaction aborted')); };
  }));
}

export const addRecord = (record) => run('readwrite', (s) => { s.put(record); });
export const allRecords = () => run('readonly', (s) => s.getAll()).then((r) => (r || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
export const clearAll = () => run('readwrite', (s) => { s.clear(); });
export function markExported(ids, when, field = 'exportedAt') {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    ids.forEach((id) => { const g = store.get(id); g.onsuccess = () => { if (g.result) store.put({ ...g.result, [field]: when }); }; });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}
