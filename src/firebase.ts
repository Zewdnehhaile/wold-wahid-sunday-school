import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type DocumentSnapshot,
  type DocumentData
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App with project config
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export native Firestore instance targeting the provisioned database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Export standard Firestore operations (Real-time web streams with zero polling intervals)
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type DocumentSnapshot,
  type DocumentData
};
