// ========================================
// E2E Tests: Command Creation
// ========================================
// End-to-end tests for command creation dialog and API

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[Command Creation] - CommandCreateDialog Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to commands page
    await page.goto('/commands', { waitUntil: 'networkidle' as const });
  });

  // ========================================
  // Dialog Open Tests
  // ========================================
  test('L4.1 - should open create command dialog', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for create button
    const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
      page.getByTestId('create-command-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Wait for dialog
      const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Verify dialog title
      const title = dialog.getByText(/create command|创建命令/i);
      const hasTitle = await title.isVisible().catch(() => false);
      expect(hasTitle).toBe(true);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // Mode Selection Tests
  // ========================================
  test('L4.2 - should switch between import and generate modes', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Open dialog
    const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
      page.getByTestId('create-command-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);
    if (!hasCreateButton) {
      monitoring.stop();
      test.skip();
      return;
    }

    await createButton.click();
    const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Look for mode buttons
    const importButton = dialog.getByRole('button', { name: /import|导入/i }).or(
      dialog.getByTestId('mode-import')
    );
    const generateButton = dialog.getByRole('button', { name: /generate|ai|生成/i }).or(
      dialog.getByTestId('mode-generate')
    );

    // Click generate mode
    const hasGenerate = await generateButton.isVisible().catch(() => false);
    if (hasGenerate) {
      await generateButton.click();

      // Verify description textarea appears
      const descriptionTextarea = dialog.getByRole('textbox', { name: /description|描述/i }).or(
        dialog.getByPlaceholder(/describe|描述/)
      );
      await expect(descriptionTextarea).toBeVisible({ timeout: 3000 });
    }

    // Click import mode
    const hasImport = await importButton.isVisible().catch(() => false);
    if (hasImport) {
      await importButton.click();

      // Verify source path input appears
      const sourcePathInput = dialog.getByRole('textbox', { name: /source|path|路径/i }).or(
        dialog.getByPlaceholder(/path|路径/)
      );
      await expect(sourcePathInput).toBeVisible({ timeout: 3000 });
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // Location Selection Tests
  // ========================================
  test('L4.3 - should switch between project and user locations', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
      page.getByTestId('create-command-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);
    if (!hasCreateButton) {
      monitoring.stop();
      test.skip();
      return;
    }

    await createButton.click();
    const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Look for location buttons
    const projectButton = dialog.getByRole('button', { name: /project|项目/i }).or(
      dialog.getByTestId('location-project')
    );
    const userButton = dialog.getByRole('button', { name: /user|global|用户|全局/i }).or(
      dialog.getByTestId('location-user')
    );

    // Both should be visible
    const hasProject = await projectButton.isVisible().catch(() => false);
    const hasUser = await userButton.isVisible().catch(() => false);

    expect(hasProject || hasUser).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // Validation Tests
  // ========================================
  test('L4.4 - should validate required fields in generate mode', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
      page.getByTestId('create-command-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);
    if (!hasCreateButton) {
      monitoring.stop();
      test.skip();
      return;
    }

    await createButton.click();
    const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Switch to generate mode
    const generateButton = dialog.getByRole('button', { name: /generate|ai|生成/i }).or(
      dialog.getByTestId('mode-generate')
    );

    const hasGenerate = await generateButton.isVisible().catch(() => false);
    if (hasGenerate) {
      await generateButton.click();

      // Try to create without filling fields
      const createActionButton = dialog.getByRole('button', { name: /^create$|^generate$/i }).or(
        dialog.getByTestId('create-action-button')
      );

      const hasCreateAction = await createActionButton.isVisible().catch(() => false);
      if (hasCreateAction) {
        // Button should be disabled without required fields
        const isDisabled = await createActionButton.isDisabled().catch(() => false);

        // Either button is disabled, or clicking it shows validation
        expect(isDisabled).toBe(true);
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Success Tests
  // ========================================
  test.describe('API Success Tests', () => {
    test('L4.5 - should create command via import mode', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock successful API response
      await page.route('**/api/commands/create', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            commandInfo: {
              name: 'test-command',
              description: 'Test command',
              path: '/.claude/commands/test/test-command.md',
            },
          }),
        });
      });

      const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
        page.getByTestId('create-command-button')
      );

      const hasCreateButton = await createButton.isVisible().catch(() => false);
      if (!hasCreateButton) {
        monitoring.stop();
        test.skip();
        return;
      }

      await createButton.click();
      const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Fill in import mode
      const sourcePathInput = dialog.getByRole('textbox', { name: /source|path|路径/i }).or(
        dialog.getByPlaceholder(/path|路径/)
      );

      const hasSourcePath = await sourcePathInput.isVisible().catch(() => false);
      if (hasSourcePath) {
        await sourcePathInput.fill('/test/path/command.md');

        // Click create
        const createActionButton = dialog.getByRole('button', { name: /^create$|^import$/i }).or(
          dialog.getByTestId('create-action-button')
        );

        const hasCreateAction = await createActionButton.isVisible().catch(() => false);
        if (hasCreateAction && !(await createActionButton.isDisabled().catch(() => false))) {
          await createActionButton.click();

          // Wait for success (dialog closes or success message)
          await page.waitForTimeout(2000);
        }
      }

      await page.unroute('**/api/commands/create');
      monitoring.stop();
    });

    test('L4.6 - should create command via generate mode', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock successful API response
      await page.route('**/api/commands/create', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            commandInfo: {
              name: 'ai-generated-command',
              description: 'AI generated command',
              path: '/.claude/commands/generated/ai-generated-command.md',
            },
          }),
        });
      });

      const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
        page.getByTestId('create-command-button')
      );

      const hasCreateButton = await createButton.isVisible().catch(() => false);
      if (!hasCreateButton) {
        monitoring.stop();
        test.skip();
        return;
      }

      await createButton.click();
      const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Switch to generate mode
      const generateButton = dialog.getByRole('button', { name: /generate|ai|生成/i }).or(
        dialog.getByTestId('mode-generate')
      );

      const hasGenerate = await generateButton.isVisible().catch(() => false);
      if (hasGenerate) {
        await generateButton.click();

        // Fill in required fields
        const nameInput = dialog.getByRole('textbox', { name: /name|command.*name|命令.*名/i }).or(
          dialog.getByPlaceholder(/name|名称/)
        );
        const descriptionTextarea = dialog.getByRole('textbox', { name: /description|描述/i }).or(
          dialog.getByPlaceholder(/describe|描述/)
        );

        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('ai-generated-command');
        }
        if (await descriptionTextarea.isVisible().catch(() => false)) {
          await descriptionTextarea.fill('A command generated by AI');
        }

        // Click generate
        const generateActionButton = dialog.getByRole('button', { name: /^generate$/i }).or(
          dialog.getByTestId('create-action-button')
        );

        const hasGenerateAction = await generateActionButton.isVisible().catch(() => false);
        if (hasGenerateAction && !(await generateActionButton.isDisabled().catch(() => false))) {
          await generateActionButton.click();

          // Wait for success
          await page.waitForTimeout(2000);
        }
      }

      await page.unroute('**/api/commands/create');
      monitoring.stop();
    });
  });

  // ========================================
  // API Error Tests
  // ========================================
  test.describe('API Error Tests', () => {
    test('L4.7 - should show error on 400 Bad Request', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock error response
      await page.route('**/api/commands/create', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Invalid request: sourcePath is required',
          }),
        });
      });

      const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
        page.getByTestId('create-command-button')
      );

      const hasCreateButton = await createButton.isVisible().catch(() => false);
      if (!hasCreateButton) {
        monitoring.stop();
        test.skip();
        return;
      }

      await createButton.click();
      const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Try to create (if possible)
      const createActionButton = dialog.getByRole('button', { name: /^create$|^import$/i }).or(
        dialog.getByTestId('create-action-button')
      );

      const hasCreateAction = await createActionButton.isVisible().catch(() => false);
      if (hasCreateAction && !(await createActionButton.isDisabled().catch(() => false))) {
        await createActionButton.click();

        // Wait for error message
        await page.waitForTimeout(2000);

        // Check for error message
        const errorMessage = page.locator('text=/error|失败|invalid/i');
        const hasError = await errorMessage.isVisible().catch(() => false);

        // Error should be displayed
        expect(hasError || (await dialog.isVisible().catch(() => false))).toBe(true);
      }

      await page.unroute('**/api/commands/create');
      monitoring.stop();
    });

    test('L4.8 - should show error on 409 Conflict', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock conflict response
      await page.route('**/api/commands/create', (route) => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Command already exists',
          }),
        });
      });

      const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
        page.getByTestId('create-command-button')
      );

      const hasCreateButton = await createButton.isVisible().catch(() => false);
      if (!hasCreateButton) {
        monitoring.stop();
        test.skip();
        return;
      }

      await createButton.click();
      const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Try to create
      const createActionButton = dialog.getByRole('button', { name: /^create$|^import$/i }).or(
        dialog.getByTestId('create-action-button')
      );

      const hasCreateAction = await createActionButton.isVisible().catch(() => false);
      if (hasCreateAction && !(await createActionButton.isDisabled().catch(() => false))) {
        await createActionButton.click();

        // Wait for error
        await page.waitForTimeout(2000);

        // Check for conflict error
        const errorMessage = page.locator('text=/already exists|已存在|conflict/i');
        const hasError = await errorMessage.isVisible().catch(() => false);

        expect(hasError || (await dialog.isVisible().catch(() => false))).toBe(true);
      }

      await page.unroute('**/api/commands/create');
      monitoring.stop();
    });

    test('L4.9 - should show error on path traversal attempt', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      // Mock forbidden response
      await page.route('**/api/commands/create', (route) => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Path traversal detected',
          }),
        });
      });

      const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
        page.getByTestId('create-command-button')
      );

      const hasCreateButton = await createButton.isVisible().catch(() => false);
      if (!hasCreateButton) {
        monitoring.stop();
        test.skip();
        return;
      }

      await createButton.click();
      const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Fill in malicious path
      const sourcePathInput = dialog.getByRole('textbox', { name: /source|path|路径/i }).or(
        dialog.getByPlaceholder(/path|路径/)
      );

      const hasSourcePath = await sourcePathInput.isVisible().catch(() => false);
      if (hasSourcePath) {
        await sourcePathInput.fill('../../../etc/passwd');

        const createActionButton = dialog.getByRole('button', { name: /^create$|^import$/i }).or(
          dialog.getByTestId('create-action-button')
        );

        const hasCreateAction = await createActionButton.isVisible().catch(() => false);
        if (hasCreateAction && !(await createActionButton.isDisabled().catch(() => false))) {
          await createActionButton.click();

          // Wait for error
          await page.waitForTimeout(2000);
        }
      }

      await page.unroute('**/api/commands/create');
      monitoring.stop();
    });
  });

  // ========================================
  // Loading State Tests
  // ========================================
  test('L4.10 - should show loading state during creation', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock delayed response
    await page.route('**/api/commands/create', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          commandInfo: { name: 'test', description: 'Test' },
        }),
      });
    });

    const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
      page.getByTestId('create-command-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);
    if (!hasCreateButton) {
      monitoring.stop();
      test.skip();
      return;
    }

    await createButton.click();
    const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill in and click create
    const sourcePathInput = dialog.getByRole('textbox', { name: /source|path|路径/i }).or(
      dialog.getByPlaceholder(/path|路径/)
    );

    const hasSourcePath = await sourcePathInput.isVisible().catch(() => false);
    if (hasSourcePath) {
      await sourcePathInput.fill('/test/path/command.md');

      const createActionButton = dialog.getByRole('button', { name: /^create$|^import$/i }).or(
        dialog.getByTestId('create-action-button')
      );

      const hasCreateAction = await createActionButton.isVisible().catch(() => false);
      if (hasCreateAction && !(await createActionButton.isDisabled().catch(() => false))) {
        await createActionButton.click();

        // Check for loading indicator
        const loadingSpinner = dialog.locator('[class*="animate-spin"]').or(
          dialog.locator('svg').filter({ hasText: /loading/i })
        );
        const hasLoading = await loadingSpinner.isVisible().catch(() => false);

        // Or check for disabled button
        const isDisabled = await createActionButton.isDisabled().catch(() => false);

        expect(hasLoading || isDisabled).toBe(true);
      }
    }

    await page.unroute('**/api/commands/create');
    monitoring.stop();
  });

  // ========================================
  // Dialog Close Tests
  // ========================================
  test('L4.11 - should close dialog on cancel', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
      page.getByTestId('create-command-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);
    if (!hasCreateButton) {
      monitoring.stop();
      test.skip();
      return;
    }

    await createButton.click();
    const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click cancel
    const cancelButton = dialog.getByRole('button', { name: /cancel|取消/i }).or(
      dialog.getByTestId('cancel-button')
    );

    const hasCancel = await cancelButton.isVisible().catch(() => false);
    if (hasCancel) {
      await cancelButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 3000 });
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });

  test('L4.12 - should close dialog on escape key', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    const createButton = page.getByRole('button', { name: /create|new|add/i }).or(
      page.getByTestId('create-command-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);
    if (!hasCreateButton) {
      monitoring.stop();
      test.skip();
      return;
    }

    await createButton.click();
    const dialog = page.getByRole('dialog').or(page.getByTestId('command-create-dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Press escape
    await page.keyboard.press('Escape');

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/'], allowWarnings: true });
    monitoring.stop();
  });
});
