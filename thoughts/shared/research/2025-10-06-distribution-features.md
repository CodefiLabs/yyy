---
date: 2025-10-06T18:31:37+0000
researcher: Claude
git_commit: 1da0e35182c2293ac375cb4b975e536c1d215b18
branch: vibeathon/v1
repository: dyad-codefi
topic: "Distribution Features: Proxy Testing, Prompt Library, MCP Servers, Settings Visibility, Ask/Agent Toggle"
tags: [research, codebase, distribution, vibeathon, proxy, prompts, mcp, settings, chat-modes]
status: complete
last_updated: 2025-10-06
last_updated_by: Claude
---

# Research: Distribution Features Implementation

**Date**: 2025-10-06T18:31:37+0000
**Researcher**: Claude
**Git Commit**: 1da0e35182c2293ac375cb4b975e536c1d215b18
**Branch**: vibeathon/v1
**Repository**: dyad-codefi

## Research Question

How to implement 5 distribution features:
1. Test local dev API for inference at https://app.vibeathon.test
2. Prepopulate prompts for prompt library from source .md files
3. Prepopulate MCP servers from config JSON
4. Hide telemetry and integrations settings via env vars
5. Convert "Ask" button into toggle between "Ask" and "Agent"

## Summary

All 5 features have existing infrastructure but need specific implementations:
1. **Proxy testing**: Infrastructure exists, need to configure `DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1`
2. **Prompt prepopulation**: No seeding mechanism exists - needs new implementation
3. **MCP prepopulation**: No default servers exist - needs new implementation
4. **Settings visibility**: Partial support via `distributionMode` - needs extension
5. **Ask/Agent toggle**: Mode selector exists as dropdown - needs UI conversion to toggle

## Detailed Findings

### 1. Inference API Proxy Configuration

#### Current Implementation
- **Main routing**: `src/ipc/utils/get_model_client.ts:81-148` - Vibeathon proxy routing when distribution mode enabled
- **Proxy URL source**: `src/ipc/utils/distribution_utils.ts:17-26` - `getVibeathonProxyUrl()` checks `DYAD_DISTRIBUTION_PROXY_URL` env var
- **API transformation**: `src/ipc/utils/vibeathon_api.ts:124` - `transformToOpenAIFormat()` standardizes requests
- **Settings handler**: `src/ipc/handlers/settings_handlers.ts:88-101` - Auto-configures proxy on distribution builds

#### How to Test Local Dev API
```bash
# Set environment variable
export DYAD_DISTRIBUTION_BUILD=true
export DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1

# Run app
npm run start:distribution:dev
```

#### Expected Flow
1. User sends message in chat
2. `chat_stream_handlers.ts:770` calls `streamText()` with model from `getModelClient()`
3. `getModelClient()` detects distribution mode, creates OpenAI client with custom baseURL
4. All requests transform to OpenAI format and route through `http://app.vibeathon.test/api/v1/chat/completions`
5. Response streams back through Vercel AI SDK

#### Verification Points
- Check network requests go to vibeathon.test
- Verify API key is sent in Authorization header
- Confirm response format matches OpenAI streaming spec
- Test error handling for failed requests

### 2. Prompt Library Prepopulation

#### Current State
- **Storage**: SQLite database table `prompts` (`src/db/schema.ts:177-198`)
- **CRUD operations**: `src/ipc/handlers/prompt_handlers.ts` - Complete IPC handlers
- **UI**: `src/pages/library.tsx` - Prompt library page
- **No seeding mechanism**: Users start with empty library

#### Schema
```typescript
{
  id: number;
  title: string;
  description: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Implementation Needed
Create seeding mechanism in database initialization:
- **Location**: `src/db/index.ts` - Add to `initializeDatabase()`
- **Source directory**: Create `resources/default-prompts/` with `.md` files
- **File format**:
  ```markdown
  ---
  title: Prompt Title
  description: Brief description
  ---
  Prompt content here...
  ```
- **Logic**: Read all `.md` files, parse frontmatter, insert if not exists

#### Files to Create/Modify
1. `resources/default-prompts/*.md` - Default prompt files
2. `src/db/index.ts` - Add `seedDefaultPrompts()` function
3. `src/db/seed_prompts.ts` - New file with seeding logic

### 3. MCP Server Prepopulation

#### Current State
- **Storage**: SQLite database table `mcp_servers` (`src/db/schema.ts:177-214`)
- **Configuration**: `src/ipc/handlers/mcp_handlers.ts` - Complete CRUD operations
- **UI**: `src/components/settings/ToolsMcpSettings.tsx` - Settings page
- **No defaults**: Users must manually configure all servers

#### Schema
```typescript
{
  id: number;
  name: string;
  transport: "stdio" | "http";
  command?: string; // For stdio
  args?: string[]; // For stdio
  cwd?: string;
  envJson?: Record<string, string>;
  url?: string; // For http
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
```

#### Implementation Needed
Create default servers configuration:
- **Location**: `resources/default-mcp-servers.json`
- **Format**:
  ```json
  [
    {
      "name": "Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"],
      "enabled": true
    }
  ]
  ```
- **Seeding logic**: Add to `src/db/index.ts` - `seedDefaultMcpServers()`

#### Recommended Default Servers
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-puppeteer` - Browser automation
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-fetch` - HTTP requests

### 4. Hide Telemetry and Integrations Settings

#### Current Implementation
- **Distribution flag**: `src/ipc/utils/distribution_utils.ts:2` - `IS_DISTRIBUTION_BUILD`
- **Settings schema**: `src/lib/schemas.ts:293-319` - `shouldHideFeature()` helper
- **Partial support**: Already hides some features in distribution mode

#### Existing Patterns

**Pattern 1: Early Return**
```typescript
// src/pages/settings.tsx:337-341
export function VibeathonApiKeySection() {
  if (!IS_DISTRIBUTION_BUILD) {
    return null;
  }
  // render content
}
```

**Pattern 2: Settings-based**
```typescript
// src/lib/schemas.ts:293-319
if (shouldHideFeature(settings, 'feature-key')) {
  return null;
}
```

#### Implementation Needed

**Option A: Simple env var check**
```typescript
// src/pages/settings.tsx
import { IS_DISTRIBUTION_BUILD } from '../ipc/utils/distribution_utils';

// Hide telemetry section (lines 92-106)
{!IS_DISTRIBUTION_BUILD && (
  <Card>
    <CardHeader>Telemetry</CardHeader>
    {/* ... */}
  </Card>
)}

// Hide integrations section (lines 111-125)
{!IS_DISTRIBUTION_BUILD && (
  <Card>
    <CardHeader>Integrations</CardHeader>
    {/* ... */}
  </Card>
)}
```

**Option B: Extend distributionMode settings**
Add to `src/lib/schemas.ts`:
```typescript
export const DISTRIBUTION_FEATURE_KEYS = [
  // ... existing keys
  'telemetry-settings',
  'integration-settings',
] as const;
```

Then in `shouldHideFeature()`:
```typescript
case 'telemetry-settings':
  return config.hideCommercialFeatures;
case 'integration-settings':
  return config.hideExternalIntegrations;
```

#### Components to Modify
- `src/pages/settings.tsx:92-106` - Telemetry section
- `src/pages/settings.tsx:111-125` - Integrations section
- `src/components/SettingsList.tsx` - Remove from navigation list

### 5. Ask/Agent Toggle Button

#### Current Implementation
- **Mode selector**: `src/components/ChatModeSelector.tsx` - Dropdown with 3 modes (Build, Ask, Agent)
- **Keyboard shortcut**: `src/hooks/useChatModeToggle.ts` - Cmd+. cycles modes
- **Container**: `src/components/ChatInputControls.tsx:18` - Renders selector
- **Send button**: `src/components/chat/ChatInput.tsx:318-327` - Standard send icon

#### Mode Behavior Differences
- **Build mode**: Full code generation with `<dyad-write>` tags
- **Ask mode**: Explanations only, no file modifications (`src/prompts/system_prompt.ts:359-378`)
- **Agent mode**: MCP tools enabled, code generation allowed

#### Current UI
```typescript
// src/components/ChatModeSelector.tsx
<Select value={mode} onValueChange={handleModeChange}>
  <SelectTrigger>Build / Ask / Agent</SelectTrigger>
  <SelectContent>
    <SelectItem value="build">Build</SelectItem>
    <SelectItem value="ask">Ask</SelectItem>
    <SelectItem value="agent">Agent</SelectItem>
  </SelectContent>
</Select>
```

#### Implementation Options

**Option A: Toggle Button (2 modes)**
Remove "Build" mode, toggle between Ask/Agent only:
```typescript
<Button
  variant="outline"
  onClick={() => setMode(mode === 'ask' ? 'agent' : 'ask')}
>
  {mode === 'ask' ? 'Ask' : 'Agent'}
</Button>
```

**Option B: Segmented Control (3 modes)**
```typescript
<ToggleGroup type="single" value={mode} onValueChange={setMode}>
  <ToggleGroupItem value="build">Build</ToggleGroupItem>
  <ToggleGroupItem value="ask">Ask</ToggleGroupItem>
  <ToggleGroupItem value="agent">Agent</ToggleGroupItem>
</ToggleGroup>
```

**Option C: Replace Send Button**
Convert send button itself into mode indicator:
```typescript
<Button type="submit" disabled={disabled}>
  {mode === 'ask' ? 'Ask' : mode === 'agent' ? 'Agent' : 'Build'}
  <SendHorizontalIcon />
</Button>
```

#### Recommended Approach
**Option C with toggle** - Replace send button to show current mode, add separate toggle:
- Send button shows: "Ask" or "Agent" label
- Small toggle control next to input to switch modes
- Maintains existing keyboard shortcut (Cmd+.)

#### Files to Modify
- `src/components/chat/ChatInput.tsx:318-327` - Update send button
- `src/components/ChatModeSelector.tsx` - Convert to toggle or remove
- `src/components/ChatInputControls.tsx` - Adjust layout

## Architecture Insights

### Vibeathon Proxy Flow
```
User Input
  → chat_stream_handlers.ts:770
  → getModelClient() (checks IS_DISTRIBUTION_BUILD)
  → createOpenAI() with baseURL from getVibeathonProxyUrl()
  → Transform to OpenAI format (vibeathon_api.ts:124)
  → POST to {baseURL}/chat/completions
  → Stream response back via Vercel AI SDK
```

### Distribution Mode Initialization
```
App Start
  → main.ts
  → ipc_host.ts registers handlers
  → settings_handlers.ts:initializeDistributionSettings()
  → Checks IS_DISTRIBUTION_BUILD
  → Auto-configures distributionMode settings
  → UI reads settings and conditionally renders
```

### Settings Persistence
- **Location**: User data directory `user-settings.json`
- **Encryption**: API keys stored with `electron-safe-storage`
- **Schema**: Validated via Zod schemas in `src/lib/schemas.ts`
- **Updates**: IPC handlers → main process → writeSettings() → disk

## Code References

### Critical Files
- `src/ipc/utils/get_model_client.ts:81-148` - Proxy routing logic
- `src/ipc/utils/distribution_utils.ts` - Distribution mode utilities
- `src/ipc/utils/vibeathon_api.ts` - API transformation
- `src/db/schema.ts` - Database schema for prompts/MCP
- `src/pages/settings.tsx` - Main settings page
- `src/components/ChatModeSelector.tsx` - Mode selector UI
- `src/lib/schemas.ts:293-319` - Feature hiding logic

### Environment Variables
- `DYAD_DISTRIBUTION_BUILD=true` - Enable distribution mode
- `DYAD_DISTRIBUTION_PROXY_URL` - Override proxy URL
- Default dev: `http://app.vibeathon.test/api/v1`
- Default prod: `https://app.vibeathon.us/api/v1`

## Implementation Priority

### Phase 1: Testing Infrastructure (Immediate)
1. Configure local proxy URL for testing
2. Verify request/response flow
3. Test error handling

### Phase 2: Settings Visibility (Easy)
1. Hide telemetry section in distribution builds
2. Hide integrations section in distribution builds
3. Update navigation list

### Phase 3: UI Conversion (Medium)
1. Convert Ask/Agent selector to toggle
2. Update send button to show mode
3. Test keyboard shortcuts

### Phase 4: Data Seeding (Complex)
1. Create default prompts markdown files
2. Implement prompt seeding logic
3. Create MCP servers JSON config
4. Implement MCP seeding logic
5. Test seeding on fresh installs

## Open Questions

1. **Prompts**: Should prepopulated prompts be editable or read-only?
2. **MCP Servers**: Which default servers should be included?
3. **Mode Toggle**: Keep all 3 modes or just Ask/Agent in distribution?
4. **Proxy Testing**: Need to set up app.vibeathon.test API endpoint first?
5. **Error Handling**: How should proxy failures be displayed to users?

## Next Steps

1. Clarify which features to implement first
2. Decide on UI approach for Ask/Agent toggle
3. Define list of default prompts and MCP servers
4. Set up local vibeathon.test API for testing
5. Create detailed implementation plan with phases
