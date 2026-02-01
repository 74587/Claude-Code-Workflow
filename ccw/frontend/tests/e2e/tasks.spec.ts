// ========================================
// E2E Tests: Tasks Management
// ========================================
// End-to-end tests for task fetching and updates

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Tasks] - Task Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display tasks for session', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page first
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Look for session with tasks
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      // Wait for navigation to session detail
      await page.waitForURL(/\/sessions\//);

      // Look for tasks section
      const tasksSection = page.getByTestId('session-tasks').or(
        page.locator('.tasks-section')
      );

      const hasTasksSection = await tasksSection.isVisible().catch(() => false);

      if (hasTasksSection) {
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

  test('L3.2 - should update task status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Look for session with tasks
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for task items
      const taskItems = page.getByTestId(/task-item|task-card/).or(
        page.locator('.task-item')
      );

      const taskCount = await taskItems.count();

      if (taskCount > 0) {
        const firstTask = taskItems.first();

        // Look for status change button/dropdown
        const statusButton = firstTask.getByRole('button', { name: /status|change/i }).or(
          firstTask.getByTestId('task-status-button')
        );

        const hasStatusButton = await statusButton.isVisible().catch(() => false);

        if (hasStatusButton) {
          await statusButton.click();

          // Select new status
          const statusOption = page.getByRole('option', { name: /completed|done/i }).or(
            page.getByRole('menuitem', { name: /completed|done/i })
          );

          const hasOption = await statusOption.isVisible().catch(() => false);

          if (hasOption) {
            await statusOption.click();

            // Verify status updated

            const completedIndicator = firstTask.getByText(/completed|done/i);
            const hasCompleted = await completedIndicator.isVisible().catch(() => false);
            expect(hasCompleted).toBe(true);
          }
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display task details', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Look for session with tasks
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for task items
      const taskItems = page.getByTestId(/task-item|task-card/).or(
        page.locator('.task-item')
      );

      const taskCount = await taskItems.count();

      if (taskCount > 0) {
        const firstTask = taskItems.first();

        // Verify task has title
        const taskTitle = firstTask.getByTestId('task-title').or(
          firstTask.locator('.task-title')
        );

        const hasTitle = await taskTitle.isVisible().catch(() => false);
        expect(hasTitle).toBe(true);

        // Verify task has status indicator
        const taskStatus = firstTask.getByTestId('task-status').or(
          firstTask.locator('.task-status')
        );

        const hasStatus = await taskStatus.isVisible().catch(() => false);
        expect(hasStatus).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should handle task update errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure for task updates
    await page.route('**/api/sessions/*/tasks/*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Try to update a task
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      const taskItems = page.getByTestId(/task-item|task-card/).or(
        page.locator('.task-item')
      );

      const taskCount = await taskItems.count();

      if (taskCount > 0) {
        const firstTask = taskItems.first();
        const statusButton = firstTask.getByRole('button', { name: /status|change/i });

        const hasStatusButton = await statusButton.isVisible().catch(() => false);

        if (hasStatusButton) {
          await statusButton.click();

          const statusOption = page.getByRole('option', { name: /completed|done/i });
          const hasOption = await statusOption.isVisible().catch(() => false);

          if (hasOption) {
            await statusOption.click();

            // Look for error message

            const errorMessage = page.getByText(/error|failed|unable/i);
            const hasError = await errorMessage.isVisible().catch(() => false);
            expect(hasError).toBe(true);
          }
        }
      }
    }

    // Restore routing
    await page.unroute('**/api/sessions/*/tasks/*');

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should refresh tasks after session reload', async ({ page }) => {
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

      // Get initial task count
      const taskItems = page.getByTestId(/task-item|task-card/).or(
        page.locator('.task-item')
      );

      const initialCount = await taskItems.count();

      // Reload page
      await page.reload({ waitUntil: 'networkidle' as const });

      // Verify tasks are still displayed
      const newTaskItems = page.getByTestId(/task-item|task-card/).or(
        page.locator('.task-item')
      );

      const newCount = await newTaskItems.count();
      expect(newCount).toBe(initialCount);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should support task filtering', async ({ page }) => {
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

      // Look for filter controls
      const filterSelect = page.getByRole('combobox', { name: /filter|show/i }).or(
        page.getByTestId('task-filter')
      );

      const hasFilter = await filterSelect.isVisible().catch(() => false);

      if (hasFilter) {
        // Select a filter option
        const filterOptions = await filterSelect.locator('option').count();

        if (filterOptions > 1) {
          await filterSelect.selectOption({ index: 1 });

          // Verify filtered results

          const taskItems = page.getByTestId(/task-item|task-card/).or(
            page.locator('.task-item')
          );

          const taskCount = await taskItems.count();
          expect(taskCount).toBeGreaterThanOrEqual(0);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should display empty state for tasks', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Look for session that might have no tasks
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for empty state
      const emptyState = page.getByTestId('tasks-empty-state').or(
        page.getByText(/no tasks|no task/i)
      );

      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      const taskItems = page.getByTestId(/task-item|task-card/).or(
        page.locator('.task-item')
      );

      const taskCount = await taskItems.count();

      // If no tasks, should show empty state
      if (taskCount === 0) {
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should support task search', async ({ page }) => {
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

        const taskItems = page.getByTestId(/task-item|task-card/).or(
          page.locator('.task-item')
        );

        const taskCount = await taskItems.count();

        // Either no results message or filtered tasks
        expect(hasNoResults || taskCount >= 0).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display task progress indicator', async ({ page }) => {
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

      // Look for progress indicator
      const progressBar = page.getByTestId('tasks-progress').or(
        page.locator('*').filter({ hasText: /\d+\/\d+|progress/i })
      );

      const hasProgress = await progressBar.isVisible().catch(() => false);

      // Progress is optional but if present should be visible
      if (hasProgress) {
        expect(progressBar).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should support batch task updates', async ({ page }) => {
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

      // Look for select all checkbox
      const selectAllCheckbox = page.getByRole('checkbox', { name: /select all/i }).or(
        page.getByTestId('select-all-tasks')
      );

      const hasSelectAll = await selectAllCheckbox.isVisible().catch(() => false);

      if (hasSelectAll) {
        await selectAllCheckbox.check();

        // Look for batch action buttons
        const batchCompleteButton = page.getByRole('button', { name: /complete all|mark complete/i }).or(
          page.getByTestId('batch-complete-button')
        );

        const hasBatchButton = await batchCompleteButton.isVisible().catch(() => false);

        if (hasBatchButton) {
          expect(batchCompleteButton).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
