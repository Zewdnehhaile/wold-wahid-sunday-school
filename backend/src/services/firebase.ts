import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy
} from 'firebase/firestore';

// Locate firebase-applet-config.json across possible process.cwd() locations
let firebaseConfig: any = {};
const candidateConfigPaths = [
  path.resolve(process.cwd(), 'firebase-applet-config.json'),
  path.resolve(__dirname, '../../../firebase-applet-config.json'),
  path.resolve(__dirname, '../../firebase-applet-config.json'),
  path.resolve(__dirname, '../firebase-applet-config.json'),
];

for (const p of candidateConfigPaths) {
  if (fs.existsSync(p)) {
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(p, 'utf-8'));
      break;
    } catch {}
  }
}

// Initialize Real Firebase App & Firestore targeting the provisioned database ID
let firestoreDb: any = null;
try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (err: any) {
  console.warn('⚠️ Firestore backend initialization notice:', err?.message || err);
}

// Persistent Local File Store for caching and offline resilience
const LOCAL_DB_PATH = path.resolve(process.cwd(), 'backend/data/local_db.json');

function ensureLocalDir() {
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadLocalStore(): Record<string, Record<string, any>> {
  try {
    ensureLocalDir();
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error loading local JSON DB:', err);
  }
  return {};
}

function saveLocalStore(store: Record<string, Record<string, any>>) {
  try {
    ensureLocalDir();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error saving local JSON DB:', err);
  }
}

const localStore = loadLocalStore();

function getCollectionLocal(colName: string): Record<string, any> {
  if (!localStore[colName]) {
    localStore[colName] = {};
  }
  return localStore[colName];
}

function normalizeDoc(id: string, data: any): any {
  if (!data) return null;
  return {
    ...data,
    id,
    telegramId: data.telegramId || data.telegram_id || data.tgId || '',
    studentCode: data.studentCode || data.code || data.student_code || '',
    phone: data.phone || '',
    fullNameAm: data.fullNameAm || data.full_name_am || data.nameAm || '',
    fullNameEn: data.fullNameEn || data.full_name_en || data.nameEn || '',
    department: data.department || '',
    status: data.status || 'pending',
  };
}

export class CollectionQuery {
  private colName: string;
  private constraints: any[] = [];

  constructor(colName: string, constraints: any[] = []) {
    this.colName = colName;
    this.constraints = constraints;
  }

  where(field: string, op: any, val: any): CollectionQuery {
    return new CollectionQuery(this.colName, [...this.constraints, { type: 'where', field, op, val }]);
  }

  orderBy(field: string, dir: any = 'asc'): CollectionQuery {
    return new CollectionQuery(this.colName, [...this.constraints, { type: 'orderBy', field, dir }]);
  }

  limit(n: number): CollectionQuery {
    return new CollectionQuery(this.colName, [...this.constraints, { type: 'limit', n }]);
  }

  async get() {
    let docsMap = new Map<string, any>();

    // 1. Load local cached documents first
    const colLocal = getCollectionLocal(this.colName);
    Object.entries(colLocal).forEach(([docId, docData]) => {
      docsMap.set(docId, normalizeDoc(docId, docData));
    });

    // 2. Query Firestore directly
    if (firestoreDb) {
      try {
        const colRef = collection(firestoreDb, this.colName);
        let fsQuery: any = colRef;
        
        for (const c of this.constraints) {
          if (c.type === 'where') {
            const fsOp = c.op === '=' ? '==' : c.op;
            fsQuery = query(fsQuery, where(c.field, fsOp, c.val));
          } else if (c.type === 'orderBy') {
            fsQuery = query(fsQuery, orderBy(c.field, c.dir));
          } else if (c.type === 'limit') {
            fsQuery = query(fsQuery, limit(c.n));
          }
        }

        const snapshot = await getDocs(fsQuery);
        snapshot.docs.forEach((d) => {
          const norm = normalizeDoc(d.id, d.data());
          docsMap.set(d.id, norm);
          colLocal[d.id] = norm;
        });
        saveLocalStore(localStore);
      } catch (fsErr: any) {
        console.warn(`Notice reading '${this.colName}' from Firestore:`, fsErr?.message || fsErr);
      }
    }

    // 3. Filter results locally according to constraints
    let results = Array.from(docsMap.values());

    for (const c of this.constraints) {
      if (c.type === 'where') {
        const { field, op, val } = c;
        results = results.filter((item) => {
          const itemVal = item[field] ?? item[field === 'telegramId' ? 'telegram_id' : field];
          if (op === '==' || op === '=') {
            return String(itemVal) === String(val) || itemVal === val;
          }
          if (op === 'in') {
            const arr = Array.isArray(val) ? val.map(String) : [];
            return arr.includes(String(itemVal)) || arr.includes(String(item.phone));
          }
          if (op === '>=') {
            return String(itemVal) >= String(val);
          }
          if (op === '<=') {
            return String(itemVal) <= String(val);
          }
          return true;
        });
      } else if (c.type === 'orderBy') {
        const { field, dir } = c;
        results.sort((a, b) => {
          const va = a[field] || '';
          const vb = b[field] || '';
          return dir === 'desc' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
        });
      } else if (c.type === 'limit') {
        results = results.slice(0, c.n);
      }
    }

    const docs = results.map((item) => ({
      id: item.id,
      data: () => item,
    }));

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
    };
  }

  async add(data: any) {
    const newId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const normData = normalizeDoc(newId, data);

    // Save to local cache immediately
    const colLocal = getCollectionLocal(this.colName);
    colLocal[newId] = normData;
    saveLocalStore(localStore);

    // Save to Firestore
    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, this.colName, newId), normData);
      } catch (err: any) {
        console.warn(`Firestore add notice for ${this.colName}:`, err?.message || err);
      }
    }

    return { id: newId };
  }

  doc(id: string) {
    const colName = this.colName;
    return {
      async get() {
        const colLocal = getCollectionLocal(colName);
        let item = colLocal[id] ? normalizeDoc(id, colLocal[id]) : null;

        if (firestoreDb && !item) {
          try {
            const docSnap = await getDoc(doc(firestoreDb, colName, id));
            if (docSnap.exists()) {
              item = normalizeDoc(id, docSnap.data());
              colLocal[id] = item;
              saveLocalStore(localStore);
            }
          } catch (err: any) {
            console.warn(`Firestore doc get notice for ${colName}/${id}:`, err?.message || err);
          }
        }

        return {
          id,
          exists: !!item,
          data: () => item,
        };
      },

      async set(data: any, options?: { merge: boolean }) {
        const colLocal = getCollectionLocal(colName);
        const existing = colLocal[id] || {};
        const merged = options?.merge ? { ...existing, ...data } : data;
        const norm = normalizeDoc(id, merged);

        colLocal[id] = norm;
        saveLocalStore(localStore);

        if (firestoreDb) {
          try {
            await setDoc(doc(firestoreDb, colName, id), norm, { merge: options?.merge ?? true });
          } catch (err: any) {
            console.warn(`Firestore setDoc notice for ${colName}/${id}:`, err?.message || err);
          }
        }
      },

      async update(data: any) {
        const colLocal = getCollectionLocal(colName);
        const existing = colLocal[id] || {};
        const merged = { ...existing, ...data };
        const norm = normalizeDoc(id, merged);

        colLocal[id] = norm;
        saveLocalStore(localStore);

        if (firestoreDb) {
          try {
            await updateDoc(doc(firestoreDb, colName, id), data);
          } catch (err: any) {
            console.warn(`Firestore updateDoc notice for ${colName}/${id}:`, err?.message || err);
          }
        }
      },

      async delete() {
        const colLocal = getCollectionLocal(colName);
        delete colLocal[id];
        saveLocalStore(localStore);

        if (firestoreDb) {
          try {
            await deleteDoc(doc(firestoreDb, colName, id));
          } catch (err: any) {
            console.warn(`Firestore deleteDoc notice for ${colName}/${id}:`, err?.message || err);
          }
        }
      }
    };
  }
}

export const db = {
  collection(name: string) {
    return new CollectionQuery(name);
  },
};
