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
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideCommercialFeatures: true }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'pro-banner')).toBe(true);
    });

    it('should hide pro-banner when hideProButtons is true', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideProButtons: true }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'pro-banner')).toBe(true);
    });

    it('should hide navigation when specified in hideNavigation array', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideNavigation: ['hub', 'library'] }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'hub-nav')).toBe(true);
      expect(shouldHideFeature(settings, 'library-nav')).toBe(true);
    });

    it('should hide import-app when hideExternalIntegrations is true', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideExternalIntegrations: true }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'import-app')).toBe(true);
    });

    it('should hide more-ideas when hideCommercialFeatures is true', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideCommercialFeatures: true }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'more-ideas')).toBe(true);
    });

    it('should not hide features when distributionMode is undefined', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react'
      } as UserSettings;

      expect(shouldHideFeature(settings, 'pro-banner')).toBe(false);
      expect(shouldHideFeature(settings, 'hub-nav')).toBe(false);
      expect(shouldHideFeature(settings, 'import-app')).toBe(false);
    });

    it('should return false for unknown feature keys', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideCommercialFeatures: true }
      } as UserSettings;

      expect(shouldHideFeature(settings, 'unknown-feature' as any)).toBe(false);
    });
  });

  describe('isDistributionMode', () => {

    it('should return true when hideCommercialFeatures is true', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideCommercialFeatures: true }
      } as UserSettings;

      expect(isDistributionMode(settings)).toBe(true);
    });

    it('should return false when distributionMode is undefined', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react'
      } as UserSettings;

      expect(isDistributionMode(settings)).toBe(false);
    });

    it('should return false when hideCommercialFeatures is false', () => {
      const settings: UserSettings = {
        selectedModel: { name: 'auto', provider: 'auto' },
        providerSettings: {},
        telemetryConsent: 'unset',
        hasRunBefore: false,
        experiments: {},
        selectedChatMode: 'build',
        enableAutoUpdate: true,
        releaseChannel: 'stable',
        selectedTemplateId: 'react',
        distributionMode: { hideCommercialFeatures: false }
      } as UserSettings;

      expect(isDistributionMode(settings)).toBe(false);
    });
  });
});