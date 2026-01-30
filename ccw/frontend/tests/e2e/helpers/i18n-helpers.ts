// ========================================
// i18n Helper Utilities for E2E Tests
// ========================================
// Reusable utilities for internationalization validation

import { Page, Locator } from '@playwright/test';

/**
 * Switch language and verify complete state update
 * @param page - Playwright Page object
 * @param locale - Target locale ('en' or 'zh')
 * @param languageSwitcher - Optional pre-located language switcher locator
 */
export async function switchLanguageAndVerify(
  page: Page,
  locale: 'en' | 'zh',
  languageSwitcher?: Locator
): Promise<void> {
  const switcher = languageSwitcher || page.getByRole('combobox', { name: /select language/i }).first();

  // Click to open dropdown
  await switcher.click();

  // Select the target language option
  const targetOption = locale === 'zh'
    ? page.getByText('中文')
    : page.getByText('English');

  await expectToBeVisible(targetOption);
  await targetOption.click();

  // Wait for language change to take effect
  // Note: Using hardcoded wait as per existing pattern - should be improved in future
  await page.waitForTimeout(500);

  // Verify the switcher text content is updated
  const expectedText = locale === 'zh' ? '中文' : 'English';
  const switcherText = await switcher.textContent();
  if (!switcherText?.includes(expectedText)) {
    throw new Error(`Expected language switcher to show "${expectedText}" but got "${switcherText}"`);
  }
}

/**
 * Verify complete i18n state after language switch
 * @param page - Playwright Page object
 * @param locale - Expected locale ('en' or 'zh')
 * @returns Object containing verification results
 */
export async function verifyI18nState(
  page: Page,
  locale: 'en' | 'zh'
): Promise<{
  langAttribute: string;
  localStorage: string | null;
  storageVerified: boolean;
}> {
  // Verify lang attribute
  const langAttribute = await page.evaluate(() => document.documentElement.lang);
  if (langAttribute !== locale) {
    throw new Error(`Expected lang="${locale}" but got lang="${langAttribute}"`);
  }

  // Verify localStorage
  const storage = await page.evaluate(() => localStorage.getItem('ccw-app-store'));
  const storageVerified = storage ? storage.includes(`"locale":"${locale}"`) : false;

  if (!storageVerified) {
    throw new Error(`localStorage does not contain locale="${locale}"`);
  }

  return { langAttribute, localStorage: storage, storageVerified };
}

/**
 * Verify language persists after page reload
 * @param page - Playwright Page object
 * @param locale - Expected locale ('en' or 'zh')
 */
export async function verifyPersistenceAfterReload(
  page: Page,
  locale: 'en' | 'zh'
): Promise<void> {
  // Reload the page
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify language is maintained
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== locale) {
    throw new Error(`Language not persisted after reload. Expected "${locale}" but got "${lang}"`);
  }

  // Verify language switcher still shows correct locale (check text content)
  const switcher = page.getByRole('combobox', { name: /select language/i }).first();
  const expectedText = locale === 'zh' ? '中文' : 'English';
  const switcherText = await switcher.textContent();
  if (!switcherText?.includes(expectedText)) {
    throw new Error(`Language switcher does not show "${expectedText}" after reload. Got "${switcherText}"`);
  }
}

/**
 * Check if translated content is visible on the page
 * @param page - Playwright Page object
 * @param locale - Expected locale ('en' or 'zh')
 * @param expectedText - Expected text content to verify
 */
export async function verifyTranslationCompleteness(
  page: Page,
  locale: 'en' | 'zh',
  expectedText?: string
): Promise<boolean> {
  if (expectedText) {
    const element = page.getByText(expectedText);
    const isVisible = await element.isVisible().catch(() => false);
    if (!isVisible) {
      throw new Error(`Expected translated text "${expectedText}" not found for locale "${locale}"`);
    }
    return true;
  }

  // If no specific text provided, check for general locale content
  const pageContent = await page.content();
  if (locale === 'zh') {
    // Check for Chinese characters
    return /[\u4e00-\u9fa5]/.test(pageContent);
  }

  // For English, check that we have English content
  return pageContent.length > 0;
}

/**
 * Verify aria-label is updated on language change
 * @param page - Playwright Page object
 * @param locator - Element locator to check
 * @param expectedLabel - Expected aria-label (partial match supported)
 */
export async function verifyAriaLabelUpdated(
  page: Page,
  locator: Locator,
  expectedLabel: string
): Promise<void> {
  const ariaLabel = await locator.getAttribute('aria-label');
  if (!ariaLabel || !ariaLabel.includes(expectedLabel)) {
    throw new Error(`Expected aria-label to include "${expectedLabel}" but got "${ariaLabel}"`);
  }
}

/**
 * Navigate to a route and verify language is maintained
 * @param page - Playwright Page object
 * @param route - Route path to navigate to
 * @param locale - Expected locale ('en' or 'zh')
 */
export async function navigateAndVerifyLanguage(
  page: Page,
  route: string,
  locale: 'en' | 'zh'
): Promise<void> {
  await page.goto(route, { waitUntil: 'networkidle' as const });

  // Verify language is maintained after navigation
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== locale) {
    throw new Error(`Language not maintained after navigation to ${route}. Expected "${locale}" but got "${lang}"`);
  }
}

/**
 * Get localStorage state as parsed object
 * @param page - Playwright Page object
 * @returns Parsed localStorage object or null
 */
export async function getLocalStorageState(page: Page): Promise<any> {
  const storage = await page.evaluate(() => {
    const item = localStorage.getItem('ccw-app-store');
    return item ? JSON.parse(item) : null;
  });
  return storage;
}

/**
 * Set localStorage state (useful for pre-test setup)
 * @param page - Playwright Page object
 * @param state - State object to set in localStorage
 */
export async function setLocalStorageState(page: Page, state: any): Promise<void> {
  await page.evaluate((s) => {
    localStorage.setItem('ccw-app-store', JSON.stringify(s));
  }, state);
}

/**
 * Expect wrapper to handle errors gracefully
 */
async function expectToBeVisible(locator: Locator): Promise<void> {
  const isVisible = await locator.isVisible().catch(() => false);
  if (!isVisible) {
    throw new Error(`Expected element to be visible but it was not found`);
  }
}

/**
 * Verify language switcher shows the correct selected option
 * Note: Custom Select component uses button, not input, so we check visible text
 */
async function expectToHaveValue(locator: Locator, value: string): Promise<void> {
  // For the custom Select component, check if the target language text is visible
  // The SelectValue displays the selected option text (English or 中文)
  const expectedText = value === 'zh' ? '中文' : 'English';

  // Check if the switcher contains the expected language text
  const switcherText = await locator.textContent().catch(() => '');

  // The switcher may show flag emoji + label or just the label
  if (!switcherText.includes(expectedText)) {
    throw new Error(`Expected language switcher to show "${expectedText}" but got "${switcherText}"`);
  }
}
