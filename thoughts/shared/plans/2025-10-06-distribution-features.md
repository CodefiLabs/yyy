# Distribution Features Implementation Plan

## Overview

Implement 5 key features for the Dyad distribution build (Vibeathon version) that simplify the UI, prepopulate content, and enable local proxy testing. The distribution build uses a single Vibeathon API key to proxy all AI requests through app.vibeathon.test (dev) or app.vibeathon.us (prod).

## Current State Analysis

The codebase already has strong infrastructure for distribution builds:
- Distribution mode detection via `DYAD_DISTRIBUTION_BUILD` env var
- Vibeathon proxy routing in `src/ipc/utils/get_model_client.ts:81-148`
- Settings visibility patterns using `IS_DISTRIBUTION_BUILD` flag
- Chat mode selector with 3 modes (Build/Ask/Agent)
- Prompt library with SQLite storage
- MCP server configuration system

### Key Discoveries:
- Proxy infrastructure is complete, just needs testing verification (`src/ipc/utils/vibeathon_api.ts`)
- No seeding mechanism exists for prompts - all stored in database
- Build and Agent modes are nearly identical (Agent = Build + MCP tools)
- Settings visibility uses early return pattern (`src/pages/settings.tsx:337-341`)
- Chat mode stored in settings schema as `selectedChatMode` enum

## Desired End State

After completing all phases:
1. ✅ Telemetry and integrations settings hidden in distribution builds
2. ✅ Two read-only prompts prepopulated: "Debug Helper" and "Pre-flight Checklist"
3. ✅ Chat interface simplified to Ask/Agent toggle (Build mode hidden)
4. ✅ Verified proxy routing works with app.vibeathon.test
5. ✅ Git commits made after each phase

### Verification:
- Start app with `DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1 npm start`
- Settings page should not show Telemetry or Integrations sections
- Library page should show 2 default prompts (not editable)
- Chat input should show Ask/Agent toggle (no Build mode)
- Network requests should route to app.vibeathon.test

## What We're NOT Doing

- Not implementing default MCP servers (deferred)
- Not changing the core proxy routing logic (already works)
- Not modifying the 3-mode system globally (only hiding Build in distribution)
- Not making prompts deletable if read-only
- Not adding prompt import/export features

## Implementation Approach

Implement in order of complexity: easiest to hardest, with git commits after each phase. This allows testing each feature independently and provides rollback points.

---

## Phase 1: Hide Settings Sections

### Overview
Hide telemetry and integrations settings in distribution builds using the existing `IS_DISTRIBUTION_BUILD` pattern.

### Changes Required:

#### 1. Update Settings Page
**File**: `src/pages/settings.tsx`
**Changes**: Wrap telemetry and integrations sections in distribution mode check

```typescript
import { IS_DISTRIBUTION_BUILD } from "../ipc/utils/distribution_utils";

// Around line 92-106 (Telemetry section)
{!IS_DISTRIBUTION_BUILD && (
  <Card>
    <CardHeader>
      <CardTitle>Telemetry</CardTitle>
    </CardHeader>
    <CardContent>
      <TelemetrySwitch />
    </CardContent>
  </Card>
)}

// Around line 111-125 (Integrations section)
{!IS_DISTRIBUTION_BUILD && (
  <Card>
    <CardHeader>
      <CardTitle>Integrations</CardTitle>
      <CardDescription>
        Connect your accounts to deploy and collaborate
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <GitHubIntegration />
      <VercelIntegration />
      <SupabaseIntegration />
      <NeonIntegration />
    </CardContent>
  </Card>
)}
```

#### 2. Update Settings Navigation
**File**: `src/components/SettingsList.tsx`
**Changes**: Conditionally hide Telemetry and Integrations from sidebar

```typescript
import { IS_DISTRIBUTION_BUILD } from "../ipc/utils/distribution_utils";

const settingsList = [
  { id: "general", label: "General" },
  { id: "workflow", label: "Workflow" },
  ...(IS_DISTRIBUTION_BUILD ? [{ id: "vibeathon-api-key", label: "Vibeathon API Key" }] : []),
  { id: "providers", label: "Providers" },
  { id: "models", label: "Models" },
  { id: "tools", label: "Tools" },
  ...(!IS_DISTRIBUTION_BUILD ? [
    { id: "telemetry", label: "Telemetry" },
    { id: "integrations", label: "Integrations" },
  ] : []),
  { id: "about", label: "About" },
];
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] Start app with `DYAD_DISTRIBUTION_BUILD=true npm start`
- [ ] Settings page does not show "Telemetry" section
- [ ] Settings page does not show "Integrations" section
- [ ] Settings sidebar does not list "Telemetry" or "Integrations"
- [ ] Settings sidebar shows "Vibeathon API Key" entry
- [ ] Start app without env var - sections should appear normally

#### Git Commit:
- [ ] Commit changes: `git add -A && git commit -m "Hide telemetry and integrations in distribution builds"`

---

## Phase 2: Prompt Prepopulation

### Overview
Add database migration for read-only flag, create seeding system for default prompts, and prepopulate two starter prompts.

### Changes Required:

#### 1. Database Schema Update
**File**: `src/db/schema.ts`
**Changes**: Add `isReadOnly` boolean field to prompts table

```typescript
export const prompts = sqliteTable("prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  isReadOnly: integer("is_read_only", { mode: "boolean" })
    .notNull()
    .default(sql`0`),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

#### 2. Generate Migration
**Command**: `npm run db:generate`
**Result**: Creates new migration file in `drizzle/` directory

#### 3. Update TypeScript Types
**File**: `src/ipc/ipc_types.ts`
**Changes**: Add `isReadOnly` to PromptDto interface

```typescript
export interface PromptDto {
  id: number;
  title: string;
  description: string | null;
  content: string;
  isReadOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4. Create Default Prompts Directory
**Directory**: `resources/default-prompts/`
**Files**: Create two markdown files

**File**: `resources/default-prompts/debug-helper.md`
```markdown
---
title: Debug Helper
description: Helps you troubleshoot when something isn't working
---
It's not working. What information do you need from me to help you fix it?

Please ask me specific questions about:
- What I expected to happen
- What actually happened
- Any error messages I'm seeing
- Steps to reproduce the issue
- My environment and setup

Walk me through debugging this systematically.
```

**File**: `resources/default-prompts/preflight-checklist.md`
```markdown
---
title: Pre-flight Checklist
description: Creates a comprehensive checklist before starting a feature
---
Before we start building this feature, please create a comprehensive checklist of everything that needs to work completely before I can ship it.

Include:
- Core functionality requirements
- Edge cases to handle
- Error scenarios to test
- Performance considerations
- User experience requirements
- Integration points with existing code
- Testing requirements (unit, integration, e2e)
- Documentation needs
- Accessibility requirements
- Security considerations

Format this as a clear, actionable checklist I can verify before marking this feature as complete.
```

#### 5. Create Seeding Utility
**File**: `src/db/seed_prompts.ts`
**Changes**: New file with prompt seeding logic

```typescript
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { prompts } from "./schema";

interface PromptFrontmatter {
  title: string;
  description?: string;
}

export async function seedDefaultPrompts(
  db: BetterSQLite3Database,
  resourcesPath: string,
): Promise<void> {
  const promptsDir = join(resourcesPath, "default-prompts");

  try {
    const files = await readdir(promptsDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      const filePath = join(promptsDir, file);
      const fileContent = await readFile(filePath, "utf-8");
      const { data, content } = matter(fileContent);
      const frontmatter = data as PromptFrontmatter;

      // Check if prompt already exists by title
      const existing = db
        .select()
        .from(prompts)
        .where(eq(prompts.title, frontmatter.title))
        .get();

      if (!existing) {
        db.insert(prompts).values({
          title: frontmatter.title,
          description: frontmatter.description || null,
          content: content.trim(),
          isReadOnly: true,
        }).run();

        console.log(`Seeded default prompt: ${frontmatter.title}`);
      }
    }
  } catch (error) {
    // If directory doesn't exist, skip seeding (dev mode)
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
```

#### 6. Install Dependencies
**Command**: `npm install gray-matter`
**Purpose**: Parse markdown frontmatter

#### 7. Update Database Initialization
**File**: `src/db/index.ts`
**Changes**: Call seedDefaultPrompts after migrations

```typescript
import { seedDefaultPrompts } from "./seed_prompts";
import { app } from "electron";
import { join } from "path";

// In initializeDatabase function, after runMigrations()
export async function initializeDatabase(): Promise<Database> {
  // ... existing code ...

  runMigrations(db);

  // Seed default prompts (only in production builds with resources)
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath;
    await seedDefaultPrompts(db, resourcesPath);
  }

  return db;
}
```

#### 8. Update Prompt Handlers
**File**: `src/ipc/handlers/prompt_handlers.ts`
**Changes**: Prevent editing/deleting read-only prompts

```typescript
// In updatePrompt handler
ipcMain.handle("prompts:update", async (_event, id: number, params: UpdatePromptParamsDto) => {
  const db = await getDatabase();

  const prompt = db.select().from(prompts).where(eq(prompts.id, id)).get();

  if (!prompt) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  if (prompt.isReadOnly) {
    throw new Error("Cannot edit read-only prompts");
  }

  // ... rest of update logic
});

// In deletePrompt handler
ipcMain.handle("prompts:delete", async (_event, id: number) => {
  const db = await getDatabase();

  const prompt = db.select().from(prompts).where(eq(prompts.id, id)).get();

  if (!prompt) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  if (prompt.isReadOnly) {
    throw new Error("Cannot delete read-only prompts");
  }

  // ... rest of delete logic
});
```

#### 9. Update UI Components
**File**: `src/components/CreatePromptDialog.tsx`
**Changes**: Disable editing for read-only prompts

```typescript
// Add check in CreateOrEditPromptDialog
const isReadOnly = prompt?.isReadOnly || false;

// Disable form fields if read-only
<Input
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  disabled={isReadOnly}
/>

<Textarea
  value={content}
  onChange={(e) => setContent(e.target.value)}
  disabled={isReadOnly}
/>

// Hide save button if read-only
{!isReadOnly && (
  <Button type="submit">Save</Button>
)}
```

**File**: `src/pages/library.tsx`
**Changes**: Hide edit/delete buttons for read-only prompts

```typescript
// In PromptCard component
{!prompt.isReadOnly && (
  <>
    <Button onClick={() => onEdit(prompt)}>Edit</Button>
    <Button onClick={() => onDelete(prompt.id)}>Delete</Button>
  </>
)}

{prompt.isReadOnly && (
  <Badge variant="secondary">Read-only</Badge>
)}
```

#### 10. Update Electron Builder Config
**File**: `electron-builder.json5`
**Changes**: Include resources directory in build

```json5
{
  files: [
    "dist/**/*",
    "drizzle/**/*",
    "resources/**/*",  // Add this line
    "package.json"
  ],
  extraResources: [
    {
      from: "resources",
      to: "resources"
    }
  ]
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates: `npm run db:generate`
- [ ] Migration applies: `npm run db:push`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] Fresh database shows 2 default prompts in Library
- [ ] Default prompts show "Read-only" badge
- [ ] Cannot edit read-only prompt titles or content
- [ ] Cannot delete read-only prompts
- [ ] Can still create new editable prompts
- [ ] Can edit and delete user-created prompts
- [ ] Prompts work in chat with @mention syntax

#### Git Commit:
- [ ] Commit changes: `git add -A && git commit -m "Add read-only prompt prepopulation system"`

---

## Phase 3: Chat Mode Simplification

### Overview
Hide Build mode in distribution builds and convert the mode selector from dropdown to Ask/Agent toggle.

### Changes Required:

#### 1. Update Chat Mode Hook
**File**: `src/hooks/useChatModeToggle.ts`
**Changes**: Skip Build mode in distribution builds

```typescript
import { IS_DISTRIBUTION_BUILD } from "../ipc/utils/distribution_utils";

export function useChatModeToggle() {
  const [settings] = useSettings();
  const { updateSettings } = useUpdateSettings();

  const toggleChatMode = useCallback(() => {
    const currentMode = settings?.selectedChatMode || "build";

    let nextMode: ChatMode;
    if (IS_DISTRIBUTION_BUILD) {
      // In distribution: toggle between ask and agent only
      nextMode = currentMode === "ask" ? "agent" : "ask";
    } else {
      // Normal: cycle through all three modes
      if (currentMode === "build") {
        nextMode = "ask";
      } else if (currentMode === "ask") {
        nextMode = "agent";
      } else {
        nextMode = "build";
      }
    }

    updateSettings({ selectedChatMode: nextMode });
  }, [settings, updateSettings]);

  return { toggleChatMode };
}
```

#### 2. Set Default Mode for Distribution
**File**: `src/ipc/handlers/settings_handlers.ts`
**Changes**: Set default to "ask" mode in distribution builds

```typescript
// In initializeDistributionSettings function
export async function initializeDistributionSettings(): Promise<void> {
  if (!IS_DISTRIBUTION_BUILD) return;

  const settings = await readSettings();

  const updates: Partial<UserSettings> = {
    distributionMode: {
      ...settings.distributionMode,
      hideCommercialFeatures: true,
      hideProButtons: true,
      hideExternalIntegrations: true,
    },
    // Set default chat mode to "ask" for distribution
    selectedChatMode: settings.selectedChatMode || "ask",
  };

  await writeSettings(updates);
}
```

#### 3. Update Mode Selector Component
**File**: `src/components/ChatModeSelector.tsx`
**Changes**: Convert to toggle button in distribution mode

```typescript
import { IS_DISTRIBUTION_BUILD } from "../ipc/utils/distribution_utils";
import { Button } from "./ui/button";

export function ChatModeSelector() {
  const [settings] = useSettings();
  const { updateSettings } = useUpdateSettings();

  const mode = settings?.selectedChatMode || "build";

  const handleModeChange = (value: ChatMode) => {
    updateSettings({ selectedChatMode: value });
  };

  // Distribution mode: simple toggle button
  if (IS_DISTRIBUTION_BUILD) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={mode === "ask" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("ask")}
        >
          Ask
        </Button>
        <Button
          variant={mode === "agent" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("agent")}
        >
          Agent
        </Button>
      </div>
    );
  }

  // Normal mode: dropdown with all 3 options
  return (
    <Select value={mode} onValueChange={handleModeChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="build">Build</SelectItem>
        <SelectItem value="ask">Ask</SelectItem>
        <SelectItem value="agent">Agent</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

#### 4. Update Schema Validation
**File**: `src/lib/schemas.ts`
**Changes**: Ensure default mode is valid for distribution

```typescript
// Update ChatModeSchema default
export const ChatModeSchema = z.enum(["build", "ask", "agent"]).default("ask");

// In UserSettingsSchema, update selectedChatMode
selectedChatMode: ChatModeSchema.default(
  process.env.DYAD_DISTRIBUTION_BUILD === "true" ? "ask" : "build"
),
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] Start app with `DYAD_DISTRIBUTION_BUILD=true npm start`
- [ ] Chat input shows Ask/Agent toggle buttons (not dropdown)
- [ ] Default mode is "Ask"
- [ ] Clicking "Agent" switches to agent mode
- [ ] Keyboard shortcut (Cmd+.) toggles between Ask/Agent only
- [ ] MCP tools picker appears in Agent mode
- [ ] Start app without env var - dropdown shows all 3 modes

#### Git Commit:
- [ ] Commit changes: `git add -A && git commit -m "Simplify chat modes to Ask/Agent toggle in distribution"`

---

## Phase 4: Proxy Testing & Verification

### Overview
Create comprehensive test procedure to verify Vibeathon proxy routing works correctly with app.vibeathon.test.

### Changes Required:

#### 1. Create Test Documentation
**File**: `docs/vibeathon-proxy-testing.md`
**Changes**: New file with testing procedure

```markdown
# Vibeathon Proxy Testing Guide

## Prerequisites

1. Ensure `app.vibeathon.test` Laravel backend is running
2. Have a valid Vibeathon API key

## Environment Setup

```bash
export DYAD_DISTRIBUTION_BUILD=true
export DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1
```

## Manual Testing Procedure

### 1. Start Application
```bash
npm start
```

### 2. Configure API Key
- Navigate to Settings > Vibeathon API Key
- Enter your API key
- Click "Validate Key"
- Verify validation succeeds

### 3. Test Chat Request
- Create new app or open existing app
- Start a chat conversation
- Send message: "Hello, what's 2+2?"
- Verify response appears

### 4. Network Verification

Open Developer Tools (View > Toggle Developer Tools):

**Console Tab:**
- Should not show any network errors
- Should not show 401 unauthorized errors

**Network Tab:**
- Filter by "chat/completions"
- Verify requests go to `app.vibeathon.test/api/v1/chat/completions`
- Check request headers include `Authorization: Bearer <key>`
- Verify response status is 200
- Check response contains streaming data

### 5. Error Handling Test

**Invalid API Key:**
- Settings > Vibeathon API Key
- Enter invalid key "invalid-key-12345"
- Click "Validate Key"
- Verify error message appears

**Network Failure:**
- Stop Laravel backend
- Send chat message
- Verify user-friendly error appears
- Restart backend
- Verify chat works again

### 6. Provider Fallback Test

**Test Fallback Keys:**
- Click "Fetch Provider Keys" in settings
- Verify fallback keys populate for OpenAI, Anthropic, etc.
- These should be used when proxy request fails

## Automated Testing

### Unit Tests
```bash
npm test src/ipc/utils/vibeathon_api.test.ts
```

### E2E Tests
```bash
# Set test environment
export TEST_VIBEATHON_URL=http://app.vibeathon.test/api/v1
npm run e2e -- vibeathon.spec.ts
```

## Expected Flow

```
User Message
  ↓
ChatInput.tsx
  ↓
IPC: chat:stream
  ↓
chat_stream_handlers.ts
  ↓
getModelClient() [checks IS_DISTRIBUTION_BUILD]
  ↓
createOpenAI() with baseURL from DYAD_DISTRIBUTION_PROXY_URL
  ↓
transformToOpenAIFormat() [vibeathon_api.ts]
  ↓
HTTP POST to app.vibeathon.test/api/v1/chat/completions
  ↓
Stream response back to UI
```

## Troubleshooting

**Requests not going to vibeathon.test:**
- Check `DYAD_DISTRIBUTION_BUILD=true` is set
- Verify `DYAD_DISTRIBUTION_PROXY_URL` is set
- Check console for "Distribution mode enabled" message

**401 Unauthorized:**
- Verify API key is valid
- Check Authorization header in network tab
- Test key validation endpoint directly

**500 Server Error:**
- Check Laravel logs: `tail -f storage/logs/laravel.log`
- Verify database is running
- Check `.env` configuration

**Streaming not working:**
- Verify Laravel response includes correct headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `X-Accel-Buffering: no`
```

#### 2. Create Test Script
**File**: `testing/test-vibeathon-proxy.sh`
**Changes**: New bash script for quick testing

```bash
#!/bin/bash

echo "🧪 Testing Vibeathon Proxy Integration"
echo "======================================"
echo ""

# Check environment
if [ -z "$DYAD_DISTRIBUTION_BUILD" ]; then
  echo "❌ DYAD_DISTRIBUTION_BUILD not set"
  exit 1
fi

if [ -z "$DYAD_DISTRIBUTION_PROXY_URL" ]; then
  echo "❌ DYAD_DISTRIBUTION_PROXY_URL not set"
  exit 1
fi

echo "✅ Environment configured:"
echo "   Distribution: $DYAD_DISTRIBUTION_BUILD"
echo "   Proxy URL: $DYAD_DISTRIBUTION_PROXY_URL"
echo ""

# Test proxy endpoint is reachable
echo "🔍 Testing proxy endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$DYAD_DISTRIBUTION_PROXY_URL/health" || echo "000")

if [ "$RESPONSE" = "200" ]; then
  echo "✅ Proxy endpoint is reachable"
elif [ "$RESPONSE" = "000" ]; then
  echo "❌ Cannot reach proxy endpoint (connection failed)"
  exit 1
else
  echo "⚠️  Proxy endpoint returned: $RESPONSE"
fi

echo ""
echo "🚀 Starting Dyad application..."
echo "   Please test manually using the procedure in docs/vibeathon-proxy-testing.md"
echo ""

npm start
```

#### 3. Add Test to Package.json
**File**: `package.json`
**Changes**: Add test script

```json
{
  "scripts": {
    "test:proxy": "bash testing/test-vibeathon-proxy.sh"
  }
}
```

#### 4. Update Main README
**File**: `README.md`
**Changes**: Add proxy testing section

```markdown
## Testing Distribution Build

To test the Vibeathon proxy integration:

```bash
export DYAD_DISTRIBUTION_BUILD=true
export DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1
npm run test:proxy
```

See [docs/vibeathon-proxy-testing.md](docs/vibeathon-proxy-testing.md) for detailed testing procedure.
```

### Success Criteria:

#### Automated Verification:
- [ ] Script is executable: `chmod +x testing/test-vibeathon-proxy.sh`
- [ ] Script runs without errors: `npm run test:proxy`

#### Manual Verification:
- [ ] Follow complete testing procedure in `docs/vibeathon-proxy-testing.md`
- [ ] All network requests route to app.vibeathon.test
- [ ] Authorization header includes API key
- [ ] Chat responses stream correctly
- [ ] Error handling works (invalid key, network failure)
- [ ] Fallback keys fetch successfully
- [ ] No console errors during normal operation

#### Git Commit:
- [ ] Commit changes: `git add -A && git commit -m "Add comprehensive proxy testing documentation and scripts"`

---

## Testing Strategy

### Unit Tests:
- No new unit tests needed (existing coverage adequate)
- Existing tests in `src/__tests__/distribution.test.ts` cover settings logic

### Integration Tests:
- Existing E2E tests in `e2e-tests/distribution.spec.ts` cover UI visibility
- Manual testing required for proxy routing (requires live backend)

### Manual Testing Steps:
1. **Phase 1**: Start with `DYAD_DISTRIBUTION_BUILD=true`, verify settings hidden
2. **Phase 2**: Check Library page for 2 default prompts, test read-only behavior
3. **Phase 3**: Verify Ask/Agent toggle, test keyboard shortcut
4. **Phase 4**: Follow complete proxy testing guide

## Performance Considerations

- Prompt seeding only runs once on first launch (checks for existing prompts)
- Read-only check adds minimal overhead to edit/delete operations
- Mode toggle is client-side state change (no performance impact)
- Proxy routing has same performance as direct API calls (no extra latency)

## Migration Notes

**Existing Users:**
- Existing prompts remain editable (isReadOnly defaults to false)
- Users upgrading will see 2 new default prompts appear
- Chat mode preference is preserved unless distribution mode is enabled

**Fresh Installs:**
- Distribution builds start with 2 default prompts
- Default chat mode is "ask" (safe, non-destructive)
- Proxy URL automatically configured based on environment

**Rollback:**
- Each phase has separate commit
- Can rollback individual phases without affecting others
- Database migration for isReadOnly is backwards compatible (defaults to false)

## References

- Research: `thoughts/shared/research/2025-10-06-distribution-features.md`
- Existing implementation: `docs/vibeathon-implementation-summary.md`
- Proxy API: `src/ipc/utils/vibeathon_api.ts`
- Distribution utils: `src/ipc/utils/distribution_utils.ts`
- Chat modes: `src/components/ChatModeSelector.tsx`
