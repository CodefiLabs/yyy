import { useCallback, useMemo } from "react";
import { useSettings } from "./useSettings";
import { useShortcut } from "./useShortcut";
import { captureEvent } from "@/lib/telemetry";
import { ChatModeSchema, type ChatMode } from "../lib/schemas";
import { IS_DISTRIBUTION_BUILD, HIDE_BUILD_MODE } from "../ipc/utils/distribution_utils";

export function useChatModeToggle() {
  const { settings, updateSettings } = useSettings();

  // Detect if user is on mac
  const isMac = useIsMac();

  // Memoize the modifiers object to prevent re-registration
  const modifiers = useMemo(
    () => ({
      ctrl: !isMac,
      meta: isMac,
    }),
    [isMac],
  );

  // Function to toggle between ask and build chat modes
  const toggleChatMode = useCallback(() => {
    if (!settings || !settings.selectedChatMode) return;

    const currentMode = settings.selectedChatMode;
    let newMode: ChatMode;
    const shouldHideBuildMode = IS_DISTRIBUTION_BUILD || HIDE_BUILD_MODE;

    if (shouldHideBuildMode) {
      // Hide Build mode: toggle between ask and agent only
      newMode = currentMode === "ask" ? "agent" : "ask";
    } else {
      // Normal: cycle through all three modes
      const modes = ChatModeSchema.options;
      const currentIndex = modes.indexOf(settings.selectedChatMode);
      newMode = modes[(currentIndex + 1) % modes.length];
    }

    updateSettings({ selectedChatMode: newMode });
    captureEvent("chat:mode_toggle", {
      from: currentMode,
      to: newMode,
      trigger: "keyboard_shortcut",
    });
  }, [settings, updateSettings]);

  // Add keyboard shortcut with memoized modifiers
  useShortcut(
    ".",
    modifiers,
    toggleChatMode,
    true, // Always enabled since we're not dependent on component selector
  );

  return { toggleChatMode, isMac };
}

// Add this function at the top
type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

export function detectIsMac(): boolean {
  const nav = navigator as NavigatorWithUserAgentData;
  // Try modern API first
  if ("userAgentData" in nav && nav.userAgentData?.platform) {
    return nav.userAgentData.platform.toLowerCase().includes("mac");
  }

  // Fallback to user agent check
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}
// Export the utility function and hook for use elsewhere
export function useIsMac(): boolean {
  return useMemo(() => detectIsMac(), []);
}
