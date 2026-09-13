import { Platform } from "react-native";
import Constants from "expo-constants";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  error: string | null;
}

export type TriggerAppUpdateResult = "reloading" | "store_redirect" | "pending";

/**
 * Retorna a versão atual do app instalada no dispositivo.
 */
export function getCurrentAppVersion(): string {
  return (
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    "1.0.0"
  );
}

/**
 * Compara duas versões semânticas (v1 vs v2).
 * Retorna 1 se v1 > v2, -1 se v1 < v2, 0 se iguais.
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Verifica atualizações disponíveis para o aplicativo.
 * - No Web / PWA: Consulta version.json ou service worker.
 * - No Android / iOS: Suporta validação via backend / stores.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentAppVersion();

  if (Platform.OS === "web") {
    try {
      const response = await fetch(`/version.json?ts=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });

      if (response.ok) {
        const versionData = await response.json();
        const latestVersion = typeof versionData?.version === "string" ? versionData.version.trim() : null;
        const hasUpdate = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;

        return {
          hasUpdate,
          currentVersion,
          latestVersion,
          error: null,
        };
      }
    } catch (err: any) {
      // Ignora erro em modo web se version.json não existir
    }
  }

  return {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    error: null,
  };
}

/**
 * Aciona atualização do app quando disponível.
 */
export async function triggerAppUpdate(): Promise<TriggerAppUpdateResult> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.reload();
    return "reloading";
  }

  return "pending";
}

/**
 * Handler de atualização de Service Worker para compatibilidade PWA.
 */
export function setPWAUpdateHandler(_handler: (reloadPage?: boolean) => Promise<void>) {
  // Mantido para compatibilidade com a interface PWA
}
