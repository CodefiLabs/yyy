import { ipcMain } from "electron";
import type { UserSettings } from "../../lib/schemas";
import { writeSettings } from "../../main/settings";
import { readSettings } from "../../main/settings";
import { IS_DISTRIBUTION_BUILD } from "../utils/distribution_utils";

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
}

export async function initializeDistributionSettings(): Promise<void> {
  if (IS_DISTRIBUTION_BUILD) {
    const currentSettings = readSettings();

    // Only set if not already configured
    if (!currentSettings.distributionMode) {
      writeSettings({
        distributionMode: {
          hideCommercialFeatures: true,
          hideProButtons: true,
          hideExternalIntegrations: true,
          hideNavigation: ['hub', 'library'],
        }
      });
    }
  }
}
