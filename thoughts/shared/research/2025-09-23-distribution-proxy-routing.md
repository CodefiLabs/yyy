---
date: 2025-09-23T15:44:22-05:00
researcher: Claude Code
git_commit: a2b18974d7f4718c0c1580338dded25965a6a8ef
branch: vibeathon/v1
repository: dyad-codefi
topic: "Distribution-specific proxy settings that override all AI provider routing"
tags: [research, codebase, distribution, proxy, ai-routing, vibeathon]
status: complete
last_updated: 2025-09-23
last_updated_by: Claude Code
---

# Research: Distribution-specific proxy settings that override all AI provider routing

**Date**: 2025-09-23T15:44:22-05:00
**Researcher**: Claude Code
**Git Commit**: a2b18974d7f4718c0c1580338dded25965a6a8ef
**Branch**: vibeathon/v1
**Repository**: dyad-codefi

## Research Question
Research Option 2: Add distribution-specific proxy settings that override all AI provider routing - for now let's say the url is app.vibeathon.test/api/v1 for development and app.vibeathon.us/api/v1 for prod

## Summary
Dyad uses a centralized AI provider routing system through `getModelClient()` that creates provider-specific AI SDK clients. All AI requests flow through this factory pattern, making it an ideal interception point for implementing distribution proxy routing. The existing distribution mode settings schema can be extended to include proxy configuration, following established patterns for environment-specific URLs and authentication handling.

## Detailed Findings

### AI Provider Routing Architecture

**Entry Point**: `src/ipc/utils/get_model_client.ts:61`
- Central factory function `getModelClient()` handles all provider selection and client creation
- All AI requests flow through `src/ipc/handlers/chat_stream_handlers.ts:484` which calls this factory
- Supports 10+ providers: OpenAI, Anthropic, Google, Azure, Ollama, LM Studio, custom providers, etc.

**Request Flow**:
1. User prompt → `chat:stream` IPC handler (`chat_stream_handlers.ts:206`)
2. Handler calls `getModelClient()` with selected model and settings (`line 484`)
3. Factory creates provider-specific AI SDK client based on provider ID
4. Request executed via `streamText()` with the created client (`line 876`)
5. Response streams back through IPC to renderer process

**Current Proxy Implementation**: Dyad Pro already implements a proxy pattern
- Lines 81-148 in `get_model_client.ts` route Pro users through Dyad Engine/Gateway
- Uses environment variables `DYAD_ENGINE_URL` and `DYAD_GATEWAY_URL` with production fallbacks
- Demonstrates the exact pattern needed for distribution proxy routing

### Distribution Mode Settings Schema

**Current Structure** (`src/lib/schemas.ts:238-243`):
```typescript
distributionMode: z.object({
  hideCommercialFeatures: z.boolean().optional().default(false),
  hideProButtons: z.boolean().optional().default(false),
  hideExternalIntegrations: z.boolean().optional().default(false),
  hideNavigation: z.array(z.string()).optional().default([]),
}).optional(),
```

**Settings Flow**:
- Stored in encrypted `user-settings.json` at user data path
- Auto-configured during distribution builds via `src/ipc/handlers/settings_handlers.ts:24-40`
- Validated through Zod schema with proper defaults
- Accessed via `IpcClient.app.getUserSettings()` throughout the application

### Environment Variable Patterns

**URL-based Environment Variables with Fallbacks** (Pattern from `get_model_client.ts`):
```typescript
const dyadEngineUrl = process.env.DYAD_ENGINE_URL;
const dyadGatewayUrl = process.env.DYAD_GATEWAY_URL;

// Usage with production fallbacks
baseURL: dyadGatewayUrl ?? "https://llm-gateway.dyad.sh/v1",
```

**Development vs Production Scripts** (`package.json:17-19`):
```json
{
  "dev:engine": "cross-env DYAD_ENGINE_URL=http://localhost:8080/v1 npm start",
  "staging:gateway": "cross-env DYAD_GATEWAY_URL=https://staging-url/v1 npm start"
}
```

**E2E Testing Pattern** (`e2e-tests/helpers/test_helper.ts:1088-1096`):
- All services route to single mock server: `http://localhost:3500`
- Uses different paths to simulate different services
- Environment variables override production URLs

### Authentication and Request Headers

**API Key Handling** (`get_model_client.ts:217`):
- Retrieves API keys from `providerSettings[provider].apiKey.value`
- Falls back to environment variables like `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Uses encrypted storage for sensitive data via `SecretSchema`

**Header Patterns**:
- Bearer authentication: `Authorization: Bearer ${apiKey}`
- Custom headers for Dyad Pro: `X-Dyad-Request-Id`
- Provider-specific authentication through AI SDK clients

**Request Interception Points**:
1. **Factory Level** (`get_model_client.ts:61`) - Single interception point for all requests
2. **Request Level** (`chat_stream_handlers.ts:761`) - Access to full request context
3. **Provider Level** (`get_model_client.ts:227+`) - Provider-specific handling
4. **Network Level** - Custom fetch function (like Dyad Engine at lines 121-183)

## Code References

- `src/ipc/utils/get_model_client.ts:61-206` - Main model client factory with Dyad Pro proxy routing
- `src/lib/schemas.ts:238-243` - Distribution mode settings schema definition
- `src/ipc/handlers/settings_handlers.ts:24-40` - Distribution settings auto-configuration
- `src/ipc/handlers/chat_stream_handlers.ts:484` - Primary AI request handler entry point
- `src/ipc/utils/llm_engine_provider.ts:121-183` - Example of custom fetch proxy implementation
- `package.json:17-19` - Environment-specific npm scripts pattern
- `.env.example:11-37` - Environment variable documentation template

## Architecture Insights

**Centralized Request Routing**: All AI requests flow through a single factory function, making it an ideal interception point for proxy routing without needing to modify individual provider implementations.

**Environment Variable Strategy**: The codebase follows a consistent pattern of using environment variables for URL overrides with production fallbacks, perfect for development/production proxy URL handling.

**Settings-Based Configuration**: The distribution mode settings provide a runtime-configurable approach that can be combined with build-time environment variables for maximum flexibility.

**Security Patterns**: API keys and sensitive data are handled through encrypted storage and proper fallback mechanisms, providing a template for proxy authentication handling.

## Implementation Recommendation

### Option 2 Implementation Plan

**1. Extend Distribution Settings Schema** (`src/lib/schemas.ts`):
```typescript
distributionMode: z.object({
  // ... existing fields
  proxySettings: z.object({
    enabled: z.boolean().optional().default(false),
    baseUrl: z.string().optional(),
    authToken: SecretSchema.optional(),
    routeAllProviders: z.boolean().optional().default(true),
  }).optional(),
}).optional(),
```

**2. Add Environment Variables** (`.env.example`):
```bash
# Distribution proxy URLs
DYAD_DISTRIBUTION_PROXY_URL_DEV=http://app.vibeathon.test/api/v1
DYAD_DISTRIBUTION_PROXY_URL_PROD=https://app.vibeathon.us/api/v1
```

**3. Add Package.json Scripts**:
```json
{
  "build:distribution:dev": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1 npm run package",
  "build:distribution:prod": "cross-env DYAD_DISTRIBUTION_BUILD=true DYAD_DISTRIBUTION_PROXY_URL=https://app.vibeathon.us/api/v1 npm run package"
}
```

**4. Modify Model Client Factory** (`src/ipc/utils/get_model_client.ts:61`):
- Add distribution proxy check before provider-specific client creation
- Route all requests through proxy when distribution mode is enabled
- Use OpenAI-compatible client with proxy base URL and authentication

**5. Auto-configure Proxy Settings** (`src/ipc/handlers/settings_handlers.ts`):
- Detect `DYAD_DISTRIBUTION_PROXY_URL` environment variable
- Auto-configure proxy settings during distribution build initialization
- Set appropriate dev/prod URLs based on environment

### Proxy Interception Strategy

**Recommended Approach**: Modify the factory level (`get_model_client.ts:61`) to check for distribution proxy settings before creating provider-specific clients.

```typescript
// Pseudo-code for implementation
if (settings.distributionMode?.proxySettings?.enabled) {
  return createOpenAICompatible({
    name: "vibeathon-proxy",
    baseURL: settings.distributionMode.proxySettings.baseUrl,
    apiKey: settings.distributionMode.proxySettings.authToken?.value || "proxy-auth",
  });
}
```

This approach:
- ✅ Single interception point for all providers
- ✅ Leverages existing proxy patterns from Dyad Pro
- ✅ Maintains compatibility with all AI SDK features
- ✅ Supports authentication and custom headers
- ✅ Can be toggled at runtime via settings

## Related Research
- Distribution Mode Feature Flag System implementation (completed)
- Existing Dyad Pro proxy routing architecture
- AI SDK provider abstraction patterns

## Open Questions
1. Should proxy routing completely replace provider selection, or allow fallback to direct providers?
2. What proxy authentication mechanism should be used (API key, bearer token, custom headers)?
3. Should the proxy handle provider-specific request transformations, or use a standardized format?
4. How should proxy errors and failover be handled?