import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const firebaseConfig = {
  apiKey: "AIzaSyAJbubOWmz8U9-VkwqdVkmCqsx9ZATM5r4",
  authDomain: "privadin-d7ebe.firebaseapp.com",
  projectId: "privadin-d7ebe",
  storageBucket: "privadin-d7ebe.firebasestorage.app",
  messagingSenderId: "676560017485",
  appId: "1:676560017485:web:faee6938970d3155e3a404",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (_err) {
    return getAuth(app);
  }
})();

// Identifica se está em ambiente de desenvolvimento ou produção
export const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

// Define o banco de dados: em Dev conecta no "dev-privadin", em Prod usa o "(default)"
// Permite sobrescrever via variável de ambiente EXPO_PUBLIC_FIRESTORE_DATABASE_ID se necessário
export const FIRESTORE_DATABASE_ID =
  process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID ||
  (IS_DEV ? "dev-privadin" : "(default)");

export const db =
  FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== "(default)"
    ? getFirestore(app, FIRESTORE_DATABASE_ID)
    : getFirestore(app);

console.log(
  `[Firebase] Ambiente: ${IS_DEV ? "DEV (Homologação)" : "PROD (Produção)"} | Banco Firestore: ${FIRESTORE_DATABASE_ID}`
);
