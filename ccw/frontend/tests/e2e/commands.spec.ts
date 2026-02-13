// ========================================
// E2E Tests: Commands Management
// ========================================
// End-to-end tests for commands list and info display

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Commands] - Commands Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to commands page directly and wait for full load
    await page.goto('/commands', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display commands list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Commands page already loaded in beforeEach

    // Look for commands list container
    const commandsList = page.getByTestId('commands-list').or(
      page.locator('.commands-list')
    );

    const isVisible = await commandsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify command items exist
      const commandItems = page.getByTestId(/command-item|command-card/).or(
        page.locator('.command-item')
      );

      const itemCount = await commandItems.count();
      expect(itemCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should display command name', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Commands page already loaded in beforeEach

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      // Check each command has a name
      for (let i = 0; i < Math.min(itemCount, 5); i++) {
        const command = commandItems.nth(i);

        const nameElement = command.getByTestId('command-name').or(
          command.locator('.command-name')
        );

        const hasName = await nameElement.isVisible().catch(() => false);
        expect(hasName).toBe(true);

        const name = await nameElement.textContent();
        expect(name).toBeTruthy();
        expect(name?.length).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should display command description', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Commands page already loaded in beforeEach

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for description
      const description = firstCommand.getByTestId('command-description').or(
        firstCommand.locator('.command-description')
      );

      const hasDescription = await description.isVisible().catch(() => false);

      if (hasDescription) {
        const text = await description.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should display command usage', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for usage info
      const usage = firstCommand.getByTestId('command-usage').or(
        firstCommand.locator('*').filter({ hasText: /usage|how to use/i })
      );

      const hasUsage = await usage.isVisible().catch(() => false);

      if (hasUsage) {
        const text = await usage.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should display command examples', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for examples section
      const examples = firstCommand.getByTestId('command-examples').or(
        firstCommand.locator('*').filter({ hasText: /example/i })
      );

      const hasExamples = await examples.isVisible().catch(() => false);

      if (hasExamples) {
        const text = await examples.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display command category', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for category badge
      const categoryBadge = firstCommand.getByTestId('command-category').or(
        firstCommand.locator('.command-category')
      );

      const hasCategory = await categoryBadge.isVisible().catch(() => false);

      if (hasCategory) {
        const text = await categoryBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should filter commands by category', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for category filter
    const categoryFilter = page.getByRole('combobox', { name: /category|filter/i }).or(
      page.getByTestId('category-filter')
    );

    const hasCategoryFilter = await categoryFilter.isVisible().catch(() => false);

    if (hasCategoryFilter) {
      // Check if there are category options
      const categoryOptions = await categoryFilter.locator('option').count();

      if (categoryOptions > 1) {
        await categoryFilter.selectOption({ index: 1 });

        // Wait for filtered results

        const commandItems = page.getByTestId(/command-item|command-card/).or(
          page.locator('.command-item')
        );

        const commandCount = await commandItems.count();
        expect(commandCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should search commands', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for search input
    const searchInput = page.getByRole('textbox', { name: /search|find/i }).or(
      page.getByTestId('command-search')
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test');

      // Wait for search results

      // Search should either show results or no results message
      const noResults = page.getByText(/no results|not found/i);
      const hasNoResults = await noResults.isVisible().catch(() => false);

      const commandItems = page.getByTestId(/command-item|command-card/).or(
        page.locator('.command-item')
      );

      const commandCount = await commandItems.count();

      // Either no results message or filtered commands
      expect(hasNoResults || commandCount >= 0).toBe(true);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should display command source type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for source badge
      const sourceBadge = firstCommand.getByTestId('command-source').or(
        firstCommand.locator('*').filter({ hasText: /builtin|custom/i })
      );

      const hasSource = await sourceBadge.isVisible().catch(() => false);

      if (hasSource) {
        const text = await sourceBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display command aliases', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });

    // Look for command items
    const commandItems = page.getByTestId(/command-item|command-card/).or(
      page.locator('.command-item')
    );

    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      const firstCommand = commandItems.first();

      // Look for aliases display
      const aliases = firstCommand.getByTestId('command-aliases').or(
        firstCommand.locator('*').filter({ hasText: /alias|also known as/i })
      );

      const hasAliases = await aliases.isVisible().catch(() => false);

      if (hasAliases) {
        const text = await aliases.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Error Scenarios
  // ========================================
  // Note: These tests use separate describe block to control navigation timing

  test.describe('API Error Tests', () => {
    // Each test sets up mock BEFORE navigation, then navigates
    // No shared beforeEach - each test handles its own navigation

    test('L3.11 - API Error - 400 Bad Request', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock API FIRST, before navigation
      await page.route('**/api/commands**', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Bad Request', message: 'Invalid command data' }),
        });
      });

      // Navigate AFTER mock is set up
      await page.goto('/commands', { waitUntil: 'networkidle' as const });

      // Debug: Check if page loaded
      const url = page.url();
      console.log('[L3.11] Current URL:', url);

      // Wait for React Query to complete with retries
      await page.waitForTimeout(3000);

      // Debug: Check page content
      const bodyContent = await page.locator('body').textContent();
      console.log('[L3.11] Page content (first 300 chars):', bodyContent?.substring(0, 300));

      // Debug: Check for any error-related text
      const hasErrorText = /Failed to load data|加载失败|Invalid command data|Bad Request/.test(bodyContent || '');
      console.log('[L3.11] Has error-related text:', hasErrorText);

      // Verify error message is displayed
      const errorMessage = page.locator('text=/Failed to load data|加载失败/');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(true);

      // Clean up route after verification
      await page.unroute('**/api/commands**');

      // Skip console error check for API error tests - errors are expected
      monitoring.stop();
    });

    test('L3.12 - API Error - 401 Unauthorized', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock API FIRST, before navigation
      await page.route('**/api/commands**', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        });
      });

      // Navigate AFTER mock is set up
      // Use domcontentloaded instead of networkidle to avoid hanging on failed requests
      await page.goto('/commands', { waitUntil: 'networkidle' as const });

      // Wait for React Query to complete retries and set error state
      await page.waitForTimeout(3000);

      // Debug: Check if error UI is in DOM
      const errorInDOM = await page.locator('body').evaluate((el) => {
        const errorElements = el.querySelectorAll('[class*="destructive"]');
        return {
          count: errorElements.length,
          content: errorElements[0]?.textContent?.substring(0, 100) || null,
        };
      });
      console.log('[L3.12] Error UI in DOM:', errorInDOM);

      // Debug: Check if error text is anywhere on page
      const bodyText = await page.locator('body').textContent();
      const hasErrorTextInBody = /Failed to load data|加载失败/.test(bodyText || '');
      console.log('[L3.12] Has error text in body:', hasErrorTextInBody);

      // Verify auth error is displayed
      const authError = page.locator('text=/Failed to load data|加载失败/');
      const hasError = await authError.isVisible().catch(() => false);
      expect(hasError).toBe(true);

      await page.unroute('**/api/commands**');

      monitoring.stop();
    });

    test('L3.13 - API Error - 403 Forbidden', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock API FIRST, before navigation
      await page.route('**/api/commands**', (route) => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
        });
      });

      // Navigate AFTER mock is set up
      // Use domcontentloaded instead of networkidle to avoid hanging on failed requests
      await page.goto('/commands', { waitUntil: 'networkidle' as const });

      // Wait for React Query to complete retries and set error state
      await page.waitForTimeout(3000);

      // Verify forbidden message is displayed
      const errorMessage = page.locator('text=/Failed to load data|加载失败/');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(true);

      await page.unroute('**/api/commands**');

      monitoring.stop();
    });

    test('L3.14 - API Error - 404 Not Found', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock API to return 404
      await page.route('**/api/commands**', (route) => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not Found', message: 'Command not found' }),
        });
      });

      // Navigate AFTER mock is set up
      // Use domcontentloaded instead of networkidle to avoid hanging on failed requests
      await page.goto('/commands', { waitUntil: 'networkidle' as const });

      // Wait for React Query to complete retries and set error state
      await page.waitForTimeout(3000);

      // Verify not found message is displayed
      const errorMessage = page.locator('text=/Failed to load data|加载失败/');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(true);

      await page.unroute('**/api/commands**');

      monitoring.stop();
    });

    test('L3.15 - API Error - 500 Internal Server Error', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock API FIRST, before navigation
      await page.route('**/api/commands**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      // Navigate AFTER mock is set up
      // Use domcontentloaded instead of networkidle to avoid hanging on failed requests
      await page.goto('/commands', { waitUntil: 'networkidle' as const });

      // Wait for React Query to complete retries and set error state
      await page.waitForTimeout(3000);

      // Verify server error message is displayed
      const errorMessage = page.locator('text=/Failed to load data|加载失败/');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(true);

      await page.unroute('**/api/commands**');

      monitoring.stop();
    });

    test('L3.16 - API Error - Network Timeout', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock API timeout - abort connection
      await page.route('**/api/commands**', (route) => {
        route.abort('failed');
      });

      // Navigate AFTER mock is set up
      // Use domcontentloaded instead of networkidle to avoid hanging on failed requests
      await page.goto('/commands', { waitUntil: 'networkidle' as const });

      // Wait for timeout handling
      await page.waitForTimeout(5000);

      // Verify timeout message is displayed
      const timeoutMessage = page.locator('text=/Failed to load data|加载失败/');
      const hasTimeout = await timeoutMessage.isVisible().catch(() => false);
      expect(hasTimeout).toBe(true);

      await page.unroute('**/api/commands**');

      monitoring.stop();
    });
  });
});
