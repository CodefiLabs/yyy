import { ipcMain } from "electron";
import type { UserSettings } from "../../lib/schemas";
import { writeSettings } from "../../main/settings";
import { readSettings } from "../../main/settings";
import { IS_DISTRIBUTION_BUILD, getVibeathonProxyUrl } from "../utils/distribution_utils";
import { fetchFallbackApiKeys, validateVibeathonApiKey } from "../utils/vibeathon_api";

export function registerSettingsHandlers() {
  // Intentionally do NOT use handle because it could log sensitive data from the return value.
  ipcMain.handle("get-user-settings", async () => {
    const settings = readSettings();
    return settings;
  });

  // Intentionally do NOT use handle because it could log sensitive data from the args.
  ipcMain.handle(
    "set-user-settings",
    async (_, settings: Partial<UserSettings>) => {
      writeSettings(settings);
      return readSettings();
    },
  );

  // Handler for fetching Vibeathon fallback keys
  ipcMain.handle("settings:fetchVibeathonKeys", async () => {
    return fetchVibeathonFallbackKeys();
  });

  // Handler for validating Vibeathon API key
  ipcMain.handle("settings:validateVibeathonKey", async (_, vibeathonApiKey: string) => {
    console.log('[Settings Handler] Validating Vibeathon API key...');
    if (!vibeathonApiKey) {
      console.log('[Settings Handler] No API key provided');
      return false;
    }
    const result = await validateVibeathonApiKey(vibeathonApiKey);
    console.log('[Settings Handler] Validation result:', result);
    return result;
  });
}

export async function fetchVibeathonFallbackKeys(): Promise<void> {
  const settings = readSettings();
  const vibeathonApiKey = settings.distributionMode?.vibeathonApiKey?.value;

  if (!vibeathonApiKey) {
    throw new Error('Vibeathon API key not configured');
  }

  const apiKeys = await fetchFallbackApiKeys(vibeathonApiKey);

  // Convert to SecretSchema format and store with expiration
  const fallbackApiKeys = Object.entries(apiKeys)
    .filter(([key]) => key !== 'expiration')
    .reduce((acc, [provider, key]) => ({
      ...acc,
      [provider]: {
        value: key as string,
        encryptionType: 'electron-safe-storage' as const,
      }
    }), {});

  writeSettings({
    distributionMode: {
      hideCommercialFeatures: settings.distributionMode?.hideCommercialFeatures ?? false,
      hideProButtons: settings.distributionMode?.hideProButtons ?? false,
      hideExternalIntegrations: settings.distributionMode?.hideExternalIntegrations ?? false,
      hideNavigation: settings.distributionMode?.hideNavigation ?? [],
      ...settings.distributionMode,
      proxySettings: {
        enabled: settings.distributionMode?.proxySettings?.enabled ?? false,
        retryCount: settings.distributionMode?.proxySettings?.retryCount ?? 0,
        useFallback: settings.distributionMode?.proxySettings?.useFallback ?? false,
        ...settings.distributionMode?.proxySettings,
        fallbackApiKeys,
        fallbackKeysExpiration: apiKeys.expiration,
      }
    }
  });
}

export async function initializeDistributionSettings(): Promise<void> {
  if (IS_DISTRIBUTION_BUILD) {
    const currentSettings = readSettings();

    // Only set if not already configured
    if (!currentSettings.distributionMode) {
      const proxyBaseUrl = getVibeathonProxyUrl();

      writeSettings({
        distributionMode: {
          hideCommercialFeatures: true,
          hideProButtons: true,
          hideExternalIntegrations: true,
          hideNavigation: ['hub', 'library'],
          proxySettings: {
            enabled: true,
            baseUrl: proxyBaseUrl,
            retryCount: 0,
            useFallback: false,
          }
        }
      });
    }
  }
}
