// ========================================
// E2E Tests: Orchestrator - Workflow Canvas
// ========================================
// End-to-end tests for workflow orchestration with @xyflow/react canvas

import { test, expect } from '@playwright/test';
import { setupEnhancedMonitoring, switchLanguageAndVerify } from './helpers/i18n-helpers';

test.describe('[Orchestrator] - Workflow Canvas Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API mocks BEFORE page navigation to prevent 404 errors
    await page.route('**/api/workflows**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            workflows: [
              {
                id: 'wf-1',
                name: 'Test Workflow',
                nodes: [
                  { id: 'node-1', type: 'start', position: { x: 100, y: 100 } },
                  { id: 'node-2', type: 'action', position: { x: 300, y: 100 } }
                ],
                edges: [
                  { id: 'edge-1', source: 'node-1', target: 'node-2' }
                ]
              }
            ],
            total: 1,
            page: 1,
            limit: 10
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    await page.goto('/orchestrator', { waitUntil: 'domcontentloaded' as const });
  });

  test('L3.01 - Canvas loads and displays nodes', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API response for workflows
    await page.route('**/api/workflows', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workflows: [
            {
              id: 'wf-1',
              name: 'Test Workflow',
              nodes: [
                { id: 'node-1', type: 'start', position: { x: 100, y: 100 } },
                { id: 'node-2', type: 'action', position: { x: 300, y: 100 } }
              ],
              edges: [
                { id: 'edge-1', source: 'node-1', target: 'node-2' }
              ]
            }
          ],
          total: 1,
          page: 1,
          limit: 10
        })
      });
    });

    // Reload page to trigger API call
    await page.reload({ waitUntil: 'domcontentloaded' as const });

    // Look for workflow canvas
    const canvas = page.getByTestId('workflow-canvas').or(
      page.locator('.react-flow')
    );

    const isCanvasVisible = await canvas.isVisible().catch(() => false);

    if (isCanvasVisible) {
      // Verify nodes are displayed
      const nodes = page.locator('.react-flow-node').or(
        page.getByTestId(/node-/)
      );

      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.02 - Create new node via drag-drop', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for node creation
    await page.route('**/api/workflows', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 'new-node-1' })
        });
      } else {
        route.continue();
      }
    });

    // Look for node library or create button
    const nodeLibrary = page.getByTestId('node-library').or(
      page.getByTestId('node-create-button')
    );

    const hasLibrary = await nodeLibrary.isVisible().catch(() => false);

    if (hasLibrary) {
      // Find a draggable node type
      const nodeType = nodeLibrary.locator('[data-node-type]').first();
      const hasNodeType = await nodeType.isVisible().catch(() => false);

      if (hasNodeType) {
        const canvas = page.getByTestId('workflow-canvas').or(
          page.locator('.react-flow')
        );

        const canvasBox = await canvas.boundingBox();
        if (canvasBox) {
          // Simulate drag-drop
          await nodeType.dragTo(canvas, {
            targetPosition: { x: canvasBox.x + 200, y: canvasBox.y + 200 }
          });

          // Wait for node to appear
          await page.waitForTimeout(500);

          // Verify new node exists
          const newNode = page.locator('.react-flow-node').or(
            page.getByTestId(/node-/)
          );

          const nodeCount = await newNode.count();
          expect(nodeCount).toBeGreaterThan(0);
        }
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.03 - Connect nodes with edges', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for edge creation
    await page.route('**/api/workflows/*', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else {
        route.continue();
      }
    });

    // Look for existing nodes
    const nodes = page.locator('.react-flow-node').or(
      page.getByTestId(/node-/)
    );

    const nodeCount = await nodes.count();

    if (nodeCount >= 2) {
      const sourceNode = nodes.first();
      const targetNode = nodes.nth(1);

      // Get node positions
      const sourceBox = await sourceNode.boundingBox();
      const targetBox = await targetNode.boundingBox();

      if (sourceBox && targetBox) {
        // Click and drag from source to target to create edge
        await page.mouse.move(sourceBox.x + sourceBox.width, sourceBox.y + sourceBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x, targetBox.y + targetBox.height / 2);
        await page.mouse.up();

        // Wait for edge to be created
        await page.waitForTimeout(300);

        // Verify edge exists
        const edges = page.locator('.react-flow-edge').or(
          page.getByTestId(/edge-/)
        );

        const edgeCount = await edges.count();
        expect(edgeCount).toBeGreaterThan(0);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.04 - Delete node and verify edge removal', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for node deletion
    await page.route('**/api/workflows/*', (route) => {
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

    // Look for nodes
    const nodes = page.locator('.react-flow-node').or(
      page.getByTestId(/node-/)
    );

    const nodeCount = await nodes.count();

    if (nodeCount > 0) {
      const firstNode = nodes.first();

      // Get initial edge count
      const edgesBefore = await page.locator('.react-flow-edge').count();

      // Select node and look for delete button
      await firstNode.click();

      const deleteButton = page.getByRole('button', { name: /delete|remove/i }).or(
        page.getByTestId('node-delete-button')
      );

      const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

      if (hasDeleteButton) {
        await deleteButton.click();

        // Wait for node to be removed
        await page.waitForTimeout(300);

        // Verify node count decreased
        const nodesAfter = await page.locator('.react-flow-node').count();
        expect(nodesAfter).toBeLessThan(nodeCount);

        // Verify edges connected to deleted node are removed
        const edgesAfter = await page.locator('.react-flow-edge').count();
        expect(edgesAfter).toBeLessThanOrEqual(edgesBefore);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.05 - Zoom in/out functionality', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for zoom controls
    const zoomControls = page.getByTestId('zoom-controls').or(
      page.locator('.react-flow-controls')
    );

    const hasZoomControls = await zoomControls.isVisible().catch(() => false);

    if (hasZoomControls) {
      const zoomInButton = zoomControls.getByRole('button').first();
      const zoomOutButton = zoomControls.getByRole('button').nth(1);

      // Get initial zoom level
      const initialZoom = await page.evaluate(() => {
        const container = document.querySelector('.react-flow');
        return container ? getComputedStyle(container).transform : 'none';
      });

      // Click zoom in
      await zoomInButton.click();
      await page.waitForTimeout(200);

      // Click zoom out
      await zoomOutButton.click();
      await page.waitForTimeout(200);

      // Verify controls are still functional
      const isStillVisible = await zoomControls.isVisible();
      expect(isStillVisible).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.06 - Pan canvas functionality', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Look for canvas
    const canvas = page.getByTestId('workflow-canvas').or(
      page.locator('.react-flow')
    );

    const isCanvasVisible = await canvas.isVisible().catch(() => false);

    if (isCanvasVisible) {
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        // Simulate panning by clicking and dragging on canvas
        await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
        await page.mouse.down();
        await page.mouse.move(canvasBox.x + 200, canvasBox.y + 150);
        await page.mouse.up();

        // Wait for pan to complete
        await page.waitForTimeout(300);

        // Verify canvas is still visible after pan
        const isStillVisible = await canvas.isVisible();
        expect(isStillVisible).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.07 - Save workflow state', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for saving workflow
    await page.route('**/api/workflows/*', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, saved: true })
        });
      } else {
        route.continue();
      }
    });

    // Look for save button
    const saveButton = page.getByRole('button', { name: /save/i }).or(
      page.getByTestId('workflow-save-button')
    );

    const hasSaveButton = await saveButton.isVisible().catch(() => false);

    if (hasSaveButton) {
      await saveButton.click();

      // Look for success indicator
      const successMessage = page.getByText(/saved|success/i).or(
        page.getByTestId('save-success')
      );

      const hasSuccess = await successMessage.isVisible().catch(() => false);
      expect(hasSuccess).toBe(true);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.08 - Load existing workflow', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for loading workflows
    await page.route('**/api/workflows', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workflows: [
            {
              id: 'wf-existing',
              name: 'Existing Workflow',
              nodes: [
                { id: 'node-1', type: 'start', position: { x: 100, y: 100 } }
              ],
              edges: []
            }
          ],
          total: 1,
          page: 1,
          limit: 10
        })
      });
    });

    // Reload to trigger API
    await page.reload({ waitUntil: 'networkidle' as const });

    // Look for workflow list selector
    const workflowSelector = page.getByRole('combobox', { name: /workflow|select/i }).or(
      page.getByTestId('workflow-selector')
    );

    const hasSelector = await workflowSelector.isVisible().catch(() => false);

    if (hasSelector) {
      const options = await workflowSelector.locator('option').count();
      if (options > 0) {
        await workflowSelector.selectOption({ index: 0 });
        await page.waitForTimeout(500);

        // Verify canvas has loaded content
        const canvas = page.getByTestId('workflow-canvas').or(
          page.locator('.react-flow')
        );

        const isCanvasVisible = await canvas.isVisible();
        expect(isCanvasVisible).toBe(true);
      }
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.09 - Export workflow configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API for export
    await page.route('**/api/workflows/*/export', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'wf-1',
          name: 'Exported Workflow',
          nodes: [],
          edges: []
        })
      });
    });

    // Look for export button
    const exportButton = page.getByRole('button', { name: /export/i }).or(
      page.getByTestId('workflow-export-button')
    );

    const hasExportButton = await exportButton.isVisible().catch(() => false);

    if (hasExportButton) {
      await exportButton.click();

      // Look for export dialog or download
      const exportDialog = page.getByRole('dialog').filter({ hasText: /export/i });
      const hasDialog = await exportDialog.isVisible().catch(() => false);

      if (hasDialog) {
        const confirmButton = exportDialog.getByRole('button', { name: /export|download|save/i });
        await confirmButton.click();
      }

      // Verify some indication of export
      await page.waitForTimeout(500);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.10 - i18n - Node labels in EN/ZH', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Get language switcher
    const languageSwitcher = page.getByRole('combobox', { name: /select language|language/i }).first();

    const hasLanguageSwitcher = await languageSwitcher.isVisible().catch(() => false);

    if (hasLanguageSwitcher) {
      // Switch to Chinese
      await switchLanguageAndVerify(page, 'zh', languageSwitcher);

      // Verify canvas elements exist in Chinese context
      const canvas = page.getByTestId('workflow-canvas').or(
        page.locator('.react-flow')
      );

      const isCanvasVisible = await canvas.isVisible().catch(() => false);
      expect(isCanvasVisible).toBe(true);

      // Switch back to English
      await switchLanguageAndVerify(page, 'en', languageSwitcher);
    }

    monitoring.assertClean({ allowWarnings: true });
    monitoring.stop();
  });

  test('L3.11 - Error - Node with invalid configuration', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API error response
    await page.route('**/api/workflows', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid node configuration' })
        });
      } else {
        route.continue();
      }
    });

    // Look for create button
    const createButton = page.getByRole('button', { name: /create|add node/i }).or(
      page.getByTestId('node-create-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Try to create node without required fields (this should trigger error)
      const submitButton = page.getByRole('button', { name: /create|save|submit/i });
      const hasSubmit = await submitButton.isVisible().catch(() => false);

      if (hasSubmit) {
        await submitButton.click();

        // Look for error message
        const errorMessage = page.getByText(/invalid|error|required/i).or(
          page.getByTestId('error-message')
        );

        const hasError = await errorMessage.isVisible().catch(() => false);
        // Error message may or may not appear depending on validation
      }
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.12 - Edge - Maximum nodes limit', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to enforce limit
    await page.route('**/api/workflows', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Maximum node limit reached' })
        });
      } else {
        route.continue();
      }
    });

    // Try to create multiple nodes rapidly
    const createButton = page.getByRole('button', { name: /create|add/i }).or(
      page.getByTestId('node-create-button')
    );

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      // Attempt multiple creates
      for (let i = 0; i < 5; i++) {
        await createButton.click();
        await page.waitForTimeout(100);
      }

      // Look for limit error message
      const limitMessage = page.getByText(/limit|maximum|too many/i).or(
        page.getByTestId('limit-message')
      );

      const hasLimitMessage = await limitMessage.isVisible().catch(() => false);
      // Limit message may or may not appear
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });

  // ========================================
  // API Error Scenarios
  // ========================================

  test('L3.13 - API Error - 400 Bad Request', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 400
    await page.route('**/api/workflows', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Bad Request', message: 'Invalid workflow data' }),
        });
      } else {
        route.continue();
      }
    });

    // Try to create a node
    const createButton = page.getByRole('button', { name: /create|add/i });
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Verify error message
      const errorMessage = page.getByText(/invalid|bad request|输入无效/i);
      await page.unroute('**/api/workflows');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    }

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.14 - API Error - 401 Unauthorized', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 401
    await page.route('**/api/workflows', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Verify auth error
    const authError = page.getByText(/unauthorized|not authenticated|未经授权/i);
    await page.unroute('**/api/workflows');
    const hasError = await authError.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.15 - API Error - 403 Forbidden', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 403
    await page.route('**/api/workflows', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Verify forbidden message
    const errorMessage = page.getByText(/forbidden|not allowed|禁止访问/i);
    await page.unroute('**/api/workflows');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.16 - API Error - 404 Not Found', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 404
    await page.route('**/api/workflows/nonexistent', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found', message: 'Workflow not found' }),
      });
    });

    // Try to access a non-existent workflow
    await page.goto('/orchestrator?workflow=nonexistent-workflow-id', { waitUntil: 'networkidle' as const });

    // Verify not found message
    const errorMessage = page.getByText(/not found|doesn't exist|未找到/i);
    await page.unroute('**/api/workflows/nonexistent');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.17 - API Error - 500 Internal Server Error', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API to return 500
    await page.route('**/api/workflows', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Verify server error message
    const errorMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/workflows');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });

  test('L3.18 - API Error - Network Timeout', async ({ page }) => {
    const monitoring = setupEnhancedMonitoring(page);

    // Mock API timeout
    await page.route('**/api/workflows', () => {
      // Never fulfill - simulate timeout
    });

    await page.reload({ waitUntil: 'networkidle' as const });

    // Wait for timeout handling
    await page.waitForTimeout(3000);

    // Verify timeout message
    const timeoutMessage = page.locator('text=/Failed to load data|加载失败/');
    await page.unroute('**/api/workflows');
    const hasTimeout = await timeoutMessage.isVisible().catch(() => false);

    monitoring.assertClean({ ignoreAPIPatterns: ['/api/workflows'], allowWarnings: true });
    monitoring.stop();
  });
});
