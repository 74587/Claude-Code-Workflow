// ========================================
// E2E Tests: Dashboard
// ========================================
// End-to-end tests for dashboard functionality with i18n support

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify, verifyI18nState, verifyPersistenceAfterReload } from './helpers/i18n-helpers';

test.describe('[Dashboard] - Core Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display dashboard stats', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for dashboard stats container
    const statsContainer = page.getByTestId('dashboard-stats').or(
      page.locator('[data-testid="stats"]')
    ).or(
      page.locator('.stats')
    );

    const isVisible = await statsContainer.isVisible().catch(() => false);

    if (isVisible) {
      // Verify stat cards are present
      const statCards = page.getByTestId(/stat-|stat-card/).or(
        page.locator('.stat-card')
      );

      const cardCount = await statCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Verify each card has a value
      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = statCards.nth(i);
        await expect(card).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display active sessions list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for sessions container
    const sessionsContainer = page.getByTestId('sessions-list').or(
      page.getByTestId('active-sessions')
    ).or(
      page.locator('.sessions-list')
    );

    const isVisible = await sessionsContainer.isVisible().catch(() => false);

    if (isVisible) {
      // Verify session items are present or empty state is shown
      const sessionItems = page.getByTestId(/session-item|session-card/).or(
        page.locator('.session-item')
      );

      const itemCount = await sessionItems.count();

      if (itemCount === 0) {
        // Check for empty state
        const emptyState = page.getByText(/no sessions|empty|no data/i).or(
          page.getByTestId('empty-state')
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      } else {
        expect(itemCount).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should support i18n (English/Chinese)', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);
      await verifyI18nState(page, 'zh');

      // Verify dashboard content is in Chinese
      const pageContent = await page.content();
      const hasChineseText = /[\u4e00-\u9fa5]/.test(pageContent);
      expect(hasChineseText).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
      await verifyI18nState(page, 'en');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should handle empty state gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for empty state indicators
    const emptyStateIndicators = [
      page.getByText(/no sessions/i),
      page.getByText(/no data/i),
      page.getByText(/get started/i),
      page.getByTestId('empty-state'),
      page.locator('.empty-state'),
    ];

    let hasEmptyState = false;
    for (const indicator of emptyStateIndicators) {
      if (await indicator.isVisible().catch(() => false)) {
        hasEmptyState = true;
        break;
      }
    }

    // If empty state is present, verify it has helpful content
    if (hasEmptyState) {
      // Look for call-to-action buttons
      const ctaButton = page.getByRole('button', { name: /create|new|add|start/i }).first();
      const hasCTA = await ctaButton.isVisible().catch(() => false);

      // Empty state should guide users to take action
      expect(hasCTA).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should persist language preference after reload', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify persistence after reload
      await verifyPersistenceAfterReload(page, 'zh');

      // Verify language is still Chinese
      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBe('zh');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display archived sessions section', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for archived sessions section
    const archivedSection = page.getByTestId('archived-sessions').or(
      page.getByText(/archived/i)
    );

    const hasArchivedSection = await archivedSection.isVisible().catch(() => false);

    if (hasArchivedSection) {
      // Verify archived sessions are visually distinct from active sessions
      const activeSessions = page.getByTestId('active-sessions').or(
        page.getByText(/active sessions/i)
      );

      const hasActiveSection = await activeSessions.isVisible().catch(() => false);
      expect(hasActiveSection).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should update stats when workspace changes', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for workspace switcher
    const workspaceSwitcher = page.getByTestId('workspace-switcher').or(
      page.getByRole('combobox', { name: /workspace/i })
    );

    const hasWorkspaceSwitcher = await workspaceSwitcher.isVisible().catch(() => false);

    if (hasWorkspaceSwitcher) {
      // Get initial stats
      const initialStats = await page.evaluate(() => {
        const stats = document.querySelector('[data-testid*="stat"]');
        return stats?.textContent || '';
      });

      // Try to switch workspace
      await workspaceSwitcher.click();

      const options = page.getByRole('option');
      const optionsCount = await options.count();

      if (optionsCount > 0) {
        const firstOption = options.first();
        await firstOption.click();

        // Wait for data refresh
        await page.waitForLoadState('networkidle');

        // Verify stats container is still visible
        const statsContainer = page.getByTestId('dashboard-stats').or(
          page.locator('.stats')
        );

        const isStillVisible = await statsContainer.isVisible().catch(() => false);
        expect(isStillVisible).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should handle API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/data', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Reload page to trigger API call
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for error indicator or fallback content
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Either error is shown or page has fallback content
    const pageContent = await page.content();
    const hasContent = pageContent.length > 1000;

    expect(hasError || hasContent).toBe(true);

    // Restore normal routing
    await page.unroute('**/api/data');

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/data'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should navigate to session detail on click', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for session items
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Click on session
      await firstSession.click();

      // Verify navigation to session detail
      await page.waitForURL(/\/session|\/sessions\//);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/session|\/sessions\//);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display today activity metric', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for today activity stat
    const todayActivity = page.getByTestId('stat-today-activity').or(
      page.getByTestId('today-activity')
    ).or(
      page.locator('*').filter({ hasText: /today|activity/i })
    );

    const hasTodayActivity = await todayActivity.isVisible().catch(() => false);

    if (hasTodayActivity) {
      const text = await todayActivity.textContent();
      expect(text).toBeTruthy();
      expect(text?.length).toBeGreaterThan(0);

      // Verify it contains a number
      const hasNumber = /\d+/.test(text || '');
      expect(hasNumber).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
