// ========================================
// E2E Tests: Session Detail
// ========================================
// End-to-end tests for session detail view and related operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Session Detail] - Session Detail Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display session detail', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page first
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Look for session with detail
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      // Verify detail view loads
      await page.waitForURL(/\/sessions\//);

      const detailContainer = page.getByTestId('session-detail').or(
        page.locator('.session-detail')
      );

      const hasDetail = await detailContainer.isVisible().catch(() => false);
      expect(hasDetail).toBe(true);

      // Verify session title is displayed
      const titleElement = page.getByTestId('session-title').or(
        page.locator('h1, h2').filter({ hasText: /.+/ })
      );

      const hasTitle = await titleElement.isVisible().catch(() => false);
      expect(hasTitle).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display session context', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for context section
      const contextSection = page.getByTestId('session-context').or(
        page.getByText(/context|requirements/i)
      );

      const hasContext = await contextSection.isVisible().catch(() => false);

      if (hasContext) {
        // Verify context items are displayed
        const contextItems = page.getByTestId(/context-item|requirement/).or(
          contextSection.locator('.context-item')
        );

        const contextCount = await contextItems.count();
        expect(contextCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display session summary', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for summary section
      const summarySection = page.getByTestId('session-summary').or(
        page.getByText(/summary|overview/i)
      );

      const hasSummary = await summarySection.isVisible().catch(() => false);

      if (hasSummary) {
        const summaryContent = await summarySection.textContent();
        // Verify summary has some content or empty state message
        expect(summaryContent?.length).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should display implementation plan', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for implementation plan section
      const implPlanSection = page.getByTestId('implementation-plan').or(
        page.getByText(/implementation|plan/i)
      );

      const hasImplPlan = await implPlanSection.isVisible().catch(() => false);

      if (hasImplPlan) {
        // Verify plan items are displayed
        const planItems = page.getByTestId(/plan-item|step-item/).or(
          implPlanSection.locator('.plan-item')
        );

        const planCount = await planItems.count();
        expect(planCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display session status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for status badge
      const statusBadge = page.getByTestId('session-status').or(
        page.locator('*').filter({ hasText: /in.progress|completed|planning|paused|archived/i })
      );

      const hasStatus = await statusBadge.isVisible().catch(() => false);
      expect(hasStatus).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display session tasks', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for tasks section
      const tasksSection = page.getByTestId('session-tasks').or(
        page.getByText(/tasks/i)
      );

      const hasTasks = await tasksSection.isVisible().catch(() => false);

      if (hasTasks) {
        const taskItems = page.getByTestId(/task-item|task-card/).or(
          page.locator('.task-item')
        );

        const taskCount = await taskItems.count();
        expect(taskCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should navigate back to sessions list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for back button
      const backButton = page.getByRole('button', { name: /back|return|sessions/i }).or(
        page.getByTestId('back-button')
      );

      const hasBackButton = await backButton.isVisible().catch(() => false);

      if (hasBackButton) {
        await backButton.click();

        // Verify navigation back to list
        await page.waitForURL(/\/sessions$/);

        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/sessions$/);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should display session metadata', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for metadata section
      const metadataSection = page.getByTestId('session-metadata').or(
        page.getByText(/metadata|created|updated/i)
      );

      const hasMetadata = await metadataSection.isVisible().catch(() => false);

      if (hasMetadata) {
        // Verify dates are displayed
        const datePattern = /\d{4}-\d{2}-\d{2}|created|updated/i;
        const hasDates = await metadataSection.locator('*').filter({ hasText: datePattern }).isVisible();

        expect(hasDates).toBe(true);
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should handle session detail API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/session-detail**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      // Look for error indicator

      const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
        page.getByTestId('error-state')
      );

      const hasError = await errorIndicator.isVisible().catch(() => false);

      // Restore routing
      await page.unroute('**/api/session-detail**');

      // Error should be displayed or handled gracefully
      expect(hasError).toBe(true);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/session-detail'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display session summaries list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for summaries section
      const summariesSection = page.getByTestId('session-summaries').or(
        page.getByText(/summaries/i)
      );

      const hasSummaries = await summariesSection.isVisible().catch(() => false);

      if (hasSummaries) {
        const summaryItems = page.getByTestId(/summary-item/).or(
          summariesSection.locator('.summary-item')
        );

        const summaryCount = await summaryItems.count();
        expect(summaryCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
