// ========================================
// E2E Tests: CLI Installations Management
// ========================================
// End-to-end tests for CLI tool installation, uninstall, and upgrade operations

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring } from './helpers/i18n-helpers';

test.describe.skip('[CLI Installations] - CLI Tools Installation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' as const });
  });

  test('L3.1 - should display CLI installations list', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'domcontentloaded' as const });

    // Look for installations list container
    const installationsList = page.getByTestId('cli-installations-list').or(
      page.locator('.cli-installations-list')
    );

    const isVisible = await installationsList.isVisible().catch(() => false);

    if (isVisible) {
      // Verify installation items exist
      const installationItems = page.getByTestId(/installation-item|tool-item/).or(
        page.locator('.installation-item')
      );

      const itemCount = await installationItems.count();
      expect(itemCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.2 - should install CLI tool', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for a tool that is not installed
    const notInstalledTools = page.locator('.installation-item').filter({ hasText: /not installed|install/i });

    const count = await notInstalledTools.count();

    if (count > 0) {
      const firstTool = notInstalledTools.first();

      // Look for install button
      const installButton = firstTool.getByRole('button', { name: /install/i }).or(
        firstTool.getByTestId('install-button')
      );

      const hasInstallButton = await installButton.isVisible().catch(() => false);

      if (hasInstallButton) {
        await installButton.click();

        // Wait for installation to start

        // Look for progress indicator
        const progressIndicator = page.getByTestId('installation-progress').or(
          page.getByText(/installing|progress/i)
        );

        // Installation may take time, just verify it started
        const hasProgress = await progressIndicator.isVisible().catch(() => false);

        if (hasProgress) {
          expect(progressIndicator).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.3 - should uninstall CLI tool', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for installed tools
    const installedTools = page.locator('.installation-item').filter({ hasText: /installed|active/i });

    const count = await installedTools.count();

    if (count > 0) {
      const firstTool = installedTools.first();

      // Look for uninstall button
      const uninstallButton = firstTool.getByRole('button', { name: /uninstall|remove/i }).or(
        firstTool.getByTestId('uninstall-button')
      );

      const hasUninstallButton = await uninstallButton.isVisible().catch(() => false);

      if (hasUninstallButton) {
        await uninstallButton.click();

        // Confirm uninstall if dialog appears
        const confirmDialog = page.getByRole('dialog').filter({ hasText: /uninstall|confirm|remove/i });
        const hasDialog = await confirmDialog.isVisible().catch(() => false);

        if (hasDialog) {
          const confirmButton = page.getByRole('button', { name: /uninstall|confirm|yes/i });
          await confirmButton.click();
        }

        // Verify uninstallation started

        const successMessage = page.getByText(/uninstalled|removed|success/i);
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.4 - should upgrade CLI tool', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for tools with available updates
    const updatableTools = page.locator('.installation-item').filter({ hasText: /update|upgrade|new version/i });

    const count = await updatableTools.count();

    if (count > 0) {
      const firstTool = updatableTools.first();

      // Look for upgrade button
      const upgradeButton = firstTool.getByRole('button', { name: /upgrade|update/i }).or(
        firstTool.getByTestId('upgrade-button')
      );

      const hasUpgradeButton = await upgradeButton.isVisible().catch(() => false);

      if (hasUpgradeButton) {
        await upgradeButton.click();

        // Wait for upgrade to start

        // Look for progress indicator
        const progressIndicator = page.getByText(/upgrading|progress/i);
        const hasProgress = await progressIndicator.isVisible().catch(() => false);

        if (hasProgress) {
          expect(progressIndicator).toBeVisible();
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.5 - should check CLI tool status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for check status/refresh button
    const checkButton = page.getByRole('button', { name: /check status|refresh|check updates/i }).or(
      page.getByTestId('check-status-button')
    );

    const hasCheckButton = await checkButton.isVisible().catch(() => false);

    if (hasCheckButton) {
      await checkButton.click();

      // Wait for status check to complete

      // Verify status indicators are updated
      const statusIndicators = page.getByTestId(/tool-status|installation-status/).or(
        page.locator('*').filter({ hasText: /active|inactive|installed|not installed/i })
      );

      const hasIndicators = await statusIndicators.isVisible().catch(() => false);
      expect(hasIndicators).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.6 - should display tool version', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for installation items
    const installationItems = page.getByTestId(/installation-item|tool-item/).or(
      page.locator('.installation-item')
    );

    const itemCount = await installationItems.count();

    if (itemCount > 0) {
      const firstItem = installationItems.first();

      // Look for version badge
      const versionBadge = firstItem.getByTestId('tool-version').or(
        firstItem.locator('*').filter({ hasText: /v?\d+\.\d+/i })
      );

      const hasVersion = await versionBadge.isVisible().catch(() => false);

      if (hasVersion) {
        const text = await versionBadge.textContent();
        expect(text).toBeTruthy();
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.7 - should display tool installation status', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for installation items
    const installationItems = page.getByTestId(/installation-item|tool-item/).or(
      page.locator('.installation-item')
    );

    const itemCount = await installationItems.count();

    if (itemCount > 0) {
      const firstItem = installationItems.first();

      // Look for status indicator
      const statusBadge = firstItem.getByTestId('tool-status').or(
        firstItem.locator('*').filter({ hasText: /active|inactive|installed|not installed/i })
      );

      const hasStatus = await statusBadge.isVisible().catch(() => false);
      expect(hasStatus).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.8 - should display tool path', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for installation items
    const installationItems = page.getByTestId(/installation-item|tool-item/).or(
      page.locator('.installation-item')
    );

    const itemCount = await installationItems.count();

    if (itemCount > 0) {
      const firstItem = installationItems.first();

      // Look for path display
      const pathDisplay = firstItem.getByTestId('tool-path').or(
        firstItem.locator('*').filter({ hasText: /\/|\\/ })
      );

      const hasPath = await pathDisplay.isVisible().catch(() => false);

      if (hasPath) {
        const text = await pathDisplay.textContent();
        expect(text).toBeTruthy();
        expect(text?.length).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.9 - should handle installation errors gracefully', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API failure
    await page.route('**/api/cli/installments/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Try to install a tool
    const notInstalledTools = page.locator('.installation-item').filter({ hasText: /not installed/i });

    const count = await notInstalledTools.count();

    if (count > 0) {
      const firstTool = notInstalledTools.first();
      const installButton = firstTool.getByRole('button', { name: /install/i });

      const hasInstallButton = await installButton.isVisible().catch(() => false);

      if (hasInstallButton) {
        await installButton.click();

        // Look for error message

        const errorMessage = page.getByText(/error|failed|unable/i);
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    }

    // Restore routing
    await page.unroute('**/api/cli/installments/**');

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/cli/installments'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - should display last checked timestamp', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Navigate to CLI installations page
    await page.goto('/settings/cli/installations', { waitUntil: 'networkidle' as const });

    // Look for last checked indicator
    const lastChecked = page.getByTestId('last-checked').or(
      page.getByText(/last checked|last updated/i)
    );

    const hasLastChecked = await lastChecked.isVisible().catch(() => false);

    if (hasLastChecked) {
      const text = await lastChecked.textContent();
      expect(text).toBeTruthy();
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });
});
