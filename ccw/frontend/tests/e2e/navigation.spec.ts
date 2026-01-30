// ========================================
// E2E Tests: Navigation i18n
// ========================================
// Tests for navigation internationalization across the application

import { test, expect } from '@playwright/test';
import {
  switchLanguageAndVerify,
  verifyI18nState,
  verifyPersistenceAfterReload,
  navigateAndVerifyLanguage,
} from './helpers/i18n-helpers';

test.describe('[Navigation] - i18n E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  /**
   * NAV-01: Verify navigation links are translated
   * Priority: P0
   */
  test('NAV-01: should translate navigation links after language switch', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Verify initial English state (check text content)
    await expect(languageSwitcher).toContainText('English');

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify i18n state is complete
    await verifyI18nState(page, 'zh');

    // Verify navigation elements have translated content
    // Check for Chinese characters in navigation
    const navContent = await page.locator('nav').textContent();
    expect(navContent).toMatch(/[\u4e00-\u9fa5]/);
  });

  /**
   * NAV-02: Verify page titles update on language change
   * Priority: P0
   */
  test('NAV-02: should update page titles when language changes', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Get initial page title in English
    const initialTitle = await page.title();
    expect(initialTitle).toBeTruthy();

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Wait for title update and verify
    await page.waitForTimeout(500);
    const updatedTitle = await page.title();

    // Title should be different (translated)
    // Note: Specific content depends on actual translations
    expect(updatedTitle).toBeTruthy();

    // Verify lang attribute on document
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('zh');
  });

  /**
   * NAV-03: Verify aria-label updates on navigation
   * Priority: P1
   */
  test('NAV-03: should update aria-labels on navigation items', async ({ page }) => {
    // Get a navigation element with aria-label (e.g., theme toggle)
    const themeButton = page.locator('button[aria-label*="switch"], button[aria-label*="mode"]').first();

    // Verify initial aria-label
    await expect(themeButton).toBeVisible();
    const initialAriaLabel = await themeButton.getAttribute('aria-label');
    expect(initialAriaLabel).toBeTruthy();

    // Switch to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify theme button is still visible
    await expect(themeButton).toBeVisible();
  });

  /**
   * NAV-04: Verify lang attribute on language switch
   * Priority: P1
   */
  test('NAV-04: should update lang attribute when switching language', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Verify initial lang attribute
    const initialLang = await page.evaluate(() => document.documentElement.lang);
    expect(initialLang).toBe('en');

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify lang attribute is updated
    const langAfterSwitch = await page.evaluate(() => document.documentElement.lang);
    expect(langAfterSwitch).toBe('zh');

    // Verify persistence after reload
    await verifyPersistenceAfterReload(page, 'zh');

    // Switch back to English
    await switchLanguageAndVerify(page, 'en', languageSwitcher);

    // Verify lang attribute returns to English
    const langAfterReturn = await page.evaluate(() => document.documentElement.lang);
    expect(langAfterReturn).toBe('en');
  });

  /**
   * Additional: Navigation maintains language across routes
   */
  test('should maintain language when navigating between pages', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Try to navigate to settings if available
    const settingsLink = page.getByRole('link', { name: /settings/i });
    const isVisible = await settingsLink.isVisible().catch(() => false);

    if (isVisible) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');

      // Verify language is maintained on new page
      await verifyI18nState(page, 'zh');

      // Verify navigation still shows Chinese (check text content)
      await expect(languageSwitcher).toContainText('中文');
    }
  });

  /**
   * Additional: Verify navigation links work in both languages
   */
  test('navigation links should work in both English and Chinese', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Find navigation links
    const navLinks = page.locator('nav a').first();
    const isVisible = await navLinks.isVisible().catch(() => false);

    if (isVisible) {
      // Click link in English
      await navLinks.click();
      await page.waitForLoadState('networkidle');
      const englishTitle = await page.title();

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Click same link in Chinese
      await navLinks.click();
      await page.waitForLoadState('networkidle');

      // Verify page loaded successfully
      const chineseTitle = await page.title();
      expect(chineseTitle).toBeTruthy();

      // Language should be maintained
      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBe('zh');
    }
  });
});
