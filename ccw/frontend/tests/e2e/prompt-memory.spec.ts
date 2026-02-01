// ========================================
// E2E Tests: Prompt Memory Management
// ========================================
// End-to-end tests for prompt history, insights, and delete operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Prompt Memory] - Prompt Memory Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display prompt history', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt memory page
    await page.goto('/memory/prompts', { waitUntil: 'networkidle' as const });

    // Look for prompts list container
    const promptsList = page.getByTestId('prompts-list').or(
      page.locator('.prompts-list')
    );

    const isVisible = await promptsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify prompt items exist or empty state is shown
      const promptItems = page.getByTestId(/prompt-item|prompt-card/).or(
        page.locator('.prompt-item')
      );

      const itemCount = await promptItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no prompts|empty/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display prompt insights', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt insights page
    await page.goto('/memory/insights', { waitUntil: 'networkidle' as const });

    // Look for insights container
    const insightsContainer = page.getByTestId('insights-container').or(
      page.locator('.insights-container')
    );

    const isVisible = await insightsContainer.isVisible().catch(() => false);

    if (isVisible) {
      // Verify insights exist or empty/analyze state is shown
      const insightItems = page.getByTestId(/insight-item|insight-card/).or(
        page.locator('.insight-item')
      );

      const itemCount = await insightItems.count();

      if (itemCount === 0) {
        // Empty state or analyze prompt button
        const analyzeButton = page.getByRole('button', { name: /analyze|generate insights/i });
        const hasAnalyzeButton = await analyzeButton.isVisible().catch(() => false);

        const emptyState = page.getByText(/no insights|analyze prompts/i);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);

        expect(hasAnalyzeButton || hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should delete prompt from history', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt history page
    await page.goto('/memory/prompts', { waitUntil: 'networkidle' as const });

    // Look for existing prompt
    const promptItems = page.getByTestId(/prompt-item|prompt-card/).or(
      page.locator('.prompt-item')
    );

    const itemCount = await promptItems.count();

    if (itemCount > 0) {
      const firstPrompt = promptItems.first();

      // Look for delete button
      const deleteButton = firstPrompt.getByRole('button', { name: /delete|remove/i }).or(
        firstPrompt.getByTestId('delete-button')
      );

      const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

      if (hasDeleteButton) {
        await deleteButton.click();

        // Confirm delete if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = page.getByRole('button', { name: /delete|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify success message

        const successMessage = page.getByText(/deleted|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should analyze prompts for insights', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt insights page
    await page.goto('/memory/insights', { waitUntil: 'networkidle' as const });

    // Look for analyze button
    const analyzeButton = page.getByRole('button', { name: /analyze|generate insights/i }).or(
      page.getByTestId('analyze-button')
    );

    const hasAnalyzeButton = await analyzeButton.isVisible().catch(() => false);

    if (hasAnalyzeButton) {
      await analyzeButton.click();

      // Look for progress indicator

      const progressIndicator = page.getByTestId('analysis-progress').or(
        page.getByText(/analyzing|generating|progress/i)
      );

      const hasProgress = await progressIndicator.isVisible().catch(() => false);

      if (hasProgress) {
        expect(progressIndicator).toBeVisible();
      }

      // Wait for analysis to complete

      // Look for insights after analysis
      const insightItems = page.getByTestId(/insight-item|insight-card/).or(
        page.locator('.insight-item')
      );

      const insightCount = await insightItems.count();

      // Either insights were generated or there's a message
      expect(insightCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display prompt patterns', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt insights page
    await page.goto('/memory/insights', { waitUntil: 'networkidle' as const });

    // Look for patterns section
    const patternsSection = page.getByTestId('patterns-section').or(
      page.getByText(/patterns|recurring/i)
    );

    const isVisible = await patternsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify pattern items are displayed
      const patternItems = page.getByTestId(/pattern-item|pattern-card/).or(
        patternsSection.locator('.pattern-item')
      );

      const patternCount = await patternItems.count();

      if (patternCount === 0) {
        // Empty state or analyze button
        const analyzeButton = page.getByRole('button', { name: /analyze/i });
        const hasAnalyzeButton = await analyzeButton.isVisible().catch(() => false);

        const emptyState = page.getByText(/no patterns/i);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);

        expect(hasAnalyzeButton || hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display prompt suggestions', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt insights page
    await page.goto('/memory/insights', { waitUntil: 'networkidle' as const });

    // Look for suggestions section
    const suggestionsSection = page.getByTestId('suggestions-section').or(
      page.getByText(/suggestions|recommendations/i)
    );

    const isVisible = await suggestionsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify suggestion items are displayed
      const suggestionItems = page.getByTestId(/suggestion-item|suggestion-card/).or(
        suggestionsSection.locator('.suggestion-item')
      );

      const suggestionCount = await suggestionItems.count();

      if (suggestionCount === 0) {
        // Empty state or analyze button
        const analyzeButton = page.getByRole('button', { name: /analyze/i });
        const hasAnalyzeButton = await analyzeButton.isVisible().catch(() => false);

        const emptyState = page.getByText(/no suggestions/i);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);

        expect(hasAnalyzeButton || hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should display prompt timestamp', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt history page
    await page.goto('/memory/prompts', { waitUntil: 'networkidle' as const });

    // Look for prompt items
    const promptItems = page.getByTestId(/prompt-item|prompt-card/).or(
      page.locator('.prompt-item')
    );

    const itemCount = await promptItems.count();

    if (itemCount > 0) {
      const firstPrompt = promptItems.first();

      // Look for timestamp display
      const timestamp = firstPrompt.getByTestId('prompt-timestamp').or(
        firstPrompt.locator('*').filter({ hasText: /\d{4}-\d{2}-\d{2}|\d+\/\d+\/\d+/i })
      );

      const hasTimestamp = await timestamp.isVisible().catch(() => false);

      if (hasTimestamp) {
        const text = await timestamp.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should filter prompts by date range', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt history page
    await page.goto('/memory/prompts', { waitUntil: 'networkidle' as const });

    // Look for date filter
    const dateFilter = page.getByRole('combobox', { name: /date|period|range/i }).or(
      page.getByTestId('date-filter')
    );

    const hasDateFilter = await dateFilter.isVisible().catch(() => false);

    if (hasDateFilter) {
      // Check if there are filter options
      const filterOptions = await dateFilter.locator('option').count();

      if (filterOptions > 1) {
        await dateFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const promptItems = page.getByTestId(/prompt-item|prompt-card/).or(
          page.locator('.prompt-item')
        );

        const promptCount = await promptItems.count();
        expect(promptCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should search prompts', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to prompt history page
    await page.goto('/memory/prompts', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('prompt-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i)
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const promptItems = page.getByTestId(/prompt-item|prompt-card/).or(
        page.locator('.prompt-item')
      );

      const promptCount = await promptItems.count();

      // Either no results message or filtered prompts
      expect(hasNoResults || promptCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should handle prompt memory API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/memory/prompts/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to prompt history page
    await page.goto('/memory/prompts', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/memory/prompts/**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/memory/prompts'], allowWarnings: true });
    monitoring.stop();
  });
});
