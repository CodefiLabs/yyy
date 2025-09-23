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