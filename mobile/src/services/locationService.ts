import * as Location from "expo-location";
import { PoopLocation } from "../types";

export async function requestCurrentLocation(): Promise<PoopLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.log("[locationService] Permissão de localização não concedida pelo usuário.");
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy != null ? position.coords.accuracy : null,
    };
  } catch (error) {
    console.warn("[locationService] Não foi possível obter localização atual:", error);
    return null;
  }
}
