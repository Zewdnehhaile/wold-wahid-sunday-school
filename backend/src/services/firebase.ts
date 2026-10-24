import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read Firebase config from firebase-applet-config.json
let firebaseConfig: any = {
  projectId: 'chromatic-wonder-f6tp2',
  apiKey: 'AIzaSyAF1ep-4kb-FP-If9EEHlJUAlxHDb4VpEs',
  appId: '1:452937791192:web:1b6d947a6718e6dc5609ad',
  firestoreDatabaseId: 'ai-studio-d3279648-1f3b-4293-8893-cd76f3d816dc',
};

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    firebaseConfig = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json, using fallback configuration.');
}

const app = getApps().length === 0
  ? initializeApp({
      apiKey: firebaseConfig.apiKey,
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
    })
  : getApps()[0];

const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || 'ai-studio-d3279648-1f3b-4293-8893-cd76f3d816dc');

export class CollectionQuery {
  private colName: string;
  private constraints: QueryConstraint[];

  constructor(colName: string, constraints: QueryConstraint[] = []) {
    this.colName = colName;
    this.constraints = constraints;
  }

  where(field: string, op: any, val: any): CollectionQuery {
    return new CollectionQuery(this.colName, [...this.constraints, where(field, op, val)]);
  }

  orderBy(field: string, dir: any = 'asc'): CollectionQuery {
    return new CollectionQuery(this.colName, [...this.constraints, orderBy(field, dir)]);
  }

  limit(n: number): CollectionQuery {
    return new CollectionQuery(this.colName, [...this.constraints, limit(n)]);
  }

  async get() {
    const colRef = collection(firestoreDb, this.colName);
    const q = this.constraints.length > 0 ? query(colRef, ...this.constraints) : colRef;
    const snap = await getDocs(q);
    return {
      empty: snap.empty,
      size: snap.size,
      docs: snap.docs.map((d: any) => ({
        id: d.id,
        data: () => d.data(),
      })),
    };
  }

  async add(data: any) {
    const colRef = collection(firestoreDb, this.colName);
    const ref = await addDoc(colRef, data);
    return { id: ref.id };
  }

  doc(id: string): { 
    get(): Promise<{ id: string; exists: boolean; data: () => any }>; 
    update(data: any): Promise<void>; 
    set(data: any, options?: { merge: boolean }): Promise<void>;
    delete(): Promise<void>; 
  } {
    const docRef = doc(firestoreDb, this.colName, id);
    return {
      async get() {
        const snap = await getDoc(docRef);
        return {
          id: snap.id,
          exists: snap.exists(),
          data: () => snap.data(),
        };
      },
      async update(data: any) {
        await updateDoc(docRef, data as Record<string, any>);
      },
      async set(data: any, options?: { merge: boolean }) {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(docRef, data, options || {});
      },
      async delete() {
        await deleteDoc(docRef);
      },
    };
  }
}

export const db = {
  collection(name: string) {
    return new CollectionQuery(name);
  },
};
