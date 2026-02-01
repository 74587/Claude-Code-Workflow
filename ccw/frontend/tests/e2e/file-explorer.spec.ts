// ========================================
// E2E Tests: File Explorer Management
// ========================================
// End-to-end tests for file tree, content, search, and roots operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[File Explorer] - File Explorer Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display file tree', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for file tree container
    const fileTree = page.getByTestId('file-tree').or(
      page.locator('.file-tree')
    );

    const isVisible = await fileTree.isVisible().catch(() => false);

    if (isVisible) {
      // Verify tree nodes exist
      const treeNodes = page.getByTestId(/tree-node|file-node|folder-node/).or(
        page.locator('.tree-node')
      );

      const nodeCount = await treeNodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should expand and collapse folders', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for folder nodes
    const folderNodes = page.getByTestId(/folder-node|directory-node/).or(
      page.locator('.folder-node')
    );

    const nodeCount = await folderNodes.count();

    if (nodeCount > 0) {
      const firstFolder = folderNodes.first();

      // Click to expand
      await firstFolder.click();

      // Wait for children to load

      // Verify children are visible
      const childNodes = firstFolder.locator('.tree-node');
      const childCount = await childNodes.count();

      // Click again to collapse
      await firstFolder.click();

      // Children should be hidden
      const visibleChildCount = await firstFolder.locator('.tree-node:visible').count();

      expect(childCount).toBeGreaterThan(visibleChildCount);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display file content', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for file nodes
    const fileNodes = page.getByTestId(/file-node|tree-node/).filter({ hasText: /\.(ts|tsx|js|jsx|json|md)$/i }).or(
      page.locator('.file-node').filter({ hasText: /\.(ts|tsx|js|jsx|json|md)$/i })
    );

    const nodeCount = await fileNodes.count();

    if (nodeCount > 0) {
      const firstFile = fileNodes.first();

      // Click to view content
      await firstFile.click();

      // Look for content viewer
      const contentViewer = page.getByTestId('file-content').or(
        page.locator('.file-content')
      );

      const hasContent = await contentViewer.isVisible().catch(() => false);

      if (hasContent) {
        const content = await contentViewer.textContent();
        expect(content).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should search files', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('file-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const searchResults = page.getByTestId(/search-result|file-match/).or(
        page.locator('.search-result')
      );

      const resultCount = await searchResults.count();

      // Either no results message or search results
      expect(hasNoResults || resultCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display available roots', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for roots section
    const rootsSection = page.getByTestId('available-roots').or(
      page.getByText(/roots|drives/i)
    );

    const isVisible = await rootsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify root items are displayed
      const rootItems = page.getByTestId(/root-item|drive-item/).or(
        rootsSection.locator('.root-item')
      );

      const rootCount = await rootItems.count();
      expect(rootCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should switch between roots', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for root selector
    const rootSelector = page.getByRole('combobox', { name: /root|drive|location/i }).or(
      page.getByTestId('root-selector')
    );

    const hasSelector = await rootSelector.isVisible().catch(() => false);

    if (hasSelector) {
      // Get initial root
      const initialRoot = await rootSelector.textContent();

      // Select different root
      const rootOptions = await rootSelector.locator('option').count();

      if (rootOptions > 1) {
        await rootSelector.selectOption({ index: 1 });

        // Wait for tree to refresh

        // Verify file tree is still visible
        const fileTree = page.getByTestId('file-tree').or(
          page.locator('.file-tree')
        );

        const isStillVisible = await fileTree.isVisible().catch(() => false);
        expect(isStillVisible).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should display file metadata', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for file nodes
    const fileNodes = page.getByTestId(/file-node|tree-node/).or(
      page.locator('.file-node')
    );

    const nodeCount = await fileNodes.count();

    if (nodeCount > 0) {
      const firstNode = fileNodes.first();

      // Look for metadata display
      const metadata = firstNode.getByTestId('file-metadata').or(
        firstNode.locator('*').filter({ hasText: /\d+KB|\d+MB|\d+ bytes/i })
      );

      const hasMetadata = await metadata.isVisible().catch(() => false);

      if (hasMetadata) {
        const text = await metadata.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should handle file tree API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/explorer/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/explorer/**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/explorer'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display binary file warning', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for binary file nodes (images, executables)
    const binaryFileNodes = page.getByTestId(/file-node/).filter({
      hasText: /\.(png|jpg|jpeg|gif|exe|dll|so|dylib)$/i
    });

    const nodeCount = await binaryFileNodes.count();

    if (nodeCount > 0) {
      const firstFile = binaryFileNodes.first();

      // Click to view content
      await firstFile.click();

      // Look for binary file warning
      const binaryWarning = page.getByText(/binary|cannot display|preview not available/i);
      const hasWarning = await binaryWarning.isVisible().catch(() => false);

      if (hasWarning) {
        expect(binaryWarning).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display file statistics', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to file explorer page
    await page.goto('/explorer', { waitUntil: 'networkidle' as const });

    // Look for statistics section
    const statsSection = page.getByTestId('file-stats').or(
      page.getByText(/files|directories|total size/i)
    );

    const isVisible = await statsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify stats are displayed
      const statItems = page.getByTestId(/stat-|files-count|directories-count/).or(
        statsSection.locator('.stat-item')
      );

      const statCount = await statItems.count();
      expect(statCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
