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

export const db = getFirestore(app);
