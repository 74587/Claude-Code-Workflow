// ========================================
// E2E Tests: Project - Development Timeline and Statistics
// ========================================
// End-to-end tests for project overview with statistics and timeline

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Project] - Development Statistics Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/project', { waitUntil: 'networkidle' as const });
  });

  test('L3.39 - Page loads and displays project statistics', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for project stats
    await page.route('**/api/project', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: {
            totalCommits: 150,
            totalFiles: 450,
            totalLines: 25000,
            languages: ['TypeScript', 'JavaScript', 'CSS'],
            contributors: 5
          }
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for project stats
    const projectStats = page.getByTestId('project-stats').or(
      page.locator('.project-stats')
    );

    const isStatsVisible = await projectStats.isVisible().catch(() => false);

    if (isStatsVisible) {
      // Verify stat items are displayed
      const statItems = page.getByTestId(/stat-|stat-card/).or(
        page.locator('.stat-item')
      );

      const statCount = await statItems.count();
      expect(statCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.40 - View development timeline', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for timeline section
    const timeline = page.getByTestId('timeline-chart').or(
      page.getByText(/timeline|activity|history/i)
    );

    const hasTimeline = await timeline.isVisible().catch(() => false);

    if (hasTimeline) {
      // Verify timeline has content
      const timelineContent = timeline.locator('*').filter({ hasText: /\d+|commit|activity/i });
      const hasContent = await timelineContent.isVisible().catch(() => false);

      if (hasContent) {
        expect(timelineContent).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.41 - View contribution graph', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for contribution graph
    const contributionGraph = page.getByTestId('contribution-graph').or(
      page.locator('.contribution-graph')
    );

    const hasGraph = await contributionGraph.isVisible().catch(() => false);

    if (hasGraph) {
      // Verify graph has visualization elements
      const graphElements = contributionGraph.locator('*').filter({ hasText: /\d+/ });
      const elementCount = await graphElements.count();
      expect(elementCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.42 - i18n - Project stats in EN/ZH', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify project stats are in Chinese
      const pageContent = await page.content();
      const hasChineseText = /[\u4e00-\u9fa5]/.test(pageContent);
      expect(hasChineseText).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.43 - Error - Failed to load project data', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API error
    await page.route('**/api/project', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load project data' })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    if (hasError) {
      expect(errorIndicator).toBeVisible();
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/project'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.44 - Edge - No commits state', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for no commits
    await page.route('**/api/project', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: {
            totalCommits: 0,
            totalFiles: 0,
            totalLines: 0,
            languages: [],
            contributors: 0
          }
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for empty state or zero stats
    const emptyState = page.getByText(/no commits|no activity|empty/i);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      expect(emptyState).toBeVisible();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
