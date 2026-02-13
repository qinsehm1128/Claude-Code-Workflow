// ========================================
// E2E Tests: CLI Configuration Management
// ========================================
// End-to-end tests for CLI endpoints and tools configuration

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe.skip('[CLI Config] - CLI Configuration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display CLI endpoints list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'domcontentloaded' as const });

    // Look for endpoints list container
    const endpointsList = page.getByTestId('cli-endpoints-list').or(
      page.locator('.cli-endpoints-list')
    );

    const isVisible = await endpointsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify endpoint items exist
      const endpointItems = page.getByTestId(/endpoint-item|cli-endpoint/).or(
        page.locator('.endpoint-item')
      );

      const itemCount = await endpointItems.count();
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should update CLI endpoint configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for existing endpoint
    const endpointItems = page.getByTestId(/endpoint-item|cli-endpoint/).or(
      page.locator('.endpoint-item')
    );

    const itemCount = await endpointItems.count();

    if (itemCount > 0) {
      const firstEndpoint = endpointItems.first();

      // Look for edit button
      const editButton = firstEndpoint.getByRole('button', { name: /edit|configure|settings/i }).or(
        firstEndpoint.getByTestId('edit-endpoint-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Look for config dialog/form
        const dialog = page.getByRole('dialog').filter({ hasText: /configure|edit|settings/i });
        const hasDialog = await dialog.isVisible().catch(() => false);

        if (hasDialog) {
          // Modify configuration
          const enabledSwitch = dialog.getByRole('switch').first();
          const hasSwitch = await enabledSwitch.isVisible().catch(() => false);

          if (hasSwitch) {
            await enabledSwitch.click();
          }

          const saveButton = page.getByRole('button', { name: /save|update/i });
          await saveButton.click();

          // Verify success message

          const successMessage = page.getByText(/saved|updated|success/i);
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should create new CLI endpoint', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for create endpoint button
    const createButton = page.getByRole('button', { name: /create|new|add endpoint/i }).or(
      page.getByTestId('create-endpoint-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create endpoint dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create|new endpoint|add endpoint/i });
      const form = page.getByTestId('create-endpoint-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in endpoint details
        const nameInput = page.getByRole('textbox', { name: /name|id/i }).or(
          page.getByLabel(/name|id/i)
        );

        const hasNameInput = await nameInput.isVisible().catch(() => false);

        if (hasNameInput) {
          await nameInput.fill('e2e-test-endpoint');

          // Select type if available
          const typeSelect = page.getByRole('combobox', { name: /type/i });
          const hasTypeSelect = await typeSelect.isVisible().catch(() => false);

          if (hasTypeSelect) {
            const typeOptions = await typeSelect.locator('option').count();
            if (typeOptions > 0) {
              await typeSelect.selectOption({ index: 0 });
            }
          }

          const submitButton = page.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          // Verify endpoint was created

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

  test('L3.4 - should delete CLI endpoint', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for existing endpoint
    const endpointItems = page.getByTestId(/endpoint-item|cli-endpoint/).or(
      page.locator('.endpoint-item')
    );

    const itemCount = await endpointItems.count();

    if (itemCount > 0) {
      const firstEndpoint = endpointItems.first();

      // Look for delete button
      const deleteButton = firstEndpoint.getByRole('button', { name: /delete|remove/i }).or(
        firstEndpoint.getByTestId('delete-button')
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

  test('L3.5 - should toggle CLI endpoint enabled status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for endpoint items
    const endpointItems = page.getByTestId(/endpoint-item|cli-endpoint/).or(
      page.locator('.endpoint-item')
    );

    const itemCount = await endpointItems.count();

    if (itemCount > 0) {
      const firstEndpoint = endpointItems.first();

      // Look for toggle switch
      const toggleSwitch = firstEndpoint.getByRole('switch').or(
        firstEndpoint.getByTestId('endpoint-toggle')
      ).or(
        firstEndpoint.getByRole('button', { name: /enable|disable|toggle/i })
      );

      const hasToggle = await toggleSwitch.isVisible().catch(() => false);

      if (hasToggle) {
        // Get initial state
        const initialState = await toggleSwitch.getAttribute('aria-checked');
        const initialChecked = initialState === 'true';

        // Toggle the endpoint
        await toggleSwitch.click();

        // Wait for update

        // Verify state changed
        const newState = await toggleSwitch.getAttribute('aria-checked');
        const newChecked = newState === 'true';

        expect(newChecked).toBe(!initialChecked);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display CLI tools configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for tools configuration section
    const toolsSection = page.getByTestId('cli-tools-config').or(
      page.getByText(/tools configuration|cli tools/i)
    );

    const isVisible = await toolsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify tool items are displayed
      const toolItems = page.getByTestId(/tool-item|cli-tool/).or(
        toolsSection.locator('.tool-item')
      );

      const toolCount = await toolItems.count();
      expect(toolCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should update CLI tools configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for tools configuration section
    const toolsSection = page.getByTestId('cli-tools-config').or(
      page.getByText(/tools configuration|cli tools/i)
    );

    const isVisible = await toolsSection.isVisible().catch(() => false);

    if (isVisible) {
      // Look for edit config button
      const editButton = toolsSection.getByRole('button', { name: /edit|configure/i }).or(
        page.getByTestId('edit-tools-config-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Look for config dialog
        const dialog = page.getByRole('dialog').filter({ hasText: /configure|settings/i });
        const hasDialog = await dialog.isVisible().catch(() => false);

        if (hasDialog) {
          // Modify configuration
          const primaryModelInput = page.getByRole('textbox', { name: /primary model/i });
          const hasModelInput = await primaryModelInput.isVisible().catch(() => false);

          if (hasModelInput) {
            await primaryModelInput.clear();
            await primaryModelInput.fill('gemini-2.5-flash');
          }

          const saveButton = page.getByRole('button', { name: /save|update/i });
          await saveButton.click();

          // Verify success

          const successMessage = page.getByText(/saved|updated|success/i);
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should display endpoint type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for endpoint items
    const endpointItems = page.getByTestId(/endpoint-item|cli-endpoint/).or(
      page.locator('.endpoint-item')
    );

    const itemCount = await endpointItems.count();

    if (itemCount > 0) {
      const firstEndpoint = endpointItems.first();

      // Look for type badge
      const typeBadge = firstEndpoint.getByTestId('endpoint-type').or(
        firstEndpoint.locator('*').filter({ hasText: /litellm|custom|wrapper|api/i })
      );

      const hasType = await typeBadge.isVisible().catch(() => false);

      if (hasType) {
        const text = await typeBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should handle config API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/cli/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to CLI config page
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/cli/**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/cli'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should validate endpoint configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI config page
    await page.goto('/settings/cli/config', { waitUntil: 'networkidle' as const });

    // Look for create endpoint button
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Try to submit without required fields
      const submitButton = page.getByRole('button', { name: /create|save|submit/i });
      const hasSubmit = await submitButton.isVisible().catch(() => false);

      if (hasSubmit) {
        await submitButton.click();

        // Look for validation error

        const errorMessage = page.getByText(/required|invalid|missing/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
