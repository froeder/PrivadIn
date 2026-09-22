import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * Versão semântica do código do aplicativo.
 * Altere aqui a cada nova versão ou update que desejar destacar aos usuários.
 */
export const APP_CODE_VERSION = "1.0.4";

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
    APP_CODE_VERSION ||
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    "1.0.0"
  );
}

/**
 * Retorna a string descritiva da versão para exibição no aplicativo (ex: v1.0.1 ou v1.0.1 • OTA #df1cc6d).
 */
export function getAppDisplayVersion(): string {
  const version = getCurrentAppVersion();
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 7) : null;
  const channel = Updates.channel;

  if (updateId) {
    return `v${version} (OTA #${updateId}${channel ? ` • ${channel}` : ""})`;
  }

  return `v${version}`;
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
 * Verifica manualmente e baixa atualizações via EAS Update.
 */
export interface ManualUpdateCheckResult {
  status: "updated" | "up_to_date" | "disabled" | "error";
  message: string;
}

export async function checkAndFetchUpdate(): Promise<ManualUpdateCheckResult> {
  if (__DEV__) {
    return {
      status: "disabled",
      message: "Atualizações OTA automáticas ficam desativadas durante o desenvolvimento local.",
    };
  }

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
    return {
      status: "updated",
      message: "Página recarregada.",
    };
  }

  if (!Updates.isEnabled) {
    return {
      status: "disabled",
      message: "O serviço de atualizações OTA não está ativo nesta compilação.",
    };
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      return {
        status: "updated",
        message: "Nova versão baixada com sucesso!",
      };
    }

    return {
      status: "up_to_date",
      message: "Você já está na versão mais recente disponível!",
    };
  } catch (error: any) {
    return {
      status: "error",
      message: error?.message || "Erro ao conectar com o servidor de atualizações.",
    };
  }
}

/**
 * Reinicia o aplicativo imediatamente para carregar o bundle atualizado.
 */
export async function reloadApp(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
    return;
  }
  await Updates.reloadAsync();
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
