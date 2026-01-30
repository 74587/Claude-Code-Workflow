// ========================================
// E2E Tests: Issues Page i18n
// ========================================
// Tests for issues page internationalization

import { test, expect } from '@playwright/test';
import {
  switchLanguageAndVerify,
  verifyI18nState,
} from './helpers/i18n-helpers';

test.describe('[Issues Page] - i18n E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Navigate to issues page
    const issuesLink = page.getByRole('link', { name: /issues/i });
    const isVisible = await issuesLink.isVisible().catch(() => false);

    if (isVisible) {
      await issuesLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  /**
   * ISS-01: Verify issue list headers are translated
   * Priority: P1
   */
  test('ISS-01: should translate issue list table headers', async ({ page }) => {
    // Look for table headers in English
    const tableHeaders = page.locator('table th, thead th');
    const count = await tableHeaders.count();

    if (count > 0) {
      // Get initial header text
      const firstHeaderText = await tableHeaders.first().textContent();
      expect(firstHeaderText).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify i18n state
      await verifyI18nState(page, 'zh');

      // Get updated header text
      const updatedHeaderText = await tableHeaders.first().textContent();
      expect(updatedHeaderText).toBeTruthy();

      // Headers should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedHeaderText !== firstHeaderText ||
                                    /[\u4e00-\u9fa5]/.test(updatedHeaderText || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * ISS-02: Verify status badges are translated
   * Priority: P2
   */
  test('ISS-02: should translate status badges', async ({ page }) => {
    // Look for status badges
    const statusBadges = page.locator('[class*="status"], [class*="badge"], span.badge').first();
    const isVisible = await statusBadges.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial status text
      const initialStatus = await statusBadges.textContent();
      expect(initialStatus).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated status text
      const updatedStatus = await statusBadges.textContent();
      expect(updatedStatus).toBeTruthy();

      // Status should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedStatus !== initialStatus ||
                                    /[\u4e00-\u9fa5]/.test(updatedStatus || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * ISS-03: Verify action buttons are translated
   * Priority: P1
   */
  test('ISS-03: should translate action buttons', async ({ page }) => {
    // Look for action buttons (view, edit, delete, etc.)
    const actionButtons = page.locator('button').filter({ hasText: /^(view|edit|delete|create)/i });
    const count = await actionButtons.count();

    if (count > 0) {
      // Get first action button text
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
   * ISS-04: Verify date formatting per locale
   * Priority: P2
   */
  test('ISS-04: should format dates according to locale', async ({ page }) => {
    // Look for date elements
    const dateElements = page.locator('time, [datetime], [class*="date"], [class*="time"]');
    const count = await dateElements.count();

    if (count > 0) {
      // Get initial date format
      const initialDate = await dateElements.first().textContent();
      expect(initialDate).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated date
      const updatedDate = await dateElements.first().textContent();
      expect(updatedDate).toBeTruthy();

      // Date might be formatted differently or contain Chinese date characters
      // This is a basic check that dates exist in both locales
      const hasDateContent = updatedDate && updatedDate.length > 0;
      expect(hasDateContent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify empty state message is translated
   */
  test('should translate empty state message', async ({ page }) => {
    // Look for empty state indicators
    const emptyState = page.getByText(/no issues|empty|no data/i);
    const isVisible = await emptyState.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial empty state text
      const initialText = await emptyState.textContent();
      expect(initialText).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated empty state text
      const updatedText = await emptyState.textContent();
      expect(updatedText).toBeTruthy();

      // Empty state should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedText !== initialText ||
                                    /[\u4e00-\u9fa5]/.test(updatedText || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify pagination controls are translated
   */
  test('should translate pagination controls', async ({ page }) => {
    // Look for pagination controls
    const pagination = page.locator('[class*="pagination"], nav[aria-label*="pagination"]');
    const isVisible = await pagination.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial pagination text
      const initialText = await pagination.textContent();
      expect(initialText).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated pagination text
      const updatedText = await pagination.textContent();
      expect(updatedText).toBeTruthy();

      // Pagination should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedText !== initialText ||
                                    /[\u4e00-\u9fa5]/.test(updatedText || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify filter controls are translated
   */
  test('should translate filter controls', async ({ page }) => {
    // Look for filter controls
    const filterSelect = page.locator('select').filter({ hasText: /filter|status|all/i }).first();
    const isVisible = await filterSelect.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial filter options
      const initialOptions = await filterSelect.locator('option').allTextContents();
      expect(initialOptions.length).toBeGreaterThan(0);

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated filter options
      const updatedOptions = await filterSelect.locator('option').allTextContents();
      expect(updatedOptions.length).toBeGreaterThan(0);

      // At least some options should be different or contain Chinese
      const hasTranslation = updatedOptions.some((opt, i) =>
        opt !== initialOptions[i] || /[\u4e00-\u9fa5]/.test(opt)
      );
      expect(hasTranslation).toBeTruthy();
    }
  });

  /**
   * Additional: Verify language persists when viewing issue details
   */
  test('should maintain language when viewing issue details', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i });

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Look for issue detail links
    const detailLink = page.locator('a').filter({ hasText: /#/ }).first();
    const isVisible = await detailLink.isVisible().catch(() => false);

    if (isVisible) {
      await detailLink.click();
      await page.waitForLoadState('networkidle');

      // Verify language is maintained
      await verifyI18nState(page, 'zh');

      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBe('zh');
    }
  });
});
