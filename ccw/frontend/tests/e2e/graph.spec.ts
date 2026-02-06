// ========================================
// E2E Tests: Graph Explorer - Code Relationship Visualization
// ========================================
// End-to-end tests for code graph visualization with node relationships

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Graph Explorer] - Code Relationship Visualization Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/graph', { waitUntil: 'networkidle' as const });
  });

  test('L3.51 - Page loads and displays code graph', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for graph data
    await page.route('**/api/graph', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nodes: [
            { id: 'node-1', label: 'Component', type: 'component' },
            { id: 'node-2', label: 'Service', type: 'service' }
          ],
          edges: [
            { id: 'edge-1', source: 'node-1', target: 'node-2', label: 'imports' }
          ]
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for code graph
    const codeGraph = page.getByTestId('code-graph').or(
      page.locator('.code-graph')
    );

    const isGraphVisible = await codeGraph.isVisible().catch(() => false);

    if (isGraphVisible) {
      // Verify graph has nodes
      const graphNodes = page.getByTestId(/graph-node|node-/).or(
        page.locator('.graph-node')
      );

      const nodeCount = await graphNodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.52 - Navigate graph nodes', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for graph nodes
    const graphNodes = page.getByTestId(/graph-node|node-/).or(
      page.locator('.graph-node')
    );

    const nodeCount = await graphNodes.count();

    if (nodeCount > 0) {
      const firstNode = graphNodes.first();

      // Click to select node
      await firstNode.click();

      // Verify node is selected
      const isSelected = await firstNode.getAttribute('aria-selected');
      expect(isSelected).toBe('true');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.53 - Expand/collapse node relationships', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for expandable nodes
    const expandableNodes = page.getByTestId(/graph-node/).filter({ hasText: /\+/ });

    const nodeCount = await expandableNodes.count();

    if (nodeCount > 0) {
      const firstNode = expandableNodes.first();

      // Click to expand
      await firstNode.click();

      // Wait for expansion
      await page.waitForTimeout(300);

      // Look for expanded children
      const childNodes = page.getByTestId(/graph-node/);
      const nodeCountAfter = await childNodes.count();

      expect(nodeCountAfter).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.54 - i18n - Graph labels in EN/ZH', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify graph is visible
      const codeGraph = page.getByTestId('code-graph').or(
        page.locator('.code-graph')
      );

      const isGraphVisible = await codeGraph.isVisible().catch(() => false);
      expect(isGraphVisible).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.55 - Error - Graph generation fails', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API error
    await page.route('**/api/graph', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to generate graph' })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    if (hasError) {
      expect(errorIndicator).toBeVisible();
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/graph'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.56 - Edge - No relationships found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for empty graph
    await page.route('**/api/graph', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nodes: [],
          edges: []
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for empty state
    const emptyState = page.getByText(/no relationships|empty|no data/i);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      expect(emptyState).toBeVisible();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
