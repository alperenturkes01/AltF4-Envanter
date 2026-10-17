// ==========================================
// ALTF4 ENVANTER SİSTEMİ - FIREBASE SDK v13.0.0 MODÜLÜ
// ==========================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
const firebaseConfig = {
  apiKey: 'AIzaSyAplESbQCk2YTCbQzi7UyOvPIYNQJvY9L8',
  authDomain: 'altf4-envanter.firebaseapp.com',
  projectId: 'altf4-envanter',
  storageBucket: 'altf4-envanter.firebasestorage.app',
  messagingSenderId: '928059638634',
  appId: '1:928059638634:web:8da6fb168fc5ad352a9b13'
};
const app = initializeApp(firebaseConfig);

import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';

// Firestore Offline Persistence (IndexedDB çoklu sekme desteği ile)
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  console.log("✅ Firebase v13.0.0 Firestore Offline Persistence (IndexedDB) aktif.");
} catch (err) {
  db = getFirestore(app);
  console.warn("Firestore standart başlatıldı:", err.message);
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Global Firebase v13.0.0 modül köprüsü
window.Firebase13 = {
  app,
  db,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  firebaseConfig
};

// Compat kütüphanesi yüklüyse aynı yapılandırmayla başlat
if (window.firebase && !window.firebase.apps.length) {
  try {
    window.firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.warn("Firebase compat başlatma uyarısı:", e);
  }
}

window.dispatchEvent(new CustomEvent("firebase:v13:ready", { detail: window.Firebase13 }));
console.log("🔥 Firebase v13.0.0 başarıyla yüklendi ve hazır.");

