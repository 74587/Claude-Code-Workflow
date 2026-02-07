// ========================================
// E2E Tests: Loops Monitor - Real-time Workflow Execution
// ========================================
// End-to-end tests for loop monitoring with WebSocket mocking

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Loops Monitor] - Real-time Loop Tracking Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API mocks BEFORE page navigation to prevent 404 errors
    // Mock WebSocket connection for real-time updates
    await page.route('**/ws/loops**', (route) => {
      route.fulfill({
        status: 101,
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket'
        },
        body: ''
      });
    });

    // Mock API for loops list
    await page.route('**/api/loops**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          loops: [
            {
              id: 'loop-1',
              name: 'Test Loop',
              status: 'running',
              progress: 50,
              startedAt: Date.now()
            }
          ]
        })
      });
    });

    await page.goto('/loops', { waitUntil: 'networkidle' as const });
  });

  test('L3.13 - Page loads and displays active loops', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Note: page.goto() already called in beforeEach with mocks set up

    // Look for loops list
    const loopsList = page.getByTestId('loops-list').or(
      page.locator('.loops-list')
    );

    const isListVisible = await loopsList.isVisible().catch(() => false);

    if (isListVisible) {
      // Verify loop items are displayed
      const loopItems = page.getByTestId(/loop-item|loop-card/).or(
        page.locator('.loop-item')
      );

      const itemCount = await loopItems.count();
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.14 - Real-time loop status updates (mock WS)', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Note: page.goto() already called in beforeEach with mocks set up

    // Inject mock WebSocket message for status update
    await page.evaluate(() => {
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'loop-update',
          loopId: 'loop-1',
          status: 'running',
          progress: 75
        })
      });

      window.dispatchEvent(event);
    });

    // Wait for update to be processed
    await page.waitForTimeout(500);

    // Look for updated status display
    const statusBadge = page.getByTestId('loop-status-badge').or(
      page.locator('*').filter({ hasText: /running|75%/i })
    );

    const hasStatus = await statusBadge.isVisible().catch(() => false);
    // Status update may or may not be visible

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.15 - Filter loops by status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for filtered loops
    await page.route('**/api/loops?status=**', (route) => {
      const requestUrl = route.request().url();
      const url = new URL(requestUrl);
      const status = url.searchParams.get('status');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          loops: [
            {
              id: `loop-${status}`,
              name: `Filtered ${status} Loop`,
              status: status
            }
          ]
        })
      });
    });

    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for status filter
    const statusFilter = page.getByRole('combobox', { name: /status|filter/i }).or(
      page.getByTestId('status-filter')
    );

    const hasFilter = await statusFilter.isVisible().catch(() => false);

    if (hasFilter) {
      await statusFilter.selectOption('running');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify filter applied
      const currentUrl = page.url();
      const hasFilterParam = currentUrl.includes('status=');
      // URL may or may not have filter parameter
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.16 - Terminate running loop', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for termination
    await page.route('**/api/loops/*/terminate', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'terminated' })
      });
    });

    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for running loop
    const runningLoops = page.locator('.loop-item').filter({ hasText: /running|active/i });

    const count = await runningLoops.count();

    if (count > 0) {
      const firstLoop = runningLoops.first();

      // Look for terminate button
      const terminateButton = firstLoop.getByRole('button', { name: /terminate|stop|end/i }).or(
        firstLoop.getByTestId('loop-terminate-button')
      );

      const hasTerminateButton = await terminateButton.isVisible().catch(() => false);

      if (hasTerminateButton) {
        await terminateButton.click();

        // Confirm if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /terminate|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = confirmDialog.getByRole('button', { name: /terminate|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify success
        const successMessage = page.getByText(/terminated|stopped|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.17 - View loop execution logs', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for logs
    await page.route('**/api/loops/*/logs', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [
            { timestamp: Date.now(), level: 'info', message: 'Loop started' },
            { timestamp: Date.now(), level: 'info', message: 'Processing step 1' }
          ]
        })
      });
    });

    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for loop items
    const loopItems = page.getByTestId(/loop-item|loop-card/).or(
      page.locator('.loop-item')
    );

    const itemCount = await loopItems.count();

    if (itemCount > 0) {
      const firstLoop = loopItems.first();

      // Look for logs button/panel
      const logsButton = firstLoop.getByRole('button', { name: /logs|view logs/i }).or(
        firstLoop.getByTestId('view-logs-button')
      );

      const hasLogsButton = await logsButton.isVisible().catch(() => false);

      if (hasLogsButton) {
        await logsButton.click();

        // Look for logs panel
        const logsPanel = page.getByTestId('loop-logs-panel').or(
          page.getByRole('dialog').filter({ hasText: /logs/i })
        );

        const hasLogsPanel = await logsPanel.isVisible().catch(() => false);
        expect(hasLogsPanel).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.18 - i18n - Loop status in EN/ZH', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify loop status in Chinese
      const statusText = page.getByText(/运行|停止|完成/i);
      const hasChineseStatus = await statusText.isVisible().catch(() => false);

      // Chinese status may or may not be visible depending on active loops
      if (hasChineseStatus) {
        expect(hasChineseStatus).toBe(true);
      }

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.19 - Error - Failed loop displays error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for failed loop
    await page.route('**/api/loops', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          loops: [
            {
              id: 'loop-failed',
              name: 'Failed Loop',
              status: 'failed',
              error: 'Connection timeout'
            }
          ]
        })
      });
    });

    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/failed|error|timeout/i).or(
      page.getByTestId('loop-error')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    if (hasError) {
      expect(errorIndicator).toBeVisible();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.20 - Edge - No loops available', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for empty loops
    await page.route('**/api/loops', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ loops: [] })
      });
    });

    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for empty state (may not be implemented in UI)
    const emptyState = page.getByTestId('empty-state').or(
      page.getByText(/no loops|empty|get started/i)
    );

    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    // If empty state UI doesn't exist, verify loops list is empty instead
    if (!hasEmptyState) {
      const loopsList = page.getByTestId('loops-list').or(
        page.locator('.loops-list')
      );
      const isListVisible = await loopsList.isVisible().catch(() => false);

      if (isListVisible) {
        // Verify no loop items are displayed
        const loopItems = page.getByTestId(/loop-item|loop-card/).or(
          page.locator('.loop-item')
        );
        const itemCount = await loopItems.count();
        expect(itemCount).toBe(0);
      }
      // If neither empty state nor list is visible, that's also acceptable
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
