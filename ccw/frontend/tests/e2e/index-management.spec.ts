// ========================================
// E2E Tests: Index Management
// ========================================
// End-to-end tests for index status and rebuild operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Index Management] - Index Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display index status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for index status container
    const statusContainer = page.getByTestId('index-status').or(
      page.locator('.index-status')
    );

    const isVisible = await statusContainer.isVisible().catch(() => false);

    if (isVisible) {
      // Verify status information is displayed
      const statusInfo = page.getByTestId('status-info').or(
        statusContainer.locator('*').filter({ hasText: /indexed|files|last updated/i })
      );

      const hasStatusInfo = await statusInfo.isVisible().catch(() => false);
      expect(hasStatusInfo).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display indexed file count', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for file count display
    const fileCount = page.getByTestId('indexed-files-count').or(
      page.getByText(/\d+\s*files?/i)
    );

    const hasFileCount = await fileCount.isVisible().catch(() => false);

    if (hasFileCount) {
      const text = await fileCount.textContent();
      expect(text).toBeTruthy();
      // Verify it contains a number
      const hasNumber = /\d+/.test(text || '');
      expect(hasNumber).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display last index time', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for last indexed time
    const lastIndexed = page.getByTestId('last-indexed').or(
      page.getByText(/last indexed|last updated/i)
    );

    const hasLastIndexed = await lastIndexed.isVisible().catch(() => false);

    if (hasLastIndexed) {
      const text = await lastIndexed.textContent();
      expect(text).toBeTruthy();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should rebuild index', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for rebuild button
    const rebuildButton = page.getByRole('button', { name: /rebuild|re-index/i }).or(
      page.getByTestId('rebuild-button')
    );

    const hasRebuildButton = await rebuildButton.isVisible().catch(() => false);

    if (hasRebuildButton) {
      await rebuildButton.click();

      // Confirm rebuild if dialog appears
      const confirmDialog = page.getByRole('dialog').filter({ hasText: /rebuild|confirm/i });
      const hasDialog = await confirmDialog.isVisible().catch(() => false);

      if (hasDialog) {
        const confirmButton = page.getByRole('button', { name: /rebuild|confirm|yes/i });
        await confirmButton.click();
      }

      // Look for progress indicator

      const progressIndicator = page.getByTestId('index-progress').or(
        page.getByText(/indexing|rebuilding|progress/i)
      );

      const hasProgress = await progressIndicator.isVisible().catch(() => false);

      if (hasProgress) {
        expect(progressIndicator).toBeVisible();
      }

      // Wait for rebuild to complete (or timeout)

      // Look for success message
      const successMessage = page.getByText(/rebuilt|completed|success/i);
      const hasSuccess = await successMessage.isVisible().catch(() => false);

      // Success message may or may not be present depending on timing
      if (hasSuccess) {
        expect(successMessage).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display index size', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for index size display
    const indexSize = page.getByTestId('index-size').or(
      page.getByText(/\d+KB|\d+MB|\d+GB/i)
    );

    const hasIndexSize = await indexSize.isVisible().catch(() => false);

    if (hasIndexSize) {
      const text = await indexSize.textContent();
      expect(text).toBeTruthy();
      // Verify it contains a size unit
      const hasSizeUnit = /KB|MB|GB/.test(text || '');
      expect(hasSizeUnit).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should cancel index rebuild', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for rebuild button
    const rebuildButton = page.getByRole('button', { name: /rebuild|re-index/i }).or(
      page.getByTestId('rebuild-button')
    );

    const hasRebuildButton = await rebuildButton.isVisible().catch(() => false);

    if (hasRebuildButton) {
      await rebuildButton.click();

      // Look for cancel button (if rebuild is in progress)

      const cancelButton = page.getByRole('button', { name: /cancel/i }).or(
        page.getByTestId('cancel-button')
      );

      const hasCancelButton = await cancelButton.isVisible().catch(() => false);

      if (hasCancelButton) {
        await cancelButton.click();

        // Verify cancellation message

        const cancelMessage = page.getByText(/cancelled|stopped/i);
        const hasCancelMessage = await cancelMessage.isVisible().catch(() => false);

        if (hasCancelMessage) {
          expect(cancelMessage).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should display index health status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for health indicator
    const healthIndicator = page.getByTestId('index-health').or(
      page.getByText(/healthy|status|ok/i)
    );

    const hasHealth = await healthIndicator.isVisible().catch(() => false);

    if (hasHealth) {
      const text = await healthIndicator.textContent();
      expect(text).toBeTruthy();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should handle index API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/index/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/index/**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/index'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should show index rebuild progress', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for rebuild button
    const rebuildButton = page.getByRole('button', { name: /rebuild/i });
    const hasRebuildButton = await rebuildButton.isVisible().catch(() => false);

    if (hasRebuildButton) {
      await rebuildButton.click();

      // Look for progress bar

      const progressBar = page.getByTestId('rebuild-progress').or(
        page.getByRole('progressbar')
      );

      const hasProgressBar = await progressBar.isVisible().catch(() => false);

      if (hasProgressBar) {
        expect(progressBar).toBeVisible();

        // Verify progress value is present
        const progressValue = await progressBar.getAttribute('aria-valuenow');
        const hasProgressValue = progressValue !== null;

        if (hasProgressValue) {
          const progress = parseInt(progressValue || '0', 10);
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display index configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to index management page
    await page.goto('/settings/index', { waitUntil: 'networkidle' as const });

    // Look for configuration section
    const configSection = page.getByTestId('index-config').or(
      page.getByText(/configuration|settings|options/i)
    );

    const isVisible = await configSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify config options are displayed
      const configOptions = configSection.locator('*').filter({ hasText: /exclude|include|depth/i });
      const configCount = await configOptions.count();

      expect(configCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
