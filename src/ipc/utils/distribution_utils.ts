// Distribution build detection following IS_TEST_BUILD pattern
export const IS_DISTRIBUTION_BUILD = process.env.DYAD_DISTRIBUTION_BUILD === "true";

// Hide Build mode (show only Ask/Agent toggle)
export const HIDE_BUILD_MODE = process.env.DYAD_HIDE_BUILD_MODE === "true";

// Feature key definitions for semantic feature detection
export const DISTRIBUTION_FEATURE_KEYS = {
  PRO_BANNER: 'pro-banner',
  PRO_BUTTONS: 'pro-buttons',
  HUB_NAV: 'hub-nav',
  LIBRARY_NAV: 'library-nav',
  IMPORT_APP: 'import-app',
  MORE_IDEAS: 'more-ideas',
  MODEL_PROVIDERS: 'model-providers',
  MODEL_PICKER: 'model-picker',
  PROVIDER_SETUP: 'provider-setup',
} as const;

export type DistributionFeatureKey = typeof DISTRIBUTION_FEATURE_KEYS[keyof typeof DISTRIBUTION_FEATURE_KEYS];

export function getVibeathonProxyUrl(): string {
  // Environment variable takes precedence
  const envUrl = process.env.DYAD_DISTRIBUTION_PROXY_URL;
  if (envUrl) {
    return envUrl;
  }

  // Default based on NODE_ENV
  // Always use HTTPS to avoid 301 redirects that can lose request body (tools)
  return process.env.NODE_ENV === 'development'
    ? 'https://app.vibeathon.test/api/v1'
    : 'https://app.vibeathon.us/api/v1';
}

export function isDistributionBuild(): boolean {
  return IS_DISTRIBUTION_BUILD;
}