import { version as appVersion } from "../../package.json";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  error: string | null;
}

/**
 * Checks for PWA updates by comparing current version with latest available
 * @returns Update check result with version info
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const currentVersion = appVersion;

    // Try to fetch the latest version from package.json in the app root
    // This requires the app to be served and accessible
    const response = await fetch("/package.json", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });

    if (!response.ok) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: null,
        error: `Failed to fetch version: ${response.statusText}`,
      };
    }

    const packageData = await response.json();
    const latestVersion = packageData.version;

    // Simple semver comparison (works for versions like 1.0.4)
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      hasUpdate,
      currentVersion,
      latestVersion: latestVersion || null,
      error: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      hasUpdate: false,
      currentVersion: appVersion,
      latestVersion: null,
      error: errorMessage,
    };
  }
}

/**
 * Compares two semantic versions
 * @param v1 - First version to compare
 * @param v2 - Second version to compare
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Triggers PWA update by reloading the service worker and page
 */
export async function triggerPWAUpdate(): Promise<void> {
  try {
    // Check if service worker is available
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();

      for (const registration of registrations) {
        // Unregister the old service worker
        await registration.unregister();
      }

      // Reload the page to get the latest version
      window.location.reload();
    } else {
      // Fallback: just reload the page if no service worker
      window.location.reload();
    }
  } catch (error) {
    // If unregistering fails, just reload the page
    console.error("Error updating PWA:", error);
    window.location.reload();
  }
}

/**
 * Gets the current app version
 * @returns The version string from package.json
 */
export function getCurrentVersion(): string {
  return appVersion;
}
