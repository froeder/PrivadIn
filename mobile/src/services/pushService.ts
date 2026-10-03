import { Platform } from "react-native";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Registra o aparelho para receber push e salva o token Expo em
 * user_private/{uid}.expoPushTokens (visível apenas ao dono; a Cloud Function
 * lê via Admin SDK). Usa require tardio para não quebrar builds antigos que
 * ainda não incluem os módulos nativos.
 */
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const Notifications = require("expo-notifications");
    const Device = require("expo-device");
    const Constants = require("expo-constants").default;

    if (!Device.isDevice) return null; // push não funciona em emulador

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("scores", {
        name: "Pontuações",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#eab308",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    await setDoc(
      doc(db, "user_private", uid),
      { expoPushTokens: arrayUnion(token) },
      { merge: true }
    );
    return token;
  } catch (error) {
    console.warn("[Push] Não foi possível registrar notificações:", error);
    return null;
  }
}

/** Exibe notificações também com o app aberto. */
export function configureForegroundNotifications(): void {
  if (Platform.OS === "web") return;
  try {
    const Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn("[Push] expo-notifications indisponível neste build:", error);
  }
}
