---
date: 2025-09-23T13:22:17-05:00
researcher: Claude
git_commit: 84f8af2e455b106084e08f58b471ad0e0625706f
branch: vibeathon/v1
repository: dyad-codefi
topic: "Dynamic Feature Flag System for Distribution Mode"
tags: [research, codebase, feature-flags, distribution, ui-components, build-system]
status: complete
last_updated: 2025-09-23
last_updated_by: Claude
---

# Research: Dynamic Feature Flag System for Distribution Mode

**Date**: 2025-09-23T13:22:17-05:00
**Researcher**: Claude
**Git Commit**: 84f8af2e455b106084e08f58b471ad0e0625706f
**Branch**: vibeathon/v1
**Repository**: dyad-codefi

## Research Question
How to implement a dynamic, flexible system for hiding certain UI elements (ad banners, Pro buttons, Hub/Library navigation, etc.) when building a distributed version of the Dyad app, without hardcoding specific class selectors or element references.

## Summary
The codebase already has excellent patterns for feature flags and conditional rendering. I recommend implementing a **Distribution Mode Feature Flag System** using:
1. Build-time environment variables for distribution detection
2. Runtime settings-based feature toggles
3. Semantic component identification rather than CSS selectors
4. Centralized configuration for easy maintenance

This approach leverages existing patterns while providing maximum flexibility for future element additions.

## Detailed Findings

### Target Components Located
- **ProBanner** (`src/components/ProBanner.tsx`) - Ad banner with gradient classes
- **Home page ideas section** (`src/pages/home.tsx:192,242`) - "More ideas" button and container
- **ProModeSelector** (`src/components/ProModeSelector.tsx:66,69`) - "Pro" button
- **ImportAppButton** (`src/components/ImportAppButton.tsx:18`) - "Import App" button
- **AppSidebar** (`src/app-sidebar.tsx:50,55`) - "Hub" and "Library" navigation links

### Existing Feature Flag Patterns

#### Pattern 1: Environment-Based Flags
The codebase uses `IS_TEST_BUILD` pattern extensively:
```typescript
// src/ipc/utils/test_utils.ts:1
export const IS_TEST_BUILD = process.env.E2E_TEST_BUILD === "true";

// Usage in forge.config.ts:51-74
const isEndToEndTestBuild = process.env.E2E_TEST_BUILD === "true";
osxSign: isEndToEndTestBuild ? undefined : { identity: process.env.APPLE_TEAM_ID }
```

#### Pattern 2: Settings-Based Feature Toggles
User settings with Zod validation:
```typescript
// src/lib/schemas.ts:203-247
export const UserSettingsSchema = z.object({
  enableDyadPro: z.boolean().optional(),
  enableProLazyEditsMode: z.boolean().optional(),
  // ... other flags
});

// Usage in components
if (settings?.enableDyadPro || userBudget) {
  return null; // Hide Pro banner
}
```

#### Pattern 3: Conditional Rendering
Robust patterns throughout components:
```typescript
// src/components/ModelPicker.tsx:154-157
if (settings && isDyadProEnabled(settings)) {
  primaryProviders.unshift(["auto", TURBO_MODELS]);
}

// src/components/ChatInputControls.tsx:18-23
{settings?.selectedChatMode === "agent" && (
  <McpToolsPicker />
)}
```

## Code References
- `src/ipc/utils/test_utils.ts:1` - Environment flag pattern
- `src/lib/schemas.ts:203-247` - Settings schema with feature flags
- `forge.config.ts:51-74` - Build-time conditional configuration
- `src/components/ProBanner.tsx:22-24` - Existing Pro feature gating
- `src/components/ProModeSelector.tsx:84-96` - Multi-condition feature checks

## Architecture Insights

### Build System Capabilities
- **Electron Forge** supports environment variable injection at build time
- **Cross-platform builds** already use conditional logic for signing/notarization
- **Package.json scripts** demonstrate environment variable patterns
- **CI/CD pipeline** supports different build modes (test, staging, production)

### Existing Security & Flexibility Patterns
- **Type safety** via Zod schemas for all feature flags
- **Centralized management** through `useSettings` hook
- **Graceful fallbacks** when settings are undefined
- **Utility functions** like `isDyadProEnabled()` for complex logic

## Implementation Strategy

### Recommended Solution: Multi-Layer Feature Flag System

#### 1. Build-Time Distribution Mode Flag
Create a build-time environment variable similar to `IS_TEST_BUILD`:

```typescript
// src/ipc/utils/distribution_utils.ts
export const IS_DISTRIBUTION_BUILD = process.env.DYAD_DISTRIBUTION_BUILD === "true";
```

**Package.json scripts:**
```json
{
  "scripts": {
    "build:distribution": "cross-env DYAD_DISTRIBUTION_BUILD=true npm run package",
    "make:distribution": "cross-env DYAD_DISTRIBUTION_BUILD=true npm run make"
  }
}
```

#### 2. Settings-Based Feature Configuration
Extend UserSettings schema with distribution-specific flags:

```typescript
// src/lib/schemas.ts - Addition to UserSettingsSchema
export const UserSettingsSchema = z.object({
  // ... existing settings
  distributionMode: z.object({
    hideCommercialFeatures: z.boolean().optional().default(false),
    hideProButtons: z.boolean().optional().default(false),
    hideExternalIntegrations: z.boolean().optional().default(false),
    hideNavigation: z.array(z.string()).optional().default([]),
  }).optional(),
});

// Utility functions
export function isDistributionMode(settings: UserSettings): boolean {
  return IS_DISTRIBUTION_BUILD || settings?.distributionMode?.hideCommercialFeatures === true;
}

export function shouldHideFeature(settings: UserSettings, featureKey: string): boolean {
  if (!settings?.distributionMode) return false;

  const config = settings.distributionMode;

  switch (featureKey) {
    case 'pro-banner':
      return config.hideCommercialFeatures || config.hideProButtons;
    case 'pro-buttons':
      return config.hideProButtons;
    case 'hub-nav':
      return config.hideNavigation?.includes('hub');
    case 'library-nav':
      return config.hideNavigation?.includes('library');
    case 'import-app':
      return config.hideExternalIntegrations;
    case 'more-ideas':
      return config.hideCommercialFeatures;
    default:
      return false;
  }
}
```

#### 3. Component Integration Pattern
Modify components to use semantic feature keys:

```typescript
// src/components/ProBanner.tsx
export function ProBanner() {
  const { settings } = useSettings();

  // Multiple conditions for hiding
  if (settings?.enableDyadPro || userBudget) {
    return null; // Existing logic
  }

  if (shouldHideFeature(settings, 'pro-banner')) {
    return null; // Distribution mode
  }

  return (
    <div className="w-full py-2 sm:py-2.5 md:py-3 rounded-lg bg-gradient-to-br...">
      {/* Existing banner content */}
    </div>
  );
}

// src/components/app-sidebar.tsx
const navigationItems = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'library', label: 'Library', href: '/library', featureKey: 'library-nav' },
  { key: 'hub', label: 'Hub', href: '/hub', featureKey: 'hub-nav' },
];

return (
  <nav>
    {navigationItems
      .filter(item => !item.featureKey || !shouldHideFeature(settings, item.featureKey))
      .map(item => (
        <NavLink key={item.key} to={item.href}>{item.label}</NavLink>
      ))}
  </nav>
);
```

#### 4. Automatic Configuration for Distribution Builds
Initialize distribution settings automatically:

```typescript
// src/ipc/handlers/settings_handlers.ts
export async function initializeDistributionSettings() {
  if (IS_DISTRIBUTION_BUILD) {
    const currentSettings = await getUserSettings();

    if (!currentSettings.distributionMode) {
      await setUserSettings({
        ...currentSettings,
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
```

### Benefits of This Approach

#### 1. Maximum Flexibility
- **Semantic naming**: `shouldHideFeature(settings, 'pro-banner')` vs CSS selectors
- **Easy additions**: New features just need a key in the switch statement
- **Runtime toggleable**: Users can override distribution defaults if needed
- **Granular control**: Hide individual elements or categories

#### 2. Leverages Existing Patterns
- **Uses current `useSettings` hook** and Jotai state management
- **Follows `IS_TEST_BUILD` pattern** for build-time flags
- **Extends UserSettings schema** with proper Zod validation
- **Maintains type safety** throughout the application

#### 3. Build System Integration
- **Environment variable support** already exists in Forge config
- **CI/CD compatibility** with existing GitHub Actions
- **Cross-platform builds** work with current setup
- **Code signing compatibility** (distribution builds can still be signed)

#### 4. Maintainability
- **Centralized configuration** in schemas and utility functions
- **Self-documenting** feature keys rather than class selectors
- **Easy testing** with existing test infrastructure
- **Backwards compatible** with current feature flag patterns

### Implementation Steps

1. **Add distribution utilities** (`src/ipc/utils/distribution_utils.ts`)
2. **Extend UserSettings schema** with distribution configuration
3. **Create feature detection utilities** (`shouldHideFeature`, `isDistributionMode`)
4. **Update target components** to check feature flags
5. **Add build scripts** for distribution mode
6. **Initialize distribution settings** automatically on first run
7. **Add tests** for feature flag logic

### Testing Strategy
- **Unit tests** for `shouldHideFeature` utility logic
- **E2E tests** with `DYAD_DISTRIBUTION_BUILD=true`
- **Visual regression tests** comparing standard vs distribution builds
- **Settings persistence tests** for distribution configuration

## Open Questions
1. Should distribution mode be completely locked down or allow user overrides?
2. Do we need a UI for configuring distribution settings in development?
3. Should some features redirect to alternative implementations rather than hide completely?
4. How should this integrate with existing Pro feature detection?

## Related Research
This research establishes the foundation for implementing semantic feature flags for distribution builds. Future research might explore:
- Dynamic feature loading for modular distributions
- Plugin-based architecture for feature management
- A/B testing infrastructure using the same feature flag system