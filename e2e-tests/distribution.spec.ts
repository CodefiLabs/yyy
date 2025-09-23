import { testWithConfig } from "./helpers/test_helper";
import { expect } from "@playwright/test";

const testDistribution = testWithConfig({
  showSetupScreen: false,
});

testDistribution.beforeEach(async ({ }) => {
  // Set distribution mode environment variable for this test
  process.env.DYAD_DISTRIBUTION_BUILD = "true";
});

testDistribution.afterEach(async ({ }) => {
  // Clean up environment variable after test
  delete process.env.DYAD_DISTRIBUTION_BUILD;
});

testDistribution("should hide commercial features in distribution mode", async ({ po }) => {
  // Wait for the page to fully load
  await po.page.waitForLoadState('networkidle');

  // Verify Pro banner is hidden
  const proBanner = po.page.locator('[data-testid="pro-banner"]');
  await expect(proBanner).not.toBeVisible();

  // Verify More Ideas section is hidden
  const moreIdeasHeading = po.page.locator('text=More ideas');
  await expect(moreIdeasHeading).not.toBeVisible();

  // Verify Import App button is hidden
  const importAppButton = po.page.locator('text=Import App');
  await expect(importAppButton).not.toBeVisible();
});

testDistribution("should hide navigation items in distribution mode", async ({ po }) => {
  // Wait for the page to fully load
  await po.page.waitForLoadState('networkidle');

  // Verify Hub navigation is hidden
  const hubNav = po.page.locator('text=Hub').first();
  await expect(hubNav).not.toBeVisible();

  // Verify Library navigation is hidden
  const libraryNav = po.page.locator('text=Library').first();
  await expect(libraryNav).not.toBeVisible();

  // Verify Home navigation is still visible (should not be hidden)
  const homeNav = po.page.locator('text=Home').first();
  await expect(homeNav).toBeVisible();
});

testDistribution("should hide pro buttons in distribution mode", async ({ po }) => {
  // Wait for the page to fully load
  await po.page.waitForLoadState('networkidle');

  // Look for any Pro-related buttons or upgrade prompts
  const proButtons = po.page.locator('text=/Pro|Upgrade|Premium/i');

  // Count visible Pro buttons - should be 0 in distribution mode
  const visibleProButtons = await proButtons.filter({ hasText: /Pro|Upgrade|Premium/i }).count();
  expect(visibleProButtons).toBe(0);
});

testDistribution("should maintain core functionality while hiding commercial features", async ({ po }) => {
  // Wait for the page to fully load
  await po.page.waitForLoadState('networkidle');

  // Verify core functionality is still accessible
  // Check that the main chat interface is available
  const chatInterface = po.page.locator('[data-testid="chat-interface"], textarea, input[type="text"]').first();
  await expect(chatInterface).toBeVisible();

  // Verify settings/config options are still available
  const settingsButton = po.page.locator('button, [role="button"]').filter({ hasText: /Settings|Config|Menu/i }).first();
  if (await settingsButton.count() > 0) {
    await expect(settingsButton).toBeVisible();
  }
});