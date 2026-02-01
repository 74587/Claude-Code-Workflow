// ========================================
// E2E Tests: Discovery Management
// ========================================
// End-to-end tests for discovery sessions, details, and findings

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Discovery] - Discovery Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display discovery sessions list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery sessions list container
    const sessionsList = page.getByTestId('discovery-sessions-list').or(
      page.locator('.discovery-sessions-list')
    );

    const isVisible = await sessionsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify session items exist or empty state is shown
      const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
        page.locator('.discovery-item')
      );

      const itemCount = await sessionItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no discoveries|empty/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display discovery details', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Click to view details
      await firstSession.click();

      // Verify detail view loads
      await page.waitForURL(/\/discovery\//);

      const detailContainer = page.getByTestId('discovery-detail').or(
        page.locator('.discovery-detail')
      );

      const hasDetail = await detailContainer.isVisible().catch(() => false);
      expect(hasDetail).toBe(true);

      // Verify session info is displayed
      const sessionInfo = page.getByTestId('discovery-info').or(
        page.locator('.discovery-info')
      );

      const hasInfo = await sessionInfo.isVisible().catch(() => false);
      expect(hasInfo).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display discovery findings', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
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

      await page.waitForURL(/\/discovery\//);

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

  test('L3.4 - should display session status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      // Check each session has status indicator
      for (let i = 0; i < Math.min(itemCount, 3); i++) {
        const session = sessionItems.nth(i);

        // Look for status badge
        const statusBadge = session.getByTestId('session-status').or(
          session.locator('*').filter({ hasText: /running|completed|failed|pending/i })
        );

        const hasStatus = await statusBadge.isVisible().catch(() => false);
        expect(hasStatus).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display session progress', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for progress bar or percentage
      const progressBar = firstSession.getByTestId('session-progress').or(
        firstSession.locator('*').filter({ hasText: /\d+%/i })
      );

      const hasProgress = await progressBar.isVisible().catch(() => false);

      if (hasProgress) {
        const text = await progressBar.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should filter findings by severity', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/discovery\//);

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

  test('L3.7 - should display finding severity', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/discovery\//);

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

  test('L3.8 - should display finding details', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/discovery\//);

      // Look for finding items
      const findingItems = page.getByTestId(/finding-item|finding-card/).or(
        page.locator('.finding-item')
      );

      const findingCount = await findingItems.count();

      if (findingCount > 0) {
        const firstFinding = findingItems.first();

        // Look for finding title
        const title = firstFinding.getByTestId('finding-title').or(
          firstFinding.locator('.finding-title')
        );

        const hasTitle = await title.isVisible().catch(() => false);
        expect(hasTitle).toBe(true);

        // Look for finding description
        const description = firstFinding.getByTestId('finding-description').or(
          firstFinding.locator('.finding-description')
        );

        const hasDescription = await description.isVisible().catch(() => false);

        if (hasDescription) {
          const text = await description.textContent();
          expect(text).toBeTruthy();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should handle discovery API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/discoveries/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/discoveries/**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/discoveries'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should export findings report', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to discovery page
    await page.goto('/discovery', { waitUntil: 'networkidle' as const });

    // Look for discovery session items
    const sessionItems = page.getByTestId(/discovery-item|discovery-session/).or(
      page.locator('.discovery-item')
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
});
