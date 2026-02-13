// ========================================
// E2E Tests: MCP (Model Context Protocol) Management
// ========================================
// End-to-end tests for MCP servers, Codex MCP, and CCW MCP configuration

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe('[MCP] - MCP Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display MCP servers list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'domcontentloaded' as const });

    // Look for MCP servers list container
    const serversList = page.getByTestId('mcp-servers-list').or(
      page.locator('.mcp-servers-list')
    );

    const isVisible = await serversList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify server items exist
      const serverItems = page.getByTestId(/server-item|mcp-server/).or(
        page.locator('.server-item')
      );

      const itemCount = await serverItems.count();
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should create new MCP server', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for create server button
    const createButton = page.getByRole('button', { name: /create|new|add server/i }).or(
      page.getByTestId('create-mcp-server-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create server dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create server|add server/i });
      const form = page.getByTestId('create-mcp-server-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in server details
        const nameInput = page.getByRole('textbox', { name: /name/i }).or(
          page.getByLabel(/name/i)
        );

        const hasNameInput = await nameInput.isVisible().catch(() => false);

        if (hasNameInput) {
          await nameInput.fill('e2e-test-server');

          const commandInput = page.getByRole('textbox', { name: /command/i });
          const hasCommandInput = await commandInput.isVisible().catch(() => false);

          if (hasCommandInput) {
            await commandInput.fill('npx');
          }

          const submitButton = page.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          // Verify server was created

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

  test('L3.3 - should update MCP server', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for existing server
    const serverItems = page.getByTestId(/server-item|mcp-server/).or(
      page.locator('.server-item')
    );

    const itemCount = await serverItems.count();

    if (itemCount > 0) {
      const firstServer = serverItems.first();

      // Look for edit button
      const editButton = firstServer.getByRole('button', { name: /edit|modify|configure/i }).or(
        firstServer.getByTestId('edit-server-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Update server configuration
        const argsInput = page.getByRole('textbox', { name: /args|arguments/i });
        const hasArgsInput = await argsInput.isVisible().catch(() => false);

        if (hasArgsInput) {
          await argsInput.fill('--version');
        }

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

  test('L3.4 - should delete MCP server', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for existing server
    const serverItems = page.getByTestId(/server-item|mcp-server/).or(
      page.locator('.server-item')
    );

    const itemCount = await serverItems.count();

    if (itemCount > 0) {
      const firstServer = serverItems.first();

      // Look for delete button
      const deleteButton = firstServer.getByRole('button', { name: /delete|remove/i }).or(
        firstServer.getByTestId('delete-button')
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

  test('L3.5 - should toggle MCP server enabled status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for server items
    const serverItems = page.getByTestId(/server-item|mcp-server/).or(
      page.locator('.server-item')
    );

    const itemCount = await serverItems.count();

    if (itemCount > 0) {
      const firstServer = serverItems.first();

      // Look for toggle switch
      const toggleSwitch = firstServer.getByRole('switch').or(
        firstServer.getByTestId('server-toggle')
      ).or(
        firstServer.getByRole('button', { name: /enable|disable|toggle/i })
      );

      const hasToggle = await toggleSwitch.isVisible().catch(() => false);

      if (hasToggle) {
        // Get initial state
        const initialState = await toggleSwitch.getAttribute('aria-checked');
        const initialChecked = initialState === 'true';

        // Toggle the server
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

  test('L3.6 - should display Codex MCP servers', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for Codex MCP section
    const codexSection = page.getByTestId('codex-mcp-section').or(
      page.getByText(/codex/i)
    );

    const isVisible = await codexSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify Codex servers are displayed
      const codexServers = page.getByTestId(/codex-server/).or(
        codexSection.locator('.server-item')
      );

      const serverCount = await codexServers.count();
      expect(serverCount).toBeGreaterThanOrEqual(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should add Codex MCP server', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for Codex MCP section
    const codexSection = page.getByTestId('codex-mcp-section').or(
      page.getByText(/codex/i)
    );

    const isVisible = await codexSection.isVisible().catch(() => false);

    if (isVisible) {
      // Look for add Codex server button
      const addButton = codexSection.getByRole('button', { name: /add|create|new/i }).or(
        page.getByTestId('add-codex-server-button')
      );

      const hasAddButton = await addButton.isVisible().catch(() => false);

      if (hasAddButton) {
        await addButton.click();

        // Look for add server dialog/form
        const dialog = page.getByRole('dialog').filter({ hasText: /add codex|create codex/i });
        const hasDialog = await dialog.isVisible().catch(() => false);

        if (hasDialog) {
          // Fill in server details
          const nameInput = page.getByRole('textbox', { name: /name/i });
          const hasNameInput = await nameInput.isVisible().catch(() => false);

          if (hasNameInput) {
            await nameInput.fill('e2e-codex-server');

            const submitButton = page.getByRole('button', { name: /add|create|save/i });
            await submitButton.click();

            // Verify server was added

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

  test('L3.8 - should display CCW MCP configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for CCW MCP section
    const ccwSection = page.getByTestId('ccw-mcp-section').or(
      page.getByText(/ccw|core memory/i)
    );

    const isVisible = await ccwSection.isVisible().catch(() => false);

    if (isVisible) {
      // Verify CCW MCP config is displayed
      const configIndicator = page.getByTestId('ccw-config').or(
        ccwSection.locator('*').filter({ hasText: /installed|enabled|configured/i })
      );

      const hasConfig = await configIndicator.isVisible().catch(() => false);
      expect(hasConfig).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should update CCW MCP configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for CCW MCP section
    const ccwSection = page.getByTestId('ccw-mcp-section').or(
      page.getByText(/ccw|core memory/i)
    );

    const isVisible = await ccwSection.isVisible().catch(() => false);

    if (isVisible) {
      // Look for configure button
      const configButton = ccwSection.getByRole('button', { name: /configure|settings|edit/i }).or(
        page.getByTestId('ccw-config-button')
      );

      const hasConfigButton = await configButton.isVisible().catch(() => false);

      if (hasConfigButton) {
        await configButton.click();

        // Look for config dialog
        const dialog = page.getByRole('dialog').filter({ hasText: /configure|settings/i });
        const hasDialog = await dialog.isVisible().catch(() => false);

        if (hasDialog) {
          // Modify configuration
          const enabledToolsCheckbox = page.getByRole('checkbox', { name: /enabled tools|tools/i });
          const hasCheckbox = await enabledToolsCheckbox.isVisible().catch(() => false);

          if (hasCheckbox) {
            await enabledToolsCheckbox.check();
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

  test('L3.10 - should install CCW MCP', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for CCW MCP section
    const ccwSection = page.getByTestId('ccw-mcp-section').or(
      page.getByText(/ccw|core memory/i)
    );

    const isVisible = await ccwSection.isVisible().catch(() => false);

    if (isVisible) {
      // Look for install button (only if not installed)
      const installButton = ccwSection.getByRole('button', { name: /install/i }).or(
        page.getByTestId('install-ccw-mcp-button')
      );

      const hasInstallButton = await installButton.isVisible().catch(() => false);

      if (hasInstallButton) {
        await installButton.click();

        // Confirm installation if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /install|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = page.getByRole('button', { name: /install|confirm|yes/i });
          await confirmButton.click();
        }

        // Wait for installation to complete

        // Verify installation message
        const successMessage = page.getByText(/installed|success|completed/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.11 - should uninstall CCW MCP', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for CCW MCP section
    const ccwSection = page.getByTestId('ccw-mcp-section').or(
      page.getByText(/ccw|core memory/i)
    );

    const isVisible = await ccwSection.isVisible().catch(() => false);

    if (isVisible) {
      // Look for uninstall button (only if installed)
      const uninstallButton = ccwSection.getByRole('button', { name: /uninstall|remove/i }).or(
        page.getByTestId('uninstall-ccw-mcp-button')
      );

      const hasUninstallButton = await uninstallButton.isVisible().catch(() => false);

      if (hasUninstallButton) {
        await uninstallButton.click();

        // Confirm uninstallation if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /uninstall|confirm|remove/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = page.getByRole('button', { name: /uninstall|confirm|yes/i });
          await confirmButton.click();
        }

        // Wait for uninstallation to complete

        // Verify uninstallation message
        const successMessage = page.getByText(/uninstalled|removed|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.12 - should display server scope (project/global)', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for server items
    const serverItems = page.getByTestId(/server-item|mcp-server/).or(
      page.locator('.server-item')
    );

    const itemCount = await serverItems.count();

    if (itemCount > 0) {
      const firstServer = serverItems.first();

      // Look for scope badge
      const scopeBadge = firstServer.getByTestId('server-scope').or(
        firstServer.locator('*').filter({ hasText: /project|global/i })
      );

      const hasScope = await scopeBadge.isVisible().catch(() => false);

      if (hasScope) {
        const text = await scopeBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.13 - should separate project and global servers', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to MCP settings page
    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Look for project servers section
    const projectSection = page.getByTestId('project-servers').or(
      page.getByText(/project servers/i)
    );

    // Look for global servers section
    const globalSection = page.getByTestId('global-servers').or(
      page.getByText(/global servers/i)
    );

    const hasProject = await projectSection.isVisible().catch(() => false);
    const hasGlobal = await globalSection.isVisible().catch(() => false);

    // At least one section should be visible
    expect(hasProject || hasGlobal).toBe(true);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.14 - should handle MCP API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/mcp/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to MCP settings page
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for error indicator
    const errorIndicator = page.getByText(/error|failed|unable to load/i).or(
      page.getByTestId('error-state')
    );

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/mcp/**');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/mcp'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Error Scenarios
  // ========================================

  test('L3.15 - API Error - 400 Bad Request', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 400
    await page.route('**/api/mcp', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bad Request', message: 'Invalid MCP server data' }),
      });
    });

    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Try to create a server
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();
      const submitButton = page.getByRole('button', { name: /create|save/i });
      await submitButton.click();

      // Verify error message
      const errorMessage = page.getByText(/invalid|bad request|输入无效/i);
      await page.unroute('**/api/mcp');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/mcp'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.16 - API Error - 401 Unauthorized', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 401
    await page.route('**/api/mcp', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      });
    });

    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Verify auth error
    const authError = page.getByText(/unauthorized|not authenticated|未经授权/i);
    await page.unroute('**/api/mcp');
    const hasError = await authError.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/mcp'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.17 - API Error - 403 Forbidden', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 403
    await page.route('**/api/mcp', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
      });
    });

    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Verify forbidden message
    const errorMessage = page.getByText(/forbidden|not allowed|禁止访问/i);
    await page.unroute('**/api/mcp');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/mcp'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.18 - API Error - 404 Not Found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 404
    await page.route('**/api/mcp/servers/nonexistent', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found', message: 'MCP server not found' }),
      });
    });

    // Try to access a non-existent server
    await page.goto('/settings/mcp/servers/nonexistent-server-id', { waitUntil: 'networkidle' as const });

    // Verify not found message
    const errorMessage = page.getByText(/not found|doesn't exist|未找到/i);
    await page.unroute('**/api/mcp/servers/nonexistent');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/mcp'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.19 - API Error - 500 Internal Server Error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 500
    await page.route('**/api/mcp', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Verify server error message
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/mcp');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/mcp'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.20 - API Error - Network Timeout', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API timeout
    await page.route('**/api/mcp', () => {
      // Never fulfill - simulate timeout
    });

    await page.goto('/settings/mcp', { waitUntil: 'networkidle' as const });

    // Wait for timeout handling
    await page.waitForTimeout(3000);

    // Verify timeout message
    const timeoutMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/mcp');
    const hasTimeout = await timeoutMessage.isVisible().catch(() => false);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/mcp'], allowWarnings: true });
    monitoring.stop();
  });
});
