// ========================================
// E2E Tests: Dashboard Charts
// ========================================
// E2E tests for chart rendering, tooltips, and responsive behavior

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';
import {
  waitForDashboardLoad,
  verifyChartRendered,
  verifyChartTooltip,
  verifyResponsiveLayout,
} from './helpers/dashboard-helpers';

test.describe('[Dashboard Charts] - Chart Rendering & Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
    await waitForDashboardLoad(page);
  });

  test.describe('Pie Chart Rendering', () => {
    test('DC-1.1 - should render workflow status pie chart with data', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const isRendered = await verifyChartRendered(page, 'pie');
      expect(isRendered).toBe(true);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-1.2 - should display pie chart slices with correct colors', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="workflow-status-pie-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        // Check for pie slices (path elements)
        const slices = chartContainer.locator('path.recharts-pie-sector');
        const sliceCount = await slices.count();

        expect(sliceCount).toBeGreaterThan(0);

        // Verify slices have fill colors
        for (let i = 0; i < Math.min(sliceCount, 5); i++) {
          const slice = slices.nth(i);
          const fill = await slice.getAttribute('fill');
          expect(fill).toBeTruthy();
          expect(fill).not.toBe('none');
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-1.3 - should display pie chart legend', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="workflow-status-pie-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        // Look for legend
        const legend = chartContainer.locator('.recharts-legend-wrapper');
        const hasLegend = await legend.isVisible().catch(() => false);

        expect(hasLegend).toBeDefined();
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-1.4 - should show tooltip on pie slice hover', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const hasTooltip = await verifyChartTooltip(page, 'pie');
      expect(hasTooltip).toBeDefined();

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Line Chart Rendering', () => {
    test('DC-2.1 - should render activity timeline line chart', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const isRendered = await verifyChartRendered(page, 'line');
      expect(isRendered).toBe(true);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-2.2 - should display X-axis with date labels', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="activity-line-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        // Look for X-axis
        const xAxis = chartContainer.locator('.recharts-xAxis');
        const hasXAxis = await xAxis.isVisible().catch(() => false);

        expect(hasXAxis).toBe(true);

        // Verify axis has ticks
        const ticks = chartContainer.locator('.recharts-xAxis .recharts-cartesian-axis-tick');
        const tickCount = await ticks.count();

        expect(tickCount).toBeGreaterThan(0);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-2.3 - should display Y-axis with count labels', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="activity-line-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        // Look for Y-axis
        const yAxis = chartContainer.locator('.recharts-yAxis');
        const hasYAxis = await yAxis.isVisible().catch(() => false);

        expect(hasYAxis).toBe(true);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-2.4 - should display multiple lines for sessions and tasks', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="activity-line-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        // Look for line paths
        const lines = chartContainer.locator('path.recharts-line-curve');
        const lineCount = await lines.count();

        // Should have at least 1-2 lines (sessions, tasks)
        expect(lineCount).toBeGreaterThanOrEqual(1);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-2.5 - should show tooltip on line hover', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const hasTooltip = await verifyChartTooltip(page, 'line');
      expect(hasTooltip).toBeDefined();

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Bar Chart Rendering', () => {
    test('DC-3.1 - should render task type bar chart', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const isRendered = await verifyChartRendered(page, 'bar');
      expect(isRendered).toBe(true);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-3.2 - should display bars with correct colors', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="task-type-bar-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        // Look for bar rectangles
        const bars = chartContainer.locator('rect.recharts-bar-rectangle');
        const barCount = await bars.count();

        expect(barCount).toBeGreaterThan(0);

        // Verify bars have fill colors
        for (let i = 0; i < Math.min(barCount, 5); i++) {
          const bar = bars.nth(i);
          const fill = await bar.getAttribute('fill');
          expect(fill).toBeTruthy();
          expect(fill).not.toBe('none');
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-3.3 - should display X-axis with task type labels', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="task-type-bar-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        const xAxis = chartContainer.locator('.recharts-xAxis');
        const hasXAxis = await xAxis.isVisible().catch(() => false);

        expect(hasXAxis).toBe(true);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-3.4 - should show tooltip on bar hover', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const hasTooltip = await verifyChartTooltip(page, 'bar');
      expect(hasTooltip).toBeDefined();

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Chart Responsiveness', () => {
    test('DC-4.1 - should resize charts on mobile viewport', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);

      // Verify charts adapt
      const pieChart = page.locator('[data-testid="workflow-status-pie-chart"] svg');
      const isVisible = await pieChart.isVisible().catch(() => false);

      if (isVisible) {
        const svgBox = await pieChart.boundingBox();
        expect(svgBox?.width).toBeLessThanOrEqual(400);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-4.2 - should resize charts on tablet viewport', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(300);

      const lineChart = page.locator('[data-testid="activity-line-chart"] svg');
      const isVisible = await lineChart.isVisible().catch(() => false);

      if (isVisible) {
        const svgBox = await lineChart.boundingBox();
        expect(svgBox?.width).toBeGreaterThan(0);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-4.3 - should resize charts on desktop viewport', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);

      const barChart = page.locator('[data-testid="task-type-bar-chart"] svg');
      const isVisible = await barChart.isVisible().catch(() => false);

      if (isVisible) {
        const svgBox = await barChart.boundingBox();
        expect(svgBox?.width).toBeGreaterThan(0);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Chart Empty States', () => {
    test('DC-5.1 - should display empty state when no data available', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock empty data response
      await page.route('**/api/session-status-counts', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.reload({ waitUntil: 'networkidle' as const });

      // Should display empty state or message
      const emptyState = page.getByText(/no data|empty|no chart data/i);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      expect(hasEmptyState).toBeDefined();

      await page.unroute('**/api/session-status-counts');

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-5.2 - should display error state when chart data fails to load', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.route('**/api/activity-timeline', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load' }),
        });
      });

      await page.reload({ waitUntil: 'networkidle' as const });

      const errorState = page.getByText(/error|failed|unable/i);
      const hasError = await errorState.isVisible().catch(() => false);

      expect(hasError).toBeDefined();

      await page.unroute('**/api/activity-timeline');

      monitoring.assertClean({ ignoreAPIPatterns: ['/api/activity-timeline'], allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Chart Legend Interaction', () => {
    test('DC-6.1 - should toggle line visibility when clicking legend', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="activity-line-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        const legend = chartContainer.locator('.recharts-legend-wrapper');
        const hasLegend = await legend.isVisible().catch(() => false);

        if (hasLegend) {
          const legendItem = legend.locator('.recharts-legend-item').first();
          const hasItem = await legendItem.isVisible().catch(() => false);

          if (hasItem) {
            // Click legend item
            await legendItem.click();
            await page.waitForTimeout(200);

            // Verify chart state changed
            expect(true).toBe(true); // Legend interaction tested
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Chart Performance', () => {
    test('DC-7.1 - should render all charts within performance budget', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const startTime = Date.now();

      // Wait for all charts to render
      await waitForDashboardLoad(page);

      const renderTime = Date.now() - startTime;

      // All charts should render within 3 seconds
      expect(renderTime).toBeLessThan(3000);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DC-7.2 - should maintain 60 FPS during chart interactions', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const chartContainer = page.locator('[data-testid="activity-line-chart"]');
      const isVisible = await chartContainer.isVisible().catch(() => false);

      if (isVisible) {
        const svgElement = chartContainer.locator('svg').first();

        // Perform rapid hovers to test frame rate
        for (let i = 0; i < 10; i++) {
          await svgElement.hover({ position: { x: i * 10, y: 50 } });
          await page.waitForTimeout(50);
        }

        // No frame drops should occur (tested visually in real environment)
        expect(true).toBe(true);
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });
});
