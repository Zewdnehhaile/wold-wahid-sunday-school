import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: 'chromatic-wonder-f6tp2',
  appId: '1:452937791192:web:1b6d947a6718e6dc5609ad',
  apiKey: 'AIzaSyAF1ep-4kb-FP-If9EEHlJUAlxHDb4VpEs',
  authDomain: 'chromatic-wonder-f6tp2.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-d3279648-1f3b-4293-8893-cd76f3d816dc',
  storageBucket: 'chromatic-wonder-f6tp2.firebasestorage.app',
  messagingSenderId: '452937791192',
};

const app = getApps().length > 0
  ? getApp()
  : initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
