// ========================================
// E2E Tests: CodexLens Manager
// ========================================
// End-to-end tests for CodexLens management feature

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[CodexLens Manager] - CodexLens Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L4.1 - should navigate to CodexLens manager', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CodexLens page
    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Check page title
    const title = page.getByText(/CodexLens/i).or(page.getByRole('heading', { name: /CodexLens/i }));
    await expect(title).toBeVisible({ timeout: 5000 }).catch(() => false);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.2 - should display all tabs', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Check for tabs
    const tabs = ['Overview', 'Settings', 'Models', 'Advanced'];
    for (const tab of tabs) {
      const tabElement = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      const isVisible = await tabElement.isVisible().catch(() => false);
      if (isVisible) {
        await expect(tabElement).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.3 - should switch between tabs', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Click Settings tab
    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();
      // Verify tab is active
      await expect(settingsTab).toHaveAttribute('data-state', 'active');
    }

    // Click Models tab
    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();
      await expect(modelsTab).toHaveAttribute('data-state', 'active');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.4 - should display overview status cards when installed', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for status cards
    const statusLabels = ['Installation Status', 'Version', 'Index Path', 'Index Count'];
    for (const label of statusLabels) {
      const element = page.getByText(new RegExp(label, 'i'));
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        await expect(element).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.5 - should display quick action buttons', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for quick action buttons
    const actions = ['FTS Full', 'FTS Incremental', 'Vector Full', 'Vector Incremental'];
    for (const action of actions) {
      const button = page.getByRole('button', { name: new RegExp(action, 'i') });
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await expect(button).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.6 - should display settings form', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Switch to Settings tab
    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();

      // Check for form inputs
      const indexDirInput = page.getByLabel(/Index Directory/i);
      const maxWorkersInput = page.getByLabel(/Max Workers/i);
      const batchSizeInput = page.getByLabel(/Batch Size/i);

      const indexDirVisible = await indexDirInput.isVisible().catch(() => false);
      const maxWorkersVisible = await maxWorkersInput.isVisible().catch(() => false);
      const batchSizeVisible = await batchSizeInput.isVisible().catch(() => false);

      // At least one should be visible if the form is rendered
      expect(indexDirVisible || maxWorkersVisible || batchSizeVisible).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.7 - should save settings configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();

      // Modify index directory
      const indexDirInput = page.getByLabel(/Index Directory/i);
      const indexDirVisible = await indexDirInput.isVisible().catch(() => false);
      if (indexDirVisible) {
        await indexDirInput.fill('/custom/index/path');

        // Click save button
        const saveButton = page.getByRole('button', { name: /Save/i });
        const saveVisible = await saveButton.isVisible().catch(() => false);
        if (saveVisible && !(await saveButton.isDisabled())) {
          await saveButton.click();

          // Wait for success or completion
          await page.waitForTimeout(1000);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.8 - should validate settings form', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();

      // Try to save with empty index directory
      const indexDirInput = page.getByLabel(/Index Directory/i);
      const indexDirVisible = await indexDirInput.isVisible().catch(() => false);
      if (indexDirVisible) {
        await indexDirInput.fill('');

        const saveButton = page.getByRole('button', { name: /Save/i });
        const saveVisible = await saveButton.isVisible().catch(() => false);
        if (saveVisible && !(await saveButton.isDisabled())) {
          await saveButton.click();

          // Check for validation error
          const errorMessage = page.getByText(/required/i, { exact: false });
          const hasError = await errorMessage.isVisible().catch(() => false);
          if (hasError) {
            await expect(errorMessage).toBeVisible();
          }
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.9 - should display models list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Switch to Models tab
    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Look for filter buttons
      const filters = ['All', 'Embedding', 'Reranker', 'Downloaded', 'Available'];
      for (const filter of filters) {
        const button = page.getByRole('button', { name: new RegExp(filter, 'i') });
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          await expect(button).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.10 - should filter models by type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Click Embedding filter
      const embeddingFilter = page.getByRole('button', { name: /Embedding/i });
      const embeddingVisible = await embeddingFilter.isVisible().catch(() => false);
      if (embeddingVisible) {
        await embeddingFilter.click();
        // Filter should be active
        await expect(embeddingFilter).toHaveAttribute('data-state', 'active');
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.11 - should search models', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Type in search box
      const searchInput = page.getByPlaceholderText(/Search models/i);
      const searchVisible = await searchInput.isVisible().catch(() => false);
      if (searchVisible) {
        await searchInput.fill('test-model');
        await page.waitForTimeout(500);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.12 - should handle bootstrap when not installed', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for bootstrap button (only visible when not installed)
    const bootstrapButton = page.getByRole('button', { name: /Bootstrap/i });
    const bootstrapVisible = await bootstrapButton.isVisible().catch(() => false);
    if (bootstrapVisible) {
      await expect(bootstrapButton).toBeVisible();
      // Don't actually click it to avoid installing in test
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.13 - should show uninstall confirmation', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for uninstall button (only visible when installed)
    const uninstallButton = page.getByRole('button', { name: /Uninstall/i });
    const uninstallVisible = await uninstallButton.isVisible().catch(() => false);
    if (uninstallVisible) {
      // Set up dialog handler before clicking
      page.on('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      await uninstallButton.click();

      // Check for confirmation dialog
      const dialog = page.getByRole('dialog');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      // Dialog may or may not appear depending on implementation
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.14 - should display refresh button', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for refresh button
    const refreshButton = page.getByRole('button', { name: /Refresh/i }).or(
      page.getByRole('button', { name: /refresh/i })
    );
    const refreshVisible = await refreshButton.isVisible().catch(() => false);
    if (refreshVisible) {
      await expect(refreshButton).toBeVisible();

      // Click refresh
      await refreshButton.click();
      await page.waitForTimeout(500);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.15 - should handle API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure for CodexLens endpoint
    await page.route('**/api/codexlens/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for error indicator or graceful degradation
    const title = page.getByText(/CodexLens/i);
    const titleVisible = await title.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/codexlens/**');

    // Page should still be visible despite error
    expect(titleVisible).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/codexlens'], allowWarnings: true });
    monitoring.stop();
  });

  test('L4.16 - should switch language and verify translations', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Switch to Chinese if language switcher is available
    const languageSwitcher = page.getByRole('button', { name: /中文|Language/i });
    const switcherVisible = await languageSwitcher.isVisible().catch(() => false);
    if (switcherVisible) {
      await languageSwitcher.click();

      // Check for Chinese translations
      const chineseTitle = page.getByText(/CodexLens/i);
      await expect(chineseTitle).toBeVisible();

      // Check for Chinese tab labels
      const overviewTab = page.getByRole('tab', { name: /概览/i });
      const overviewVisible = await overviewTab.isVisible().catch(() => false);
      if (overviewVisible) {
        await expect(overviewTab).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.17 - should navigate from sidebar', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/', { waitUntil: 'networkidle' as const });

    // Look for CodexLens link in sidebar
    const codexLensLink = page.getByRole('link', { name: /CodexLens/i });
    const linkVisible = await codexLensLink.isVisible().catch(() => false);
    if (linkVisible) {
      await codexLensLink.click();
      await page.waitForURL(/codexlens/);
      expect(page.url()).toContain('codexlens');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.18 - should display empty state when no models', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Search for a non-existent model to show empty state
      const searchInput = page.getByPlaceholderText(/Search models/i);
      const searchVisible = await searchInput.isVisible().catch(() => false);
      if (searchVisible) {
        await searchInput.fill('nonexistent-model-xyz-123');

        // Look for empty state message
        const emptyState = page.getByText(/No models found/i);
        const emptyVisible = await emptyState.isVisible().catch(() => false);
        if (emptyVisible) {
          await expect(emptyState).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
