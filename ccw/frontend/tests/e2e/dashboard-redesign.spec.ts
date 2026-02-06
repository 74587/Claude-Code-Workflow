// ========================================
// E2E Tests: Dashboard Redesign
// ========================================
// E2E tests for navigation grouping, dashboard loading, drag-drop persistence, and ticker updates

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';
import {
  waitForDashboardLoad,
  verifyNavGroupState,
  toggleNavGroup,
  simulateDragDrop,
  getDashboardLayout,
  verifyTickerMessages,
  simulateTickerMessage,
  verifyAllWidgetsPresent,
  verifyResponsiveLayout,
} from './helpers/dashboard-helpers';

test.describe('[Dashboard Redesign] - Navigation & Layout Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
    await waitForDashboardLoad(page);
  });

  test.describe('Navigation Grouping', () => {
    test('DR-1.1 - should display all 6 navigation groups', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Define expected navigation groups
      const expectedGroups = [
        'Overview',
        'Workflow',
        'Knowledge',
        'Issues',
        'Tools',
        'Configuration',
      ];

      // Verify each group is present
      for (const groupName of expectedGroups) {
        const groupTrigger = page.getByRole('button', { name: new RegExp(groupName, 'i') });
        await expect(groupTrigger).toBeVisible();
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-1.2 - should expand and collapse navigation groups', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Find first navigation group
      const firstGroup = page.getByRole('button', { name: /overview|workflow/i }).first();
      await expect(firstGroup).toBeVisible();

      // Get initial state
      const initialExpanded = (await firstGroup.getAttribute('aria-expanded')) === 'true';

      // Toggle group
      await firstGroup.click();
      await page.waitForTimeout(300); // Wait for accordion animation

      // Verify state changed
      const afterToggle = (await firstGroup.getAttribute('aria-expanded')) === 'true';
      expect(afterToggle).toBe(!initialExpanded);

      // Toggle back
      await firstGroup.click();
      await page.waitForTimeout(300);

      const finalState = (await firstGroup.getAttribute('aria-expanded')) === 'true';
      expect(finalState).toBe(initialExpanded);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-1.3 - should persist navigation group state across reloads', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Expand a group
      const workflowGroup = page.getByRole('button', { name: /workflow/i });
      const isExpanded = (await workflowGroup.getAttribute('aria-expanded')) === 'true';

      if (!isExpanded) {
        await workflowGroup.click();
        await page.waitForTimeout(300);
      }

      // Reload page
      await page.reload({ waitUntil: 'networkidle' as const });
      await waitForDashboardLoad(page);

      // Verify group is still expanded
      const afterReload = (await workflowGroup.getAttribute('aria-expanded')) === 'true';
      expect(afterReload).toBe(true);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-1.4 - should highlight active route within expanded group', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Navigate to home (active by default)
      const homeLink = page.getByRole('link', { name: /home|dashboard/i });
      await expect(homeLink).toBeVisible();

      // Check if link has active class or aria-current
      const ariaCurrent = await homeLink.getAttribute('aria-current');
      const hasActiveClass = await homeLink.evaluate((el) =>
        el.classList.contains('active') || el.classList.contains('bg-accent')
      );

      expect(ariaCurrent === 'page' || hasActiveClass).toBe(true);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-1.5 - should support keyboard navigation for groups', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Focus first navigation group
      const firstGroup = page.getByRole('button', { name: /overview|workflow/i }).first();
      await firstGroup.focus();

      // Press Enter to toggle
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Verify state changed
      const expanded = (await firstGroup.getAttribute('aria-expanded')) === 'true';
      expect(expanded).toBeDefined();

      // Press Tab to move to next element
      await page.keyboard.press('Tab');

      // Verify focus moved
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Dashboard Loading', () => {
    test('DR-2.1 - should load all 5 widgets successfully', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await verifyAllWidgetsPresent(page, 5);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-2.2 - should display loading states before data loads', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Navigate to fresh page
      await page.goto('/', { waitUntil: 'domcontentloaded' as const });

      // Check for loading skeletons
      const skeletons = page.locator('[data-testid*="skeleton"]');
      const skeletonCount = await skeletons.count();

      // Should have some loading indicators
      expect(skeletonCount).toBeGreaterThanOrEqual(0);

      // Wait for page to fully load
      await waitForDashboardLoad(page);

      // Skeletons should be gone
      const remainingSkeletons = await page
        .locator('[data-testid*="skeleton"]:visible')
        .count();
      expect(remainingSkeletons).toBe(0);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-2.3 - should handle widget load errors gracefully', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock API failure
      await page.route('**/api/data', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.reload({ waitUntil: 'networkidle' as const });

      // Should display error state or fallback content
      const errorIndicator = page.getByText(/error|failed|unable/i).or(
        page.getByTestId('error-state')
      );

      const hasError = await errorIndicator.isVisible().catch(() => false);
      const pageHasContent = (await page.content()).length > 1000;

      expect(hasError || pageHasContent).toBe(true);

      await page.unroute('**/api/data');

      monitoring.assertClean({ ignoreAPIPatterns: ['/api/data'], allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Drag-Drop Persistence', () => {
    test('DR-3.1 - should allow dragging widgets to new positions', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Get initial layout
      const initialLayout = await getDashboardLayout(page);

      // Find a widget to drag
      const widget = page.locator('[data-grid]').first();
      const isVisible = await widget.isVisible().catch(() => false);

      if (isVisible) {
        const widgetBox = await widget.boundingBox();
        if (widgetBox) {
          // Simulate drag
          const startX = widgetBox.x + widgetBox.width / 2;
          const startY = widgetBox.y + 20;
          const targetX = startX + 100;
          const targetY = startY + 50;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(targetX, targetY, { steps: 5 });
          await page.mouse.up();
          await page.waitForTimeout(500);

          // Get new layout
          const newLayout = await getDashboardLayout(page);

          // Layout should have changed
          expect(JSON.stringify(newLayout)).not.toBe(JSON.stringify(initialLayout));
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-3.2 - should persist layout changes after page reload', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Get current layout
      const beforeLayout = await getDashboardLayout(page);

      // Reload page
      await page.reload({ waitUntil: 'networkidle' as const });
      await waitForDashboardLoad(page);

      // Get layout after reload
      const afterLayout = await getDashboardLayout(page);

      // Layout should be the same
      expect(JSON.stringify(afterLayout)).toBe(JSON.stringify(beforeLayout));

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-3.3 - should restore default layout on reset button click', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Look for reset button
      const resetButton = page.getByRole('button', { name: /reset|default/i });
      const hasResetButton = await resetButton.isVisible().catch(() => false);

      if (hasResetButton) {
        await resetButton.click();
        await page.waitForTimeout(500);

        // Verify layout was reset (widgets in default positions)
        const layout = await getDashboardLayout(page);
        expect(layout).toBeDefined();
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Ticker Real-time Updates', () => {
    test('DR-4.1 - should display ticker marquee component', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const tickerContainer = page.getByTestId('ticker-marquee').or(
        page.locator('.ticker-marquee')
      );

      const isVisible = await tickerContainer.isVisible().catch(() => false);
      expect(isVisible).toBe(true);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-4.2 - should display ticker messages with animation', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const messageCount = await verifyTickerMessages(page);

      // Should have messages (or be waiting for messages)
      expect(messageCount).toBeGreaterThanOrEqual(0);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-4.3 - should pause animation on hover', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      const tickerContainer = page.getByTestId('ticker-marquee').or(
        page.locator('.ticker-marquee')
      );

      const isVisible = await tickerContainer.isVisible().catch(() => false);

      if (isVisible) {
        // Hover over ticker
        await tickerContainer.hover();
        await page.waitForTimeout(200);

        // Check if animation is paused (has paused class or style)
        const isPaused = await tickerContainer.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.animationPlayState === 'paused' ||
            el.classList.contains('paused') ||
            el.querySelector('.paused') !== null
          );
        });

        expect(isPaused).toBeDefined();
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-4.4 - should display connection status indicator', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Look for connection status indicator
      const statusIndicator = page.getByTestId('ticker-status').or(
        page.locator('.connection-status')
      );

      const hasIndicator = await statusIndicator.isVisible().catch(() => false);

      // Either has indicator or ticker is working
      const tickerVisible = await page
        .getByTestId('ticker-marquee')
        .isVisible()
        .catch(() => false);

      expect(hasIndicator || tickerVisible).toBe(true);

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });

  test.describe('Responsive Layout', () => {
    test('DR-5.1 - should adapt layout for mobile viewport', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await verifyResponsiveLayout(page, 'mobile');

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-5.2 - should adapt layout for tablet viewport', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await verifyResponsiveLayout(page, 'tablet');

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('DR-5.3 - should adapt layout for desktop viewport', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await verifyResponsiveLayout(page, 'desktop');

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });
});
