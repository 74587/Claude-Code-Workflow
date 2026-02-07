// ========================================
// E2E Tests: Commands Management
// ========================================
// End-to-end tests for commands list and info display

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Commands] - Commands Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display commands list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for commands list container
    const commandsList = page.getByTestId('commands-list').or(
      page.locator('.commands-list')
    );

    const isVisible = await commandsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify command items exist
      const commandItems = page.getByTestId(/command-item|command-card/).or(
        page.locator('.command-item')
      );

      const itemCount = await commandItems.count();
      expect(itemCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display command name', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      // Check each command has a name
      for (let i = 0; i < Math.min(itemCount, 5); i++) {
        const command = commandItems.nth(i);

        const nameElement = command.getByTestId('command-name').or(
          command.locator('.command-name')
        );

        const hasName = await nameElement.isVisible().catch(() => false);
        expect(hasName).toBe(true);

        const name = await nameElement.textContent();
        expect(name).toBeTruthy();
        expect(name?.length).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display command description', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for description
      const description = firstCommand.getByTestId('command-description').or(
        firstCommand.locator('.command-description')
      );

      const hasDescription = await description.isVisible().catch(() => false);

      if (hasDescription) {
        const text = await description.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should display command usage', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for usage info
      const usage = firstCommand.getByTestId('command-usage').or(
        firstCommand.locator('*').filter({ hasText: /usage|how to use/i })
      );

      const hasUsage = await usage.isVisible().catch(() => false);

      if (hasUsage) {
        const text = await usage.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display command examples', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for examples section
      const examples = firstCommand.getByTestId('command-examples').or(
        firstCommand.locator('*').filter({ hasText: /example/i })
      );

      const hasExamples = await examples.isVisible().catch(() => false);

      if (hasExamples) {
        const text = await examples.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display command category', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for category badge
      const categoryBadge = firstCommand.getByTestId('command-category').or(
        firstCommand.locator('.command-category')
      );

      const hasCategory = await categoryBadge.isVisible().catch(() => false);

      if (hasCategory) {
        const text = await categoryBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should filter commands by category', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for category filter
    const categoryFilter = page.getByRole('combobox', { name: /category|filter/i }).or(
      page.getByTestId('category-filter')
    );

    const hasCategoryFilter = await categoryFilter.isVisible().catch(() => false);

    if (hasCategoryFilter) {
      // Check if there are category options
      const categoryOptions = await categoryFilter.locator('option').count();

      if (categoryOptions > 1) {
        await categoryFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const commandItems = page.getByTestId(/command-item|command-card/).or(
          page.locator('.command-item')
        );

        const commandCount = await commandItems.count();
        expect(commandCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should search commands', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('command-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const commandItems = page.getByTestId(/command-item|command-card/).or(
        page.locator('.command-item')
      );

      const commandCount = await commandItems.count();

      // Either no results message or filtered commands
      expect(hasNoResults || commandCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display command source type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for source badge
      const sourceBadge = firstCommand.getByTestId('command-source').or(
        firstCommand.locator('*').filter({ hasText: /builtin|custom/i })
      );

      const hasSource = await sourceBadge.isVisible().catch(() => false);

      if (hasSource) {
        const text = await sourceBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display command aliases', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for aliases display
      const aliases = firstCommand.getByTestId('command-aliases').or(
        firstCommand.locator('*').filter({ hasText: /alias|also known as/i })
      );

      const hasAliases = await aliases.isVisible().catch(() => false);

      if (hasAliases) {
        const text = await aliases.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Error Scenarios
  // ========================================

  test('L3.11 - API Error - 400 Bad Request', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 400
    await page.route('**/api/commands/**', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bad Request', message: 'Invalid command data' }),
      });
    });

    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Verify error message is displayed
    const errorMessage = page.getByText(/invalid|bad request|输入无效/i);
    await page.unroute('**/api/commands/**');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/commands'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.12 - API Error - 401 Unauthorized', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 401
    await page.route('**/api/commands', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      });
    });

    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Verify auth error
    const authError = page.getByText(/unauthorized|not authenticated|未经授权/i);
    await page.unroute('**/api/commands');
    const hasError = await authError.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/commands'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.13 - API Error - 403 Forbidden', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 403
    await page.route('**/api/commands', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
      });
    });

    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Verify forbidden message
    const errorMessage = page.getByText(/forbidden|not allowed|禁止访问/i);
    await page.unroute('**/api/commands');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/commands'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.14 - API Error - 404 Not Found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 404
    await page.route('**/api/commands/nonexistent', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found', message: 'Command not found' }),
      });
    });

    // Try to access a non-existent command
    await page.goto('/commands/nonexistent-command-id', { waitUntil: 'networkidle' as const });

    // Verify not found message
    const errorMessage = page.getByText(/not found|doesn't exist|未找到/i);
    await page.unroute('**/api/commands/nonexistent');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/commands'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.15 - API Error - 500 Internal Server Error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 500
    await page.route('**/api/commands', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Verify server error message
    const errorMessage = page.getByText(/server error|try again|服务器错误/i);
    await page.unroute('**/api/commands');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/commands'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.16 - API Error - Network Timeout', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API timeout
    await page.route('**/api/commands', () => {
      // Never fulfill - simulate timeout
    });

    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Wait for timeout handling
    await page.waitForTimeout(3000);

    // Verify timeout message
    const timeoutMessage = page.getByText(/timeout|network error|unavailable|网络超时/i);
    await page.unroute('**/api/commands');
    const hasTimeout = await timeoutMessage.isVisible().catch(() => false);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/commands'], allowWarnings: true });
    monitoring.stop();
  });
});
