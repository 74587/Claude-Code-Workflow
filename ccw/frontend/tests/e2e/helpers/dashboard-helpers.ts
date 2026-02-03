// ========================================
// Dashboard E2E Helper Functions
// ========================================
// Reusable utilities for dashboard E2E interactions

import { Page, Locator, expect } from '@playwright/test';

/**
 * Wait for all dashboard widgets to finish loading
 * @param page - Playwright Page object
 * @param timeout - Maximum wait time in milliseconds (default: 30000)
 */
export async function waitForDashboardLoad(page: Page, timeout = 30000): Promise<void> {
  // Wait for network idle first
  await page.waitForLoadState('networkidle', { timeout });

  // Wait for dashboard grid container to be visible
  const dashboardGrid = page.getByTestId('dashboard-grid-container').or(
    page.locator('.dashboard-grid-container')
  );

  await expect(dashboardGrid).toBeVisible({ timeout });

  // Wait for all widget skeletons to disappear
  const skeletons = page.locator('[data-testid*="skeleton"]');
  const skeletonCount = await skeletons.count();

  if (skeletonCount > 0) {
    // Wait for skeletons to be hidden
    await page.waitForFunction(
      () => {
        const skels = document.querySelectorAll('[data-testid*="skeleton"]');
        return Array.from(skels).every(
          (skel) => window.getComputedStyle(skel).display === 'none'
        );
      },
      { timeout }
    );
  }

  // Wait for stats cards to be visible
  const statsCards = page.getByTestId(/stat-card/).or(page.locator('.stat-card'));
  const statsCount = await statsCards.count();

  if (statsCount > 0) {
    await expect(statsCards.first()).toBeVisible({ timeout });
  }

  // Small delay to ensure all animations complete
  await page.waitForTimeout(500);
}

/**
 * Verify a specific chart type has rendered correctly
 * @param page - Playwright Page object
 * @param chartType - Type of chart to verify
 * @returns Promise<boolean> indicating if chart rendered successfully
 */
export async function verifyChartRendered(
  page: Page,
  chartType: 'pie' | 'line' | 'bar'
): Promise<boolean> {
  let chartSelector: string;

  switch (chartType) {
    case 'pie':
      chartSelector = '[data-testid="workflow-status-pie-chart"]';
      break;
    case 'line':
      chartSelector = '[data-testid="activity-line-chart"]';
      break;
    case 'bar':
      chartSelector = '[data-testid="task-type-bar-chart"]';
      break;
  }

  // Find chart container
  const chartContainer = page.locator(chartSelector);
  const isVisible = await chartContainer.isVisible().catch(() => false);

  if (!isVisible) {
    return false;
  }

  // Verify chart has rendered content (SVG elements)
  const svgElement = chartContainer.locator('svg').first();
  const hasSvg = await svgElement.isVisible().catch(() => false);

  if (!hasSvg) {
    return false;
  }

  // Check for chart-specific elements
  switch (chartType) {
    case 'pie': {
      // Pie chart should have path elements (slices)
      const slices = chartContainer.locator('path.recharts-pie-sector');
      const sliceCount = await slices.count();
      return sliceCount > 0;
    }
    case 'line': {
      // Line chart should have line path elements
      const lines = chartContainer.locator('path.recharts-line-curve');
      const lineCount = await lines.count();
      return lineCount > 0;
    }
    case 'bar': {
      // Bar chart should have rect elements (bars)
      const bars = chartContainer.locator('rect.recharts-bar-rectangle');
      const barCount = await bars.count();
      return barCount > 0;
    }
  }
}

/**
 * Simulate drag-drop interaction for widget repositioning
 * @param page - Playwright Page object
 * @param widgetId - Widget identifier (data-grid i attribute)
 * @param targetX - Target X coordinate
 * @param targetY - Target Y coordinate
 */
export async function simulateDragDrop(
  page: Page,
  widgetId: string,
  targetX: number,
  targetY: number
): Promise<void> {
  // Find widget by data-grid attribute
  const widget = page.locator(`[data-grid*='"i":"${widgetId}"']`).or(
    page.getByTestId(`widget-${widgetId}`)
  );

  await expect(widget).toBeVisible();

  // Get widget's current position
  const widgetBox = await widget.boundingBox();
  if (!widgetBox) {
    throw new Error(`Widget ${widgetId} not found or not visible`);
  }

  // Calculate drag coordinates
  const startX = widgetBox.x + widgetBox.width / 2;
  const startY = widgetBox.y + 20; // Drag from header area

  // Perform drag-drop
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(100); // Small delay to register drag start

  // Move to target position
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.waitForTimeout(100); // Small delay before release

  await page.mouse.up();

  // Wait for layout to settle
  await page.waitForTimeout(500);
}

/**
 * Get current layout configuration from dashboard
 * @param page - Playwright Page object
 * @returns Layout configuration object
 */
export async function getDashboardLayout(page: Page): Promise<Record<string, any>> {
  const layout = await page.evaluate(() => {
    const storage = localStorage.getItem('ccw-app-store');
    if (!storage) return null;

    const parsed = JSON.parse(storage);
    return parsed.state?.dashboardLayout || null;
  });

  return layout;
}

/**
 * Verify navigation group is expanded/collapsed
 * @param page - Playwright Page object
 * @param groupName - Navigation group name (e.g., 'Overview', 'Workflow')
 * @param expectedExpanded - Whether group should be expanded
 */
export async function verifyNavGroupState(
  page: Page,
  groupName: string,
  expectedExpanded: boolean
): Promise<void> {
  const groupTrigger = page.getByRole('button', { name: new RegExp(groupName, 'i') });
  await expect(groupTrigger).toBeVisible();

  const ariaExpanded = await groupTrigger.getAttribute('aria-expanded');
  const isExpanded = ariaExpanded === 'true';

  if (isExpanded !== expectedExpanded) {
    throw new Error(
      `Navigation group "${groupName}" expected to be ${expectedExpanded ? 'expanded' : 'collapsed'} but was ${isExpanded ? 'expanded' : 'collapsed'}`
    );
  }
}

/**
 * Toggle navigation group expand/collapse
 * @param page - Playwright Page object
 * @param groupName - Navigation group name
 */
export async function toggleNavGroup(page: Page, groupName: string): Promise<void> {
  const groupTrigger = page.getByRole('button', { name: new RegExp(groupName, 'i') });
  await expect(groupTrigger).toBeVisible();

  await groupTrigger.click();
  await page.waitForTimeout(300); // Wait for accordion animation
}

/**
 * Verify ticker marquee is displaying messages
 * @param page - Playwright Page object
 * @returns Number of messages displayed
 */
export async function verifyTickerMessages(page: Page): Promise<number> {
  const tickerContainer = page.getByTestId('ticker-marquee').or(
    page.locator('.ticker-marquee')
  );

  const isVisible = await tickerContainer.isVisible().catch(() => false);
  if (!isVisible) {
    return 0;
  }

  const messages = tickerContainer.locator('.ticker-message').or(
    tickerContainer.locator('[data-message]')
  );

  return await messages.count();
}

/**
 * Simulate WebSocket message for ticker testing
 * @param page - Playwright Page object
 * @param message - Mock ticker message
 */
export async function simulateTickerMessage(
  page: Page,
  message: {
    id: string;
    text: string;
    type: 'session' | 'task' | 'workflow' | 'status';
    link?: string;
    timestamp: number;
  }
): Promise<void> {
  await page.evaluate((msg) => {
    const event = new MessageEvent('message', {
      data: JSON.stringify(msg),
    });

    // Dispatch to WebSocket mock if available
    const ws = (window as any).__mockWebSocket;
    if (ws && ws.onmessage) {
      ws.onmessage(event);
    }
  }, message);

  await page.waitForTimeout(100); // Wait for message to be processed
}

/**
 * Verify chart tooltip appears on hover
 * @param page - Playwright Page object
 * @param chartType - Type of chart
 * @returns True if tooltip appeared
 */
export async function verifyChartTooltip(
  page: Page,
  chartType: 'pie' | 'line' | 'bar'
): Promise<boolean> {
  let chartSelector: string;

  switch (chartType) {
    case 'pie':
      chartSelector = '[data-testid="workflow-status-pie-chart"]';
      break;
    case 'line':
      chartSelector = '[data-testid="activity-line-chart"]';
      break;
    case 'bar':
      chartSelector = '[data-testid="task-type-bar-chart"]';
      break;
  }

  const chartContainer = page.locator(chartSelector);

  // Find interactive chart element
  const chartElement = chartContainer.locator('svg').first();
  await expect(chartElement).toBeVisible();

  // Hover over chart
  await chartElement.hover({ position: { x: 50, y: 50 } });
  await page.waitForTimeout(200); // Wait for tooltip animation

  // Check if tooltip is visible
  const tooltip = page.locator('.recharts-tooltip-wrapper').or(
    page.locator('[role="tooltip"]')
  );

  return await tooltip.isVisible().catch(() => false);
}

/**
 * Verify all widgets are present on dashboard
 * @param page - Playwright Page object
 * @param expectedWidgetCount - Expected number of widgets
 */
export async function verifyAllWidgetsPresent(
  page: Page,
  expectedWidgetCount = 5
): Promise<void> {
  // Look for widget containers
  const widgets = page.locator('[data-grid]').or(page.locator('.widget-container'));

  const widgetCount = await widgets.count();

  if (widgetCount < expectedWidgetCount) {
    throw new Error(
      `Expected ${expectedWidgetCount} widgets but found ${widgetCount}`
    );
  }

  // Verify each widget is visible
  for (let i = 0; i < expectedWidgetCount; i++) {
    await expect(widgets.nth(i)).toBeVisible();
  }
}

/**
 * Wait for specific widget to load
 * @param page - Playwright Page object
 * @param widgetId - Widget identifier
 */
export async function waitForWidgetLoad(page: Page, widgetId: string): Promise<void> {
  const widget = page.getByTestId(`widget-${widgetId}`).or(
    page.locator(`[data-widget="${widgetId}"]`)
  );

  await expect(widget).toBeVisible({ timeout: 10000 });

  // Wait for skeleton to disappear
  const skeleton = widget.locator('[data-testid*="skeleton"]');
  const hasSkeleton = await skeleton.isVisible().catch(() => false);

  if (hasSkeleton) {
    await expect(skeleton).toBeHidden({ timeout: 5000 });
  }
}

/**
 * Verify responsive layout changes at breakpoint
 * @param page - Playwright Page object
 * @param breakpoint - Breakpoint name ('mobile', 'tablet', 'desktop')
 */
export async function verifyResponsiveLayout(
  page: Page,
  breakpoint: 'mobile' | 'tablet' | 'desktop'
): Promise<void> {
  const viewportSizes = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 900 },
  };

  await page.setViewportSize(viewportSizes[breakpoint]);
  await page.waitForTimeout(300); // Wait for layout reflow

  // Verify grid layout adjusts
  const grid = page.getByTestId('dashboard-grid-container');
  await expect(grid).toBeVisible();

  // Check computed styles for grid columns
  const gridColumns = await grid.evaluate((el) => {
    return window.getComputedStyle(el).gridTemplateColumns;
  });

  // Verify column count matches breakpoint expectations
  const columnCount = gridColumns.split(' ').length;
  const expectedColumns = {
    mobile: [1, 2], // 1-2 columns on mobile
    tablet: [2, 6], // 2-6 columns on tablet
    desktop: [12], // 12 columns on desktop
  };

  const isValidLayout = expectedColumns[breakpoint].some((count) =>
    Math.abs(columnCount - count) <= 1
  );

  if (!isValidLayout) {
    throw new Error(
      `Layout at ${breakpoint} has ${columnCount} columns, expected ${expectedColumns[breakpoint]}`
    );
  }
}
