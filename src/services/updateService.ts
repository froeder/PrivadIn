import { version as appVersion } from "../../package.json";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  error: string | null;
}

/**
 * Checks for PWA updates by comparing current version with latest available
 * Fetches from /version.json which is served from the public/ folder
 * @returns Update check result with version info
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const currentVersion = appVersion;

    // Fetch the latest version from version.json served from public/ folder
    // This file is copied to the dist/ output during build
    const response = await fetch("/version.json", {
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

    const versionData = await response.json();

    // Validate version.json structure
    if (
      !versionData ||
      typeof versionData.version !== "string" ||
      !versionData.version.trim()
    ) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: null,
        error: "Invalid version.json format: missing or invalid version field",
      };
    }

    const latestVersion = versionData.version.trim();

    // Simple semver comparison (works for versions like 1.0.5)
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
 * Triggers PWA update using targeted service worker update flow
 * 1. Checks for a waiting service worker (new version)
 * 2. Tells it to skip waiting (take control)
 * 3. Reloads once the new controller is active
 */
export async function triggerPWAUpdate(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();

      for (const registration of registrations) {
        // Check if there's a waiting worker (new version ready)
        if (registration.waiting) {
          // Tell the waiting worker to skip waiting and take control
          registration.waiting.postMessage({ type: "SKIP_WAITING" });

          // Reload once the new worker takes control
          let isReloading = false;
          navigator.serviceWorker.oncontrollerchange = () => {
            if (!isReloading) {
              isReloading = true;
              window.location.reload();
            }
          };
        } else {
          // No waiting worker yet, check for updates
          await registration.update();
        }
      }
    } else {
      // Fallback: just reload if no service worker support
      window.location.reload();
    }
  } catch (error) {
    console.error("Error updating PWA service worker:", error);
    // Fallback to page reload on error
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
