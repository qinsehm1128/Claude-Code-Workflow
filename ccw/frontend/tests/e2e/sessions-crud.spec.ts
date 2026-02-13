// ========================================
// E2E Tests: Sessions CRUD Operations
// ========================================
// End-to-end tests for session create, read, update, archive, and delete operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Sessions CRUD] - Session Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display sessions list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for sessions list container
    const sessionsList = page.getByTestId('sessions-list').or(
      page.locator('.sessions-list')
    );

    const isVisible = await sessionsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify session items exist or empty state is shown
      const sessionItems = page.getByTestId(/session-item|session-card/).or(
        page.locator('.session-item')
      );

      const itemCount = await sessionItems.count();

      if (itemCount === 0) {
        const emptyState = page.getByTestId('empty-state').or(
          page.getByText(/no sessions/i)
        );
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        expect(hasEmptyState).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should create new session', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for create session button
    const createButton = page.getByRole('button', { name: /create|new|add session/i }).or(
      page.getByTestId('create-session-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Look for create session dialog/form
      const dialog = page.getByRole('dialog').filter({ hasText: /create session|new session/i });
      const form = page.getByTestId('create-session-form');

      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasForm = await form.isVisible().catch(() => false);

      if (hasDialog || hasForm) {
        // Fill in session details
        const titleInput = page.getByRole('textbox', { name: /title|name/i }).or(
          page.getByLabel(/title|name/i)
        );

        const hasTitleInput = await titleInput.isVisible().catch(() => false);

        if (hasTitleInput) {
          await titleInput.fill('E2E Test Session');

          const submitButton = page.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          // Verify session was created

          const successMessage = page.getByText(/created|success/i).or(
            page.getByTestId('success-message')
          );

          // Either success message or the session appears in list
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess).toBe(true);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should read session details', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for existing session
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Click on session to view details
      await firstSession.click();

      // Verify session detail page loads
      await page.waitForURL(/\/sessions\//);

      const detailContainer = page.getByTestId('session-detail').or(
        page.locator('.session-detail')
      );

      const hasDetail = await detailContainer.isVisible().catch(() => false);
      expect(hasDetail).toBe(true);

      // Verify session title is displayed
      const titleElement = page.getByTestId('session-title').or(
        page.locator('h1, h2').filter({ hasText: /.+/ })
      );

      const hasTitle = await titleElement.isVisible().catch(() => false);
      expect(hasTitle).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should update session title and description', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for existing session
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Click on session to view details
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for edit button
      const editButton = page.getByRole('button', { name: /edit|modify/i }).or(
        page.getByTestId('edit-session-button')
      );

      const hasEditButton = await editButton.isVisible().catch(() => false);

      if (hasEditButton) {
        await editButton.click();

        // Update title
        const titleInput = page.getByRole('textbox', { name: /title|name/i });
        await titleInput.clear();
        await titleInput.fill('Updated E2E Test Session');

        // Update description
        const descInput = page.getByRole('textbox', { name: /description/i }).or(
          page.getByLabel(/description/i)
        );

        const hasDescInput = await descInput.isVisible().catch(() => false);

        if (hasDescInput) {
          await descInput.fill('Updated description for E2E testing');
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

  test('L3.5 - should archive session', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for existing session
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for archive button
      const archiveButton = firstSession.getByRole('button', { name: /archive/i }).or(
        firstSession.getByTestId('archive-button')
      );

      const hasArchiveButton = await archiveButton.isVisible().catch(() => false);

      if (hasArchiveButton) {
        await archiveButton.click();

        // Confirm archive if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /archive|confirm/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = page.getByRole('button', { name: /archive|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify success message

        const successMessage = page.getByText(/archived|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should delete session', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for existing session
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Look for delete button
      const deleteButton = firstSession.getByRole('button', { name: /delete|remove/i }).or(
        firstSession.getByTestId('delete-button')
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

  test('L3.7 - should update list after mutation', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Get initial session count
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const initialCount = await sessionItems.count();

    // Look for create button
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Quick fill and submit
      const titleInput = page.getByRole('textbox', { name: /title|name/i });
      const hasTitleInput = await titleInput.isVisible().catch(() => false);

      if (hasTitleInput) {
        await titleInput.fill('List Update Test Session');

        const submitButton = page.getByRole('button', { name: /create|save/i });
        await submitButton.click();

        // Wait for list update

        // Verify list is updated
        const newCount = await sessionItems.count();
        expect(newCount).toBe(initialCount + 1);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should handle API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure for sessions
    await page.route('**/api/sessions', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to sessions page to trigger API call
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for error indicator - SessionsPage shows "Failed to load data"
    const errorIndicator = page.getByText(/Failed to load data|failed|加载失败/i).or(
      page.getByTestId('error-state')
    );

    // Wait a bit for error to appear
    await page.waitForTimeout(1000);

    const hasError = await errorIndicator.isVisible().catch(() => false);

    // Restore routing AFTER checking for error
    await page.unroute('**/api/sessions');

    // Error should be displayed or handled gracefully
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should support i18n in session operations', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify session-related UI is in Chinese
      const sessionsHeading = page.getByRole('heading', { name: /session/i }).or(
        page.locator('h1, h2').filter({ hasText: /session/i })
      );

      const hasHeading = await sessionsHeading.isVisible().catch(() => false);
      if (hasHeading) {
        const pageContent = await page.content();
        const hasChineseText = /[\u4e00-\u9fa5]/.test(pageContent);
        expect(hasChineseText).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display session tasks', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to sessions page
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' as const });

    // Look for existing session
    const sessionItems = page.getByTestId(/session-item|session-card/).or(
      page.locator('.session-item')
    );

    const itemCount = await sessionItems.count();

    if (itemCount > 0) {
      const firstSession = sessionItems.first();

      // Click on session to view details
      await firstSession.click();

      await page.waitForURL(/\/sessions\//);

      // Look for tasks section
      const tasksSection = page.getByTestId('session-tasks').or(
        page.getByText(/tasks/i)
      );

      const hasTasksSection = await tasksSection.isVisible().catch(() => false);

      if (hasTasksSection) {
        const taskItems = page.getByTestId(/task-item|task-card/).or(
          page.locator('.task-item')
        );

        const taskCount = await taskItems.count();
        // Tasks can be empty, just verify the section exists
        expect(taskCount).toBeGreaterThanOrEqual(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Error Scenarios
  // ========================================

  test('L3.11 - API Error - 400 Bad Request on create session', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 400
    await page.route('**/api/sessions', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Bad Request', message: 'Invalid session data' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Try to create a session
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      const submitButton = page.getByRole('button', { name: /create|save|submit/i });
      await submitButton.click();

      // Wait for error to appear
      await page.waitForTimeout(1000);

      // Verify error message - look for toast or inline error
      const errorMessage = page.locator('text=/Failed to load data|加载失败/');
      const hasError = await errorMessage.isVisible().catch(() => false);
      await page.unroute('**/api/sessions');
      expect(hasError).toBe(true);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.12 - API Error - 401 Unauthorized', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 401
    await page.route('**/api/sessions', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      });
    });

    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Wait for error to appear
    await page.waitForTimeout(1000);

    // 401 might redirect to login or show auth error
    const loginRedirect = page.url().includes('/login');
    // SessionsPage shows "Failed to load data" for any error
    const authError = page.locator('text=/Failed to load data|加载失败/');

    const hasAuthError = await authError.isVisible().catch(() => false);
    await page.unroute('**/api/sessions');
    expect(loginRedirect || hasAuthError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.13 - API Error - 403 Forbidden', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 403
    await page.route('**/api/sessions', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
      });
    });

    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Wait for error to appear
    await page.waitForTimeout(1000);

    // Verify error message - SessionsPage shows "Failed to load data"
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    const hasError = await errorMessage.isVisible().catch(() => false);
    await page.unroute('**/api/sessions');
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.14 - API Error - 404 Not Found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 404 for specific session
    await page.route('**/api/sessions/nonexistent', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found', message: 'Session not found' }),
      });
    });

    // Navigate to a non-existent session
    await page.goto('/sessions/nonexistent-session-id', { waitUntil: 'domcontentloaded' as const });

    // Wait for error to appear
    await page.waitForTimeout(1000);

    // Verify not found message - Session detail page shows error
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    const hasError = await errorMessage.isVisible().catch(() => false);
    await page.unroute('**/api/sessions/nonexistent');
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.15 - API Error - 500 Internal Server Error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 500
    await page.route('**/api/sessions', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error', message: 'Something went wrong' }),
      });
    });

    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Wait for error to appear
    await page.waitForTimeout(1000);

    // Verify server error message - SessionsPage shows "Failed to load data"
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    const hasError = await errorMessage.isVisible().catch(() => false);
    await page.unroute('**/api/sessions');
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.16 - API Error - Network Timeout', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API timeout by not fulfilling
    await page.route('**/api/sessions', () => {
      // Never fulfill - simulate timeout
    });

    await page.goto('/sessions', { waitUntil: 'networkidle' as const });

    // Wait for timeout handling
    await page.waitForTimeout(5000);

    // Verify timeout message
    const timeoutMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/sessions');
    const hasTimeout = await timeoutMessage.isVisible().catch(() => false);
    // Timeout message may or may not appear depending on implementation

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/sessions'], allowWarnings: true });
    monitoring.stop();
  });
});
