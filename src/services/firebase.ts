import { initializeApp } from "@firebase/app";
import { getAuth } from "@firebase/auth";
import { getFirestore } from "@firebase/firestore";
import { getStorage } from "@firebase/storage";

const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? "");

export const isFirebaseConfigured = Boolean(
  apiKey.startsWith("AIza") &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID,
);

const firebaseConfig = {
  apiKey: isFirebaseConfigured ? apiKey : "AIzaSyDemoDemoDemoDemoDemoDemoDemoDemoDemo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:demo",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Identifica se está em ambiente de desenvolvimento ou produção
export const IS_DEV = Boolean(import.meta.env.DEV);

// Define o banco de dados: em Dev conecta no "dev-privadin", em Prod usa o "(default)"
// Permite sobrescrever via variável de ambiente VITE_FIRESTORE_DATABASE_ID se necessário
export const FIRESTORE_DATABASE_ID =
  import.meta.env.VITE_FIRESTORE_DATABASE_ID ||
  (IS_DEV ? "dev-privadin" : "(default)");

export const db =
  FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== "(default)"
    ? getFirestore(app, FIRESTORE_DATABASE_ID)
    : getFirestore(app);

export const storage = getStorage(app);

console.log(
  `[Firebase Web] Ambiente: ${IS_DEV ? "DEV (Homologação)" : "PROD (Produção)"} | Banco Firestore: ${FIRESTORE_DATABASE_ID}`
);
