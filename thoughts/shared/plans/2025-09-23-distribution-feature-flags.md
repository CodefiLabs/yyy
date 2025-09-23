# Distribution Mode Feature Flag System Implementation Plan

## Overview

We're implementing a **Distribution Mode Feature Flag System** that allows hiding specific UI elements (Pro banners, Hub/Library navigation, Pro buttons, Import App button, and More Ideas section) in distributed builds. The system leverages existing patterns from the codebase while providing maximum flexibility through semantic feature keys rather than hardcoded CSS selectors.

## Current State Analysis

The codebase already has excellent patterns for feature flags and conditional rendering:
- Environment-based flags (`IS_TEST_BUILD` pattern in `src/ipc/utils/test_utils.ts:1`)
- Settings-based feature toggles (`UserSettingsSchema` in `src/lib/schemas.ts:203-247`)
- Conditional rendering patterns throughout React components
- Build-time environment variable injection via `cross-env` and Electron Forge

### Key Discoveries:
- `ProBanner` component (`src/components/ProBanner.tsx:22-24`) - Already has Pro feature gating
- `ProModeSelector` component (`src/components/ProModeSelector.tsx:84-96`) - Complex Pro button logic
- `AppSidebar` component (`src/components/app-sidebar.tsx:50,55`) - Hub/Library navigation links
- `ImportAppButton` component (`src/components/ImportAppButton.tsx:18`) - Simple button component
- Home page (`src/pages/home.tsx:192,242`) - More Ideas section with random prompts
- Existing environment variable patterns follow `cross-env VARIABLE=value npm run command` format
- Settings use Zod validation and are persisted with encryption for sensitive data

## Desired End State

After implementation:
- Build scripts `npm run build:distribution` and `npm run make:distribution` create distribution builds
- Distribution builds automatically hide commercial features (Pro banners, Hub/Library nav, etc.)
- Feature hiding uses semantic keys (`shouldHideFeature(settings, 'pro-banner')`) not CSS selectors
- System is runtime configurable but defaults to distribution mode in distribution builds
- All changes are backwards compatible and follow existing codebase patterns
- Comprehensive test coverage ensures reliability

### Verification:
- Distribution build hides all target elements while maintaining functionality
- Standard builds remain unchanged
- Settings persist correctly and feature detection works reliably
- No regressions in existing Pro feature functionality

## What We're NOT Doing

- Not removing features permanently - they're hidden but can be re-enabled
- Not hardcoding CSS selectors or fragile DOM queries
- Not breaking existing Pro feature detection or billing logic
- Not creating a new settings UI for distribution configuration (auto-configured)
- Not modifying core business logic - only presentation layer

## Implementation Approach

Use a **multi-layer feature flag system** that:
1. Detects distribution builds via environment variables (`DYAD_DISTRIBUTION_BUILD=true`)
2. Automatically configures distribution settings on first run
3. Uses semantic feature keys for flexible element hiding
4. Integrates with existing `useSettings` hook and Jotai state management
5. Maintains type safety through Zod schema extensions

## Phase 1: Core Infrastructure Setup

### Overview
Establish the foundation for distribution mode feature flags by creating utilities, extending schemas, and setting up the detection system.

### Changes Required:

#### 1. Distribution Utilities Module
**File**: `src/ipc/utils/distribution_utils.ts`
**Changes**: Create new file with environment flag detection

```typescript
// Distribution build detection following IS_TEST_BUILD pattern
export const IS_DISTRIBUTION_BUILD = process.env.DYAD_DISTRIBUTION_BUILD === "true";

// Feature key definitions for semantic feature detection
export const DISTRIBUTION_FEATURE_KEYS = {
  PRO_BANNER: 'pro-banner',
  PRO_BUTTONS: 'pro-buttons',
  HUB_NAV: 'hub-nav',
  LIBRARY_NAV: 'library-nav',
  IMPORT_APP: 'import-app',
  MORE_IDEAS: 'more-ideas',
} as const;

export type DistributionFeatureKey = typeof DISTRIBUTION_FEATURE_KEYS[keyof typeof DISTRIBUTION_FEATURE_KEYS];
```

#### 2. UserSettings Schema Extension
**File**: `src/lib/schemas.ts`
**Changes**: Add distribution mode configuration to UserSettingsSchema (around line 245)

```typescript
// Add to UserSettingsSchema object
distributionMode: z.object({
  hideCommercialFeatures: z.boolean().optional().default(false),
  hideProButtons: z.boolean().optional().default(false),
  hideExternalIntegrations: z.boolean().optional().default(false),
  hideNavigation: z.array(z.string()).optional().default([]),
}).optional(),
```

#### 3. Feature Detection Utilities
**File**: `src/lib/schemas.ts`
**Changes**: Add utility functions after existing functions (around line 258)

```typescript
import { IS_DISTRIBUTION_BUILD, DistributionFeatureKey } from '@/ipc/utils/distribution_utils';

export function isDistributionMode(settings: UserSettings): boolean {
  return IS_DISTRIBUTION_BUILD || settings?.distributionMode?.hideCommercialFeatures === true;
}

export function shouldHideFeature(settings: UserSettings, featureKey: DistributionFeatureKey): boolean {
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

#### 4. Default Settings Update
**File**: `src/main/settings.ts`
**Changes**: Add distribution mode defaults to DEFAULT_SETTINGS (around line 37)

```typescript
// Add to DEFAULT_SETTINGS object
distributionMode: undefined,
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `npm run ts`
- [x] Linting passes: `npm run lint`
- [x] Settings schema validation works: `npm test -- readSettings`
- [x] Distribution utilities can be imported without errors

#### Manual Verification:
- [x] `IS_DISTRIBUTION_BUILD` correctly reads environment variable
- [x] `shouldHideFeature` utility function works with test settings
- [x] Schema extension maintains backwards compatibility
- [x] No breaking changes to existing settings functionality

---

## Phase 2: Component Integration

### Overview
Update target components to use distribution mode feature flags for conditional rendering.

### Changes Required:

#### 1. ProBanner Component
**File**: `src/components/ProBanner.tsx`
**Changes**: Add distribution mode check after existing Pro check (around line 24)

```typescript
import { shouldHideFeature } from '@/lib/schemas';

// Add after existing enableDyadPro check
if (shouldHideFeature(settings, 'pro-banner')) {
  return null;
}
```

#### 2. ProModeSelector Component
**File**: `src/components/ProModeSelector.tsx`
**Changes**: Add distribution mode check for Pro button hiding

```typescript
import { shouldHideFeature } from '@/lib/schemas';

// Add conditional check in render logic
const shouldHideProButton = shouldHideFeature(settings, 'pro-buttons');

if (shouldHideProButton) {
  return null; // or return simplified version without Pro upgrade
}
```

#### 3. AppSidebar Component
**File**: `src/components/app-sidebar.tsx`
**Changes**: Filter navigation items based on distribution settings

```typescript
import { shouldHideFeature } from '@/lib/schemas';

// Update navigation items filtering
const navigationItems = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'library', label: 'Library', href: '/library', featureKey: 'library-nav' as const },
  { key: 'hub', label: 'Hub', href: '/hub', featureKey: 'hub-nav' as const },
];

// Filter items based on distribution settings
const filteredItems = navigationItems.filter(item =>
  !item.featureKey || !shouldHideFeature(settings, item.featureKey)
);
```

#### 4. ImportAppButton Component
**File**: `src/components/ImportAppButton.tsx`
**Changes**: Add distribution mode conditional rendering

```typescript
import { useSettings } from '@/hooks/useSettings';
import { shouldHideFeature } from '@/lib/schemas';

export function ImportAppButton() {
  const { settings } = useSettings();

  if (shouldHideFeature(settings, 'import-app')) {
    return null;
  }

  // ... existing button implementation
}
```

#### 5. Home Page More Ideas Section
**File**: `src/pages/home.tsx`
**Changes**: Wrap More Ideas section with distribution check (around lines 192-244)

```typescript
import { shouldHideFeature } from '@/lib/schemas';

// Wrap the More Ideas section
{!shouldHideFeature(settings, 'more-ideas') && (
  <div className="flex flex-col gap-4 mt-2">
    {/* Existing More Ideas implementation */}
  </div>
)}
```

### Success Criteria:

#### Automated Verification:
- [x] React components compile without TypeScript errors: `npm run ts`
- [x] No linting errors: `npm run lint`
- [x] Component unit tests pass: `npm test`
- [x] No runtime console errors when components render

#### Manual Verification:
- [x] Components render normally with default settings
- [x] Components hide correctly when distribution settings are enabled
- [x] No visual regressions in standard mode
- [x] Transitions between hidden/shown states work smoothly

---

## Phase 3: Build System Integration

### Overview
Add build scripts and configuration for distribution mode, with automatic settings initialization.

### Changes Required:

#### 1. Package.json Build Scripts
**File**: `package.json`
**Changes**: Add distribution build scripts after existing scripts (around line 42)

```json
"build:distribution": "cross-env DYAD_DISTRIBUTION_BUILD=true npm run package",
"make:distribution": "cross-env DYAD_DISTRIBUTION_BUILD=true npm run make"
```

#### 2. Distribution Settings Initialization
**File**: `src/ipc/handlers/settings_handlers.ts`
**Changes**: Add initialization function and call it during app startup

```typescript
import { IS_DISTRIBUTION_BUILD } from '@/ipc/utils/distribution_utils';

export async function initializeDistributionSettings(): Promise<void> {
  if (IS_DISTRIBUTION_BUILD) {
    const currentSettings = await getUserSettings();

    // Only set if not already configured
    if (!currentSettings.distributionMode) {
      await setUserSettings({
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

#### 3. App Initialization Integration
**File**: `src/main.ts`
**Changes**: Call distribution settings initialization during app ready (around line 200)

```typescript
import { initializeDistributionSettings } from '@/ipc/handlers/settings_handlers';

// Add after app ready event
app.whenReady().then(async () => {
  await createMainWindow();
  await initializeDistributionSettings(); // Add this line
  // ... rest of initialization
});
```

#### 4. Environment Variables Documentation
**File**: `.env.example`
**Changes**: Add distribution build variable (around line 37)

```env
# Distribution build mode
# DYAD_DISTRIBUTION_BUILD=
```

### Success Criteria:

#### Automated Verification:
- [x] Build scripts execute successfully: `npm run build:distribution`
- [x] Package scripts work: `npm run make:distribution`
- [x] TypeScript compilation passes: `npm run ts`
- [x] No linting errors: `npm run lint`

#### Manual Verification:
- [x] Distribution builds automatically configure settings on first run
- [x] Environment variable correctly detected in built app
- [x] Standard builds remain unaffected
- [x] Distribution settings persist across app restarts

---

## Phase 4: Testing & Validation

### Overview
Add comprehensive test coverage for distribution mode functionality.

### Changes Required:

#### 1. Utility Function Tests
**File**: `src/__tests__/distribution.test.ts`
**Changes**: Create comprehensive test suite for distribution utilities

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shouldHideFeature, isDistributionMode } from '@/lib/schemas';
import type { UserSettings } from '@/lib/schemas';

describe('Distribution Mode Feature Flags', () => {
  const originalEnv = process.env.DYAD_DISTRIBUTION_BUILD;

  afterEach(() => {
    process.env.DYAD_DISTRIBUTION_BUILD = originalEnv;
  });

  describe('shouldHideFeature', () => {
    it('should hide pro-banner when hideCommercialFeatures is true', () => {
      const settings: UserSettings = {
        distributionMode: { hideCommercialFeatures: true }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'pro-banner')).toBe(true);
    });

    it('should hide navigation when specified in hideNavigation array', () => {
      const settings: UserSettings = {
        distributionMode: { hideNavigation: ['hub', 'library'] }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'hub-nav')).toBe(true);
      expect(shouldHideFeature(settings, 'library-nav')).toBe(true);
    });

    // Add more test cases for all feature keys
  });

  describe('isDistributionMode', () => {
    it('should return true when DYAD_DISTRIBUTION_BUILD is true', () => {
      process.env.DYAD_DISTRIBUTION_BUILD = 'true';

      // Re-import to get updated environment variable
      vi.resetModules();

      const settings: UserSettings = {} as UserSettings;
      expect(isDistributionMode(settings)).toBe(true);
    });
  });
});
```

#### 2. Component Integration Tests
**File**: `src/__tests__/components/ProBanner.test.tsx`
**Changes**: Add distribution mode tests to existing component tests

```typescript
import { render, screen } from '@testing-library/react';
import { ProBanner } from '@/components/ProBanner';
import type { UserSettings } from '@/lib/schemas';

describe('ProBanner Distribution Mode', () => {
  it('should hide when distribution mode hideCommercialFeatures is true', () => {
    const settings: UserSettings = {
      distributionMode: { hideCommercialFeatures: true }
    } as UserSettings;

    const { container } = render(<ProBanner />, {
      wrapper: ({ children }) => (
        <SettingsProvider value={settings}>
          {children}
        </SettingsProvider>
      )
    });

    expect(container.firstChild).toBeNull();
  });
});
```

#### 3. E2E Distribution Tests
**File**: `e2e-tests/distribution.spec.ts`
**Changes**: Create E2E tests for distribution builds

```typescript
import { test, expect } from './helpers/test_helper';

const testWithDistribution = test.extend({
  electronApp: async ({ electronApp }, use) => {
    // Set distribution environment variable
    process.env.DYAD_DISTRIBUTION_BUILD = 'true';
    await use(electronApp);
  },
});

testWithDistribution('should hide commercial features in distribution mode', async ({ po }) => {
  await po.navigateToHome();

  // Verify Pro banner is hidden
  await expect(po.page.locator('[data-testid="pro-banner"]')).not.toBeVisible();

  // Verify Hub/Library navigation is hidden
  await expect(po.page.locator('text=Hub')).not.toBeVisible();
  await expect(po.page.locator('text=Library')).not.toBeVisible();

  // Verify More Ideas section is hidden
  await expect(po.page.locator('text=More ideas')).not.toBeVisible();
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `npm test`
- [ ] Component tests pass: `npm test -- ProBanner`
- [ ] E2E tests pass: `npm run e2e -- distribution.spec.ts`
- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Distribution build correctly hides all target elements
- [ ] Standard build shows all elements normally
- [ ] Feature flags can be toggled in development
- [ ] No regressions in existing Pro feature functionality
- [ ] Settings persist correctly across app restarts

---

## Testing Strategy

### Unit Tests:
- Test `shouldHideFeature` utility with all feature keys and conditions
- Test `isDistributionMode` with various environment and settings combinations
- Test settings schema validation with distribution mode fields
- Test default settings merging with distribution configuration

### Integration Tests:
- Test component conditional rendering with mocked settings
- Test settings initialization during app startup
- Test build-time environment variable detection
- Test IPC handlers with distribution settings

### E2E Tests:
- Test complete distribution build flow end-to-end
- Test settings persistence across app restarts
- Test visual appearance with distribution settings enabled
- Test interaction patterns work correctly when elements are hidden

### Manual Testing Steps:
1. Build app with `npm run build:distribution` and verify elements are hidden
2. Build app with standard `npm run package` and verify elements are visible
3. Toggle distribution settings manually and verify immediate UI response
4. Restart app and verify distribution settings persist
5. Test all navigation and Pro features work correctly in both modes

## Performance Considerations

- Feature detection uses simple boolean checks and object property access
- No additional network requests or expensive operations
- Settings loading uses existing patterns and caching
- Component rendering optimized with early returns for hidden elements
- Build-time environment variable detection has zero runtime cost

## Migration Notes

- All changes are backwards compatible - existing settings remain unchanged
- Users upgrading will not see any difference until they use distribution builds
- Distribution settings only apply when explicitly building in distribution mode
- No data migration required - new schema fields have appropriate defaults

## References

- Original research: `thoughts/shared/research/2025-09-23-distribution-feature-flags.md`
- Existing feature flag patterns: `src/ipc/utils/test_utils.ts:1`
- Settings schema: `src/lib/schemas.ts:203-247`
- Build configuration: `forge.config.ts:51-74`