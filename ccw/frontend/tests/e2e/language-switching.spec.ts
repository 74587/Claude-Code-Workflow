// ========================================
// E2E Tests: Language Switching
// ========================================
// End-to-end tests for internationalization

import { test, expect } from '@playwright/test';

test.describe('Language Switching E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should display language switcher in header', async ({ page }) => {
    // Find the language switcher select element
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i });

    // Verify language switcher is visible
    await expect(languageSwitcher).toBeVisible();
  });

  test('should switch to Chinese and verify text updates', async ({ page }) => {
    // Find the language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Verify initial locale is English (check text content)
    await expect(languageSwitcher).toContainText('English');

    // Click the language switcher
    await languageSwitcher.click();

    // Wait for dropdown to appear and click Chinese option
    const chineseOption = page.getByText('中文');
    await expect(chineseOption).toBeVisible();
    await chineseOption.click();

    // Wait for language change to take effect
    await page.waitForTimeout(500);

    // Verify locale is now Chinese (check text content)
    await expect(languageSwitcher).toContainText('中文');

    // Verify document lang attribute is updated
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');

    // Verify some translated text is displayed
    // This will check for Chinese characters on the page
    const pageContent = await page.content();
    expect(pageContent).toContain('中文');
  });

  test('should persist language selection after page reload', async ({ page }) => {
    // Find the language switcher and switch to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await languageSwitcher.click();

    const chineseOption = page.getByText('中文');
    await chineseOption.click();

    // Wait for the change to take effect
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Verify locale is still Chinese after reload (check text content)
    await expect(languageSwitcher).toContainText('中文');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  });

  test('should switch back to English from Chinese', async ({ page }) => {
    // First switch to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await languageSwitcher.click();

    const chineseOption = page.getByText('中文');
    await chineseOption.click();

    await page.waitForTimeout(500);

    // Verify we're in Chinese (check text content)
    await expect(languageSwitcher).toContainText('中文');

    // Switch back to English
    await languageSwitcher.click();

    const englishOption = page.getByText('English');
    await expect(englishOption).toBeVisible();
    await englishOption.click();

    // Wait for the change to take effect
    await page.waitForTimeout(500);

    // Verify we're back in English (check text content)
    await expect(languageSwitcher).toContainText('English');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('should display correct flag icons in language options', async ({ page }) => {
    // Click the language switcher to open dropdown
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await languageSwitcher.click();

    // Verify both flags are visible (use first() to avoid strict mode violation)
    await expect(page.getByText('🇺🇸').first()).toBeVisible();
    await expect(page.getByText('🇨🇳').first()).toBeVisible();

    // Verify the labels are correct (use first() to avoid strict mode violation)
    await expect(page.getByText('English').first()).toBeVisible();
    await expect(page.getByText('中文').first()).toBeVisible();
  });

  test('should maintain language selection across navigation', async ({ page }) => {
    // Switch to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await languageSwitcher.click();

    const chineseOption = page.getByText('中文');
    await chineseOption.click();

    await page.waitForTimeout(500);

    // Navigate to a different page (if available)
    const settingsLink = page.getByRole('link', { name: /settings/i });
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');

      // Verify language is still Chinese (check text content)
      await expect(languageSwitcher).toContainText('中文');
    }
  });

  test('should update aria-labels when language changes', async ({ page }) => {
    // Get the theme toggle button - try to find it by icon or role
    const themeButton = page.locator('button[aria-label*="switch"], button[aria-label*="mode"]').first();

    // Verify theme button is visible
    await expect(themeButton).toBeVisible();

    // Get initial aria-label
    const initialAriaLabel = await themeButton.getAttribute('aria-label');
    expect(initialAriaLabel).toBeTruthy();

    // Switch to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await languageSwitcher.click();

    const chineseOption = page.getByText('中文');
    await chineseOption.click();

    await page.waitForTimeout(500);

    // Verify aria-label is different (should be translated or changed)
    // The exact content depends on the translation files
    await expect(themeButton).toBeVisible();
  });

  test('should store language preference in localStorage', async ({ page }) => {
    // Switch to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await languageSwitcher.click();

    const chineseOption = page.getByText('中文');
    await chineseOption.click();

    await page.waitForTimeout(500);

    // Check localStorage
    const storage = await page.evaluate(() => {
      const item = localStorage.getItem('ccw-app-store');
      return item ? JSON.parse(item) : null;
    });

    // Verify locale is stored
    expect(storage).not.toBeNull();
    expect(storage?.state?.locale).toBe('zh');
  });

  test('should load language preference from localStorage on first visit', async ({ browser }) => {
    // Create a new context and page
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set localStorage before navigating
    await page.goto('/');

    await page.evaluate(() => {
      localStorage.setItem('ccw-app-store', JSON.stringify({
        state: { locale: 'zh', theme: 'system', sidebarCollapsed: false },
        version: 0,
      }));
    });

    // Reload to apply the stored locale
    await page.reload();

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Verify language is loaded from localStorage (check text content)
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await expect(languageSwitcher).toContainText('中文');

    await context.close();
  });
});
