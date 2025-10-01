import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { ProviderSettingsGrid } from "@/components/ProviderSettings";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { IpcClient } from "@/ipc/ipc_client";
import { showSuccess, showError } from "@/lib/toast";
import { AutoApproveSwitch } from "@/components/AutoApproveSwitch";
import { TelemetrySwitch } from "@/components/TelemetrySwitch";
import { MaxChatTurnsSelector } from "@/components/MaxChatTurnsSelector";
import { ThinkingBudgetSelector } from "@/components/ThinkingBudgetSelector";
import { useSettings } from "@/hooks/useSettings";
import { useAppVersion } from "@/hooks/useAppVersion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter, Link } from "@tanstack/react-router";
import { GitHubIntegration } from "@/components/GitHubIntegration";
import { VercelIntegration } from "@/components/VercelIntegration";
import { SupabaseIntegration } from "@/components/SupabaseIntegration";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AutoFixProblemsSwitch } from "@/components/AutoFixProblemsSwitch";
import { AutoUpdateSwitch } from "@/components/AutoUpdateSwitch";
import { ReleaseChannelSelector } from "@/components/ReleaseChannelSelector";
import { NeonIntegration } from "@/components/NeonIntegration";
import { RuntimeModeSelector } from "@/components/RuntimeModeSelector";
import { ToolsMcpSettings } from "@/components/settings/ToolsMcpSettings";
import { IS_DISTRIBUTION_BUILD, getVibeathonProxyUrl } from "@/ipc/utils/distribution_utils";
import { warmValidationCache } from "@/hooks/useVibeathonKeyValidation";
import { useEffect } from "react";

export default function SettingsPage() {
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const appVersion = useAppVersion();
  const { settings, updateSettings } = useSettings();
  const router = useRouter();

  const handleResetEverything = async () => {
    setIsResetting(true);
    try {
      const ipcClient = IpcClient.getInstance();
      await ipcClient.resetAll();
      showSuccess("Successfully reset everything. Restart the application.");
    } catch (error) {
      console.error("Error resetting:", error);
      showError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsResetting(false);
      setIsResetDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen px-8 py-4">
      <div className="max-w-5xl mx-auto">
        <Button
          onClick={() => router.history.back()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 mb-4 bg-(--background-lightest) py-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
        <div className="flex justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
        </div>

        <div className="space-y-6">
          <VibeathonApiKeySection />
          <GeneralSettings appVersion={appVersion} />
          <WorkflowSettings />
          <AISettings />

          <div
            id="provider-settings"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm"
          >
            <ProviderSettingsGrid />
          </div>

          <div className="space-y-6">
            <div
              id="telemetry"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
            >
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Telemetry
              </h2>
              <div className="space-y-2">
                <TelemetrySwitch />
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  This records anonymous usage data to improve the product.
                </div>
              </div>

              <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                <span className="mr-2 font-medium">Telemetry ID:</span>
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200 font-mono">
                  {settings ? settings.telemetryUserId : "n/a"}
                </span>
              </div>
            </div>
          </div>

          {/* Integrations Section */}
          <div
            id="integrations"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Integrations
            </h2>
            <div className="space-y-4">
              <GitHubIntegration />
              <VercelIntegration />
              <SupabaseIntegration />
              <NeonIntegration />
            </div>
          </div>

          {/* Tools (MCP) */}
          <div
            id="tools-mcp"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Tools (MCP)
            </h2>
            <ToolsMcpSettings />
          </div>

          {/* Experiments Section */}
          <div
            id="experiments"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Experiments
            </h2>
            <div className="space-y-4">
              <div className="space-y-1 mt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-native-git"
                    checked={!!settings?.enableNativeGit}
                    onCheckedChange={(checked) => {
                      updateSettings({
                        enableNativeGit: checked,
                      });
                    }}
                  />
                  <Label htmlFor="enable-native-git">Enable Native Git</Label>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Native Git offers faster performance but requires{" "}
                  <a
                    onClick={() => {
                      IpcClient.getInstance().openExternalUrl(
                        "https://git-scm.com/downloads",
                      );
                    }}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    installing Git
                  </a>
                  .
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div
            id="danger-zone"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-red-200 dark:border-red-800"
          >
            <h2 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
              Danger Zone
            </h2>

            <div className="space-y-4">
              <div className="flex items-start justify-between flex-col sm:flex-row sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Reset Everything
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This will delete all your apps, chats, and settings. This
                    action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setIsResetDialogOpen(true)}
                  disabled={isResetting}
                  className="rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? "Resetting..." : "Reset Everything"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isResetDialogOpen}
        title="Reset Everything"
        message="Are you sure you want to reset everything? This will delete all your apps, chats, and settings. This action cannot be undone."
        confirmText="Reset Everything"
        cancelText="Cancel"
        onConfirm={handleResetEverything}
        onCancel={() => setIsResetDialogOpen(false)}
      />
    </div>
  );
}

export function GeneralSettings({ appVersion }: { appVersion: string | null }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      id="general-settings"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        General Settings
      </h2>

      <div className="space-y-4 mb-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Theme
          </label>

          <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
            {(["system", "light", "dark"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setTheme(option)}
                className={`
                px-4 py-1.5 text-sm font-medium rounded-md
                transition-all duration-200
                ${
                  theme === option
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }
              `}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1 mt-4">
        <AutoUpdateSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          This will automatically update the app when new versions are
          available.
        </div>
      </div>

      <div className="mt-4">
        <ReleaseChannelSelector />
      </div>

      <div className="mt-4">
        <RuntimeModeSelector />
      </div>

      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-4">
        <span className="mr-2 font-medium">App Version:</span>
        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200 font-mono">
          {appVersion ? appVersion : "-"}
        </span>
      </div>
    </div>
  );
}

export function WorkflowSettings() {
  return (
    <div
      id="workflow-settings"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Workflow Settings
      </h2>

      <div className="space-y-1">
        <AutoApproveSwitch showToast={false} />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          This will automatically approve code changes and run them.
        </div>
      </div>

      <div className="space-y-1 mt-4">
        <AutoFixProblemsSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          This will automatically fix TypeScript errors.
        </div>
      </div>
    </div>
  );
}
export function AISettings() {
  return (
    <div
      id="ai-settings"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        AI Settings
      </h2>

      <div className="mt-4">
        <ThinkingBudgetSelector />
      </div>

      <div className="mt-4">
        <MaxChatTurnsSelector />
      </div>
    </div>
  );
}

export function VibeathonApiKeySection() {
  // Only show in distribution builds
  if (!IS_DISTRIBUTION_BUILD) {
    return null;
  }

  const { settings, updateSettings } = useSettings();
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{
    type: 'success' | 'error';
    content: string | React.ReactNode;
  } | null>(null);

  useEffect(() => {
    const currentKey = settings?.distributionMode?.vibeathonApiKey?.value;
    if (currentKey) {
      setApiKey(currentKey);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsValidating(true);
    setValidationMessage(null);

    try {
      const isValid = await IpcClient.getInstance().validateVibeathonKey(apiKey);

      if (isValid) {
        // Warm the validation cache immediately after successful validation
        // This prevents re-validation when navigating to home page
        warmValidationCache(apiKey);

        // Save to settings and wait for it to complete
        await updateSettings({
          distributionMode: {
            ...settings?.distributionMode,
            vibeathonApiKey: { value: apiKey },
          },
        });

        // Add a small delay to ensure settings are fully persisted
        await new Promise(resolve => setTimeout(resolve, 100));

        setValidationMessage({
          type: 'success',
          content: (
            <>
              API key validated and saved successfully!{' '}
              <Link
                to="/"
                className="underline font-medium hover:text-green-900 dark:hover:text-green-200"
              >
                Go to Apps
              </Link>
            </>
          ),
        });
      } else {
        setValidationMessage({
          type: 'error',
          content: 'Invalid API key. Please check and try again.',
        });
      }
    } catch {
      setValidationMessage({
        type: 'error',
        content: 'Error validating API key. Please try again.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Determine environment-aware URL
  const vibeathonUrl = getVibeathonProxyUrl().includes('vibeathon.test')
    ? 'app.vibeathon.test'
    : 'app.vibeathon.us';

  return (
    <div
      id="vibeathon-api-key"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Vibeathon API Key
      </h2>

      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          Copy your API key from{' '}
          <a
            href={`https://${vibeathonUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {vibeathonUrl}
          </a>
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Note: If the Vibeathon event is over, download the full version of Dyad at{' '}
          <a
            href="https://www.dyad.sh/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            dyad.sh
          </a>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Vibeathon API key"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isValidating || !apiKey}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isValidating ? 'Validating...' : 'Validate & Save'}
        </button>

        {validationMessage && (
          <div
            className={`p-3 rounded-md ${
              validationMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {validationMessage.content}
          </div>
        )}
      </div>
    </div>
  );
}
