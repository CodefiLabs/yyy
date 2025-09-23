# Vibeathon Proxy Routing Implementation Plan

## Overview

Implement a comprehensive proxy routing system for Dyad distribution builds that routes all AI requests through Vibeathon proxy servers. The system includes Laravel API integration for user-specific API key management, exponential retry logic with fallback to direct providers, request logging for offline sync, and complete hiding of the Model Providers UI in distribution mode.

## Current State Analysis

The Dyad codebase has excellent infrastructure for this implementation:

### Key Discoveries:
- **Centralized AI Routing**: All AI requests flow through `getModelClient()` factory at `src/ipc/utils/get_model_client.ts:61`
- **Existing Proxy Pattern**: Dyad Pro already implements similar proxy routing (lines 81-148) that we can model after
- **Distribution Settings**: Schema already exists and can be extended for proxy configuration at `src/lib/schemas.ts:238-243`
- **Two AI Entry Points**: Main chat (`chat_stream_handlers.ts:206`) and help bot (`help_bot_handlers.ts:22`)
- **Feature Hiding System**: `shouldHideFeature()` utility already implemented for hiding UI components
- **Environment Patterns**: Consistent dev/prod URL patterns with fallbacks throughout codebase

## Desired End State

After implementation:
- Distribution builds automatically route all AI requests through Vibeathon proxy
- Users enter Vibeathon API key in settings to fetch fallback AI provider keys
- Model Providers section completely hidden in distribution mode
- Exponential retry with fallback to direct providers when proxy fails
- Failed requests logged for sync when proxy comes back online
- OpenAI-compatible request format standardization
- Dev (app.vibeathon.test/api/v1) vs prod (app.vibeathon.us/api/v1) proxy URLs

### Verification:
- Distribution build shows Vibeathon API key input instead of provider settings
- All AI requests (chat + help bot) route through proxy with user's API key
- Proxy failures trigger exponential backoff and eventual fallback
- Failed requests stored locally and can be synced when proxy returns
- Model provider UI completely hidden in distribution builds

## What We're NOT Doing

- Not modifying the core AI SDK integration patterns
- Not changing the existing Pro/non-Pro user flows
- Not breaking compatibility with standard Dyad builds
- Not storing sensitive API keys in plaintext (they'll be encrypted)
- Not creating a new settings UI framework (extending existing patterns)

## Implementation Approach

Leverage Dyad's existing proxy architecture by extending distribution mode settings and modifying the centralized `getModelClient()` factory to intercept all AI requests. Use the proven environment variable + settings pattern for configuration and follow existing encryption/security patterns for API key storage.

## Phase 1: Schema & Settings Infrastructure

### Overview
Extend the distribution mode settings schema to include Vibeathon proxy configuration and hide Model Providers UI in distribution builds.

### Changes Required:

#### 1. Distribution Settings Schema Extension
**File**: `src/lib/schemas.ts`
**Changes**: Extend distributionMode with proxy and API key configuration

```typescript
// Add to existing distributionMode object
vibeathonApiKey: SecretSchema.optional(),
proxySettings: z.object({
  enabled: z.boolean().optional().default(false),
  baseUrl: z.string().optional(),
  fallbackApiKeys: z.record(z.string(), SecretSchema).optional(), // {openai: {value, encryptionType}, anthropic: {value, encryptionType}}
  fallbackKeysExpiration: z.string().optional(), // ISO date string
  retryCount: z.number().optional().default(0),
  lastFailure: z.string().optional(), // ISO date string
  useFallback: z.boolean().optional().default(false),
}).optional(),
```

#### 2. Feature Keys for Provider UI Hiding
**File**: `src/ipc/utils/distribution_utils.ts`
**Changes**: Add feature keys for Model Providers UI

```typescript
export const DISTRIBUTION_FEATURE_KEYS = {
  // ... existing keys
  MODEL_PROVIDERS: 'model-providers',
  MODEL_PICKER: 'model-picker',
  PROVIDER_SETUP: 'provider-setup',
} as const;
```

#### 3. Feature Detection Logic
**File**: `src/lib/schemas.ts`
**Changes**: Add cases to shouldHideFeature for new provider UI keys

```typescript
// Add to switch statement in shouldHideFeature
case 'model-providers':
case 'model-picker':
case 'provider-setup':
  return config.hideCommercialFeatures || config.proxySettings?.enabled;
```

#### 4. Hide Model Providers in Settings Navigation
**File**: `src/components/SettingsList.tsx`
**Changes**: Add distribution mode check for Model Providers section

```typescript
import { shouldHideFeature } from '@/lib/schemas';
import { useSettings } from '@/hooks/useSettings';

// In component render
const { settings } = useSettings();

// Filter out model-providers section when hidden
const filteredItems = items.filter(item =>
  item.id !== 'provider-settings' ||
  !shouldHideFeature(settings, 'model-providers')
);
```

#### 5. Hide ModelPicker in Chat Interface
**File**: `src/components/ChatInputControls.tsx`
**Changes**: Conditionally render ModelPicker based on distribution settings

```typescript
import { shouldHideFeature } from '@/lib/schemas';
import { useSettings } from '@/hooks/useSettings';

// Add conditional rendering around ModelPicker
{!shouldHideFeature(settings, 'model-picker') && (
  <ModelPicker />
)}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `npm run ts`
- [x] Linting passes: `npm run lint`
- [x] Schema validation tests pass: `npm test -- schemas.test.ts`
- [x] Settings encryption/decryption works: `npm test -- settings.test.ts`

#### Manual Verification:
- [ ] Distribution build hides Model Providers section in settings
- [ ] ModelPicker hidden in chat interface when distribution mode enabled
- [ ] Setup banners/provider cards hidden in distribution mode
- [ ] Standard builds show all provider UI normally

---

## Phase 2: API Key Management System

### Overview
Implement Vibeathon API key input UI and Laravel endpoint integration for fetching fallback AI provider keys.

### Changes Required:

#### 1. Vibeathon API Key Configuration Component
**File**: `src/components/settings/VibeathonConfiguration.tsx`
**Changes**: Create new component for Vibeathon API key input (new file)

```typescript
import { SecretInput } from './SecretInput';
import { useSettings } from '@/hooks/useSettings';

export function VibeathonConfiguration() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-4">
      <h3>Vibeathon API Configuration</h3>
      <SecretInput
        label="Vibeathon API Key"
        placeholder="Enter your API key from vibeathon.us"
        value={settings.distributionMode?.vibeathonApiKey}
        onChange={(value) => updateSettings({
          distributionMode: {
            ...settings.distributionMode,
            vibeathonApiKey: value
          }
        })}
      />
      <FetchApiKeysButton />
    </div>
  );
}
```

#### 2. Laravel API Integration Utility
**File**: `src/ipc/utils/vibeathon_api.ts`
**Changes**: Create Laravel API client for fetching fallback keys (new file)

```typescript
import { getEnvVar } from './read_env';

const VIBEATHON_API_BASE = getEnvVar('DYAD_DISTRIBUTION_PROXY_URL') ||
  (process.env.NODE_ENV === 'development'
    ? 'http://app.vibeathon.test/api/v1'
    : 'https://app.vibeathon.us/api/v1');

export async function fetchFallbackApiKeys(vibeathonApiKey: string) {
  const response = await fetch(`${VIBEATHON_API_BASE}/user/ai-keys`, {
    headers: {
      'Authorization': `Bearer ${vibeathonApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch API keys: ${response.statusText}`);
  }

  return response.json(); // {openai: "key", anthropic: "key", expiration: "2025-12-31T23:59:59Z"}
}
```

#### 3. Settings Handler for API Key Fetching
**File**: `src/ipc/handlers/settings_handlers.ts`
**Changes**: Add IPC handler for fetching fallback API keys

```typescript
import { fetchFallbackApiKeys } from '../utils/vibeathon_api';

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
      ...settings.distributionMode,
      proxySettings: {
        ...settings.distributionMode?.proxySettings,
        fallbackApiKeys,
        fallbackKeysExpiration: apiKeys.expiration,
      }
    }
  });
}

// Register IPC handler
ipcMain.handle('settings:fetchVibeathonKeys', fetchVibeathonFallbackKeys);
```

#### 4. Distribution Settings Auto-Configuration
**File**: `src/ipc/handlers/settings_handlers.ts`
**Changes**: Update initializeDistributionSettings to enable proxy

```typescript
export async function initializeDistributionSettings(): Promise<void> {
  if (IS_DISTRIBUTION_BUILD) {
    const currentSettings = readSettings();

    if (!currentSettings.distributionMode) {
      const proxyBaseUrl = process.env.DYAD_DISTRIBUTION_PROXY_URL ||
        (process.env.NODE_ENV === 'development'
          ? 'http://app.vibeathon.test/api/v1'
          : 'https://app.vibeathon.us/api/v1');

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
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run ts`
- [ ] IPC handler responds correctly: Test via electron console
- [ ] API key encryption works: `npm test -- settings.test.ts`
- [ ] HTTP requests to Laravel API succeed: Manual verification with real endpoint

#### Manual Verification:
- [ ] Vibeathon API key input appears in distribution settings
- [ ] Fetch button retrieves and stores fallback API keys
- [ ] API keys stored encrypted in settings file
- [ ] Error handling works for invalid API keys

---

## Phase 3: Proxy Request Routing

### Overview
Modify the central `getModelClient()` factory and help bot handler to route all AI requests through Vibeathon proxy when distribution mode is enabled.

### Changes Required:

#### 1. Proxy Client Creation in Model Factory
**File**: `src/ipc/utils/get_model_client.ts`
**Changes**: Add Vibeathon proxy check at the beginning of getModelClient()

```typescript
import { createOpenAI } from '@ai-sdk/openai';

export async function getModelClient(
  model: LargeLanguageModel,
  settings: UserSettings
): Promise<LanguageModelV2> {
  // Vibeathon proxy routing for distribution mode
  if (settings.distributionMode?.proxySettings?.enabled &&
      !settings.distributionMode?.proxySettings?.useFallback) {

    const proxySettings = settings.distributionMode.proxySettings;
    const vibeathonApiKey = settings.distributionMode.vibeathonApiKey?.value;

    if (vibeathonApiKey && proxySettings.baseUrl) {
      logger.info('Routing AI request through Vibeathon proxy');

      return createOpenAI({
        name: 'vibeathon-proxy',
        baseURL: proxySettings.baseUrl,
        apiKey: vibeathonApiKey,
      })(model.name);
    }
  }

  // Check for fallback mode
  if (settings.distributionMode?.proxySettings?.useFallback &&
      settings.distributionMode?.proxySettings?.fallbackApiKeys) {

    logger.info('Using fallback API keys due to proxy failure');
    return createFallbackClient(model, settings);
  }

  // Existing logic for standard/Pro modes...
  const providers = await getLanguageModelProviders();
  // ... rest of existing function
}

function createFallbackClient(model: LargeLanguageModel, settings: UserSettings): LanguageModelV2 {
  const fallbackKeys = settings.distributionMode?.proxySettings?.fallbackApiKeys;

  // Use fallback API keys for direct provider access
  switch (model.provider) {
    case 'openai':
      return createOpenAI({
        apiKey: fallbackKeys?.openai?.value,
      })(model.name);
    case 'anthropic':
      return createAnthropic({
        apiKey: fallbackKeys?.anthropic?.value,
      })(model.name);
    // ... other providers
    default:
      throw new Error(`Fallback not supported for provider: ${model.provider}`);
  }
}
```

#### 2. Help Bot Proxy Routing
**File**: `src/ipc/handlers/help_bot_handlers.ts`
**Changes**: Route help bot through proxy when in distribution mode

```typescript
import { readSettings } from '../../main/settings';

export async function handleHelpChatStart(
  event: IpcMainInvokeEvent,
  requestId: string,
  message: string
): Promise<{ success: boolean; requestId: string }> {
  const settings = readSettings();

  let client;

  // Route through Vibeathon proxy if distribution mode enabled
  if (settings.distributionMode?.proxySettings?.enabled &&
      !settings.distributionMode?.proxySettings?.useFallback) {

    const vibeathonApiKey = settings.distributionMode.vibeathonApiKey?.value;
    const proxyBaseUrl = settings.distributionMode.proxySettings.baseUrl;

    if (vibeathonApiKey && proxyBaseUrl) {
      client = createOpenAI({
        name: 'vibeathon-help-proxy',
        baseURL: proxyBaseUrl,
        apiKey: vibeathonApiKey,
      });
    }
  }

  // Fallback to original help chat endpoint
  if (!client) {
    client = createOpenAI({
      name: "helpchat",
      baseURL: "https://helpchat.dyad.sh/v1",
      apiKey: "helpchat-key",
    });
  }

  // ... rest of existing help bot logic
}
```

#### 3. Request Format Standardization
**File**: `src/ipc/utils/vibeathon_api.ts`
**Changes**: Add request transformation utilities

```typescript
export function transformToOpenAIFormat(
  model: string,
  messages: any[],
  options: any
) {
  // Standardize all provider requests to OpenAI-compatible format
  return {
    model: model,
    messages: messages,
    stream: true,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    // Add any Vibeathon-specific headers or parameters
    metadata: {
      original_provider: options.originalProvider,
      request_id: options.requestId,
    }
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run ts`
- [ ] Model client creation works: `npm test -- get_model_client.test.ts`
- [ ] Help bot routing works: `npm test -- help_bot_handlers.test.ts`
- [ ] OpenAI-compatible format validation: Unit tests for format transformation

#### Manual Verification:
- [ ] Main chat requests route through Vibeathon proxy
- [ ] Help bot requests route through Vibeathon proxy
- [ ] Requests include correct authentication headers
- [ ] Request format matches OpenAI compatibility

---

## Phase 4: Retry Logic & Fallback System

### Overview
Implement exponential backoff retry logic with 10 attempts, then provide fallback option. Include silent fallback for subsequent requests after user chooses fallback mode.

### Changes Required:

#### 1. Retry Logic Utility
**File**: `src/ipc/utils/retry_logic.ts`
**Changes**: Create exponential backoff retry system (new file)

```typescript
export class VibeathonRetryManager {
  private static readonly MAX_RETRIES = 10;
  private static readonly BASE_DELAY = 1000; // 1 second

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        if (attempt < this.MAX_RETRIES) {
          const delay = this.BASE_DELAY * Math.pow(2, attempt - 1);
          logger.warn(`Vibeathon proxy attempt ${attempt} failed, retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw new VibeathonProxyError(
      `Failed after ${this.MAX_RETRIES} attempts: ${lastError.message}`,
      lastError
    );
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class VibeathonProxyError extends Error {
  constructor(message: string, public readonly originalError: Error) {
    super(message);
    this.name = 'VibeathonProxyError';
  }
}
```

#### 2. Enhanced Model Client with Retry Logic
**File**: `src/ipc/utils/get_model_client.ts`
**Changes**: Integrate retry logic into proxy routing

```typescript
import { VibeathonRetryManager, VibeathonProxyError } from './retry_logic';

export async function getModelClient(
  model: LargeLanguageModel,
  settings: UserSettings
): Promise<LanguageModelV2> {
  // Vibeathon proxy routing with retry logic
  if (settings.distributionMode?.proxySettings?.enabled &&
      !settings.distributionMode?.proxySettings?.useFallback) {

    try {
      return await VibeathonRetryManager.executeWithRetry(async () => {
        const client = await createVibeathonProxyClient(model, settings);
        // Test the connection with a simple request
        await testConnection(client);
        return client;
      }, (attempt, error) => {
        // Update retry count in settings
        updateRetryCount(attempt);
      });

    } catch (error) {
      if (error instanceof VibeathonProxyError) {
        logger.error('Vibeathon proxy failed after all retries:', error);
        // Mark for fallback mode and throw special error for UI handling
        await markProxyFailed();
        throw new ProxyFailureRequiresUserAction(error.message);
      }
      throw error;
    }
  }

  // ... rest of existing logic
}

async function markProxyFailed(): Promise<void> {
  const settings = readSettings();
  writeSettings({
    distributionMode: {
      ...settings.distributionMode,
      proxySettings: {
        ...settings.distributionMode?.proxySettings,
        lastFailure: new Date().toISOString(),
        retryCount: 0, // Reset for next session
      }
    }
  });
}

export class ProxyFailureRequiresUserAction extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyFailureRequiresUserAction';
  }
}
```

#### 3. Fallback Mode Toggle Handler
**File**: `src/ipc/handlers/settings_handlers.ts`
**Changes**: Add handler to enable/disable fallback mode

```typescript
export async function toggleFallbackMode(useFallback: boolean): Promise<void> {
  const settings = readSettings();

  writeSettings({
    distributionMode: {
      ...settings.distributionMode,
      proxySettings: {
        ...settings.distributionMode?.proxySettings,
        useFallback,
        retryCount: 0, // Reset retry count when toggling
      }
    }
  });

  logger.info(`Fallback mode ${useFallback ? 'enabled' : 'disabled'}`);
}

ipcMain.handle('settings:toggleFallbackMode', async (event, useFallback: boolean) => {
  return toggleFallbackMode(useFallback);
});
```

#### 4. Silent Fallback for Subsequent Requests
**File**: `src/ipc/utils/get_model_client.ts`
**Changes**: Add silent fallback logic for follow-up requests

```typescript
// Add to getModelClient function
if (settings.distributionMode?.proxySettings?.enabled &&
    !settings.distributionMode?.proxySettings?.useFallback) {

  // Check if proxy failed recently (within last 5 minutes)
  const lastFailure = settings.distributionMode?.proxySettings?.lastFailure;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  if (lastFailure && new Date(lastFailure) > fiveMinutesAgo) {
    try {
      // Quick silent test of proxy (no retries)
      const client = await createVibeathonProxyClient(model, settings);
      await testConnection(client, { timeout: 2000 });

      // Proxy is back! Clear failure timestamp
      await clearProxyFailure();
      return client;

    } catch (error) {
      logger.info('Proxy still failing, using fallback silently');
      return createFallbackClient(model, settings);
    }
  }

  // Normal retry logic for fresh requests...
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Retry logic unit tests pass: `npm test -- retry_logic.test.ts`
- [ ] Exponential backoff timing verified: Unit tests with mocked timers
- [ ] Error handling tests pass: `npm test -- get_model_client.test.ts`
- [ ] Settings update correctly: Test retry count and failure timestamps

#### Manual Verification:
- [ ] Proxy failures trigger exponential backoff (1s, 2s, 4s, 8s, etc.)
- [ ] After 10 failures, user sees fallback option
- [ ] Fallback mode uses direct provider API keys
- [ ] Subsequent requests silently test proxy first, then fallback

---

## Phase 5: Request Logging & Sync

### Overview
Log all failed requests locally for syncing when the proxy comes back online, including request details and user context.

### Changes Required:

#### 1. Failed Request Storage Schema
**File**: `src/db/schema.ts`
**Changes**: Add table for failed requests

```typescript
export const failedRequests = sqliteTable('failed_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id'), // From Vibeathon API key context
  requestData: text('request_data'), // JSON string of the full request
  timestamp: text('timestamp'),
  retryCount: integer('retry_count').default(0),
  synced: integer('synced', { mode: 'boolean' }).default(false),
  error: text('error'), // Error message that caused the failure
});
```

#### 2. Request Logging Service
**File**: `src/ipc/utils/request_logger.ts`
**Changes**: Create service for logging failed requests (new file)

```typescript
import { db } from '../../db';
import { failedRequests } from '../../db/schema';
import { eq } from 'drizzle-orm';

export class RequestLogger {
  static async logFailedRequest(
    requestData: any,
    userId: string,
    error: string
  ): Promise<void> {
    try {
      await db.insert(failedRequests).values({
        id: generateId(),
        userId,
        requestData: JSON.stringify(requestData),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        synced: false,
        error,
      });

      logger.info('Failed request logged for future sync');
    } catch (dbError) {
      logger.error('Failed to log request:', dbError);
    }
  }

  static async getUnsyncedRequests(userId: string): Promise<any[]> {
    return db.select()
      .from(failedRequests)
      .where(eq(failedRequests.userId, userId))
      .where(eq(failedRequests.synced, false));
  }

  static async markRequestSynced(requestId: string): Promise<void> {
    await db.update(failedRequests)
      .set({ synced: true })
      .where(eq(failedRequests.id, requestId));
  }
}
```

#### 3. Integration with Proxy Failure Handling
**File**: `src/ipc/utils/get_model_client.ts`
**Changes**: Log requests when proxy fails after all retries

```typescript
import { RequestLogger } from './request_logger';

// In the catch block of proxy retry logic
} catch (error) {
  if (error instanceof VibeathonProxyError) {
    // Log the failed request for future sync
    const userId = extractUserIdFromSettings(settings);
    await RequestLogger.logFailedRequest(
      {
        model: model.name,
        provider: model.provider,
        timestamp: new Date().toISOString(),
        // Don't log the actual message content for privacy
        messageCount: getCurrentMessageCount(),
      },
      userId,
      error.message
    );

    logger.error('Vibeathon proxy failed after all retries:', error);
    await markProxyFailed();
    throw new ProxyFailureRequiresUserAction(error.message);
  }
  throw error;
}
```

#### 4. Sync Service for When Proxy Returns
**File**: `src/ipc/utils/sync_service.ts`
**Changes**: Create background sync when proxy is restored (new file)

```typescript
import { RequestLogger } from './request_logger';
import { fetchVibeathonApi } from './vibeathon_api';

export class SyncService {
  static async syncFailedRequests(userId: string, apiKey: string): Promise<void> {
    const unsyncedRequests = await RequestLogger.getUnsyncedRequests(userId);

    if (unsyncedRequests.length === 0) {
      return;
    }

    logger.info(`Syncing ${unsyncedRequests.length} failed requests`);

    for (const request of unsyncedRequests) {
      try {
        await fetchVibeathonApi('/sync/failed-request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: request.id,
            originalTimestamp: request.timestamp,
            requestData: JSON.parse(request.requestData),
            error: request.error,
          }),
        });

        await RequestLogger.markRequestSynced(request.id);
        logger.info(`Synced request ${request.id}`);

      } catch (syncError) {
        logger.warn(`Failed to sync request ${request.id}:`, syncError);
        // Don't break the loop, continue with other requests
      }
    }
  }

  // Auto-sync when proxy connection is restored
  static async autoSyncOnProxyRestore(settings: UserSettings): Promise<void> {
    const userId = extractUserIdFromSettings(settings);
    const apiKey = settings.distributionMode?.vibeathonApiKey?.value;

    if (userId && apiKey) {
      await this.syncFailedRequests(userId, apiKey);
    }
  }
}
```

#### 5. Database Migration
**File**: `src/db/migrations/add_failed_requests.sql`
**Changes**: Create migration for failed requests table (new file)

```sql
CREATE TABLE IF NOT EXISTS "failed_requests" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT,
  "request_data" TEXT,
  "timestamp" TEXT,
  "retry_count" INTEGER DEFAULT 0,
  "synced" BOOLEAN DEFAULT FALSE,
  "error" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_failed_requests_user_synced"
ON "failed_requests" ("user_id", "synced");
```

### Success Criteria:

#### Automated Verification:
- [ ] Database migration runs successfully: `npm run db:push`
- [ ] Request logging tests pass: `npm test -- request_logger.test.ts`
- [ ] Sync service tests pass: `npm test -- sync_service.test.ts`
- [ ] Database operations work: `npm run db:studio` shows failed_requests table

#### Manual Verification:
- [ ] Failed requests stored in database when proxy down
- [ ] Sync occurs automatically when proxy comes back online
- [ ] Synced requests marked as completed
- [ ] Privacy maintained (no message content in logs)

---

## Phase 6: Build Scripts & Environment Setup

### Overview
Create build scripts and environment configuration for development vs production Vibeathon proxy URLs.

### Changes Required:

#### 1. Environment Variables Documentation
**File**: `.env.example`
**Changes**: Add Vibeathon proxy URL variables

```bash
# Vibeathon Distribution Proxy URLs
DYAD_DISTRIBUTION_PROXY_URL=

# Development: http://app.vibeathon.test/api/v1
# Production: https://app.vibeathon.us/api/v1
```

#### 2. Package.json Build Scripts
**File**: `package.json`
**Changes**: Add distribution build scripts with proxy URLs

```json
{
  "scripts": {
    "build:distribution:dev": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1 npm run package",
    "build:distribution:prod": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=https://app.vibeathon.us/api/v1 npm run package",
    "make:distribution:dev": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1 npm run make",
    "make:distribution:prod": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=https://app.vibeathon.us/api/v1 npm run make",
    "start:distribution:dev": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1 npm start",
    "start:distribution:prod": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=https://app.vibeathon.us/api/v1 npm start"
  }
}
```

#### 3. Environment Detection Utility
**File**: `src/ipc/utils/distribution_utils.ts`
**Changes**: Add proxy URL detection with dev/prod defaults

```typescript
export function getVibeathonProxyUrl(): string {
  // Environment variable takes precedence
  const envUrl = process.env.DYAD_DISTRIBUTION_PROXY_URL;
  if (envUrl) {
    return envUrl;
  }

  // Default based on NODE_ENV
  return process.env.NODE_ENV === 'development'
    ? 'http://app.vibeathon.test/api/v1'
    : 'https://app.vibeathon.us/api/v1';
}

export function isDistributionBuild(): boolean {
  return IS_DISTRIBUTION_BUILD;
}
```

#### 4. Update Distribution Settings Initialization
**File**: `src/ipc/handlers/settings_handlers.ts`
**Changes**: Use environment-aware proxy URL detection

```typescript
import { getVibeathonProxyUrl } from '../utils/distribution_utils';

export async function initializeDistributionSettings(): Promise<void> {
  if (IS_DISTRIBUTION_BUILD) {
    const currentSettings = readSettings();

    if (!currentSettings.distributionMode) {
      writeSettings({
        distributionMode: {
          hideCommercialFeatures: true,
          hideProButtons: true,
          hideExternalIntegrations: true,
          hideNavigation: ['hub', 'library'],
          proxySettings: {
            enabled: true,
            baseUrl: getVibeathonProxyUrl(),
            retryCount: 0,
            useFallback: false,
          }
        }
      });
    }
  }
}
```

#### 5. Distribution Testing Configuration
**File**: `e2e-tests/helpers/test_helper.ts`
**Changes**: Add distribution mode testing setup

```typescript
// Add to E2E test environment setup
if (process.env.DYAD_DISTRIBUTION_BUILD === 'true') {
  process.env.DYAD_DISTRIBUTION_PROXY_URL = "http://localhost:3500/vibeathon/v1";
  // Mock Vibeathon API endpoint in fake LLM server
}
```

#### 6. Mock Vibeathon API for Testing
**File**: `testing/fake-llm-server/vibeathon_mock.ts`
**Changes**: Create mock Vibeathon API endpoints (new file)

```typescript
export function setupVibeathonMockRoutes(app: any) {
  // Mock API key validation
  app.get('/vibeathon/v1/user/ai-keys', (req: any, res: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    res.json({
      openai: 'mock-openai-key',
      anthropic: 'mock-anthropic-key',
      expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    });
  });

  // Mock AI requests proxy
  app.post('/vibeathon/v1/chat/completions', (req: any, res: any) => {
    // Return mock OpenAI-compatible response
    res.json({
      choices: [{
        message: { content: 'Mock response from Vibeathon proxy' }
      }]
    });
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build scripts execute successfully: `npm run build:distribution:dev`
- [x] Package scripts work: `npm run make:distribution:prod`
- [x] Environment variable detection works: `npm test -- distribution_utils.test.ts`
- [x] E2E tests pass with distribution mode: `npm run e2e -- distribution.spec.ts`

#### Manual Verification:
- [ ] Development build uses app.vibeathon.test URL
- [ ] Production build uses app.vibeathon.us URL
- [ ] Environment variables override defaults correctly
- [ ] Distribution builds automatically configure proxy settings

---

## Testing Strategy

### Unit Tests:
- Retry logic with mocked timers (exponential backoff verification)
- Settings schema validation with proxy configuration
- Request logger database operations
- Environment variable detection and URL generation
- API key encryption/decryption with fallback keys

### Integration Tests:
- End-to-end proxy routing through getModelClient()
- Help bot proxy integration
- Settings auto-configuration during distribution builds
- Failed request logging and sync workflow
- Fallback mode toggle and behavior

### Manual Testing Steps:
1. Build distribution version and verify Vibeathon API key input appears
2. Enter valid API key and fetch fallback provider keys
3. Test main chat routing through proxy with valid key
4. Test help bot routing through proxy
5. Simulate proxy failure and verify exponential backoff behavior
6. Verify fallback mode activated after 10 failures
7. Test silent fallback on subsequent requests
8. Verify failed requests logged and synced when proxy returns
9. Test development vs production proxy URL detection

## Performance Considerations

- Proxy requests add network latency but maintain streaming capabilities
- Retry logic uses exponential backoff to avoid overwhelming the proxy
- Failed request logging stored locally with efficient database indexes
- Fallback mode provides immediate response when proxy is down
- Silent proxy testing on subsequent requests minimizes user interruption

## Migration Notes

- All changes are backwards compatible - existing settings remain unchanged
- Distribution mode only applies when explicitly building with DYAD_DISTRIBUTION_BUILD=true
- No data migration required - new schema fields have appropriate defaults
- Existing Pro user flows remain completely unaffected

## References

- Original research: `thoughts/shared/research/2025-09-23-distribution-proxy-routing.md`
- Distribution mode feature flags: `thoughts/shared/plans/2025-09-23-distribution-feature-flags.md`
- Existing Dyad Pro proxy routing: `src/ipc/utils/get_model_client.ts:81-148`
- AI SDK provider patterns: `src/ipc/utils/get_model_client.ts:227+`