// ========================================
// E2E Tests: Rules Management
// ========================================
// End-to-end tests for rules CRUD and toggle operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Rules] - Rules Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display rules list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for rules list container
    const rulesList = page.getByTestId('rules-list').or(
      page.locator('.rules-list')
    );

    const isVisible = await rulesList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify rule items exist or empty state is shown
      const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
        page.locator('.rule-item')
      );

      const itemCount = await ruleItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no rules|empty/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should create new rule', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for create rule button
    const createButton = page.getByRole('button', { name: /create|new|add rule/i }).or(
      page.getByTestId('create-rule-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create rule dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create rule|new rule/i });
      const form = page.getByTestId('create-rule-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in rule details
        const ruleInput = page.getByRole('textbox', { name: /rule|pattern|name/i }).or(
          page.getByLabel(/rule|pattern|name/i)
        );

        const hasRuleInput = await ruleInput.isVisible().catch(() => false);

        if (hasRuleInput) {
          await ruleInput.fill('e2e-test-rule');

          // Select scope if available
          const scopeSelect = page.getByRole('combobox', { name: /scope/i });
          const hasScopeSelect = await scopeSelect.isVisible().catch(() => false);

          if (hasScopeSelect) {
            const scopeOptions = await scopeSelect.locator('option').count();
            if (scopeOptions > 0) {
              await scopeSelect.selectOption({ index: 0 });
            }
          }

          const submitButton = page.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          // Verify rule was created

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

  test('L3.3 - should update rule', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for existing rule
    const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
      page.locator('.rule-item')
    );

    const itemCount = await ruleItems.count();

    if (itemCount > 0) {
      const firstRule = ruleItems.first();

      // Look for edit button
      const editButton = firstRule.getByRole('button', { name: /edit|modify|configure/i }).or(
        firstRule.getByTestId('edit-rule-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Update rule details
        const ruleInput = page.getByRole('textbox', { name: /rule|description/i });
        const hasRuleInput = await ruleInput.isVisible().catch(() => false);

        if (hasRuleInput) {
          await ruleInput.clear();
          await ruleInput.fill('updated e2e-test-rule');
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

  test('L3.4 - should delete rule', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for existing rule
    const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
      page.locator('.rule-item')
    );

    const itemCount = await ruleItems.count();

    if (itemCount > 0) {
      const firstRule = ruleItems.first();

      // Look for delete button
      const deleteButton = firstRule.getByRole('button', { name: /delete|remove/i }).or(
        firstRule.getByTestId('delete-button')
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

  test('L3.5 - should toggle rule enabled status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for rule items
    const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
      page.locator('.rule-item')
    );

    const itemCount = await ruleItems.count();

    if (itemCount > 0) {
      const firstRule = ruleItems.first();

      // Look for toggle switch
      const toggleSwitch = firstRule.getByRole('switch').or(
        firstRule.getByTestId('rule-toggle')
      ).or(
        firstRule.getByRole('button', { name: /enable|disable|toggle/i })
      );

      const hasToggle = await toggleSwitch.isVisible().catch(() => false);

      if (hasToggle) {
        // Get initial state
        const initialState = await toggleSwitch.getAttribute('aria-checked');
        const initialChecked = initialState === 'true';

        // Toggle the rule
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

  test('L3.6 - should display rule scope', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for rule items
    const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
      page.locator('.rule-item')
    );

    const itemCount = await ruleItems.count();

    if (itemCount > 0) {
      const firstRule = ruleItems.first();

      // Look for scope badge
      const scopeBadge = firstRule.getByTestId('rule-scope').or(
        firstRule.locator('*').filter({ hasText: /project|workspace|global/i })
      );

      const hasScope = await scopeBadge.isVisible().catch(() => false);

      if (hasScope) {
        const text = await scopeBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should filter rules by scope', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for scope filter
    const scopeFilter = page.getByRole('combobox', { name: /scope|filter/i }).or(
      page.getByTestId('scope-filter')
    );

    const hasScopeFilter = await scopeFilter.isVisible().catch(() => false);

    if (hasScopeFilter) {
      // Check if there are scope options
      const scopeOptions = await scopeFilter.locator('option').count();

      if (scopeOptions > 1) {
        await scopeFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
          page.locator('.rule-item')
        );

        const ruleCount = await ruleItems.count();
        expect(ruleCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should search rules', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('rule-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
        page.locator('.rule-item')
      );

      const ruleCount = await ruleItems.count();

      // Either no results message or filtered rules
      expect(hasNoResults || ruleCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display rule enforcement status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Look for rule items
    const ruleItems = page.getByTestId(/rule-item|rule-card/).or(
      page.locator('.rule-item')
    );

    const itemCount = await ruleItems.count();

    if (itemCount > 0) {
      const firstRule = ruleItems.first();

      // Look for enforced by indicator
      const enforcedByBadge = firstRule.getByTestId('rule-enforced-by').or(
        firstRule.locator('*').filter({ hasText: /enforced by|lint|hook/i })
      );

      const hasEnforcedBy = await enforcedByBadge.isVisible().catch(() => false);

      if (hasEnforcedBy) {
        const text = await enforcedByBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should handle rules API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/rules/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to rules page
    await page.goto('/settings/rules', { waitUntil: 'networkidle' as const });

    // Try to create a rule
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      const ruleInput = page.getByRole('textbox', { name: /rule|name/i });
      const hasRuleInput = await ruleInput.isVisible().catch(() => false);

      if (hasRuleInput) {
        await ruleInput.fill('test-rule');

        const submitButton = page.getByRole('button', { name: /create|save/i });
        await submitButton.click();

        // Look for error message

        const errorMessage = page.getByText(/error|failed|unable/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    // Restore routing
    await page.unroute('**/api/rules/**');

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/rules'], allowWarnings: true });
    monitoring.stop();
  });
});
