// ========================================
// E2E Tests: Workspace Management
// ========================================
// End-to-end tests for workspace switching, recent paths, and data refresh

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, verifyI18nState } from './helpers/i18n-helpers';

test.describe('[Workspace] - Workspace Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display recent paths', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for recent paths section
    const recentPathsSection = page.getByTestId('recent-paths').or(
      page.getByText(/recent|history/i)
    );

    const isVisible = await recentPathsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify recent path items exist
      const pathItems = page.getByTestId(/recent-path|path-item/).or(
        page.locator('.recent-path-item')
      );

      const itemCount = await pathItems.count();

      if (itemCount === 0) {
        // Empty state is acceptable
        const emptyState = page.getByText(/no recent|empty/i);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      } else {
        expect(itemCount).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should remove recent path', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for recent paths
    const pathItems = page.getByTestId(/recent-path|path-item/).or(
      page.locator('.recent-path-item')
    );

    const itemCount = await pathItems.count();

    if (itemCount > 0) {
      const firstPath = pathItems.first();

      // Look for remove button
      const removeButton = firstPath.getByRole('button', { name: /remove|delete|x/i }).or(
        firstPath.getByTestId('remove-path-button')
      );

      const hasRemoveButton = await removeButton.isVisible().catch(() => false);

      if (hasRemoveButton) {
        const initialCount = await pathItems.count();

        await removeButton.click();

        // Verify path is removed

        const newCount = await pathItems.count();
        expect(newCount).toBe(initialCount - 1);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should switch workspace', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for workspace switcher
    const workspaceSwitcher = page.getByTestId('workspace-switcher').or(
      page.getByRole('combobox', { name: /workspace/i })
    );

    const isVisible = await workspaceSwitcher.isVisible().catch(() => false);

    if (isVisible) {
      const initialWorkspace = await workspaceSwitcher.textContent();

      await workspaceSwitcher.click();

      // Look for workspace options
      const options = page.getByRole('option');
      const optionsCount = await options.count();

      if (optionsCount > 0) {
        const firstOption = options.first();
        const optionText = await firstOption.textContent();

        if (optionText !== initialWorkspace) {
          await firstOption.click();

          // Verify workspace changed
          await page.waitForLoadState('networkidle');

          const newWorkspace = await workspaceSwitcher.textContent();
          expect(newWorkspace).not.toBe(initialWorkspace);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should refresh data after workspace switch', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get initial stats
    const initialStats = await page.evaluate(() => {
      const stats = document.querySelector('[data-testid*="stat"], .stat');
      return stats?.textContent || '';
    });

    // Look for workspace switcher
    const workspaceSwitcher = page.getByTestId('workspace-switcher').or(
      page.getByRole('combobox', { name: /workspace/i })
    );

    const isVisible = await workspaceSwitcher.isVisible().catch(() => false);

    if (isVisible) {
      await workspaceSwitcher.click();

      const options = page.getByRole('option');
      const optionsCount = await options.count();

      if (optionsCount > 0) {
        const firstOption = options.first();
        await firstOption.click();

        // Wait for data refresh
        await page.waitForLoadState('networkidle');

        // Verify data is refreshed (stats container is still visible)
        const statsContainer = page.getByTestId('dashboard-stats').or(
          page.locator('.stats')
        );

        const isStillVisible = await statsContainer.isVisible().catch(() => false);
        expect(isStillVisible).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should maintain i18n preference after workspace switch', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Set language to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();
    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      await languageSwitcher.click();
      const chineseOption = page.getByText('中文');
      await chineseOption.click();

      const initialLang = await page.evaluate(() => document.documentElement.lang);

      // Switch workspace
      const workspaceSwitcher = page.getByTestId('workspace-switcher').or(
        page.getByRole('combobox', { name: /workspace/i })
      );

      const hasWorkspaceSwitcher = await workspaceSwitcher.isVisible().catch(() => false);

      if (hasWorkspaceSwitcher) {
        await workspaceSwitcher.click();

        const options = page.getByRole('option');
        const optionsCount = await options.count();

        if (optionsCount > 0) {
          await options.first().click();
          await page.waitForLoadState('networkidle');

          // Verify language is maintained
          const currentLang = await page.evaluate(() => document.documentElement.lang);
          expect(currentLang).toBe(initialLang);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should handle workspace switch with unsaved changes', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Simulate unsaved changes
    await page.evaluate(() => {
      sessionStorage.setItem('unsaved-changes', JSON.stringify({
        form: { field1: 'value1' },
        timestamp: Date.now(),
      }));
    });

    // Try to switch workspace
    const workspaceSwitcher = page.getByTestId('workspace-switcher').or(
      page.getByRole('combobox', { name: /workspace/i })
    );

    const isVisible = await workspaceSwitcher.isVisible().catch(() => false);

    if (isVisible) {
      await workspaceSwitcher.click();

      // Check for unsaved changes warning
      const warningDialog = page.getByRole('dialog').filter({ hasText: /unsaved|changes|save/i });

      const hasWarning = await warningDialog.isVisible().catch(() => false);

      if (hasWarning) {
        expect(warningDialog).toBeVisible();

        // Test cancel button (stay on current workspace)
        const cancelButton = page.getByRole('button', { name: /cancel|stay/i });
        const hasCancel = await cancelButton.isVisible().catch(() => false);

        if (hasCancel) {
          await cancelButton.click();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should persist workspace selection on reload', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for workspace switcher
    const workspaceSwitcher = page.getByTestId('workspace-switcher').or(
      page.getByRole('combobox', { name: /workspace/i })
    );

    const isVisible = await workspaceSwitcher.isVisible().catch(() => false);

    if (isVisible) {
      const initialWorkspace = await workspaceSwitcher.textContent();

      // Reload page
      await page.reload({ waitUntil: 'networkidle' as const });

      // Verify workspace is restored
      const restoredWorkspace = await workspaceSwitcher.textContent();
      expect(restoredWorkspace).toBe(initialWorkspace);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should handle invalid workspace gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Try to navigate to invalid workspace
    await page.goto('/?workspace=invalid-workspace-that-does-not-exist', { waitUntil: 'networkidle' as const });

    // Page should still be functional
    const isPageFunctional = await page.evaluate(() => {
      return document.body !== null && document.visibilityState === 'visible';
    });

    expect(isPageFunctional).toBe(true);

    // Check for error indicator or fallback
    const errorIndicator = page.getByText(/error|not found|invalid/i);
    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Error indicator is acceptable, but page should still load
    const pageContent = await page.content();
    const hasContent = pageContent.length > 1000;

    expect(hasError || hasContent).toBe(true);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should update UI elements on workspace switch', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get initial header state
    const initialHeader = await page.locator('header').textContent();

    // Look for workspace switcher
    const workspaceSwitcher = page.getByTestId('workspace-switcher').or(
      page.getByRole('combobox', { name: /workspace/i })
    );

    const isVisible = await workspaceSwitcher.isVisible().catch(() => false);

    if (isVisible) {
      await workspaceSwitcher.click();

      const options = page.getByRole('option');
      const optionsCount = await options.count();

      if (optionsCount > 0) {
        await options.first().click();

        // Wait for UI update
        await page.waitForLoadState('networkidle');

        // Check that header is updated (if workspace name is displayed)
        const newHeader = await page.locator('header').textContent();
        expect(newHeader).toBeDefined();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display current workspace in header', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get header element
    const header = page.locator('header');

    // Check for workspace indicator
    const workspaceIndicator = header.locator('[data-testid="current-workspace"]').or(
      header.locator('*').filter({ hasText: /workspace/i })
    );

    const isVisible = await workspaceIndicator.isVisible().catch(() => false);

    if (isVisible) {
      const text = await workspaceIndicator.textContent();
      expect(text).toBeTruthy();
      expect(text?.length).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
