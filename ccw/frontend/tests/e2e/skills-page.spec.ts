// ========================================
// E2E Tests: Skills Page i18n
// ========================================
// Tests for skills page internationalization

import { test, expect } from '@playwright/test';
import {
  switchLanguageAndVerify,
  verifyI18nState,
} from './helpers/i18n-helpers';

test.describe('[Skills Page] - i18n E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Navigate to skills page
    const skillsLink = page.getByRole('link', { name: /skills/i });
    const isVisible = await skillsLink.isVisible().catch(() => false);

    if (isVisible) {
      await skillsLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  /**
   * SKL-01: Verify skills list headers are translated
   * Priority: P1
   */
  test('SKL-01: should translate skills list headers', async ({ page }) => {
    // Look for page headers
    const pageHeading = page.getByRole('heading', { level: 1 }).or(
      page.getByRole('heading', { level: 2 })
    ).first();

    const initialHeading = await pageHeading.textContent();
    expect(initialHeading).toBeTruthy();

    // Switch to Chinese
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Verify i18n state
    await verifyI18nState(page, 'zh');

    // Get updated heading
    const updatedHeading = await pageHeading.textContent();
    expect(updatedHeading).toBeTruthy();

    // Heading should contain Chinese characters or be different
    const hasChineseOrDifferent = updatedHeading !== initialHeading ||
                                  /[\u4e00-\u9fa5]/.test(updatedHeading || '');
    expect(hasChineseOrDifferent).toBeTruthy();
  });

  /**
   * SKL-02: Verify skill categories are translated
   * Priority: P1
   */
  test('SKL-02: should translate skill categories', async ({ page }) => {
    // Look for category labels or sections
    const categoryElements = page.locator('[class*="category"], h3, h4').filter({ hasText: /.+/ });
    const count = await categoryElements.count();

    if (count > 0) {
      // Get initial category text
      const initialCategory = await categoryElements.first().textContent();
      expect(initialCategory).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated category text
      const updatedCategory = await categoryElements.first().textContent();
      expect(updatedCategory).toBeTruthy();

      // Category should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedCategory !== initialCategory ||
                                    /[\u4e00-\u9fa5]/.test(updatedCategory || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * SKL-03: Verify action buttons are translated
   * Priority: P1
   */
  test('SKL-03: should translate action buttons', async ({ page }) => {
    // Look for action buttons
    const actionButtons = page.locator('button').filter({
      hasText: /^(use|execute|run|create|edit|delete)/i
    });
    const count = await actionButtons.count();

    if (count > 0) {
      // Get first button text
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
   * SKL-04: Verify description text is translated
   * Priority: P1
   */
  test('SKL-04: should translate skill descriptions', async ({ page }) => {
    // Look for description elements
    const descriptions = page.locator('p, [class*="description"], [class*="detail"]');
    const count = await descriptions.count();

    if (count > 0) {
      // Get initial description text
      const initialDescription = await descriptions.first().textContent();
      expect(initialDescription).toBeTruthy();
      expect(initialDescription?.length).toBeGreaterThan(10);

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated description
      const updatedDescription = await descriptions.first().textContent();
      expect(updatedDescription).toBeTruthy();

      // Description should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedDescription !== initialDescription ||
                                    /[\u4e00-\u9fa5]/.test(updatedDescription || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify search/filter controls are translated
   */
  test('should translate search and filter controls', async ({ page }) => {
    // Look for search inputs
    const searchInput = page.getByPlaceholder(/search|filter/i).or(
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
   * Additional: Verify skill cards display translated content
   */
  test('should translate skill card content', async ({ page }) => {
    // Look for skill cards
    const skillCards = page.locator('[class*="card"], article').filter({ hasText: /.+/ });
    const count = await skillCards.count();

    if (count > 0) {
      // Get initial card content
      const initialContent = await skillCards.first().textContent();
      expect(initialContent).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated card content
      const updatedContent = await skillCards.first().textContent();
      expect(updatedContent).toBeTruthy();

      // Card content should contain Chinese characters or be different
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
    const emptyState = page.getByText(/no skills|empty|no data/i);
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
   * Additional: Verify modal/dialog content is translated
   */
  test('should translate modal content when viewing skill details', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i });

    // Switch to Chinese first
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Look for skill detail buttons
    const detailButton = page.getByRole('button', { name: /view|details|more/i }).first();
    const isVisible = await detailButton.isVisible().catch(() => false);

    if (isVisible) {
      await detailButton.click();
      await page.waitForTimeout(500);

      // Look for modal/dialog
      const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
      const modalVisible = await modal.isVisible().catch(() => false);

      if (modalVisible) {
        // Verify modal has Chinese content
        const modalContent = await modal.textContent();
        expect(modalContent).toMatch(/[\u4e00-\u9fa5]/);
      }
    }
  });
});
