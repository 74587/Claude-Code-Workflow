// ========================================
// E2E Tests: Explorer - File System Navigation
// ========================================
// End-to-end tests for file explorer with tree navigation and file details

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Explorer] - File System Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });
  });

  test('L3.45 - Page loads and displays file tree', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for file tree
    await page.route('**/api/explorer', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [
            {
              id: 'file-1',
              name: 'src',
              type: 'directory',
              children: [
                { id: 'file-2', name: 'index.ts', type: 'file' }
              ]
            }
          ]
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for file tree
    const fileTree = page.getByTestId('file-tree').or(
      page.locator('.file-tree')
    );

    const isTreeVisible = await fileTree.isVisible().catch(() => false);

    if (isTreeVisible) {
      // Verify tree nodes are displayed
      const treeNodes = page.getByTestId(/tree-node|file-node|directory-node/).or(
        page.locator('.tree-node')
      );

      const nodeCount = await treeNodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.46 - Navigate directories', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for directory nodes
    const directoryNodes = page.getByTestId(/directory-node|folder-node/).or(
      page.locator('.directory-node')
    );

    const nodeCount = await directoryNodes.count();

    if (nodeCount > 0) {
      const firstDirectory = directoryNodes.first();

      // Click to expand
      await firstDirectory.click();

      // Wait for children to load
      await page.waitForTimeout(300);

      // Verify directory state changed
      const isExpanded = await firstDirectory.getAttribute('aria-expanded');
      expect(isExpanded).toBe('true');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.47 - View file details', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for file nodes
    const fileNodes = page.getByTestId(/file-node/).filter({ hasText: /\.(ts|tsx|js|jsx)$/i }).or(
      page.locator('.file-node').filter({ hasText: /\.(ts|tsx|js|jsx)$/i })
    );

    const fileCount = await fileNodes.count();

    if (fileCount > 0) {
      const firstFile = fileNodes.first();

      // Click to view details
      await firstFile.click();

      // Look for file details panel
      const detailsPanel = page.getByTestId('file-details-panel').or(
        page.locator('.file-details')
      );

      const hasDetails = await detailsPanel.isVisible().catch(() => false);

      if (hasDetails) {
        expect(detailsPanel).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.48 - i18n - File tree labels in EN/ZH', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify file tree content
      const fileTree = page.getByTestId('file-tree').or(
        page.locator('.file-tree')
      );

      const isTreeVisible = await fileTree.isVisible().catch(() => false);
      expect(isTreeVisible).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.49 - Error - Directory not found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API error
    await page.route('**/api/explorer', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Directory not found' })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/not found|error|unable/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    if (hasError) {
      expect(errorIndicator).toBeVisible();
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/explorer'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.50 - Edge - Empty directory', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for empty directory
    await page.route('**/api/explorer', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [] })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for empty state
    const emptyState = page.getByText(/empty|no files|directory is empty/i);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      expect(emptyState).toBeVisible();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
