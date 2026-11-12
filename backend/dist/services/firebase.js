"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.CollectionQuery = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
// Locate firebase-applet-config.json across possible process.cwd() locations
let firebaseConfig = {};
const candidateConfigPaths = [
    path_1.default.resolve(process.cwd(), 'firebase-applet-config.json'),
    path_1.default.resolve(__dirname, '../../../firebase-applet-config.json'),
    path_1.default.resolve(__dirname, '../../firebase-applet-config.json'),
    path_1.default.resolve(__dirname, '../firebase-applet-config.json'),
];
for (const p of candidateConfigPaths) {
    if (fs_1.default.existsSync(p)) {
        try {
            firebaseConfig = JSON.parse(fs_1.default.readFileSync(p, 'utf-8'));
            break;
        }
        catch { }
    }
}
// Initialize Real Firebase App & Firestore with long-polling for better connectivity
let firestoreDb = null;
try {
    const app = (0, app_1.getApps)().length === 0 ? (0, app_1.initializeApp)(firebaseConfig) : (0, app_1.getApp)();
    firestoreDb = (0, firestore_1.initializeFirestore)(app, {
        experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
}
catch (err) {
    console.warn('⚠️ Firestore backend initialization notice:', err?.message || err);
}
// Persistent Local File Store for caching and offline resilience
const LOCAL_DB_PATH = path_1.default.resolve(process.cwd(), 'backend/data/local_db.json');
function ensureLocalDir() {
    const dir = path_1.default.dirname(LOCAL_DB_PATH);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
function loadLocalStore() {
    try {
        ensureLocalDir();
        if (fs_1.default.existsSync(LOCAL_DB_PATH)) {
            const raw = fs_1.default.readFileSync(LOCAL_DB_PATH, 'utf-8');
            return JSON.parse(raw);
        }
    }
    catch (err) {
        console.warn('Error loading local JSON DB:', err);
    }
    return {};
}
function saveLocalStore(store) {
    try {
        ensureLocalDir();
        fs_1.default.writeFileSync(LOCAL_DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
    }
    catch (err) {
        console.warn('Error saving local JSON DB:', err);
    }
}
const localStore = loadLocalStore();
function getCollectionLocal(colName) {
    if (!localStore[colName]) {
        localStore[colName] = {};
    }
    return localStore[colName];
}
function normalizeDoc(id, data) {
    if (!data)
        return null;
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
class CollectionQuery {
    colName;
    constraints = [];
    constructor(colName, constraints = []) {
        this.colName = colName;
        this.constraints = constraints;
    }
    where(field, op, val) {
        return new CollectionQuery(this.colName, [...this.constraints, { type: 'where', field, op, val }]);
    }
    orderBy(field, dir = 'asc') {
        return new CollectionQuery(this.colName, [...this.constraints, { type: 'orderBy', field, dir }]);
    }
    limit(n) {
        return new CollectionQuery(this.colName, [...this.constraints, { type: 'limit', n }]);
    }
    async get() {
        let docsMap = new Map();
        // 1. Load local cached documents first
        const colLocal = getCollectionLocal(this.colName);
        Object.entries(colLocal).forEach(([docId, docData]) => {
            docsMap.set(docId, normalizeDoc(docId, docData));
        });
        // 2. Query Firestore directly
        if (firestoreDb) {
            try {
                const colRef = (0, firestore_1.collection)(firestoreDb, this.colName);
                let fsQuery = colRef;
                for (const c of this.constraints) {
                    if (c.type === 'where') {
                        const fsOp = c.op === '=' ? '==' : c.op;
                        fsQuery = (0, firestore_1.query)(fsQuery, (0, firestore_1.where)(c.field, fsOp, c.val));
                    }
                    else if (c.type === 'orderBy') {
                        fsQuery = (0, firestore_1.query)(fsQuery, (0, firestore_1.orderBy)(c.field, c.dir));
                    }
                    else if (c.type === 'limit') {
                        fsQuery = (0, firestore_1.query)(fsQuery, (0, firestore_1.limit)(c.n));
                    }
                }
                const snapshot = await (0, firestore_1.getDocs)(fsQuery);
                snapshot.docs.forEach((d) => {
                    const norm = normalizeDoc(d.id, d.data());
                    docsMap.set(d.id, norm);
                    colLocal[d.id] = norm;
                });
                saveLocalStore(localStore);
            }
            catch (fsErr) {
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
            }
            else if (c.type === 'orderBy') {
                const { field, dir } = c;
                results.sort((a, b) => {
                    const va = a[field] || '';
                    const vb = b[field] || '';
                    return dir === 'desc' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
                });
            }
            else if (c.type === 'limit') {
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
    async add(data) {
        const newId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const normData = normalizeDoc(newId, data);
        // Save to local cache immediately
        const colLocal = getCollectionLocal(this.colName);
        colLocal[newId] = normData;
        saveLocalStore(localStore);
        // Save to Firestore
        if (firestoreDb) {
            try {
                await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestoreDb, this.colName, newId), normData);
            }
            catch (err) {
                console.warn(`Firestore add notice for ${this.colName}:`, err?.message || err);
            }
        }
        return { id: newId };
    }
    doc(id) {
        const colName = this.colName;
        return {
            async get() {
                const colLocal = getCollectionLocal(colName);
                let item = colLocal[id] ? normalizeDoc(id, colLocal[id]) : null;
                if (firestoreDb && !item) {
                    try {
                        const docSnap = await (0, firestore_1.getDoc)((0, firestore_1.doc)(firestoreDb, colName, id));
                        if (docSnap.exists()) {
                            item = normalizeDoc(id, docSnap.data());
                            colLocal[id] = item;
                            saveLocalStore(localStore);
                        }
                    }
                    catch (err) {
                        console.warn(`Firestore doc get notice for ${colName}/${id}:`, err?.message || err);
                    }
                }
                return {
                    id,
                    exists: !!item,
                    data: () => item,
                };
            },
            async set(data, options) {
                const colLocal = getCollectionLocal(colName);
                const existing = colLocal[id] || {};
                const merged = options?.merge ? { ...existing, ...data } : data;
                const norm = normalizeDoc(id, merged);
                colLocal[id] = norm;
                saveLocalStore(localStore);
                if (firestoreDb) {
                    try {
                        await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestoreDb, colName, id), norm, { merge: options?.merge ?? true });
                    }
                    catch (err) {
                        console.warn(`Firestore setDoc notice for ${colName}/${id}:`, err?.message || err);
                    }
                }
            },
            async update(data) {
                const colLocal = getCollectionLocal(colName);
                const existing = colLocal[id] || {};
                const merged = { ...existing, ...data };
                const norm = normalizeDoc(id, merged);
                colLocal[id] = norm;
                saveLocalStore(localStore);
                if (firestoreDb) {
                    try {
                        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firestoreDb, colName, id), data);
                    }
                    catch (err) {
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
                        await (0, firestore_1.deleteDoc)((0, firestore_1.doc)(firestoreDb, colName, id));
                    }
                    catch (err) {
                        console.warn(`Firestore deleteDoc notice for ${colName}/${id}:`, err?.message || err);
                    }
                }
            }
        };
    }
}
exports.CollectionQuery = CollectionQuery;
exports.db = {
    collection(name) {
        return new CollectionQuery(name);
    },
};
