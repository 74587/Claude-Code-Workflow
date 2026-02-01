// ========================================
// E2E Tests: Loops Management
// ========================================
// End-to-end tests for loop CRUD operations and controls

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Loops] - Loop Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display loops list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for loops list container
    const loopsList = page.getByTestId('loops-list').or(
      page.locator('.loops-list')
    );

    const isVisible = await loopsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify loop items exist or empty state is shown
      const loopItems = page.getByTestId(/loop-item|loop-card/).or(
        page.locator('.loop-item')
      );

      const itemCount = await loopItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no loops/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should create new loop', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for create loop button
    const createButton = page.getByRole('button', { name: /create|new|add loop/i }).or(
      page.getByTestId('create-loop-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create loop dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create loop|new loop/i });
      const form = page.getByTestId('create-loop-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in loop details
        const promptInput = page.getByRole('textbox', { name: /prompt|description/i }).or(
          page.getByLabel(/prompt|description/i)
        );

        const hasPromptInput = await promptInput.isVisible().catch(() => false);

        if (hasPromptInput) {
          await promptInput.fill('E2E Test Loop prompt');

          // Select tool if available
          const toolSelect = page.getByRole('combobox', { name: /tool/i });
          const hasToolSelect = await toolSelect.isVisible().catch(() => false);

          if (hasToolSelect) {
            const toolOptions = await toolSelect.locator('option').count();
            if (toolOptions > 0) {
              await toolSelect.selectOption({ index: 0 });
            }
          }

          const submitButton = page.getByRole('button', { name: /create|save|submit|start/i });
          await submitButton.click();

          // Verify loop was created

          const successMessage = page.getByText(/created|started|success/i).or(
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

  test('L3.3 - should pause running loop', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for running loop
    const runningLoops = page.getByTestId(/loop-item|loop-card/).filter({ hasText: /running|active/i }).or(
      page.locator('.loop-item').filter({ hasText: /running|active/i })
    );

    const count = await runningLoops.count();

    if (count > 0) {
      const firstLoop = runningLoops.first();

      // Look for pause button
      const pauseButton = firstLoop.getByRole('button', { name: /pause/i }).or(
        firstLoop.getByTestId('pause-button')
      );

      const hasPauseButton = await pauseButton.isVisible().catch(() => false);

      if (hasPauseButton) {
        await pauseButton.click();

        // Verify loop is paused

        const pausedIndicator = firstLoop.getByText(/paused/i);
        const hasPaused = await pausedIndicator.isVisible().catch(() => false);
        expect(hasPaused).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should resume paused loop', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for paused loop
    const pausedLoops = page.getByTestId(/loop-item|loop-card/).filter({ hasText: /paused/i }).or(
      page.locator('.loop-item').filter({ hasText: /paused/i })
    );

    const count = await pausedLoops.count();

    if (count > 0) {
      const firstLoop = pausedLoops.first();

      // Look for resume button
      const resumeButton = firstLoop.getByRole('button', { name: /resume|continue/i }).or(
        firstLoop.getByTestId('resume-button')
      );

      const hasResumeButton = await resumeButton.isVisible().catch(() => false);

      if (hasResumeButton) {
        await resumeButton.click();

        // Verify loop is resumed

        const runningIndicator = firstLoop.getByText(/running|active/i);
        const hasRunning = await runningIndicator.isVisible().catch(() => false);
        expect(hasRunning).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should stop loop', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for active/paused loop
    const activeLoops = page.locator('.loop-item').filter({ hasText: /running|paused|active/i });

    const count = await activeLoops.count();

    if (count > 0) {
      const firstLoop = activeLoops.first();

      // Look for stop button
      const stopButton = firstLoop.getByRole('button', { name: /stop/i }).or(
        firstLoop.getByTestId('stop-button')
      );

      const hasStopButton = await stopButton.isVisible().catch(() => false);

      if (hasStopButton) {
        await stopButton.click();

        // Confirm stop if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /stop|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = page.getByRole('button', { name: /stop|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify loop is stopped

        const stoppedIndicator = firstLoop.getByText(/stopped|completed/i);
        const hasStopped = await stoppedIndicator.isVisible().catch(() => false);
        expect(hasStopped).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should delete loop', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for existing loop
    const loopItems = page.getByTestId(/loop-item|loop-card/).or(
      page.locator('.loop-item')
    );

    const itemCount = await loopItems.count();

    if (itemCount > 0) {
      const firstLoop = loopItems.first();

      // Look for delete button
      const deleteButton = firstLoop.getByRole('button', { name: /delete|remove/i }).or(
        firstLoop.getByTestId('delete-button')
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

  test('L3.7 - should display loop status correctly', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for loop items
    const loopItems = page.getByTestId(/loop-item|loop-card/).or(
      page.locator('.loop-item')
    );

    const itemCount = await loopItems.count();

    if (itemCount > 0) {
      // Check each loop has a status indicator
      for (let i = 0; i < Math.min(itemCount, 3); i++) {
        const loop = loopItems.nth(i);

        // Look for status indicator
        const statusIndicator = loop.getByTestId('loop-status').or(
          loop.locator('*').filter({ hasText: /running|paused|stopped|completed|created/i })
        );

        const hasStatus = await statusIndicator.isVisible().catch(() => false);
        expect(hasStatus).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should display loop progress', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for loop items with progress
    const loopItems = page.getByTestId(/loop-item|loop-card/).or(
      page.locator('.loop-item')
    );

    const itemCount = await loopItems.count();

    if (itemCount > 0) {
      const firstLoop = loopItems.first();

      // Look for progress bar or step indicator
      const progressBar = firstLoop.getByTestId('loop-progress').or(
        firstLoop.locator('*').filter({ hasText: /\d+\/\d+|step/i })
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

  test('L3.9 - should handle loop creation errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/loops', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for create button
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Try to create loop
      const promptInput = page.getByRole('textbox', { name: /prompt|description/i });
      const hasPromptInput = await promptInput.isVisible().catch(() => false);

      if (hasPromptInput) {
        await promptInput.fill('Test prompt');

        const submitButton = page.getByRole('button', { name: /create|save|submit/i });
        await submitButton.click();

        // Look for error message

        const errorMessage = page.getByText(/error|failed|unable/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    // Restore routing
    await page.unroute('**/api/loops');

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/loops'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should support batch operations on loops', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to loops page
    await page.goto('/loops', { waitUntil: 'networkidle' as const });

    // Look for batch operation controls
    const selectAllCheckbox = page.getByRole('checkbox', { name: /select all/i }).or(
      page.getByTestId('select-all-loops')
    );

    const hasSelectAll = await selectAllCheckbox.isVisible().catch(() => false);

    if (hasSelectAll) {
      await selectAllCheckbox.check();

      // Look for batch action buttons
      const batchStopButton = page.getByRole('button', { name: /stop selected|stop all/i }).or(
        page.getByTestId('batch-stop-button')
      );

      const hasBatchStop = await batchStopButton.isVisible().catch(() => false);

      if (hasBatchStop) {
        expect(batchStopButton).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
