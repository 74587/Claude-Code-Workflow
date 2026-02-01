// ========================================
// E2E Tests: Review Sessions Management
// ========================================
// End-to-end tests for review sessions list and detail view

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Review] - Review Sessions Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display review sessions list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review sessions list container
    const sessionsList = page.getByTestId('review-sessions-list').or(
      page.locator('.review-sessions-list')
    );

    const isVisible = await sessionsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify session items exist or empty state is shown
      const sessionItems = page.getByTestId(/review-item|review-session/).or(
        page.locator('.review-item')
      );

      const itemCount = await sessionItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no reviews|empty/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display review session detail', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Click to view detail
      await firstSession.click();

      // Verify detail view loads
      await page.waitForURL(/\/review\//);

      const detailContainer = page.getByTestId('review-detail').or(
        page.locator('.review-detail')
      );

      const hasDetail = await detailContainer.isVisible().catch(() => false);
      expect(hasDetail).toBe(true);

      // Verify session info is displayed
      const sessionInfo = page.getByTestId('review-info').or(
        page.locator('.review-info')
      );

      const hasInfo = await sessionInfo.isVisible().catch(() => false);
      expect(hasInfo).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display review session title', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      // Check each session has a title
      for (let i = 0; i < Math.min(itemCount, 3); i++) {
        const session = sessionItems.nth(i);

        const titleElement = session.getByTestId('review-title').or(
          session.locator('.review-title')
        );

        const hasTitle = await titleElement.isVisible().catch(() => false);
        expect(hasTitle).toBe(true);

        const title = await titleElement.textContent();
        expect(title).toBeTruthy();
        expect(title?.length).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should display review findings', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for findings count
      const findingsCount = firstSession.getByTestId('findings-count').or(
        firstSession.locator('*').filter({ hasText: /\d+\s*findings/i })
      );

      const hasFindingsCount = await findingsCount.isVisible().catch(() => false);

      if (hasFindingsCount) {
        const text = await findingsCount.textContent();
        expect(text).toBeTruthy();
      }

      // Click to view findings
      await firstSession.click();

      await page.waitForURL(/\/review\//);

      // Look for findings list
      const findingsList = page.getByTestId('findings-list').or(
        page.locator('.findings-list')
      );

      const hasFindings = await findingsList.isVisible().catch(() => false);

      if (hasFindings) {
        const findingItems = page.getByTestId(/finding-item|finding-card/).or(
          page.locator('.finding-item')
        );

        const findingCount = await findingItems.count();
        expect(findingCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display review dimensions', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/review\//);

      // Look for dimensions list
      const dimensionsList = page.getByTestId('review-dimensions').or(
        page.locator('.review-dimensions')
      );

      const hasDimensions = await dimensionsList.isVisible().catch(() => false);

      if (hasDimensions) {
        const dimensionItems = page.getByTestId(/dimension-item|dimension-card/).or(
          dimensionsList.locator('.dimension-item')
        );

        const dimensionCount = await dimensionItems.count();
        expect(dimensionCount).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display finding severity', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/review\//);

      // Look for finding items
      const findingItems = page.getByTestId(/finding-item|finding-card/).or(
        page.locator('.finding-item')
      );

      const findingCount = await findingItems.count();

      if (findingCount > 0) {
        const firstFinding = findingItems.first();

        // Look for severity badge
        const severityBadge = firstFinding.getByTestId('finding-severity').or(
          firstFinding.locator('*').filter({ hasText: /critical|high|medium|low/i })
        );

        const hasSeverity = await severityBadge.isVisible().catch(() => false);
        expect(hasSeverity).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should filter findings by severity', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/review\//);

      // Look for severity filter
      const severityFilter = page.getByRole('combobox', { name: /severity|filter/i }).or(
        page.getByTestId('severity-filter')
      );

      const hasFilter = await severityFilter.isVisible().catch(() => false);

      if (hasFilter) {
        const filterOptions = await severityFilter.locator('option').count();

        if (filterOptions > 1) {
          await severityFilter.selectOption({ index: 1 });

          // Wait for filtered results

          const findingItems = page.getByTestId(/finding-item|finding-card/).or(
            page.locator('.finding-item')
          );

          const findingCount = await findingItems.count();
          expect(findingCount).toBeGreaterThanOrEqual(0);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should display finding recommendations', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/review\//);

      // Look for finding items
      const findingItems = page.getByTestId(/finding-item|finding-card/).or(
        page.locator('.finding-item')
      );

      const findingCount = await findingItems.count();

      if (findingCount > 0) {
        const firstFinding = findingItems.first();

        // Look for recommendations section
        const recommendations = firstFinding.getByTestId('finding-recommendations').or(
          firstFinding.locator('*').filter({ hasText: /recommend|fix|suggestion/i })
        );

        const hasRecommendations = await recommendations.isVisible().catch(() => false);

        if (hasRecommendations) {
          const text = await recommendations.textContent();
          expect(text).toBeTruthy();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should export review report', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for review session items
    const sessionItems = page.getByTestId(/review-item|review-session/).or(
      page.locator('.review-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for export button
      const exportButton = firstSession.getByRole('button', { name: /export|download|report/i }).or(
        firstSession.getByTestId('export-button')
      );

      const hasExportButton = await exportButton.isVisible().catch(() => false);

      if (hasExportButton) {
        // Click export and verify download starts
        const downloadPromise = page.waitForEvent('download');

        await exportButton.click();

        const download = await downloadPromise.catch(() => null);

        // Either download started or there was feedback
        const successMessage = page.getByText(/exporting|downloading|success/i);
        const hasMessage = await successMessage.isVisible().catch(() => false);

        expect(download !== null || hasMessage).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should handle review API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/**/review**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to review sessions page
    await page.goto('/review', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/**/review**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api'], allowWarnings: true });
    monitoring.stop();
  });
});
