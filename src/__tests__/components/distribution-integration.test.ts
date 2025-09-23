import { describe, it, expect } from 'vitest';
import { shouldHideFeature } from '@/lib/schemas';
import type { UserSettings } from '@/lib/schemas';

describe('Distribution Mode Component Integration', () => {
  const createMockSettings = (distributionMode?: any): UserSettings => ({
    selectedModel: { name: 'auto', provider: 'auto' },
    providerSettings: {},
    telemetryConsent: 'unset',
    hasRunBefore: false,
    experiments: {},
    selectedChatMode: 'build',
    enableAutoUpdate: true,
    releaseChannel: 'stable',
    selectedTemplateId: 'react',
    distributionMode,
  } as UserSettings);

  describe('ProBanner component logic', () => {
    it('should hide when distribution mode hides commercial features', () => {
      const settings = createMockSettings({ hideCommercialFeatures: true });
      expect(shouldHideFeature(settings, 'pro-banner')).toBe(true);
    });

    it('should hide when distribution mode hides pro buttons', () => {
      const settings = createMockSettings({ hideProButtons: true });
      expect(shouldHideFeature(settings, 'pro-banner')).toBe(true);
    });

    it('should show when distribution mode is not configured', () => {
      const settings = createMockSettings();
      expect(shouldHideFeature(settings, 'pro-banner')).toBe(false);
    });
  });

  describe('ProModeSelector component logic', () => {
    it('should hide when distribution mode hides pro buttons', () => {
      const settings = createMockSettings({ hideProButtons: true });
      expect(shouldHideFeature(settings, 'pro-buttons')).toBe(true);
    });

    it('should show when distribution mode is not configured', () => {
      const settings = createMockSettings();
      expect(shouldHideFeature(settings, 'pro-buttons')).toBe(false);
    });
  });

  describe('AppSidebar navigation logic', () => {
    it('should hide Hub navigation when configured', () => {
      const settings = createMockSettings({ hideNavigation: ['hub'] });
      expect(shouldHideFeature(settings, 'hub-nav')).toBe(true);
    });

    it('should hide Library navigation when configured', () => {
      const settings = createMockSettings({ hideNavigation: ['library'] });
      expect(shouldHideFeature(settings, 'library-nav')).toBe(true);
    });

    it('should hide both when both are configured', () => {
      const settings = createMockSettings({ hideNavigation: ['hub', 'library'] });
      expect(shouldHideFeature(settings, 'hub-nav')).toBe(true);
      expect(shouldHideFeature(settings, 'library-nav')).toBe(true);
    });

    it('should show navigation when not configured', () => {
      const settings = createMockSettings();
      expect(shouldHideFeature(settings, 'hub-nav')).toBe(false);
      expect(shouldHideFeature(settings, 'library-nav')).toBe(false);
    });
  });

  describe('ImportAppButton component logic', () => {
    it('should hide when distribution mode hides external integrations', () => {
      const settings = createMockSettings({ hideExternalIntegrations: true });
      expect(shouldHideFeature(settings, 'import-app')).toBe(true);
    });

    it('should show when distribution mode is not configured', () => {
      const settings = createMockSettings();
      expect(shouldHideFeature(settings, 'import-app')).toBe(false);
    });
  });

  describe('Home page More Ideas logic', () => {
    it('should hide when distribution mode hides commercial features', () => {
      const settings = createMockSettings({ hideCommercialFeatures: true });
      expect(shouldHideFeature(settings, 'more-ideas')).toBe(true);
    });

    it('should show when distribution mode is not configured', () => {
      const settings = createMockSettings();
      expect(shouldHideFeature(settings, 'more-ideas')).toBe(false);
    });
  });

  describe('Comprehensive distribution configuration', () => {
    it('should hide all configured features in a full distribution setup', () => {
      const settings = createMockSettings({
        hideCommercialFeatures: true,
        hideProButtons: true,
        hideExternalIntegrations: true,
        hideNavigation: ['hub', 'library'],
      });

      // Should hide all commercial features
      expect(shouldHideFeature(settings, 'pro-banner')).toBe(true);
      expect(shouldHideFeature(settings, 'more-ideas')).toBe(true);

      // Should hide pro buttons
      expect(shouldHideFeature(settings, 'pro-buttons')).toBe(true);

      // Should hide external integrations
      expect(shouldHideFeature(settings, 'import-app')).toBe(true);

      // Should hide navigation
      expect(shouldHideFeature(settings, 'hub-nav')).toBe(true);
      expect(shouldHideFeature(settings, 'library-nav')).toBe(true);
    });
  });
});