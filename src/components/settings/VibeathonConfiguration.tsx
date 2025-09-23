import { useState } from "react";
import { Info, KeyRound, Trash2, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserSettings } from "@/lib/schemas";
import { useSettings } from "@/hooks/useSettings";
import { IpcClient } from "@/ipc/ipc_client";

interface VibeathonConfigurationProps {
  settings: UserSettings | null | undefined;
}

export function VibeathonConfiguration({ settings }: VibeathonConfigurationProps) {
  const { updateSettings } = useSettings();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentApiKey = settings?.distributionMode?.vibeathonApiKey?.value;
  const hasApiKey = !!currentApiKey && currentApiKey !== "Not Set";
  const hasFallbackKeys = !!settings?.distributionMode?.proxySettings?.fallbackApiKeys;

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await updateSettings({
        distributionMode: {
          hideCommercialFeatures: settings?.distributionMode?.hideCommercialFeatures ?? false,
          hideProButtons: settings?.distributionMode?.hideProButtons ?? false,
          hideExternalIntegrations: settings?.distributionMode?.hideExternalIntegrations ?? false,
          hideNavigation: settings?.distributionMode?.hideNavigation ?? [],
          ...settings?.distributionMode,
          vibeathonApiKey: {
            value: apiKeyInput.trim(),
            encryptionType: "electron-safe-storage",
          },
        },
      });

      setApiKeyInput("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    setIsDeleting(true);
    setSaveError(null);

    try {
      await updateSettings({
        distributionMode: {
          hideCommercialFeatures: settings?.distributionMode?.hideCommercialFeatures ?? false,
          hideProButtons: settings?.distributionMode?.hideProButtons ?? false,
          hideExternalIntegrations: settings?.distributionMode?.hideExternalIntegrations ?? false,
          hideNavigation: settings?.distributionMode?.hideNavigation ?? [],
          ...settings?.distributionMode,
          vibeathonApiKey: undefined,
          proxySettings: {
            enabled: settings?.distributionMode?.proxySettings?.enabled ?? false,
            retryCount: settings?.distributionMode?.proxySettings?.retryCount ?? 0,
            useFallback: settings?.distributionMode?.proxySettings?.useFallback ?? false,
            ...settings?.distributionMode?.proxySettings,
            fallbackApiKeys: undefined,
            fallbackKeysExpiration: undefined,
          },
        },
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to delete API key");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFetchFallbackKeys = async () => {
    if (!hasApiKey) return;

    setIsFetching(true);
    setFetchError(null);

    try {
      await IpcClient.getInstance().fetchVibeathonKeys();
      // Settings will be updated automatically via the handler
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Failed to fetch fallback keys");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Vibeathon API Configuration</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure your Vibeathon API key to enable proxy routing and fetch fallback provider keys.
        </p>
      </div>

      <Accordion
        type="multiple"
        className="w-full space-y-4"
        defaultValue={["vibeathon-key"]}
      >
        <AccordionItem
          value="vibeathon-key"
          className="border rounded-lg px-4 bg-(--background-lightest)"
        >
          <AccordionTrigger className="text-lg font-medium hover:no-underline cursor-pointer">
            Vibeathon API Key
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            {hasApiKey && (
              <Alert variant="default" className="mb-4">
                <KeyRound className="h-4 w-4" />
                <AlertTitle className="flex justify-between items-center">
                  <span>Current Vibeathon API Key</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteApiKey}
                    disabled={isDeleting}
                    className="flex items-center gap-1 h-7 px-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </AlertTitle>
                <AlertDescription>
                  <p className="font-mono text-sm">{currentApiKey}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    This key is configured and ready to use.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label
                htmlFor="vibeathonApiKeyInput"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {hasApiKey ? "Update" : "Set"} Vibeathon API Key
              </label>
              <div className="flex items-start space-x-2">
                <Input
                  id="vibeathonApiKeyInput"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter your Vibeathon API key from vibeathon.us"
                  className={`flex-grow ${saveError ? "border-red-500" : ""}`}
                />
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSaving || !apiKeyInput.trim()}
                >
                  {isSaving ? "Saving..." : "Save Key"}
                </Button>
              </div>
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This key will be used to authenticate with the Vibeathon proxy service
                and fetch fallback AI provider keys.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="fallback-keys"
          className="border rounded-lg px-4 bg-(--background-lightest)"
        >
          <AccordionTrigger className="text-lg font-medium hover:no-underline cursor-pointer">
            Fallback AI Provider Keys
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            {hasFallbackKeys ? (
              <Alert variant="default" className="mb-4">
                <KeyRound className="h-4 w-4" />
                <AlertTitle>Fallback Keys Available</AlertTitle>
                <AlertDescription>
                  <p className="text-sm">
                    You have fallback AI provider keys configured. These will be used
                    if the Vibeathon proxy becomes unavailable.
                  </p>
                  {settings?.distributionMode?.proxySettings?.fallbackKeysExpiration && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      Keys expire: {new Date(settings.distributionMode.proxySettings.fallbackKeysExpiration).toLocaleDateString()}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="default" className="mb-4">
                <Info className="h-4 w-4" />
                <AlertTitle>No Fallback Keys</AlertTitle>
                <AlertDescription>
                  <p className="text-sm">
                    No fallback AI provider keys are currently configured.
                    Fetch them using your Vibeathon API key.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Button
                onClick={handleFetchFallbackKeys}
                disabled={isFetching || !hasApiKey}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isFetching ? "Fetching Keys..." : "Fetch Fallback Keys"}
              </Button>
              {fetchError && <p className="text-xs text-red-600">{fetchError}</p>}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {!hasApiKey
                  ? "Set your Vibeathon API key first to fetch fallback keys."
                  : "Fetch fresh AI provider keys from your Vibeathon account for fallback use."}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}