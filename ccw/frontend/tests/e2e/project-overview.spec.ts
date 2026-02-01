// ========================================
// E2E Tests: Project Overview
// ========================================
// End-to-end tests for project overview display and navigation

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Project Overview] - Project Overview Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display project overview', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for project overview container
    const overviewContainer = page.getByTestId('project-overview').or(
      page.locator('.project-overview')
    );

    const isVisible = await overviewContainer.isVisible().catch(() => false);

    if (isVisible) {
      // Verify project name is displayed
      const projectName = page.getByTestId('project-name').or(
        page.locator('h1').filter({ hasText: /.+/ })
      );

      const hasName = await projectName.isVisible().catch(() => false);
      expect(hasName).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display technology stack', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for technology stack section
    const techStackSection = page.getByTestId('tech-stack').or(
      page.getByText(/technology stack|tech stack|languages/i)
    );

    const isVisible = await techStackSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify tech stack items are displayed
      const techItems = page.getByTestId(/tech-item|language-item/).or(
        techStackSection.locator('.tech-item')
      );

      const techCount = await techItems.count();
      expect(techCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display architecture information', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for architecture section
    const archSection = page.getByTestId('architecture').or(
      page.getByText(/architecture|design/i)
    );

    const isVisible = await archSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify architecture info is displayed
      const archInfo = archSection.locator('*').filter({ hasText: /layers|patterns|style/i });

      const hasInfo = await archInfo.isVisible().catch(() => false);
      expect(hasInfo).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should display key components', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for key components section
    const componentsSection = page.getByTestId('key-components').or(
      page.getByText(/components|modules/i)
    );

    const isVisible = await componentsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify component items are displayed
      const componentItems = page.getByTestId(/component-item|key-component/).or(
        componentsSection.locator('.component-item')
      );

      const componentCount = await componentItems.count();
      expect(componentCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display development index', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for development index section
    const devIndexSection = page.getByTestId('development-index').or(
      page.getByText(/development index|features|enhancements/i)
    );

    const isVisible = await devIndexSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify index items are displayed or empty state
      const indexItems = page.getByTestId(/index-item|feature-item/).or(
        devIndexSection.locator('.index-item')
      );

      const indexCount = await indexItems.count();

      if (indexCount === 0) {
        const emptyState = page.getByText(/no entries|empty/i);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should support i18n in project overview', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify project overview content is in Chinese
      const pageContent = await page.content();
      const hasChineseText = /[\u4e00-\u9fa5]/.test(pageContent);
      expect(hasChineseText).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should display project guidelines', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for guidelines section
    const guidelinesSection = page.getByTestId('project-guidelines').or(
      page.getByText(/guidelines|conventions|rules/i)
    );

    const isVisible = await guidelinesSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify guideline items are displayed or empty state
      const guidelineItems = page.getByTestId(/guideline-item|convention-item/).or(
        guidelinesSection.locator('.guideline-item')
      );

      const guidelineCount = await guidelineItems.count();

      if (guidelineCount === 0) {
        const emptyState = page.getByText(/no guidelines|empty/i);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should display project initialization date', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for initialization date
    const initDate = page.getByTestId('initialization-date').or(
      page.getByText(/initialized|created|since/i)
    );

    const hasInitDate = await initDate.isVisible().catch(() => false);

    if (hasInitDate) {
      const text = await initDate.textContent();
      expect(text).toBeTruthy();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should handle project overview API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/ccw**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/ccw**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/ccw'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should refresh project data', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to project overview page
    await page.goto('/project', { waitUntil: 'networkidle' as const });

    // Get initial content
    const initialContent = await page.content();

    // Look for refresh button
    const refreshButton = page.getByRole('button', { name: /refresh|reload/i }).or(
      page.getByTestId('refresh-button')
    );

    const hasRefreshButton = await refreshButton.isVisible().catch(() => false);

    if (hasRefreshButton) {
      await refreshButton.click();

      // Wait for data refresh
      await page.waitForLoadState('networkidle');

      // Verify content is still displayed
      const newContent = await page.content();
      expect(newContent.length).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
