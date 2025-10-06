import {
  MiniSelectTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings } from "@/hooks/useSettings";
import type { ChatMode } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { detectIsMac } from "@/hooks/useChatModeToggle";
import { IS_DISTRIBUTION_BUILD, HIDE_BUILD_MODE } from "@/ipc/utils/distribution_utils";
import { MessageCircleQuestion, Bot } from "lucide-react";

export function ChatModeSelector() {
  const { settings, updateSettings } = useSettings();

  const shouldHideBuildMode = IS_DISTRIBUTION_BUILD || HIDE_BUILD_MODE;
  const selectedMode = settings?.selectedChatMode || (shouldHideBuildMode ? "ask" : "build");

  const handleModeChange = (value: string) => {
    updateSettings({ selectedChatMode: value as ChatMode });
  };

  const getModeDisplayName = (mode: ChatMode) => {
    switch (mode) {
      case "build":
        return "Build";
      case "ask":
        return "Ask";
      case "agent":
        return "Agent";
      default:
        return shouldHideBuildMode ? "Ask" : "Build";
    }
  };
  const isMac = detectIsMac();

  // Hide Build mode: icon button group for Ask/Agent only
  if (shouldHideBuildMode) {
    return (
      <ToggleGroup
        type="single"
        value={selectedMode}
        onValueChange={(value) => value && handleModeChange(value)}
        variant="outline"
        className="gap-0"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="ask"
              aria-label="Ask mode"
              data-testid="chat-mode-ask"
              className="h-8 px-2.5 text-xs rounded-r-none border-r-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <MessageCircleQuestion className="size-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col">
              <span className="font-medium">Ask</span>
              <span className="text-xs opacity-90">
                Ask questions about the app
              </span>
              <span className="text-xs opacity-75 mt-1">
                {isMac ? "⌘ + ." : "Ctrl + ."} to toggle
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="agent"
              aria-label="Agent mode"
              data-testid="chat-mode-agent"
              className="h-8 px-2.5 text-xs rounded-l-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Bot className="size-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col">
              <span className="font-medium">Agent</span>
              <span className="text-xs opacity-90">
                Use tools (MCP) and generate code
              </span>
              <span className="text-xs opacity-75 mt-1">
                {isMac ? "⌘ + ." : "Ctrl + ."} to toggle
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
    );
  }

  // Normal mode: dropdown with all 3 options
  return (
    <Select value={selectedMode} onValueChange={handleModeChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <MiniSelectTrigger
            data-testid="chat-mode-selector"
            className={cn(
              "h-6 w-fit px-1.5 py-0 text-xs-sm font-medium shadow-none gap-0.5",
              selectedMode === "build"
                ? "bg-background hover:bg-muted/50 focus:bg-muted/50"
                : "bg-primary/10 hover:bg-primary/20 focus:bg-primary/20 text-primary border-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 dark:focus:bg-primary/30",
            )}
            size="sm"
          >
            <SelectValue>{getModeDisplayName(selectedMode)}</SelectValue>
          </MiniSelectTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col">
            <span>Open mode menu</span>
            <span className="text-xs text-gray-200 dark:text-gray-500">
              {isMac ? "⌘ + ." : "Ctrl + ."} to toggle
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
      <SelectContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SelectItem value="build">
          <div className="flex flex-col items-start">
            <span className="font-medium">Build</span>
            <span className="text-xs text-muted-foreground">
              Generate and edit code
            </span>
          </div>
        </SelectItem>
        <SelectItem value="ask">
          <div className="flex flex-col items-start">
            <span className="font-medium">Ask</span>
            <span className="text-xs text-muted-foreground">
              Ask questions about the app
            </span>
          </div>
        </SelectItem>
        <SelectItem value="agent">
          <div className="flex flex-col items-start">
            <span className="font-medium">Agent (experimental)</span>
            <span className="text-xs text-muted-foreground">
              Agent can use tools (MCP) and generate code
            </span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
