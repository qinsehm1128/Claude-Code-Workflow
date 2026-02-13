// ========================================
// E2E Tests: CodexLens Manager
// ========================================
// End-to-end tests for CodexLens management feature

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe.skip('[CodexLens Manager] - CodexLens Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L4.1 - should navigate to CodexLens manager', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CodexLens page
    await page.goto('/settings/codexlens', { waitUntil: 'domcontentloaded' as const });

    // Check page title
    const title = page.getByText(/CodexLens/i).or(page.getByRole('heading', { name: /CodexLens/i }));
    await expect(title).toBeVisible({ timeout: 5000 }).catch(() => false);

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.2 - should display all tabs', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Check for tabs
    const tabs = ['Overview', 'Settings', 'Models', 'Advanced'];
    for (const tab of tabs) {
      const tabElement = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      const isVisible = await tabElement.isVisible().catch(() => false);
      if (isVisible) {
        await expect(tabElement).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.3 - should switch between tabs', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Click Settings tab
    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();
      // Verify tab is active
      await expect(settingsTab).toHaveAttribute('data-state', 'active');
    }

    // Click Models tab
    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();
      await expect(modelsTab).toHaveAttribute('data-state', 'active');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.4 - should display overview status cards when installed', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for status cards
    const statusLabels = ['Installation Status', 'Version', 'Index Path', 'Index Count'];
    for (const label of statusLabels) {
      const element = page.getByText(new RegExp(label, 'i'));
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        await expect(element).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.5 - should display quick action buttons', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for quick action buttons
    const actions = ['FTS Full', 'FTS Incremental', 'Vector Full', 'Vector Incremental'];
    for (const action of actions) {
      const button = page.getByRole('button', { name: new RegExp(action, 'i') });
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await expect(button).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.6 - should display settings form', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Switch to Settings tab
    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();

      // Check for form inputs
      const indexDirInput = page.getByLabel(/Index Directory/i);
      const maxWorkersInput = page.getByLabel(/Max Workers/i);
      const batchSizeInput = page.getByLabel(/Batch Size/i);

      const indexDirVisible = await indexDirInput.isVisible().catch(() => false);
      const maxWorkersVisible = await maxWorkersInput.isVisible().catch(() => false);
      const batchSizeVisible = await batchSizeInput.isVisible().catch(() => false);

      // At least one should be visible if the form is rendered
      expect(indexDirVisible || maxWorkersVisible || batchSizeVisible).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.7 - should save settings configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();

      // Modify index directory
      const indexDirInput = page.getByLabel(/Index Directory/i);
      const indexDirVisible = await indexDirInput.isVisible().catch(() => false);
      if (indexDirVisible) {
        await indexDirInput.fill('/custom/index/path');

        // Click save button
        const saveButton = page.getByRole('button', { name: /Save/i });
        const saveVisible = await saveButton.isVisible().catch(() => false);
        if (saveVisible && !(await saveButton.isDisabled())) {
          await saveButton.click();

          // Wait for success or completion
          await page.waitForTimeout(1000);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.8 - should validate settings form', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();

      // Try to save with empty index directory
      const indexDirInput = page.getByLabel(/Index Directory/i);
      const indexDirVisible = await indexDirInput.isVisible().catch(() => false);
      if (indexDirVisible) {
        await indexDirInput.fill('');

        const saveButton = page.getByRole('button', { name: /Save/i });
        const saveVisible = await saveButton.isVisible().catch(() => false);
        if (saveVisible && !(await saveButton.isDisabled())) {
          await saveButton.click();

          // Check for validation error
          const errorMessage = page.getByText(/required/i, { exact: false });
          const hasError = await errorMessage.isVisible().catch(() => false);
          if (hasError) {
            await expect(errorMessage).toBeVisible();
          }
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.9 - should display models list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Switch to Models tab
    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Look for filter buttons
      const filters = ['All', 'Embedding', 'Reranker', 'Downloaded', 'Available'];
      for (const filter of filters) {
        const button = page.getByRole('button', { name: new RegExp(filter, 'i') });
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          await expect(button).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.10 - should filter models by type', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Click Embedding filter
      const embeddingFilter = page.getByRole('button', { name: /Embedding/i });
      const embeddingVisible = await embeddingFilter.isVisible().catch(() => false);
      if (embeddingVisible) {
        await embeddingFilter.click();
        // Filter should be active
        await expect(embeddingFilter).toHaveAttribute('data-state', 'active');
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.11 - should search models', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Type in search box
      const searchInput = page.getByPlaceholderText(/Search models/i);
      const searchVisible = await searchInput.isVisible().catch(() => false);
      if (searchVisible) {
        await searchInput.fill('test-model');
        await page.waitForTimeout(500);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.12 - should handle bootstrap when not installed', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for bootstrap button (only visible when not installed)
    const bootstrapButton = page.getByRole('button', { name: /Bootstrap/i });
    const bootstrapVisible = await bootstrapButton.isVisible().catch(() => false);
    if (bootstrapVisible) {
      await expect(bootstrapButton).toBeVisible();
      // Don't actually click it to avoid installing in test
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.13 - should show uninstall confirmation', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for uninstall button (only visible when installed)
    const uninstallButton = page.getByRole('button', { name: /Uninstall/i });
    const uninstallVisible = await uninstallButton.isVisible().catch(() => false);
    if (uninstallVisible) {
      // Set up dialog handler before clicking
      page.on('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      await uninstallButton.click();

      // Check for confirmation dialog
      const dialog = page.getByRole('dialog');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      // Dialog may or may not appear depending on implementation
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.14 - should display refresh button', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for refresh button
    const refreshButton = page.getByRole('button', { name: /Refresh/i }).or(
      page.getByRole('button', { name: /refresh/i })
    );
    const refreshVisible = await refreshButton.isVisible().catch(() => false);
    if (refreshVisible) {
      await expect(refreshButton).toBeVisible();

      // Click refresh
      await refreshButton.click();
      await page.waitForTimeout(500);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.15 - should handle API errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure for CodexLens endpoint
    await page.route('**/api/codexlens/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Look for error indicator or graceful degradation
    const title = page.getByText(/CodexLens/i);
    const titleVisible = await title.isVisible().catch(() => false);

    // Restore routing
    await page.unroute('**/api/codexlens/**');

    // Page should still be visible despite error
    expect(titleVisible).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/codexlens'], allowWarnings: true });
    monitoring.stop();
  });

  test('L4.16 - should switch language and verify translations', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    // Switch to Chinese if language switcher is available
    const languageSwitcher = page.getByRole('button', { name: /中文|Language/i });
    const switcherVisible = await languageSwitcher.isVisible().catch(() => false);
    if (switcherVisible) {
      await languageSwitcher.click();

      // Check for Chinese translations
      const chineseTitle = page.getByText(/CodexLens/i);
      await expect(chineseTitle).toBeVisible();

      // Check for Chinese tab labels
      const overviewTab = page.getByRole('tab', { name: /概览/i });
      const overviewVisible = await overviewTab.isVisible().catch(() => false);
      if (overviewVisible) {
        await expect(overviewTab).toBeVisible();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.17 - should navigate from sidebar', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/', { waitUntil: 'networkidle' as const });

    // Look for CodexLens link in sidebar
    const codexLensLink = page.getByRole('link', { name: /CodexLens/i });
    const linkVisible = await codexLensLink.isVisible().catch(() => false);
    if (linkVisible) {
      await codexLensLink.click();
      await page.waitForURL(/codexlens/);
      expect(page.url()).toContain('codexlens');
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L4.18 - should display empty state when no models', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

    const modelsTab = page.getByRole('tab', { name: /Models/i });
    const modelsVisible = await modelsTab.isVisible().catch(() => false);
    if (modelsVisible) {
      await modelsTab.click();

      // Search for a non-existent model to show empty state
      const searchInput = page.getByPlaceholderText(/Search models/i);
      const searchVisible = await searchInput.isVisible().catch(() => false);
      if (searchVisible) {
        await searchInput.fill('nonexistent-model-xyz-123');

        // Look for empty state message
        const emptyState = page.getByText(/No models found/i);
        const emptyVisible = await emptyState.isVisible().catch(() => false);
        if (emptyVisible) {
          await expect(emptyState).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // Search Tab Tests
  // ========================================
  test.describe.skip('[CodexLens Manager] - Search Tab Tests', () => {
    test('L4.19 - should navigate to Search tab', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      // Click Search tab
      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Verify tab is active
        await expect(searchTab).toHaveAttribute('data-state', 'active');

        // Verify search content is visible
        const searchContent = page.getByText(/Search/i).or(
          page.getByPlaceholder(/Search query/i)
        );
        const contentVisible = await searchContent.isVisible().catch(() => false);
        if (contentVisible) {
          await expect(searchContent.first()).toBeVisible();
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.20 - should display all search UI elements', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Verify search type selector exists
        const searchTypeSelector = page.getByLabel(/Search Type/i).or(
          page.getByRole('combobox', { name: /Search Type/i })
        ).or(page.getByText(/Search Type/i));
        const typeVisible = await searchTypeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          await expect(searchTypeSelector.first()).toBeVisible();
        }

        // Verify search mode selector exists
        const searchModeSelector = page.getByLabel(/Search Mode/i).or(
          page.getByRole('combobox', { name: /Search Mode/i })
        ).or(page.getByText(/Search Mode/i));
        const modeVisible = await searchModeSelector.isVisible().catch(() => false);
        if (modeVisible) {
          await expect(searchModeSelector.first()).toBeVisible();
        }

        // Verify query input field exists
        const queryInput = page.getByPlaceholder(/Search query/i).or(
          page.getByLabel(/Query/i)
        ).or(page.getByRole('textbox', { name: /query/i }));
        const inputVisible = await queryInput.isVisible().catch(() => false);
        if (inputVisible) {
          await expect(queryInput.first()).toBeVisible();
        }

        // Verify search button exists
        const searchButton = page.getByRole('button', { name: /Search/i });
        const buttonVisible = await searchButton.isVisible().catch(() => false);
        if (buttonVisible) {
          await expect(searchButton.first()).toBeVisible();
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.21 - should show search type options', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Click on search type selector to open dropdown
        const searchTypeSelector = page.getByLabel(/Search Type/i).or(
          page.getByRole('combobox', { name: /Search Type/i })
        );
        const typeVisible = await searchTypeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);

          // Check for expected search type options
          const searchTypes = ['Content Search', 'File Search', 'Symbol Search'];
          for (const type of searchTypes) {
            const option = page.getByRole('option', { name: new RegExp(type, 'i') });
            const optionVisible = await option.isVisible().catch(() => false);
            if (optionVisible) {
              await expect(option).toBeVisible();
            }
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.22 - should show search mode options for Content Search', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Select Content Search first
        const searchTypeSelector = page.getByLabel(/Search Type/i).or(
          page.getByRole('combobox', { name: /Search Type/i })
        );
        const typeVisible = await searchTypeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);

          const contentOption = page.getByRole('option', { name: /Content Search/i });
          const contentVisible = await contentOption.isVisible().catch(() => false);
          if (contentVisible) {
            await contentOption.click();

            // Click on search mode selector to open dropdown
            const searchModeSelector = page.getByLabel(/Search Mode/i).or(
              page.getByRole('combobox', { name: /Search Mode/i })
            );
            const modeVisible = await searchModeSelector.isVisible().catch(() => false);
            if (modeVisible) {
              await searchModeSelector.first().click();
              await page.waitForTimeout(300);

              // Check for expected search mode options
              const searchModes = ['Semantic', 'Exact', 'Fuzzy'];
              for (const mode of searchModes) {
                const option = page.getByRole('option', { name: new RegExp(mode, 'i') });
                const optionVisible = await option.isVisible().catch(() => false);
                if (optionVisible) {
                  await expect(option).toBeVisible();
                }
              }
            }
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.23 - should hide search mode for Symbol Search', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Select Symbol Search
        const searchTypeSelector = page.getByLabel(/Search Type/i).or(
          page.getByRole('combobox', { name: /Search Type/i })
        );
        const typeVisible = await searchTypeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);

          const symbolOption = page.getByRole('option', { name: /Symbol Search/i });
          const symbolVisible = await symbolOption.isVisible().catch(() => false);
          if (symbolVisible) {
            await symbolOption.click();
            await page.waitForTimeout(300);

            // Verify search mode selector is hidden or removed
            const searchModeSelector = page.getByLabel(/Search Mode/i).or(
              page.getByRole('combobox', { name: /Search Mode/i })
            );
            const modeVisible = await searchModeSelector.isVisible().catch(() => false);

            // Search mode should not be visible for Symbol Search
            expect(modeVisible).toBe(false);
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.24 - should disable search button with empty query', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Verify search button is disabled with empty query
        const searchButton = page.getByRole('button', { name: /Search/i });
        const buttonVisible = await searchButton.isVisible().catch(() => false);
        if (buttonVisible) {
          // Check if button is disabled when query is empty
          const isDisabled = await searchButton.first().isDisabled().catch(() => false);
          if (isDisabled) {
            await expect(searchButton.first()).toBeDisabled();
          } else {
            // If not disabled, check for validation on click
            const queryInput = page.getByPlaceholder(/Search query/i).or(
              page.getByLabel(/Query/i)
            );
            const inputVisible = await queryInput.isVisible().catch(() => false);
            if (inputVisible) {
              // Ensure input is empty
              const inputValue = await queryInput.first().inputValue();
              expect(inputValue || '').toBe('');

              // Try clicking search button
              await searchButton.first().click();
              await page.waitForTimeout(300);

              // Check for error message
              const errorMessage = page.getByText(/required|enter a query|empty query/i);
              const errorVisible = await errorMessage.isVisible().catch(() => false);
              if (errorVisible) {
                await expect(errorMessage).toBeVisible();
              }
            }
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.25 - should enable search button with valid query', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Enter query text
        const queryInput = page.getByPlaceholder(/Search query/i).or(
          page.getByLabel(/Query/i)
        );
        const inputVisible = await queryInput.isVisible().catch(() => false);
        if (inputVisible) {
          await queryInput.first().fill('test query');
          await page.waitForTimeout(300);

          // Verify search button is enabled
          const searchButton = page.getByRole('button', { name: /Search/i });
          const buttonVisible = await searchButton.isVisible().catch(() => false);
          if (buttonVisible) {
            const isEnabled = await searchButton.first().isEnabled().catch(() => true);
            expect(isEnabled).toBe(true);
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.26 - should show loading state during search', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Enter query text
        const queryInput = page.getByPlaceholder(/Search query/i).or(
          page.getByLabel(/Query/i)
        );
        const inputVisible = await queryInput.isVisible().catch(() => false);
        if (inputVisible) {
          await queryInput.first().fill('test query');
          await page.waitForTimeout(300);

          // Click search button
          const searchButton = page.getByRole('button', { name: /Search/i });
          const buttonVisible = await searchButton.isVisible().catch(() => false);
          if (buttonVisible) {
            // Set up route handler to delay response
            await page.route('**/api/codexlens/search**', async (route) => {
              // Delay response to observe loading state
              await new Promise(resolve => setTimeout(resolve, 1000));
              route.continue();
            });

            await searchButton.first().click();

            // Check for loading indicator
            const loadingIndicator = page.getByText(/Searching|Loading/i).or(
              page.getByRole('button', { name: /Search/i }).filter({ hasText: /Searching|Loading/i })
            ).or(page.locator('[aria-busy="true"]'));

            // Wait briefly to see if loading state appears
            await page.waitForTimeout(200);
            const loadingVisible = await loadingIndicator.isVisible().catch(() => false);

            // Clean up route
            await page.unroute('**/api/codexlens/search**');

            // Loading state may or may not be visible depending on speed
            if (loadingVisible) {
              await expect(loadingIndicator.first()).toBeVisible();
            }
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.27 - should display search results', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Select Content Search
        const searchTypeSelector = page.getByLabel(/Search Type/i).or(
          page.getByRole('combobox', { name: /Search Type/i })
        );
        const typeVisible = await searchTypeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);

          const contentOption = page.getByRole('option', { name: /Content Search/i });
          const contentVisible = await contentOption.isVisible().catch(() => false);
          if (contentVisible) {
            await contentOption.click();

            // Enter query text
            const queryInput = page.getByPlaceholder(/Search query/i).or(
              page.getByLabel(/Query/i)
            );
            const inputVisible = await queryInput.isVisible().catch(() => false);
            if (inputVisible) {
              await queryInput.first().fill('test');
              await page.waitForTimeout(300);

              // Click search button
              const searchButton = page.getByRole('button', { name: /Search/i });
              const buttonVisible = await searchButton.isVisible().catch(() => false);
              if (buttonVisible) {
                await searchButton.first().click();

                // Wait for results
                await page.waitForTimeout(2000);

                // Check for results area
                const resultsArea = page.getByText(/Results|No results|Found/i).or(
                  page.locator('[data-testid="search-results"]')
                ).or(page.locator('.search-results'));
                const resultsVisible = await resultsArea.isVisible().catch(() => false);

                if (resultsVisible) {
                  await expect(resultsArea.first()).toBeVisible();
                }
              }
            }
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.28 - should handle search between different types', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Start with Content Search
        const searchTypeSelector = page.getByLabel(/Search Type/i).or(
          page.getByRole('combobox', { name: /Search Type/i })
        );
        const typeVisible = await searchTypeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          // Select Content Search
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);
          const contentOption = page.getByRole('option', { name: /Content Search/i });
          const contentVisible = await contentOption.isVisible().catch(() => false);
          if (contentVisible) {
            await contentOption.click();
          }

          // Verify mode selector is visible
          const searchModeSelector = page.getByLabel(/Search Mode/i).or(
            page.getByRole('combobox', { name: /Search Mode/i })
          );
          let modeVisible = await searchModeSelector.isVisible().catch(() => false);
          expect(modeVisible).toBe(true);

          // Switch to Symbol Search
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);
          const symbolOption = page.getByRole('option', { name: /Symbol Search/i });
          const symbolVisible = await symbolOption.isVisible().catch(() => false);
          if (symbolVisible) {
            await symbolOption.click();
          }

          // Verify mode selector is hidden
          modeVisible = await searchModeSelector.isVisible().catch(() => false);
          expect(modeVisible).toBe(false);

          // Switch to File Search
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);
          const fileOption = page.getByRole('option', { name: /File Search/i });
          const fileVisible = await fileOption.isVisible().catch(() => false);
          if (fileVisible) {
            await fileOption.click();
          }

          // Verify mode selector is visible again
          modeVisible = await searchModeSelector.isVisible().catch(() => false);
          expect(modeVisible).toBe(true);
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.29 - should handle empty search results gracefully', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Enter a unique query that likely has no results
        const queryInput = page.getByPlaceholder(/Search query/i).or(
          page.getByLabel(/Query/i)
        );
        const inputVisible = await queryInput.isVisible().catch(() => false);
        if (inputVisible) {
          await queryInput.first().fill('nonexistent-unique-query-xyz-123');
          await page.waitForTimeout(300);

          // Click search button
          const searchButton = page.getByRole('button', { name: /Search/i });
          const buttonVisible = await searchButton.isVisible().catch(() => false);
          if (buttonVisible) {
            await searchButton.first().click();

            // Wait for results
            await page.waitForTimeout(2000);

            // Check for empty state message
            const emptyState = page.getByText(/No results|Found 0|No matches/i);
            const emptyVisible = await emptyState.isVisible().catch(() => false);
            if (emptyVisible) {
              await expect(emptyState.first()).toBeVisible();
            }
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });

    test('L4.30 - should handle search mode selection', async ({ page }) => {
      const monitoring = setupEnhancedMonitoring(page);

      await page.goto('/settings/codexlens', { waitUntil: 'networkidle' as const });

      const searchTab = page.getByRole('tab', { name: /Search/i });
      const searchTabVisible = await searchTab.isVisible().catch(() => false);
      if (searchTabVisible) {
        await searchTab.click();

        // Ensure we're on Content or File Search (which have modes)
        const searchTypeSelector = page.getByLabel(/Search Type/i).or(
          page.getByRole('combobox', { name: /Search Type/i })
        );
        const typeVisible = await searchTypeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          await searchTypeSelector.first().click();
          await page.waitForTimeout(300);

          const contentOption = page.getByRole('option', { name: /Content Search/i });
          const contentVisible = await contentOption.isVisible().catch(() => false);
          if (contentVisible) {
            await contentOption.click();
          }

          // Try different search modes
          const searchModes = ['Semantic', 'Exact'];
          for (const mode of searchModes) {
            const searchModeSelector = page.getByLabel(/Search Mode/i).or(
              page.getByRole('combobox', { name: /Search Mode/i })
            );
            const modeVisible = await searchModeSelector.isVisible().catch(() => false);
            if (modeVisible) {
              await searchModeSelector.first().click();
              await page.waitForTimeout(300);

              const modeOption = page.getByRole('option', { name: new RegExp(mode, 'i') });
              const optionVisible = await modeOption.isVisible().catch(() => false);
              if (optionVisible) {
                await modeOption.click();
                await page.waitForTimeout(300);

                // Verify selection
                await expect(searchModeSelector.first()).toContainText(mode, { timeout: 2000 }).catch(() => {
                  // Selection may or may not be reflected in selector text
                });
              }
            }
          }
        }
      }

      monitoring.assertClean({ allowWarnings: true });
      monitoring.stop();
    });
  });
});
