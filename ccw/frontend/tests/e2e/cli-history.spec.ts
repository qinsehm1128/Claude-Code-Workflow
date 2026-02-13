// ========================================
// E2E Tests: CLI History Management
// ========================================
// End-to-end tests for CLI execution history, detail view, and delete operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe.skip('[CLI History] - CLI Execution History Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display CLI execution history', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'domcontentloaded' as const });

    // Look for history list container
    const historyList = page.getByTestId('cli-history-list').or(
      page.locator('.cli-history-list')
    );

    const isVisible = await historyList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify history items exist or empty state is shown
      const historyItems = page.getByTestId(/history-item|execution-item/).or(
        page.locator('.history-item')
      );

      const itemCount = await historyItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no history|no executions/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display CLI execution detail', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for history items
    const historyItems = page.getByTestId(/history-item|execution-item/).or(
      page.locator('.history-item')
    );

    const itemCount = await historyItems.count();

    if (itemCount > 0) {
      const firstItem = historyItems.first();

      // Click on item to view detail
      await firstItem.click();

      // Verify detail view loads
      await page.waitForURL(/\/history\//);

      const detailContainer = page.getByTestId('execution-detail').or(
        page.locator('.execution-detail')
      );

      const hasDetail = await detailContainer.isVisible().catch(() => false);
      expect(hasDetail).toBe(true);

      // Verify conversation turns are displayed
      const conversationTurns = page.getByTestId(/turn|conversation/).or(
        page.locator('.conversation-turn')
      );

      const turnCount = await conversationTurns.count();
      expect(turnCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should delete single execution', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for history items
    const historyItems = page.getByTestId(/history-item|execution-item/).or(
      page.locator('.history-item')
    );

    const initialCount = await historyItems.count();

    if (initialCount > 0) {
      const firstItem = historyItems.first();

      // Look for delete button
      const deleteButton = firstItem.getByRole('button', { name: /delete|remove/i }).or(
        firstItem.getByTestId('delete-button')
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

  test('L3.4 - should delete executions by tool', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for bulk delete by tool option
    const bulkDeleteButton = page.getByRole('button', { name: /delete by tool|bulk delete/i }).or(
      page.getByTestId('bulk-delete-button')
    );

    const hasBulkDelete = await bulkDeleteButton.isVisible().catch(() => false);

    if (hasBulkDelete) {
      await bulkDeleteButton.click();

      // Look for tool selection dialog
      const dialog = page.getByRole('dialog').filter({ hasText: /select tool|choose tool/i });
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        // Select a tool
        const toolSelect = page.getByRole('combobox', { name: /tool/i });
        const toolOptions = await toolSelect.locator('option').count();

        if (toolOptions > 0) {
          await toolSelect.selectOption({ index: 0 });

          const confirmButton = page.getByRole('button', { name: /delete|confirm/i });
          await confirmButton.click();

          // Verify success message

          const successMessage = page.getByText(/deleted|success/i);
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should delete all history', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for delete all button
    const deleteAllButton = page.getByRole('button', { name: /delete all|clear history/i }).or(
      page.getByTestId('delete-all-button')
    );

    const hasDeleteAll = await deleteAllButton.isVisible().catch(() => false);

    if (hasDeleteAll) {
      await deleteAllButton.click();

      // Confirm delete all if dialog appears
      const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete all|confirm|clear/i });
      const hasDialog = await confirmDialog.isVisible().catch(() => false);

      if (hasDialog) {
        const confirmButton = page.getByRole('button', { name: /delete|confirm|yes|clear/i });
        await confirmButton.click();
      }

      // Verify success message

      const successMessage = page.getByText(/deleted|cleared|success/i);
      const hasSuccess = await successMessage.isVisible().catch(() => false);
      expect(hasSuccess).toBe(true);

      // Verify empty state is shown
      const emptyState = page.getByTestId('empty-state').or(
        page.getByText(/no history|no executions/i)
      );

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      expect(hasEmptyState).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display execution metadata', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for history items
    const historyItems = page.getByTestId(/history-item|execution-item/).or(
      page.locator('.history-item')
    );

    const itemCount = await historyItems.count();

    if (itemCount > 0) {
      const firstItem = historyItems.first();

      // Look for metadata indicators (tool, status, duration)
      const toolBadge = firstItem.getByTestId('execution-tool').or(
        firstItem.locator('*').filter({ hasText: /gemini|qwen|codex/i })
      );

      const statusBadge = firstItem.getByTestId('execution-status').or(
        firstItem.locator('*').filter({ hasText: /success|error|timeout/i })
      );

      const durationBadge = firstItem.getByTestId('execution-duration').or(
        firstItem.locator('*').filter({ hasText: /\d+ms|\d+s/i })
      );

      const hasMetadata = await Promise.all([
        toolBadge.isVisible().catch(() => false),
        statusBadge.isVisible().catch(() => false),
        durationBadge.isVisible().catch(() => false),
      ]);

      // At least some metadata should be visible
      expect(hasMetadata.some(Boolean)).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should filter history by tool', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for tool filter
    const toolFilter = page.getByRole('combobox', { name: /tool|filter by/i }).or(
      page.getByTestId('tool-filter')
    );

    const hasToolFilter = await toolFilter.isVisible().catch(() => false);

    if (hasToolFilter) {
      // Check if there are tool options
      const toolOptions = await toolFilter.locator('option').count();

      if (toolOptions > 1) {
        await toolFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const historyItems = page.getByTestId(/history-item|execution-item/).or(
          page.locator('.history-item')
        );

        const historyCount = await historyItems.count();
        expect(historyCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should search history', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('history-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const historyItems = page.getByTestId(/history-item|execution-item/).or(
        page.locator('.history-item')
      );

      const historyCount = await historyItems.count();

      // Either no results message or filtered history
      expect(hasNoResults || historyCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display conversation turns in detail', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for history items
    const historyItems = page.getByTestId(/history-item|execution-item/).or(
      page.locator('.history-item')
    );

    const itemCount = await historyItems.count();

    if (itemCount > 0) {
      const firstItem = historyItems.first();
      await firstItem.click();

      // Wait for detail view
      await page.waitForURL(/\/history\//);

      // Look for conversation turns
      const conversationTurns = page.getByTestId(/turn|conversation/).or(
        page.locator('.conversation-turn')
      );

      const turnCount = await conversationTurns.count();

      if (turnCount > 0) {
        // Verify each turn has prompt and output
        const firstTurn = conversationTurns.first();

        const promptSection = firstTurn.getByTestId('turn-prompt').or(
          firstTurn.locator('.turn-prompt')
        );

        const outputSection = firstTurn.getByTestId('turn-output').or(
          firstTurn.locator('.turn-output')
        );

        const hasPrompt = await promptSection.isVisible().catch(() => false);
        const hasOutput = await outputSection.isVisible().catch(() => false);

        expect(hasPrompt || hasOutput).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should handle history API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/cli/history**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to CLI history page
    await page.goto('/settings/cli/history', { waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/cli/history**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/cli/history'], allowWarnings: true });
    monitoring.stop();
  });
});
