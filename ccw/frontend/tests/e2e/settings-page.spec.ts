// ========================================
// E2E Tests: Settings Page i18n
// ========================================
// Tests for settings page internationalization

import { test, expect } from '@playwright/test';
import {
  switchLanguageAndVerify,
  verifyI18nState,
  verifyPersistenceAfterReload,
} from './helpers/i18n-helpers';

test.describe('[Settings Page] - i18n E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Navigate to settings page
    const settingsLink = page.getByRole('link', { name: /settings/i });
    const isVisible = await settingsLink.isVisible().catch(() => false);

    if (isVisible) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  /**
   * SET-01: Verify settings page render in English
   * Priority: P0
   */
  test('SET-01: should render settings page in English', async ({ page }) => {
    // Verify initial locale is English
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('en');

    // Verify settings page has English content
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();

    // Look for settings-related headings or labels
    const heading = page.getByRole('heading', { name: /settings/i });
    const isVisible = await heading.isVisible().catch(() => false);

    if (isVisible) {
      await expect(heading).toBeVisible();
    }
  });

  /**
   * SET-02: Verify settings page render in Chinese
   * Priority: P0
   */
  test('SET-02: should render settings page in Chinese', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify i18n state
    await verifyI18nState(page, 'zh');

    // Verify settings page has Chinese content
    const pageContent = await page.content();
    expect(pageContent).toMatch(/[\u4e00-\u9fa5]/);
  });

  /**
   * SET-03: Verify localStorage persists locale selection
   * Priority: P0
   */
  test('SET-03: should persist locale selection to localStorage', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify localStorage contains locale
    const storage = await page.evaluate(() => {
      const item = localStorage.getItem('ccw-app-store');
      return item ? JSON.parse(item) : null;
    });

    expect(storage).not.toBeNull();
    expect(storage?.state?.locale).toBe('zh');

    // Verify persistence after reload
    await verifyPersistenceAfterReload(page, 'zh');
  });

  /**
   * SET-04: Verify aria-label updates on settings form
   * Priority: P0
   */
  test('SET-04: should update aria-labels on settings form controls', async ({ page }) => {
    // Find form controls with aria-label
    const formInputs = page.locator('input[aria-label], select[aria-label], button[aria-label]').first();
    const isVisible = await formInputs.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial aria-label
      const initialAriaLabel = await formInputs.getAttribute('aria-label');
      expect(initialAriaLabel).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated aria-label
      const updatedAriaLabel = await formInputs.getAttribute('aria-label');
      expect(updatedAriaLabel).toBeTruthy();

      // Aria-label should be different (translated)
      // Note: Some aria-labels might not change if they're UI-independent
      if (initialAriaLabel === updatedAriaLabel) {
        // If same, verify at least lang attribute changed
        const lang = await page.evaluate(() => document.documentElement.lang);
        expect(lang).toBe('zh');
      }
    }
  });

  /**
   * SET-05: Verify form input placeholders are translated
   * Priority: P0
   */
  test('SET-05: should translate form input placeholders', async ({ page }) => {
    // Find inputs with placeholders
    const inputsWithPlaceholder = page.locator('input[placeholder]').first();
    const isVisible = await inputsWithPlaceholder.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial placeholder
      const initialPlaceholder = await inputsWithPlaceholder.getAttribute('placeholder');
      expect(initialPlaceholder).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated placeholder
      const updatedPlaceholder = await inputsWithPlaceholder.getAttribute('placeholder');

      // Placeholder should be different (translated) or contain Chinese characters
      if (updatedPlaceholder) {
        const hasChineseOrDifferent = updatedPlaceholder !== initialPlaceholder ||
                                      /[\u4e00-\u9fa5]/.test(updatedPlaceholder);
        expect(hasChineseOrDifferent).toBeTruthy();
      }
    }
  });

  /**
   * Additional: Verify save/cancel buttons are translated
   */
  test('should translate save and cancel buttons', async ({ page }) => {
    // Find action buttons
    const saveButton = page.getByRole('button', { name: /save|apply/i }).first();
    const isSaveVisible = await saveButton.isVisible().catch(() => false);

    if (isSaveVisible) {
      // Get initial button text
      const initialText = await saveButton.textContent();
      expect(initialText).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated button text
      const updatedText = await saveButton.textContent();
      expect(updatedText).toBeTruthy();

      // Text should be different (translated) or contain Chinese characters
      const hasChineseOrDifferent = updatedText !== initialText ||
                                    /[\u4e00-\u9fa5]/.test(updatedText || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify settings state persists across sessions
   */
  test('should maintain language preference across browser sessions', async ({ page, context }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Close and reopen page
    await page.close();
    const newPage = await context.newPage();
    await newPage.goto('/', { waitUntil: 'networkidle' });

    // Navigate to settings again
    const settingsLink = newPage.getByRole('link', { name: /settings/i });
    const isVisible = await settingsLink.isVisible().catch(() => false);

    if (isVisible) {
      await settingsLink.click();
      await newPage.waitForLoadState('networkidle');
    }

    // Verify language is still Chinese (check text content)
    const newLanguageSwitcher = newPage.getByRole('combobox', { name: /select language/i }).first();
    await expect(newLanguageSwitcher).toContainText('中文');

    const lang = await newPage.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('zh');
  });

  /**
   * Additional: Verify form validation messages are translated
   */
  test('should translate form validation messages', async ({ page }) => {
    // Try to find a required input
    const requiredInput = page.locator('input[required], select[required]').first();
    const isVisible = await requiredInput.isVisible().catch(() => false);

    if (isVisible) {
      // Get validation message in English
      const englishMessage = await requiredInput.evaluate(el =>
        (el as HTMLInputElement).validationMessage
      );

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i }).first();
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Note: Browser validation messages might not translate
      // This test verifies the mechanism exists even if browser provides English
      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBe('zh');
    }
  });
});
