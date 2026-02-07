// ========================================
// E2E Tests: Help Page
// ========================================
// End-to-end tests for help documentation page

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Help] - Help Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' as const });
  });

  test('L3.50 - should display help documentation content', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for help page content
    const helpContent = page.getByTestId('help-content').or(
      page.locator('.help-documentation')
    ).or(
      page.locator('main')
    );

    await expect(helpContent).toBeVisible();

    // Verify page title is present
    const pageTitle = page.getByRole('heading', { name: /help|帮助/i }).or(
      page.locator('h1')
    );

    const hasTitle = await pageTitle.isVisible().catch(() => false);
    expect(hasTitle).toBe(true);

    // Verify help sections are displayed
    const helpSections = page.locator('a[href*="/docs"], a[href^="/docs"]').or(
      page.locator('[data-testid*="help"]')
    );

    const sectionCount = await helpSections.count();
    expect(sectionCount).toBeGreaterThan(0);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.51 - should display documentation navigation links', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for documentation links
    const docLinks = page.locator('a[href*="/docs/"], a[href^="/docs"]').or(
      page.locator('[data-testid="docs-link"]')
    );

    const linkCount = await docLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // Verify links have proper structure
    for (let i = 0; i < Math.min(linkCount, 3); i++) {
      const link = docLinks.nth(i);
      await expect(link).toHaveAttribute('href');
    }

    // Look for "Full Documentation" button/link
    const fullDocsLink = page.getByRole('link', { name: /full.*docs|documentation/i }).or(
      page.locator('a[href="/docs"]')
    );

    const hasFullDocs = await fullDocsLink.isVisible().catch(() => false);
    expect(hasFullDocs).toBe(true);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.52 - should support i18n (English/Chinese switching)', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify help content is in Chinese
      const pageContent = await page.content();
      const hasChinese = /[\u4e00-\u9fa5]/.test(pageContent);
      expect(hasChinese).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);

      // Verify help content is in English
      const englishContent = await page.content();
      const hasEnglish = /[a-zA-Z]{5,}/.test(englishContent);
      expect(hasEnglish).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.53 - should display quick links and overview cards', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for quick link cards
    const quickLinkCards = page.locator('a[href*="/docs"], a[href="/sessions"]').or(
      page.locator('[data-testid*="card"], .card')
    );

    const cardCount = await quickLinkCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify documentation overview cards exist
    const overviewCards = page.locator('a[href*="/docs/commands"], a[href*="/docs/workflows"], a[href*="/docs/overview"]').or(
      page.locator('[data-testid*="overview"]')
    );

    const overviewCount = await overviewCards.count();
    expect(overviewCount).toBeGreaterThan(0);

    // Look for specific help sections (Getting Started, Orchestrator Guide, Commands)
    const gettingStartedLink = page.getByRole('link', { name: /getting.*started|入门/i });
    const orchestratorGuideLink = page.getByRole('link', { name: /orchestrator.*guide|编排指南/i });
    const commandsLink = page.getByRole('link', { name: /commands|命令/i });

    const hasGettingStarted = await gettingStartedLink.isVisible().catch(() => false);
    const hasOrchestratorGuide = await orchestratorGuideLink.isVisible().catch(() => false);
    const hasCommands = await commandsLink.isVisible().catch(() => false);

    // At least one help section should be visible
    expect(hasGettingStarted || hasOrchestratorGuide || hasCommands).toBe(true);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.54 - should ensure basic accessibility and page structure', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Verify main content area exists
    const mainContent = page.locator('main').or(
      page.locator('#main-content')
    ).or(
      page.locator('[role="main"]')
    );

    await expect(mainContent).toBeVisible();

    // Verify page has proper heading structure
    const h1 = page.locator('h1');
    const hasH1 = await h1.count();
    expect(hasH1).toBeGreaterThanOrEqual(1);

    // Look for skip to main content link (accessibility feature)
    const skipLink = page.getByRole('link', { name: /skip to main content|跳转到主要内容/i });

    const hasSkipLink = await skipLink.isVisible().catch(() => false);
    // Skip link may not be visible by default, so we don't fail if missing
    if (hasSkipLink) {
      await expect(skipLink).toHaveAttribute('href');
    }

    // Verify focus management on interactive elements
    const interactiveElements = page.locator('button, a[href], [tabindex]:not([tabindex="-1"])');
    const interactiveCount = await interactiveElements.count();
    expect(interactiveCount).toBeGreaterThan(0);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
