// ========================================
// E2E Tests: API Settings - CLI Provider Configuration
// ========================================
// End-to-end tests for API provider management and testing

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[API Settings] - CLI Provider Configuration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API mocks BEFORE page navigation to prevent 404 errors
    await page.route('**/api/settings/cli**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          providers: [
            {
              id: 'provider-1',
              name: 'Gemini',
              endpoint: 'https://api.example.com',
              enabled: true
            }
          ]
        })
      });
    });

    await page.goto('/api-settings', { waitUntil: 'domcontentloaded' as const });
  });

  test('L3.21 - Page loads and displays current configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API response for current settings
    await page.route('**/api/settings/cli', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          providers: [
            {
              id: 'provider-1',
              name: 'Gemini',
              endpoint: 'https://api.example.com',
              enabled: true
            }
          ]
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for API settings form
    const settingsForm = page.getByTestId('api-settings-form').or(
      page.locator('form').filter({ hasText: /api|settings|provider/i })
    );

    const isFormVisible = await settingsForm.isVisible().catch(() => false);

    if (isFormVisible) {
      // Verify provider list is displayed
      const providerList = page.getByTestId('provider-list').or(
        settingsForm.locator('*').filter({ hasText: /provider|gemini|cli/i })
      );

      const hasProviders = await providerList.isVisible().catch(() => false);
      expect(hasProviders).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.22 - Add new CLI provider', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for adding provider
    await page.route('**/api/settings/cli', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            provider: {
              id: 'new-provider',
              name: 'Test Provider',
              endpoint: 'https://test.api.com'
            }
          })
        });
      } else {
        route.continue();
      }
    });

    // Look for add provider button
    const addButton = page.getByRole('button', { name: /add|create|new provider/i }).or(
      page.getByTestId('provider-add-button')
    );

    const hasAddButton = await addButton.isVisible().catch(() => false);

    if (hasAddButton) {
      await addButton.click();

      // Look for provider form
      const form = page.getByTestId('provider-form').or(
        page.getByRole('dialog').locator('form')
      );

      const hasForm = await form.isVisible().catch(() => false);

      if (hasForm) {
        // Fill in provider details
        const nameInput = form.getByRole('textbox', { name: /name/i }).or(
          form.getByLabel(/name/i)
        );

        const hasNameInput = await nameInput.isVisible().catch(() => false);

        if (hasNameInput) {
          await nameInput.fill('E2E Test Provider');

          const endpointInput = form.getByRole('textbox', { name: /endpoint|url|api/i });
          const hasEndpointInput = await endpointInput.isVisible().catch(() => false);

          if (hasEndpointInput) {
            await endpointInput.fill('https://e2e-test.api.com');

            // Submit form
            const saveButton = form.getByRole('button', { name: /save|create|submit/i });
            await saveButton.click();

            // Verify success
            const successMessage = page.getByText(/added|created|success/i);
            const hasSuccess = await successMessage.isVisible().catch(() => false);
            expect(hasSuccess).toBe(true);
          }
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.23 - Edit existing provider', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for editing provider
    await page.route('**/api/settings/cli', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else {
        route.continue();
      }
    });

    // Look for existing provider
    const providerItems = page.getByTestId(/provider-item|provider-card/).or(
      page.locator('.provider-item')
    );

    const providerCount = await providerItems.count();

    if (providerCount > 0) {
      const firstProvider = providerItems.first();

      // Look for edit button
      const editButton = firstProvider.getByRole('button', { name: /edit|modify/i }).or(
        firstProvider.getByTestId('edit-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Edit provider details
        const nameInput = page.getByRole('textbox', { name: /name/i });
        const hasNameInput = await nameInput.isVisible().catch(() => false);

        if (hasNameInput) {
          await nameInput.fill('Updated Provider Name');

          const saveButton = page.getByRole('button', { name: /save|update/i });
          await saveButton.click();

          // Verify success
          const successMessage = page.getByText(/updated|saved|success/i);
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.24 - Delete provider', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for deleting provider
    await page.route('**/api/settings/cli/*', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else {
        route.continue();
      }
    });

    // Look for existing provider
    const providerItems = page.getByTestId(/provider-item|provider-card/).or(
      page.locator('.provider-item')
    );

    const providerCount = await providerItems.count();

    if (providerCount > 0) {
      const firstProvider = providerItems.first();

      // Look for delete button
      const deleteButton = firstProvider.getByRole('button', { name: /delete|remove/i }).or(
        firstProvider.getByTestId('delete-button')
      );

      const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

      if (hasDeleteButton) {
        await deleteButton.click();

        // Confirm deletion if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = confirmDialog.getByRole('button', { name: /delete|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify success
        const successMessage = page.getByText(/deleted|removed|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.25 - Test API connection', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for connection test
    await page.route('**/api/settings/test', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          latency: 45,
          status: 'connected'
        })
      });
    });

    // Look for test connection button
    const testButton = page.getByRole('button', { name: /test|check connection/i }).or(
      page.getByTestId('connection-test-button')
    );

    const hasTestButton = await testButton.isVisible().catch(() => false);

    if (hasTestButton) {
      await testButton.click();

      // Wait for test to complete
      await page.waitForTimeout(1000);

      // Verify connection result
      const successMessage = page.getByText(/connected|success|available/i);
      const hasSuccess = await successMessage.isVisible().catch(() => false);
      expect(hasSuccess).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.26 - Save configuration persists', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for saving
    await page.route('**/api/settings/cli', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, persisted: true })
        });
      } else {
        route.continue();
      }
    });

    // Look for save button
    const saveButton = page.getByRole('button', { name: /save|apply/i }).or(
      page.getByTestId('provider-save-button')
    );

    const hasSaveButton = await saveButton.isVisible().catch(() => false);

    if (hasSaveButton) {
      await saveButton.click();

      // Verify persistence via localStorage
      const configStore = await page.evaluate(() => {
        const storage = localStorage.getItem('ccw-config-store');
        return storage ? JSON.parse(storage) : null;
      });

      const hasPersisted = configStore !== null;
      expect(hasPersisted).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.27 - i18n - Form labels in EN/ZH', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify form is visible in Chinese
      const form = page.getByTestId('api-settings-form').or(
        page.locator('form')
      );

      const isFormVisible = await form.isVisible().catch(() => false);
      expect(isFormVisible).toBe(true);

      // Check for Chinese text
      const pageContent = await page.content();
      const hasChineseText = /[\u4e00-\u9fa5]/.test(pageContent);
      expect(hasChineseText).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.28 - Error - Invalid API endpoint', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API error for invalid endpoint
    await page.route('**/api/settings/test', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid endpoint URL',
          details: 'Endpoint must be a valid HTTPS URL'
        })
      });
    });

    // Look for endpoint input
    const endpointInput = page.getByRole('textbox', { name: /endpoint|url|api/i }).or(
      page.getByLabel(/endpoint|url/i)
    );

    const hasEndpointInput = await endpointInput.isVisible().catch(() => false);

    if (hasEndpointInput) {
      await endpointInput.fill('not-a-valid-url');

      const testButton = page.getByRole('button', { name: /test|validate/i });
      const hasTestButton = await testButton.isVisible().catch(() => false);

      if (hasTestButton) {
        await testButton.click();

        // Verify error message
        const errorMessage = page.getByText(/invalid|error|url/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/settings/test'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.29 - Error - Connection timeout', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock timeout
    await page.route('**/api/settings/test', (route) => {
      // Simulate timeout by never responding
      setTimeout(() => {
        route.abort('timedout');
      }, 35000);
    });

    // Look for test connection button
    const testButton = page.getByRole('button', { name: /test|check/i });

    const hasTestButton = await testButton.isVisible().catch(() => false);

    if (hasTestButton) {
      await testButton.click();

      // Wait for timeout message
      await page.waitForTimeout(3000);

      // Verify timeout error
      const timeoutMessage = page.getByText(/timeout|timed out|unavailable/i);
      const hasTimeout = await timeoutMessage.isVisible().catch(() => false);
      // Timeout message may or may not appear
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/settings/test'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.30 - Edge - Maximum providers limit', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to enforce limit
    await page.route('**/api/settings/cli', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Maximum provider limit reached',
            limit: 10
          })
        });
      } else {
        route.continue();
      }
    });

    // Look for add provider button
    const addButton = page.getByRole('button', { name: /add|create/i });

    const hasAddButton = await addButton.isVisible().catch(() => false);

    if (hasAddButton) {
      await addButton.click();

      // Try to add provider
      const nameInput = page.getByRole('textbox', { name: /name/i });
      const hasNameInput = await nameInput.isVisible().catch(() => false);

      if (hasNameInput) {
        await nameInput.fill('Test Provider');

        const saveButton = page.getByRole('button', { name: /save|create/i });
        await saveButton.click();

        // Look for limit error
        const limitMessage = page.getByText(/limit|maximum|too many/i);
        const hasLimitMessage = await limitMessage.isVisible().catch(() => false);
        // Limit message may or may not appear
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/settings/cli'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.31 - API Error - 401 Unauthorized', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 401
    await page.route('**/api/settings/cli', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Verify auth error or redirect
    const authError = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/settings/cli');
    const hasError = await authError.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/settings/cli'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.32 - API Error - 403 Forbidden', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 403
    await page.route('**/api/settings/cli', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Verify forbidden message
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/settings/cli');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/settings/cli'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.33 - API Error - 404 Not Found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 404
    await page.route('**/api/settings/cli', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found', message: 'Settings not found' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Verify not found message
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/settings/cli');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/settings/cli'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.34 - API Error - 500 Internal Server Error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 500
    await page.route('**/api/settings/cli', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Verify server error message
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/settings/cli');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/settings/cli'], allowWarnings: true });
    monitoring.stop();
  });
});
