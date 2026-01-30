// ========================================
// E2E Tests: Memory Page i18n
// ========================================
// Tests for memory page internationalization

import { test, expect } from '@playwright/test';
import {
  switchLanguageAndVerify,
  verifyI18nState,
} from './helpers/i18n-helpers';

test.describe('[Memory Page] - i18n E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Navigate to memory page
    const memoryLink = page.getByRole('link', { name: /memory/i });
    const isVisible = await memoryLink.isVisible().catch(() => false);

    if (isVisible) {
      await memoryLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  /**
   * MEM-01: Verify memory page renders in English
   * Priority: P2
   */
  test('MEM-01: should render memory page in English', async ({ page }) => {
    // Verify initial locale is English
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('en');

    // Verify memory page has content
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();

    // Look for page heading
    const heading = page.getByRole('heading', { level: 1 }).or(
      page.getByRole('heading', { level: 2 })
    ).first();

    const isVisible = await heading.isVisible().catch(() => false);
    if (isVisible) {
      const headingText = await heading.textContent();
      expect(headingText).toBeTruthy();
    }
  });

  /**
   * MEM-02: Verify language switch works on memory page
   * Priority: P2
   */
  test('MEM-02: should switch language on memory page', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i });

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify i18n state
    await verifyI18nState(page, 'zh');

    // Verify memory page has Chinese content
    const pageContent = await page.content();
    expect(pageContent).toMatch(/[\u4e00-\u9fa5]/);

    // Switch back to English
    await switchLanguageAndVerify(page, 'en', languageSwitcher);

    // Verify back in English
    const englishContent = await page.content();
    expect(englishContent).toBeTruthy();

    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('en');
  });

  /**
   * Additional: Verify memory entries are displayed in selected language
   */
  test('should display memory entries in selected language', async ({ page }) => {
    // Look for memory entries or content sections
    const entries = page.locator('[class*="entry"], [class*="item"], [class*="memory"], article');
    const count = await entries.count();

    if (count > 0) {
      // Get initial entry content
      const initialContent = await entries.first().textContent();
      expect(initialContent).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated entry content
      const updatedContent = await entries.first().textContent();
      expect(updatedContent).toBeTruthy();

      // Content should be different or contain Chinese characters
      const hasChineseOrDifferent = updatedContent !== initialContent ||
                                    /[\u4e00-\u9fa5]/.test(updatedContent || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify empty state is translated
   */
  test('should translate empty state message', async ({ page }) => {
    // Look for empty state
    const emptyState = page.getByText(/no memory|empty|no data/i);
    const isVisible = await emptyState.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial text
      const initialText = await emptyState.textContent();
      expect(initialText).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated text
      const updatedText = await emptyState.textContent();
      expect(updatedText).toBeTruthy();

      // Should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedText !== initialText ||
                                    /[\u4e00-\u9fa5]/.test(updatedText || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify search/filter controls are translated
   */
  test('should translate search and filter controls', async ({ page }) => {
    // Look for search inputs
    const searchInput = page.getByPlaceholder(/search|filter|find/i).or(
      page.getByRole('searchbox')
    ).first();
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial placeholder
      const initialPlaceholder = await searchInput.getAttribute('placeholder');
      expect(initialPlaceholder).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated placeholder
      const updatedPlaceholder = await searchInput.getAttribute('placeholder');

      // Placeholder should be different or contain Chinese characters
      if (updatedPlaceholder) {
        const hasChineseOrDifferent = updatedPlaceholder !== initialPlaceholder ||
                                      /[\u4e00-\u9fa5]/.test(updatedPlaceholder);
        expect(hasChineseOrDifferent).toBeTruthy();
      }
    }
  });

  /**
   * Additional: Verify memory action buttons are translated
   */
  test('should translate memory action buttons', async ({ page }) => {
    // Look for action buttons
    const actionButtons = page.locator('button').filter({
      hasText: /^(add|create|delete|export|clear)/i
    });
    const count = await actionButtons.count();

    if (count > 0) {
      // Get initial button text
      const initialText = await actionButtons.first().textContent();
      expect(initialText).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated button text
      const updatedText = await actionButtons.first().textContent();
      expect(updatedText).toBeTruthy();

      // Button text should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedText !== initialText ||
                                    /[\u4e00-\u9fa5]/.test(updatedText || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify category tags are translated
   */
  test('should translate memory category tags', async ({ page }) => {
    // Look for category tags
    const categoryTags = page.locator('[class*="tag"], [class*="category"], [class*="label"]');
    const count = await categoryTags.count();

    if (count > 0) {
      // Get initial tag text
      const initialTag = await categoryTags.first().textContent();
      expect(initialTag).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated tag text
      const updatedTag = await categoryTags.first().textContent();
      expect(updatedTag).toBeTruthy();

      // Tag should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedTag !== initialTag ||
                                    /[\u4e00-\u9fa5]/.test(updatedTag || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Smoke test - Verify basic functionality
   */
  test('smoke test: memory page loads and responds to language change', async ({ page }) => {
    // Verify page loads
    await expect(page).toHaveURL(/.*memory.*/);

    // Verify language switcher is present
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
    await expect(languageSwitcher).toBeVisible();

    // Verify initial state
    const initialLang = await page.evaluate(() => document.documentElement.lang);
    expect(initialLang).toBe('en');

    // Switch language and verify
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify basic Chinese content exists
    const hasChineseContent = await page.evaluate(() =>
      /[\u4e00-\u9fa5]/.test(document.body.textContent || '')
    );
    expect(hasChineseContent).toBeTruthy();
  });
});
