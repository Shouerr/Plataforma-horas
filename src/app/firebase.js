// src/app/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ Debug: verificar variables de entorno en consola
if (import.meta.env.DEV) {
  console.log("Firebase ENV →", {
    VITE_FB_API_KEY: import.meta.env.VITE_FB_API_KEY,
    VITE_FB_AUTH_DOMAIN: import.meta.env.VITE_FB_AUTH_DOMAIN,
    VITE_FB_PROJECT_ID: import.meta.env.VITE_FB_PROJECT_ID,
    VITE_FB_STORAGE_BUCKET: import.meta.env.VITE_FB_STORAGE_BUCKET,
    VITE_FB_MESSAGING_SENDER_ID: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
    VITE_FB_APP_ID: import.meta.env.VITE_FB_APP_ID,
  });
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
