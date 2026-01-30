// ========================================
// E2E Tests: Sessions Page i18n
// ========================================
// Tests for sessions page internationalization

import { test, expect } from '@playwright/test';
import {
  switchLanguageAndVerify,
  verifyI18nState,
} from './helpers/i18n-helpers';

test.describe('[Sessions Page] - i18n E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Navigate to sessions page
    const sessionsLink = page.getByRole('link', { name: /sessions|history/i });
    const isVisible = await sessionsLink.isVisible().catch(() => false);

    if (isVisible) {
      await sessionsLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  /**
   * SES-01: Verify sessions list headers are translated
   * Priority: P1
   */
  test('SES-01: should translate sessions list headers', async ({ page }) => {
    // Look for table headers or list headers
    const headers = page.locator('table th, thead th, [role="columnheader"]');
    const count = await headers.count();

    if (count > 0) {
      // Get initial header text
      const initialHeader = await headers.first().textContent();
      expect(initialHeader).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify i18n state
      await verifyI18nState(page, 'zh');

      // Get updated header
      const updatedHeader = await headers.first().textContent();
      expect(updatedHeader).toBeTruthy();

      // Header should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedHeader !== initialHeader ||
                                    /[\u4e00-\u9fa5]/.test(updatedHeader || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * SES-02: Verify session status badges are translated
   * Priority: P2
   */
  test('SES-02: should translate session status badges', async ({ page }) => {
    // Look for status badges
    const statusBadges = page.locator('[class*="status"], [class*="badge"], span[title*="status"]');
    const count = await statusBadges.count();

    if (count > 0) {
      // Get initial status text
      const initialStatus = await statusBadges.first().textContent();
      expect(initialStatus).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated status
      const updatedStatus = await statusBadges.first().textContent();
      expect(updatedStatus).toBeTruthy();

      // Status should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedStatus !== initialStatus ||
                                    /[\u4e00-\u9fa5]/.test(updatedStatus || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * SES-03: Verify date/time formatting per locale
   * Priority: P2
   */
  test('SES-03: should format date/time according to locale', async ({ page }) => {
    // Look for date/time elements
    const dateElements = page.locator('time, [datetime], [class*="date"], [class*="time"]');
    const count = await dateElements.count();

    if (count > 0) {
      // Get initial date
      const initialDate = await dateElements.first().textContent();
      expect(initialDate).toBeTruthy();
      expect(initialDate?.length).toBeGreaterThan(0);

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated date
      const updatedDate = await dateElements.first().textContent();
      expect(updatedDate).toBeTruthy();

      // Date should be present (formatting may differ by locale)
      expect(updatedDate?.length).toBeGreaterThan(0);

      // Verify lang attribute is correct
      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBe('zh');
    }
  });

  /**
   * SES-04: Verify session detail view translated
   * Priority: P1
   */
  test('SES-04: should translate session detail view', async ({ page }) => {
    // Look for session detail links
    const detailLink = page.locator('a').filter({ hasText: /view|details|#/i }).first();
    const isVisible = await detailLink.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial page content
      const initialContent = await page.content();
      expect(initialContent).toBeTruthy();

      // Click detail link
      await detailLink.click();
      await page.waitForLoadState('networkidle');

      // Get detail page content
      const detailContent = await page.content();
      expect(detailContent).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify i18n state
      await verifyI18nState(page, 'zh');

      // Get updated detail content
      const updatedContent = await page.content();

      // Content should contain Chinese characters
      expect(updatedContent).toMatch(/[\u4e00-\u9fa5]/);
    }
  });

  /**
   * Additional: Verify action buttons are translated
   */
  test('should translate session action buttons', async ({ page }) => {
    // Look for action buttons
    const actionButtons = page.locator('button').filter({
      hasText: /^(resume|delete|export|view|continue)/i
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
   * Additional: Verify session type/category labels are translated
   */
  test('should translate session type labels', async ({ page }) => {
    // Look for type/category labels
    const typeLabels = page.locator('[class*="type"], [class*="category"], span[title*="type"]');
    const count = await typeLabels.count();

    if (count > 0) {
      // Get initial label text
      const initialLabel = await typeLabels.first().textContent();
      expect(initialLabel).toBeTruthy();

      // Switch to Chinese
      const languageSwitcher = page.getByRole('combobox', { name: /select language/i });
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Get updated label
      const updatedLabel = await typeLabels.first().textContent();
      expect(updatedLabel).toBeTruthy();

      // Label should contain Chinese characters or be different
      const hasChineseOrDifferent = updatedLabel !== initialLabel ||
                                    /[\u4e00-\u9fa5]/.test(updatedLabel || '');
      expect(hasChineseOrDifferent).toBeTruthy();
    }
  });

  /**
   * Additional: Verify empty state is translated
   */
  test('should translate empty state message', async ({ page }) => {
    // Look for empty state
    const emptyState = page.getByText(/no sessions|empty|no history/i);
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
   * Additional: Verify pagination controls are translated
   */
  test('should translate pagination controls', async ({ page }) => {
    // Look for pagination
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
   * Additional: Verify language persists when viewing session details
   */
  test('should maintain language when navigating session history', async ({ page }) => {
    const languageSwitcher = page.getByRole('combobox', { name: /select language/i });

    // Switch to Chinese
    await switchLanguageAndVerify(page, 'zh', languageSwitcher);

    // Try to navigate (simulate session navigation)
    const navLinks = await page.locator('a').count();
    if (navLinks > 0) {
      const firstLink = page.locator('a').first();
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      // Verify language is maintained
      await verifyI18nState(page, 'zh');

      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBe('zh');
    }
  });
});
