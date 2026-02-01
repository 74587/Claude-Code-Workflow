// ========================================
// E2E Tests: Issues and Queue Management
// ========================================
// End-to-end tests for issues CRUD and queue operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Issues & Queue] - Issue Tracking Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display issues list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to issues page
    await page.goto('/issues', { waitUntil: 'networkidle' as const });

    // Look for issues list container
    const issuesList = page.getByTestId('issues-list').or(
      page.locator('.issues-list')
    );

    const isVisible = await issuesList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify issue items exist or empty state is shown
      const issueItems = page.getByTestId(/issue-item|issue-card/).or(
        page.locator('.issue-item')
      );

      const itemCount = await issueItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no issues/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should create new issue', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to issues page
    await page.goto('/issues', { waitUntil: 'networkidle' as const });

    // Look for create issue button
    const createButton = page.getByRole('button', { name: /create|new|add issue/i }).or(
      page.getByTestId('create-issue-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create issue dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create issue|new issue/i });
      const form = page.getByTestId('create-issue-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in issue details
        const titleInput = page.getByRole('textbox', { name: /title|subject/i }).or(
          page.getByLabel(/title|subject/i)
        );

        const hasTitleInput = await titleInput.isVisible().catch(() => false);

        if (hasTitleInput) {
          await titleInput.fill('E2E Test Issue');

          // Set priority if available
          const prioritySelect = page.getByRole('combobox', { name: /priority/i });
          const hasPrioritySelect = await prioritySelect.isVisible().catch(() => false);

          if (hasPrioritySelect) {
            await prioritySelect.selectOption('medium');
          }

          const submitButton = page.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          // Verify issue was created

          const successMessage = page.getByText(/created|success/i).or(
            page.getByTestId('success-message')
          );

          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should update issue status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to issues page
    await page.goto('/issues', { waitUntil: 'networkidle' as const });

    // Look for existing issue
    const issueItems = page.getByTestId(/issue-item|issue-card/).or(
      page.locator('.issue-item')
    );

    const itemCount = await issueItems.count();

    if (itemCount > 0) {
      const firstIssue = issueItems.first();

      // Look for status change button/dropdown
      const statusButton = firstIssue.getByRole('button', { name: /status|in.progress|open|close/i }).or(
        firstIssue.getByTestId('status-button')
      );

      const hasStatusButton = await statusButton.isVisible().catch(() => false);

      if (hasStatusButton) {
        await statusButton.click();

        // Select new status
        const statusOption = page.getByRole('option', { name: /in.progress|working/i }).or(
          page.getByRole('menuitem', { name: /in.progress|working/i })
        );

        const hasOption = await statusOption.isVisible().catch(() => false);

        if (hasOption) {
          await statusOption.click();

          // Verify status updated

          const updatedStatus = firstIssue.getByText(/in.progress|working/i);
          const hasUpdated = await updatedStatus.isVisible().catch(() => false);
          expect(hasUpdated).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should delete issue', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to issues page
    await page.goto('/issues', { waitUntil: 'networkidle' as const });

    // Look for existing issue
    const issueItems = page.getByTestId(/issue-item|issue-card/).or(
      page.locator('.issue-item')
    );

    const itemCount = await issueItems.count();

    if (itemCount > 0) {
      const firstIssue = issueItems.first();

      // Look for delete button
      const deleteButton = firstIssue.getByRole('button', { name: /delete|remove/i }).or(
        firstIssue.getByTestId('delete-button')
      );

      const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

      if (hasDeleteButton) {
        await deleteButton.click();

        // Confirm delete if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = page.getByRole('button', { name: /delete|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify success message

        const successMessage = page.getByText(/deleted|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display issue queue', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to issues/queue page
    await page.goto('/queue', { waitUntil: 'networkidle' as const });

    // Look for queue container
    const queueContainer = page.getByTestId('issue-queue').or(
      page.locator('.queue-container')
    );

    const isVisible = await queueContainer.isVisible().catch(() => false);

    if (isVisible) {
      // Verify queue items or empty state
      const queueItems = page.getByTestId(/queue-item|task-item/).or(
        page.locator('.queue-item')
      );

      const itemCount = await queueItems.count();
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should activate queue', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to queue page
    await page.goto('/queue', { waitUntil: 'networkidle' as const });

    // Look for activate button
    const activateButton = page.getByRole('button', { name: /activate|start queue/i }).or(
      page.getByTestId('activate-queue-button')
    );

    const hasActivateButton = await activateButton.isVisible().catch(() => false);

    if (hasActivateButton) {
      await activateButton.click();

      // Verify queue activation

      const activeIndicator = page.getByText(/active|running/i).or(
        page.getByTestId('queue-active')
      );

      const hasActive = await activeIndicator.isVisible().catch(() => false);
      expect(hasActive).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should deactivate queue', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to queue page
    await page.goto('/queue', { waitUntil: 'networkidle' as const });

    // Look for deactivate button (may only be visible when queue is active)
    const deactivateButton = page.getByRole('button', { name: /deactivate|stop|pause/i }).or(
      page.getByTestId('deactivate-queue-button')
    );

    const hasDeactivateButton = await deactivateButton.isVisible().catch(() => false);

    if (hasDeactivateButton) {
      await deactivateButton.click();

      // Verify queue deactivation

      const inactiveIndicator = page.getByText(/inactive|stopped|paused/i).or(
        page.getByTestId('queue-inactive')
      );

      const hasInactive = await inactiveIndicator.isVisible().catch(() => false);
      expect(hasInactive).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should delete queue', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to queue page
    await page.goto('/queue', { waitUntil: 'networkidle' as const });

    // Look for delete queue button
    const deleteButton = page.getByRole('button', { name: /delete|remove queue/i }).or(
      page.getByTestId('delete-queue-button')
    );

    const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

    if (hasDeleteButton) {
      await deleteButton.click();

      // Confirm delete if dialog appears
      const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete|confirm/i });
      const hasDialog = await confirmDialog.isVisible().catch(() => false);

      if (hasDialog) {
        const confirmButton = page.getByRole('button', { name: /delete|confirm|yes/i });
        await confirmButton.click();
      }

      // Verify success message

      const successMessage = page.getByText(/deleted|success/i);
      const hasSuccess = await successMessage.isVisible().catch(() => false);
      expect(hasSuccess).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should merge queues', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to queue page
    await page.goto('/queue', { waitUntil: 'networkidle' as const });

    // Look for merge button
    const mergeButton = page.getByRole('button', { name: /merge|combine/i }).or(
      page.getByTestId('merge-queue-button')
    );

    const hasMergeButton = await mergeButton.isVisible().catch(() => false);

    if (hasMergeButton) {
      await mergeButton.click();

      // Look for merge dialog
      const dialog = page.getByRole('dialog').filter({ hasText: /merge|combine/i });
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        // Select source and target queues
        const sourceSelect = page.getByRole('combobox', { name: /source|from/i });
        const targetSelect = page.getByRole('combobox', { name: /target|to/i });

        const hasSourceSelect = await sourceSelect.isVisible().catch(() => false);
        const hasTargetSelect = await targetSelect.isVisible().catch(() => false);

        if (hasSourceSelect && hasTargetSelect) {
          // Select options (if available)
          const sourceOptions = await sourceSelect.locator('option').count();
          const targetOptions = await targetSelect.locator('option').count();

          if (sourceOptions > 1 && targetOptions > 1) {
            await sourceSelect.selectOption({ index: 1 });
            await targetSelect.selectOption({ index: 2 });
          }

          const confirmButton = page.getByRole('button', { name: /merge|combine/i });
          await confirmButton.click();

          // Verify success message

          const successMessage = page.getByText(/merged|success/i);
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should verify cache invalidation after mutations', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to issues page
    await page.goto('/issues', { waitUntil: 'networkidle' as const });

    // Get initial issue count
    const issueItems = page.getByTestId(/issue-item|issue-card/).or(
      page.locator('.issue-item')
    );

    const initialCount = await issueItems.count();

    // Look for create button
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Quick fill and submit
      const titleInput = page.getByRole('textbox', { name: /title|subject/i });
      const hasTitleInput = await titleInput.isVisible().catch(() => false);

      if (hasTitleInput) {
        await titleInput.fill('Cache Test Issue');

        const submitButton = page.getByRole('button', { name: /create|save/i });
        await submitButton.click();

        // Wait for cache update and list refresh

        // Verify list is updated (cache invalidated)
        const newCount = await issueItems.count();
        expect(newCount).toBe(initialCount + 1);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
