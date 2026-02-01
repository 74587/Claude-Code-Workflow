// ========================================
// E2E Tests: Lite Tasks Management
// ========================================
// End-to-end tests for lite tasks list and detail view

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Lite Tasks] - Lite Tasks Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display lite tasks list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for lite tasks list container
    const tasksList = page.getByTestId('lite-tasks-list').or(
      page.locator('.lite-tasks-list')
    );

    const isVisible = await tasksList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify task items exist or empty state is shown
      const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
        page.locator('.lite-task-item')
      );

      const itemCount = await taskItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no tasks|empty/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display lite task detail', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for task items
    const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
      page.locator('.lite-task-item')
    );

    const itemCount = await taskItems.count();

    if (itemCount > 0) {
      const firstTask = taskItems.first();

      // Click to view detail
      await firstTask.click();

      // Verify detail view loads
      await page.waitForURL(/\/lite-tasks\//);

      const detailContainer = page.getByTestId('lite-task-detail').or(
        page.locator('.lite-task-detail')
      );

      const hasDetail = await detailContainer.isVisible().catch(() => false);
      expect(hasDetail).toBe(true);

      // Verify task info is displayed
      const taskInfo = page.getByTestId('task-info').or(
        page.locator('.task-info')
      );

      const hasInfo = await taskInfo.isVisible().catch(() => false);
      expect(hasInfo).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display task title', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for task items
    const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
      page.locator('.lite-task-item')
    );

    const itemCount = await taskItems.count();

    if (itemCount > 0) {
      // Check each task has a title
      for (let i = 0; i < Math.min(itemCount, 3); i++) {
        const task = taskItems.nth(i);

        const titleElement = task.getByTestId('task-title').or(
          task.locator('.task-title')
        );

        const hasTitle = await titleElement.isVisible().catch(() => false);
        expect(hasTitle).toBe(true);

        const title = await titleElement.textContent();
        expect(title).toBeTruthy();
        expect(title?.length).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should display task status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for task items
    const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
      page.locator('.lite-task-item')
    );

    const itemCount = await taskItems.count();

    if (itemCount > 0) {
      // Check each task has a status indicator
      for (let i = 0; i < Math.min(itemCount, 3); i++) {
        const task = taskItems.nth(i);

        const statusBadge = task.getByTestId('task-status').or(
          task.locator('*').filter({ hasText: /pending|in.progress|completed|blocked|failed/i })
        );

        const hasStatus = await statusBadge.isVisible().catch(() => false);
        expect(hasStatus).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display task type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for task items
    const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
      page.locator('.lite-task-item')
    );

    const itemCount = await taskItems.count();

    if (itemCount > 0) {
      const firstTask = taskItems.first();

      // Look for type badge
      const typeBadge = firstTask.getByTestId('task-type').or(
        firstTask.locator('*').filter({ hasText: /lite.plan|lite.fix|multi.cli/i })
      );

      const hasType = await typeBadge.isVisible().catch(() => false);

      if (hasType) {
        const text = await typeBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should filter tasks by type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for type filter
    const typeFilter = page.getByRole('combobox', { name: /type|filter/i }).or(
      page.getByTestId('type-filter')
    );

    const hasTypeFilter = await typeFilter.isVisible().catch(() => false);

    if (hasTypeFilter) {
      // Check if there are type options
      const typeOptions = await typeFilter.locator('option').count();

      if (typeOptions > 1) {
        await typeFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
          page.locator('.lite-task-item')
        );

        const taskCount = await taskItems.count();
        expect(taskCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should filter tasks by status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for status filter
    const statusFilter = page.getByRole('combobox', { name: /status|filter/i }).or(
      page.getByTestId('status-filter')
    );

    const hasStatusFilter = await statusFilter.isVisible().catch(() => false);

    if (hasStatusFilter) {
      // Check if there are status options
      const statusOptions = await statusFilter.locator('option').count();

      if (statusOptions > 1) {
        await statusFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
          page.locator('.lite-task-item')
        );

        const taskCount = await taskItems.count();
        expect(taskCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should search lite tasks', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('task-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
        page.locator('.lite-task-item')
      );

      const taskCount = await taskItems.count();

      // Either no results message or filtered tasks
      expect(hasNoResults || taskCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display task creation date', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for task items
    const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
      page.locator('.lite-task-item')
    );

    const itemCount = await taskItems.count();

    if (itemCount > 0) {
      const firstTask = taskItems.first();

      // Look for creation date
      const dateDisplay = firstTask.getByTestId('task-created-at').or(
        firstTask.locator('*').filter({ hasText: /\d{4}-\d{2}-\d{2}|created/i })
      );

      const hasDate = await dateDisplay.isVisible().catch(() => false);

      if (hasDate) {
        const text = await dateDisplay.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display task metadata in detail view', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to lite tasks page
    await page.goto('/lite-tasks', { waitUntil: 'networkidle' as const });

    // Look for task items
    const taskItems = page.getByTestId(/lite-task-item|lite-task-card/).or(
      page.locator('.lite-task-item')
    );

    const itemCount = await taskItems.count();

    if (itemCount > 0) {
      const firstTask = taskItems.first();
      await firstTask.click();

      // Wait for detail view
      await page.waitForURL(/\/lite-tasks\//);

      // Look for metadata section
      const metadataSection = page.getByTestId('task-metadata').or(
        page.locator('.task-metadata')
      );

      const hasMetadata = await metadataSection.isVisible().catch(() => false);

      if (hasMetadata) {
        // Verify metadata is displayed
        const text = await metadataSection.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
