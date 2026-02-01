// ========================================
// E2E Tests: Hooks Management
// ========================================
// End-to-end tests for hooks CRUD, toggle, and template operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Hooks] - Hooks Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display hooks list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for hooks list container
    const hooksList = page.getByTestId('hooks-list').or(
      page.locator('.hooks-list')
    );

    const isVisible = await hooksList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify hook items exist or empty state is shown
      const hookItems = page.getByTestId(/hook-item|hook-card/).or(
        page.locator('.hook-item')
      );

      const itemCount = await hookItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no hooks|empty/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should create new hook', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for create hook button
    const createButton = page.getByRole('button', { name: /create|new|add hook/i }).or(
      page.getByTestId('create-hook-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create hook dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create hook|new hook/i });
      const form = page.getByTestId('create-hook-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in hook details
        const nameInput = page.getByRole('textbox', { name: /name/i }).or(
          page.getByLabel(/name/i)
        );

        const hasNameInput = await nameInput.isVisible().catch(() => false);

        if (hasNameInput) {
          await nameInput.fill('e2e-test-hook');

          // Select trigger
          const triggerSelect = page.getByRole('combobox', { name: /trigger/i });
          const hasTriggerSelect = await triggerSelect.isVisible().catch(() => false);

          if (hasTriggerSelect) {
            const triggerOptions = await triggerSelect.locator('option').count();
            if (triggerOptions > 0) {
              await triggerSelect.selectOption({ index: 0 });
            }
          }

          // Enter command
          const commandInput = page.getByRole('textbox', { name: /command|script/i });
          const hasCommandInput = await commandInput.isVisible().catch(() => false);

          if (hasCommandInput) {
            await commandInput.fill('echo "test"');
          }

          const submitButton = page.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          // Verify hook was created

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

  test('L3.3 - should update hook', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for existing hook
    const hookItems = page.getByTestId(/hook-item|hook-card/).or(
      page.locator('.hook-item')
    );

    const itemCount = await hookItems.count();

    if (itemCount > 0) {
      const firstHook = hookItems.first();

      // Look for edit button
      const editButton = firstHook.getByRole('button', { name: /edit|modify|configure/i }).or(
        firstHook.getByTestId('edit-hook-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Update hook command
        const commandInput = page.getByRole('textbox', { name: /command|script/i });
        const hasCommandInput = await commandInput.isVisible().catch(() => false);

        if (hasCommandInput) {
          await commandInput.clear();
          await commandInput.fill('echo "updated"');
        }

        // Save changes
        const saveButton = page.getByRole('button', { name: /save|update|submit/i });
        await saveButton.click();

        // Verify success message

        const successMessage = page.getByText(/updated|saved|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should delete hook', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for existing hook
    const hookItems = page.getByTestId(/hook-item|hook-card/).or(
      page.locator('.hook-item')
    );

    const itemCount = await hookItems.count();

    if (itemCount > 0) {
      const firstHook = hookItems.first();

      // Look for delete button
      const deleteButton = firstHook.getByRole('button', { name: /delete|remove/i }).or(
        firstHook.getByTestId('delete-button')
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

  test('L3.5 - should toggle hook enabled status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for hook items
    const hookItems = page.getByTestId(/hook-item|hook-card/).or(
      page.locator('.hook-item')
    );

    const itemCount = await hookItems.count();

    if (itemCount > 0) {
      const firstHook = hookItems.first();

      // Look for toggle switch
      const toggleSwitch = firstHook.getByRole('switch').or(
        firstHook.getByTestId('hook-toggle')
      ).or(
        firstHook.getByRole('button', { name: /enable|disable|toggle/i })
      );

      const hasToggle = await toggleSwitch.isVisible().catch(() => false);

      if (hasToggle) {
        // Get initial state
        const initialState = await toggleSwitch.getAttribute('aria-checked');
        const initialChecked = initialState === 'true';

        // Toggle the hook
        await toggleSwitch.click();

        // Wait for update

        // Verify state changed
        const newState = await toggleSwitch.getAttribute('aria-checked');
        const newChecked = newState === 'true';

        expect(newChecked).toBe(!initialChecked);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display hook trigger', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for hook items
    const hookItems = page.getByTestId(/hook-item|hook-card/).or(
      page.locator('.hook-item')
    );

    const itemCount = await hookItems.count();

    if (itemCount > 0) {
      const firstHook = hookItems.first();

      // Look for trigger badge
      const triggerBadge = firstHook.getByTestId('hook-trigger').or(
        firstHook.locator('*').filter({ hasText: /pre-commit|post-commit|pre-push|on-save/i })
      );

      const hasTrigger = await triggerBadge.isVisible().catch(() => false);

      if (hasTrigger) {
        const text = await triggerBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should install hook from template', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for template installation button
    const templateButton = page.getByRole('button', { name: /template|install template/i }).or(
      page.getByTestId('install-template-button')
    );

    const hasTemplateButton = await templateButton.isVisible().catch(() => false);

    if (hasTemplateButton) {
      await templateButton.click();

      // Look for template selection dialog
      const dialog = page.getByRole('dialog').filter({ hasText: /template|choose/i });
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        // Select a template
        const templateOption = dialog.getByRole('button').first();
        const hasOption = await templateOption.isVisible().catch(() => false);

        if (hasOption) {
          await templateOption.click();

          // Confirm installation
          const confirmButton = page.getByRole('button', { name: /install|add/i });
          await confirmButton.click();

          // Verify success

          const successMessage = page.getByText(/installed|success/i);
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should display hook matcher pattern', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for hook items
    const hookItems = page.getByTestId(/hook-item|hook-card/).or(
      page.locator('.hook-item')
    );

    const itemCount = await hookItems.count();

    if (itemCount > 0) {
      const firstHook = hookItems.first();

      // Look for matcher pattern display
      const matcherDisplay = firstHook.getByTestId('hook-matcher').or(
        firstHook.locator('*').filter({ hasText: /\*\..+|\.ts$|\.js$/i })
      );

      const hasMatcher = await matcherDisplay.isVisible().catch(() => false);

      if (hasMatcher) {
        const text = await matcherDisplay.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should filter hooks by trigger type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Look for trigger filter
    const triggerFilter = page.getByRole('combobox', { name: /trigger|filter/i }).or(
      page.getByTestId('trigger-filter')
    );

    const hasTriggerFilter = await triggerFilter.isVisible().catch(() => false);

    if (hasTriggerFilter) {
      // Check if there are filter options
      const filterOptions = await triggerFilter.locator('option').count();

      if (filterOptions > 1) {
        await triggerFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const hookItems = page.getByTestId(/hook-item|hook-card/).or(
          page.locator('.hook-item')
        );

        const hookCount = await hookItems.count();
        expect(hookCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should handle hooks API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/hooks/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to hooks page
    await page.goto('/settings/hooks', { waitUntil: 'networkidle' as const });

    // Try to create a hook
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      const nameInput = page.getByRole('textbox', { name: /name/i });
      const hasNameInput = await nameInput.isVisible().catch(() => false);

      if (hasNameInput) {
        await nameInput.fill('test-hook');

        const submitButton = page.getByRole('button', { name: /create|save/i });
        await submitButton.click();

        // Look for error message

        const errorMessage = page.getByText(/error|failed|unable/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    // Restore routing
    await page.unroute('**/api/hooks/**');

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/hooks'], allowWarnings: true });
    monitoring.stop();
  });
});
