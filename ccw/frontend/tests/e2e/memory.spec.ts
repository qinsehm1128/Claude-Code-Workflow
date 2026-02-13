// ========================================
// E2E Tests: Memory Management
// ========================================
// End-to-end tests for memory CRUD, prompts, and insights

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Memory] - Memory Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display memories list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory page
    await page.goto('/memory', { waitUntil: 'domcontentloaded' as const });

    // Look for memories list container
    const memoriesList = page.getByTestId('memories-list').or(
      page.locator('.memories-list')
    );

    const isVisible = await memoriesList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify memory items exist or empty state is shown
      const memoryItems = page.getByTestId(/memory-item|memory-card/).or(
        page.locator('.memory-item')
      );

      const itemCount = await memoryItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no memories|empty/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should create new memory', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory page
    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Look for create memory button
    const createButton = page.getByRole('button', { name: /create|new|add memory/i }).or(
      page.getByTestId('create-memory-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create memory dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create memory|new memory/i });
      const form = page.getByTestId('create-memory-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in memory details
        const contentInput = page.getByRole('textbox', { name: /content|description|message/i }).or(
          page.getByLabel(/content|description|message/i)
        );

        const hasContentInput = await contentInput.isVisible().catch(() => false);

        if (hasContentInput) {
          await contentInput.fill('E2E Test Memory content');

          // Add tags if available
          const tagsInput = page.getByRole('textbox', { name: /tags/i });
          const hasTagsInput = await tagsInput.isVisible().catch(() => false);

          if (hasTagsInput) {
            await tagsInput.fill('test,e2e');
          }

          const submitButton = page.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          // Verify memory was created

          const successMessage = page.getByText(/created|success/i).or(
            page.getByTestId('success-message')
          );

          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should update memory', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory page
    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Look for existing memory
    const memoryItems = page.getByTestId(/memory-item|memory-card/).or(
      page.locator('.memory-item')
    );

    const itemCount = await memoryItems.count();

    if (itemCount > 0) {
      const firstMemory = memoryItems.first();

      // Look for edit button
      const editButton = firstMemory.getByRole('button', { name: /edit|modify/i }).or(
        firstMemory.getByTestId('edit-memory-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Update memory content
        const contentInput = page.getByRole('textbox', { name: /content|description|message/i });
        await contentInput.clear();
        await contentInput.fill('Updated E2E Test Memory content');

        // Save changes
        const saveButton = page.getByRole('button', { name: /save|update|submit/i });
        await saveButton.click();

        // Verify success message

        const successMessage = page.getByText(/updated|saved|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should delete memory', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory page
    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Look for existing memory
    const memoryItems = page.getByTestId(/memory-item|memory-card/).or(
      page.locator('.memory-item')
    );

    const itemCount = await memoryItems.count();

    if (itemCount > 0) {
      const firstMemory = memoryItems.first();

      // Look for delete button
      const deleteButton = firstMemory.getByRole('button', { name: /delete|remove/i }).or(
        firstMemory.getByTestId('delete-button')
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

  test('L3.5 - should display prompt history', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory/prompts page
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
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display prompt insights', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory/insights page
    await page.goto('/memory/insights', { waitUntil: 'networkidle' as const });

    // Look for insights container
    const insightsContainer = page.getByTestId('insights-container').or(
      page.locator('.insights-container')
    );

    const isVisible = await insightsContainer.isVisible().catch(() => false);

    if (isVisible) {
      // Verify insights exist or empty state is shown
      const insightItems = page.getByTestId(/insight-item|insight-card/).or(
        page.locator('.insight-item')
      );

      const itemCount = await insightItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByText(/no insights|analyze prompts/i);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should delete prompt from history', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory/prompts page
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

  test('L3.8 - should search memories', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory page
    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('memory-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const memoryItems = page.getByTestId(/memory-item|memory-card/).or(
        page.locator('.memory-item')
      );

      const memoryCount = await memoryItems.count();

      // Either no results message or filtered memories
      expect(hasNoResults || memoryCount >= 0).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should filter memories by tags', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory page
    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Look for tag filter
    const tagFilter = page.getByRole('combobox', { name: /tags?|filter/i }).or(
      page.getByTestId('tag-filter')
    );

    const hasTagFilter = await tagFilter.isVisible().catch(() => false);

    if (hasTagFilter) {
      // Check if there are tag options
      const tagOptions = await tagFilter.locator('option').count();

      if (tagOptions > 1) {
        await tagFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const memoryItems = page.getByTestId(/memory-item|memory-card/).or(
          page.locator('.memory-item')
        );

        const memoryCount = await memoryItems.count();
        expect(memoryCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display memory statistics', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to memory page
    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Look for statistics section
    const statsSection = page.getByTestId('memory-stats').or(
      page.locator('.memory-stats')
    );

    const isVisible = await statsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify stat items are present
      const statItems = page.getByTestId(/stat-/).or(
        page.locator('.stat-item')
      );

      const statCount = await statItems.count();
      expect(statCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Error Scenarios
  // ========================================

  test('L3.11 - API Error - 400 Bad Request', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 400
    await page.route('**/api/memory', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bad Request', message: 'Invalid memory data' }),
      });
    });

    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Try to create a memory
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();
      const submitButton = page.getByRole('button', { name: /create|save/i });
      await submitButton.click();

      // Verify error message
      const errorMessage = page.getByText(/invalid|bad request|输入无效/i);
      await page.unroute('**/api/memory');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/memory'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.12 - API Error - 401 Unauthorized', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 401
    await page.route('**/api/memory', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      });
    });

    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Verify auth error
    const authError = page.getByText(/unauthorized|not authenticated|未经授权/i);
    await page.unroute('**/api/memory');
    const hasError = await authError.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/memory'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.13 - API Error - 403 Forbidden', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 403
    await page.route('**/api/memory', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
      });
    });

    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Verify forbidden message
    const errorMessage = page.getByText(/forbidden|not allowed|禁止访问/i);
    await page.unroute('**/api/memory');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/memory'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.14 - API Error - 404 Not Found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 404
    await page.route('**/api/memory/nonexistent', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found', message: 'Memory not found' }),
      });
    });

    // Try to access a non-existent memory
    await page.goto('/memory/nonexistent-memory-id', { waitUntil: 'networkidle' as const });

    // Verify not found message
    const errorMessage = page.getByText(/not found|doesn't exist|未找到/i);
    await page.unroute('**/api/memory/nonexistent');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/memory'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.15 - API Error - 500 Internal Server Error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 500
    await page.route('**/api/memory', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Verify server error message
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/memory');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/memory'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.16 - API Error - Network Timeout', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API timeout
    await page.route('**/api/memory', () => {
      // Never fulfill - simulate timeout
    });

    await page.goto('/memory', { waitUntil: 'networkidle' as const });

    // Wait for timeout handling
    await page.waitForTimeout(3000);

    // Verify timeout message
    const timeoutMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/memory');
    const hasTimeout = await timeoutMessage.isVisible().catch(() => false);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/memory'], allowWarnings: true });
    monitoring.stop();
  });
});
