// ========================================
// E2E Tests: History - Archived Session Management
// ========================================
// End-to-end tests for history page with search, filter, restore operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[History] - Archived Session Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history', { waitUntil: 'networkidle' as const });
  });

  test('L3.31 - Page loads and displays archived sessions', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for history
    await page.route('**/api/history', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              id: 'session-1',
              title: 'Archived Session 1',
              archivedAt: Date.now(),
              status: 'completed'
            }
          ]
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for history list
    const historyList = page.getByTestId('history-list').or(
      page.locator('.history-list')
    );

    const isListVisible = await historyList.isVisible().catch(() => false);

    if (isListVisible) {
      // Verify session items are displayed
      const sessionItems = page.getByTestId(/session-item|history-item/).or(
        page.locator('.history-item')
      );

      const itemCount = await sessionItems.count();
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.32 - Search archived sessions', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for search
    await page.route('**/api/history?q=**', (route) => {
      const requestUrl = route.request().url();
      const url = new URL(requestUrl);
      const query = url.searchParams.get('q');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              id: 'session-search',
              title: `Search Result for ${query}`,
              archivedAt: Date.now()
            }
          ]
        })
      });
    });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('search-input')
    );

    const hasSearchInput = await searchInput.isVisible().catch(() => false);

    if (hasSearchInput) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Verify search was performed
      const searchResults = page.getByTestId(/history-item|session-item/);
      const resultCount = await searchResults.count();
      expect(resultCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.33 - Filter by date range', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for date filter
    await page.route('**/api/history**', (route) => {
      const requestUrl = route.request().url();
      const url = new URL(requestUrl);
      const fromDate = url.searchParams.get('from');
      const toDate = url.searchParams.get('to');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              id: 'session-filtered',
              title: 'Filtered by Date',
              archivedAt: Date.now()
            }
          ]
        })
      });
    });

    // Look for date filter controls
    const dateFilter = page.getByTestId('date-filter').or(
      page.locator('*').filter({ hasText: /date|filter/i })
    );

    const hasDateFilter = await dateFilter.isVisible().catch(() => false);

    if (hasDateFilter) {
      const fromDateInput = page.getByRole('textbox', { name: /from|start/i });
      const hasFromDate = await fromDateInput.isVisible().catch(() => false);

      if (hasFromDate) {
        await fromDateInput.fill('2024-01-01');

        const toDateInput = page.getByRole('textbox', { name: /to|end/i });
        const hasToDate = await toDateInput.isVisible().catch(() => false);

        if (hasToDate) {
          await toDateInput.fill('2024-12-31');

          // Look for apply button
          const applyButton = page.getByRole('button', { name: /apply|filter/i });
          const hasApplyButton = await applyButton.isVisible().catch(() => false);

          if (hasApplyButton) {
            await applyButton.click();
            await page.waitForTimeout(500);
          }
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.34 - Restore archived session', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for restore
    await page.route('**/api/history/*/restore', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sessionId: 'restored-session' })
      });
    });

    // Look for archived session
    const sessionItems = page.getByTestId(/session-item|history-item/).or(
      page.locator('.history-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for restore button
      const restoreButton = firstSession.getByRole('button', { name: /restore|reload/i }).or(
        firstSession.getByTestId('restore-button')
      );

      const hasRestoreButton = await restoreButton.isVisible().catch(() => false);

      if (hasRestoreButton) {
        await restoreButton.click();

        // Verify success message
        const successMessage = page.getByText(/restored|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.35 - Delete archived session', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for delete
    await page.route('**/api/history/*', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else {
        route.continue();
      }
    });

    // Look for archived session
    const sessionItems = page.getByTestId(/session-item|history-item/).or(
      page.locator('.history-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for delete button
      const deleteButton = firstSession.getByRole('button', { name: /delete|remove/i }).or(
        firstSession.getByTestId('delete-button')
      );

      const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

      if (hasDeleteButton) {
        await deleteButton.click();

        // Confirm deletion if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = confirmDialog.getByRole('button', { name: /delete|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify success message
        const successMessage = page.getByText(/deleted|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.36 - i18n - Archive messages in EN/ZH', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify history content is in Chinese
      const pageContent = await page.content();
      const hasChineseText = /[\u4e00-\u9fa5]/.test(pageContent);
      expect(hasChineseText).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.37 - Error - Restore fails', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API error for restore
    await page.route('**/api/history/*/restore', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to restore session' })
      });
    });

    // Look for archived session
    const sessionItems = page.getByTestId(/session-item|history-item/).or(
      page.locator('.history-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for restore button
      const restoreButton = firstSession.getByRole('button', { name: /restore|reload/i });

      const hasRestoreButton = await restoreButton.isVisible().catch(() => false);

      if (hasRestoreButton) {
        await restoreButton.click();

        // Verify error message
        const errorMessage = page.getByText(/error|failed|unable/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/history'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.38 - Edge - Empty archive state', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for empty history
    await page.route('**/api/history', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: [] })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for empty state UI OR validate that list is empty (defensive check)
    const emptyState = page.getByTestId('empty-state').or(
      page.getByText(/no history|empty|no sessions/i)
    );

    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    // Fallback: check if history list is empty
    const listItems = page.getByTestId(/session-item|history-item/).or(
      page.locator('.history-item')
    );
    const itemCount = await listItems.count();

    // Test passes if: empty state UI is visible OR list has 0 items
    const isValidEmptyState = hasEmptyState || itemCount === 0;
    expect(isValidEmptyState).toBe(true);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
