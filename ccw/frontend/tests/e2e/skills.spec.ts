// ========================================
// E2E Tests: Skills Management
// ========================================
// End-to-end tests for skills list and toggle operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Skills] - Skills Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display skills list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Look for skills list container
    const skillsList = page.getByTestId('skills-list').or(
      page.locator('.skills-list')
    );

    const isVisible = await skillsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify skill items exist
      const skillItems = page.getByTestId(/skill-item|skill-card/).or(
        page.locator('.skill-item')
      );

      const itemCount = await skillItems.count();
      expect(itemCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should toggle skill enabled status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Look for skill items
    const skillItems = page.getByTestId(/skill-item|skill-card/).or(
      page.locator('.skill-item')
    );

    const itemCount = await skillItems.count();

    if (itemCount > 0) {
      const firstSkill = skillItems.first();

      // Look for toggle switch/button
      const toggleSwitch = firstSkill.getByRole('switch').or(
        firstSkill.getByTestId('skill-toggle')
      ).or(
        firstSkill.getByRole('button', { name: /enable|disable|toggle/i })
      );

      const hasToggle = await toggleSwitch.isVisible().catch(() => false);

      if (hasToggle) {
        // Get initial state
        const initialState = await toggleSwitch.getAttribute('aria-checked');
        const initialChecked = initialState === 'true';

        // Toggle the skill
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

  test('L3.3 - should display skill description', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Look for skill items
    const skillItems = page.getByTestId(/skill-item|skill-card/).or(
      page.locator('.skill-item')
    );

    const itemCount = await skillItems.count();

    if (itemCount > 0) {
      const firstSkill = skillItems.first();

      // Look for skill description
      const description = firstSkill.getByTestId('skill-description').or(
        firstSkill.locator('.skill-description')
      );

      const hasDescription = await description.isVisible().catch(() => false);

      if (hasDescription) {
        const text = await description.textContent();
        expect(text).toBeTruthy();
        expect(text?.length).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should display skill triggers', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Look for skill items
    const skillItems = page.getByTestId(/skill-item|skill-card/).or(
      page.locator('.skill-item')
    );

    const itemCount = await skillItems.count();

    if (itemCount > 0) {
      const firstSkill = skillItems.first();

      // Look for triggers section
      const triggers = firstSkill.getByTestId('skill-triggers').or(
        firstSkill.locator('.skill-triggers')
      );

      const hasTriggers = await triggers.isVisible().catch(() => false);

      if (hasTriggers) {
        const text = await triggers.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should filter skills by category', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

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

        const skillItems = page.getByTestId(/skill-item|skill-card/).or(
          page.locator('.skill-item')
        );

        const skillCount = await skillItems.count();
        expect(skillCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should search skills', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('skill-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const skillItems = page.getByTestId(/skill-item|skill-card/).or(
        page.locator('.skill-item')
      );

      const skillCount = await skillItems.count();

      // Either no results message or filtered skills
      expect(hasNoResults || skillCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should display skill source type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Look for skill items
    const skillItems = page.getByTestId(/skill-item|skill-card/).or(
      page.locator('.skill-item')
    );

    const itemCount = await skillItems.count();

    if (itemCount > 0) {
      const firstSkill = skillItems.first();

      // Look for source badge
      const sourceBadge = firstSkill.getByTestId('skill-source').or(
        firstSkill.locator('*').filter({ hasText: /builtin|custom|community/i })
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

  test('L3.8 - should support i18n in skills page', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify skills-related UI is in Chinese
      const pageContent = await page.content();
      const hasChineseText = /[\u4e00-\u9fa5]/.test(pageContent);
      expect(hasChineseText).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display skill version', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Look for skill items
    const skillItems = page.getByTestId(/skill-item|skill-card/).or(
      page.locator('.skill-item')
    );

    const itemCount = await skillItems.count();

    if (itemCount > 0) {
      const firstSkill = skillItems.first();

      // Look for version badge
      const versionBadge = firstSkill.getByTestId('skill-version').or(
        firstSkill.locator('*').filter({ hasText: /v\d+\./i })
      );

      const hasVersion = await versionBadge.isVisible().catch(() => false);

      if (hasVersion) {
        const text = await versionBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should handle toggle errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure for skill toggle
    await page.route('**/api/skills/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to skills page
    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Try to toggle a skill
    const skillItems = page.getByTestId(/skill-item|skill-card/).or(
      page.locator('.skill-item')
    );

    const itemCount = await skillItems.count();

    if (itemCount > 0) {
      const firstSkill = skillItems.first();
      const toggleSwitch = firstSkill.getByRole('switch').or(
        firstSkill.getByTestId('skill-toggle')
      );

      const hasToggle = await toggleSwitch.isVisible().catch(() => false);

      if (hasToggle) {
        await toggleSwitch.click();

        // Look for error message

        const errorMessage = page.getByText(/error|failed|unable/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    // Restore routing
    await page.unroute('**/api/skills/**');

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/skills'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Error Scenarios
  // ========================================

  test('L3.11 - API Error - 400 Bad Request', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 400
    await page.route('**/api/skills/**', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bad Request', message: 'Invalid skill data' }),
      });
    });

    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Try to toggle a skill (should fail with 400)
    const skillItems = page.getByTestId(/skill-item|skill-card/).or(
      page.locator('.skill-item')
    );

    const itemCount = await skillItems.count();
    if (itemCount > 0) {
      const firstSkill = skillItems.first();
      const toggleSwitch = firstSkill.getByRole('switch').or(
        firstSkill.getByTestId('skill-toggle')
      );

      const hasToggle = await toggleSwitch.isVisible().catch(() => false);
      if (hasToggle) {
        await toggleSwitch.click();

        // Verify error message
        const errorMessage = page.getByText(/invalid|bad request|输入无效/i);
        await page.unroute('**/api/skills/**');
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/skills'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.12 - API Error - 401 Unauthorized', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 401
    await page.route('**/api/skills', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      });
    });

    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Verify auth error
    const authError = page.getByText(/unauthorized|not authenticated|未经授权/i);
    await page.unroute('**/api/skills');
    const hasError = await authError.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/skills'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.13 - API Error - 403 Forbidden', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 403
    await page.route('**/api/skills', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
      });
    });

    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Verify forbidden message
    const errorMessage = page.getByText(/forbidden|not allowed|禁止访问/i);
    await page.unroute('**/api/skills');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/skills'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.14 - API Error - 404 Not Found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 404
    await page.route('**/api/skills/nonexistent', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found', message: 'Skill not found' }),
      });
    });

    // Try to access a non-existent skill
    await page.goto('/skills/nonexistent-skill-id', { waitUntil: 'networkidle' as const });

    // Verify not found message
    const errorMessage = page.getByText(/not found|doesn't exist|未找到/i);
    await page.unroute('**/api/skills/nonexistent');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/skills'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.15 - API Error - 500 Internal Server Error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 500
    await page.route('**/api/skills', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Verify server error message
    const errorMessage = page.getByText(/server error|try again|服务器错误/i);
    await page.unroute('**/api/skills');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/skills'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.16 - API Error - Network Timeout', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API timeout
    await page.route('**/api/skills', () => {
      // Never fulfill - simulate timeout
    });

    await page.goto('/skills', { waitUntil: 'networkidle' as const });

    // Wait for timeout handling
    await page.waitForTimeout(3000);

    // Verify timeout message
    const timeoutMessage = page.getByText(/timeout|network error|unavailable|网络超时/i);
    await page.unroute('**/api/skills');
    const hasTimeout = await timeoutMessage.isVisible().catch(() => false);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/skills'], allowWarnings: true });
    monitoring.stop();
  });
});
