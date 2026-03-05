// ========================================
// CcwToolsMcpCard Component Tests
// ========================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  installCcwMcp: vi.fn(),
  uninstallCcwMcp: vi.fn(),
  updateCcwConfig: vi.fn(),
  installCcwMcpToCodex: vi.fn(),
  uninstallCcwMcpFromCodex: vi.fn(),
  updateCcwConfigForCodex: vi.fn(),
}));

vi.mock('@/lib/api', () => apiMock);

const notificationsMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

// Avoid importing the full hooks barrel in this component test (it has heavy deps and
// side effects that aren't relevant here).
vi.mock('@/hooks', () => ({
  mcpServersKeys: { all: ['mcpServers'] },
  useNotifications: () => notificationsMock,
}));

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: (selector: (state: { projectPath: string }) => string) =>
    selector({ projectPath: '' }),
  selectProjectPath: (state: { projectPath: string }) => state.projectPath,
}));

describe('CcwToolsMcpCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables all tools when clicking "Disable All" button', async () => {
    const { CcwToolsMcpCard } = await import('./CcwToolsMcpCard');
    const onUpdateConfigMock = vi.fn();

    render(
      <CcwToolsMcpCard
        target="codex"
        isInstalled={true}
        enabledTools={['write_file', 'read_file', 'edit_file']}
        onToggleTool={vi.fn()}
        onUpdateConfig={onUpdateConfigMock}
        onInstall={vi.fn()}
      />,
      { locale: 'en' }
    );

    const user = userEvent.setup();
    // Expand the card
    await act(async () => {
      await user.click(screen.getByText(/CCW MCP Server|mcp\.ccw\.title/i));
    });

    // Find and click "Disable All" button
    const disableAllButton = screen.getByRole('button', {
      name: /Disable All|mcp\.ccw\.actions\.disableAll/i,
    });
    expect(disableAllButton).toBeEnabled();
    await act(async () => {
      await user.click(disableAllButton);
    });

    // Verify onUpdateConfig was called with empty enabledTools array
    await waitFor(() => {
      expect(onUpdateConfigMock).toHaveBeenCalledWith({ enabledTools: [] });
    });
  });

  it('preserves enabledTools when saving config (Codex)', async () => {
    const { CcwToolsMcpCard } = await import('./CcwToolsMcpCard');
    const updateCodexMock = vi.mocked(apiMock.updateCcwConfigForCodex);
    updateCodexMock.mockResolvedValue({
      isInstalled: true,
      enabledTools: [],
      installedScopes: ['global'],
    });

    render(
      <CcwToolsMcpCard
        target="codex"
        isInstalled={true}
        enabledTools={['write_file', 'read_many_files']}
        onToggleTool={vi.fn()}
        onUpdateConfig={vi.fn()}
        onInstall={vi.fn()}
      />,
      { locale: 'en' }
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText(/CCW MCP Server|mcp\.ccw\.title/i));
    });
    const saveButton = screen.getByRole('button', {
      name: /Save Configuration|mcp\.ccw\.actions\.saveConfig/i,
    });
    expect(saveButton).toBeEnabled();
    await act(async () => {
      await user.click(saveButton);
    });

    await waitFor(() => {
      expect(updateCodexMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(notificationsMock.success).toHaveBeenCalled();
    });

    const [payload] = updateCodexMock.mock.calls[0] ?? [];
    expect(payload).toEqual(
      expect.objectContaining({
        enabledTools: ['write_file', 'read_many_files'],
      })
    );
  });

  it('preserves enabledTools when saving config (Claude)', async () => {
    const { CcwToolsMcpCard } = await import('./CcwToolsMcpCard');
    const updateClaudeMock = vi.mocked(apiMock.updateCcwConfig);
    updateClaudeMock.mockResolvedValue({
      isInstalled: true,
      enabledTools: [],
      installedScopes: ['global'],
    });

    render(
      <CcwToolsMcpCard
        isInstalled={true}
        enabledTools={['write_file', 'smart_search']}
        onToggleTool={vi.fn()}
        onUpdateConfig={vi.fn()}
        onInstall={vi.fn()}
      />,
      { locale: 'en' }
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText(/CCW MCP Server|mcp\.ccw\.title/i));
    });
    const saveButton = screen.getByRole('button', {
      name: /Save Configuration|mcp\.ccw\.actions\.saveConfig/i,
    });
    expect(saveButton).toBeEnabled();
    await act(async () => {
      await user.click(saveButton);
    });

    await waitFor(() => {
      expect(updateClaudeMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(notificationsMock.success).toHaveBeenCalled();
    });

    const [payload] = updateClaudeMock.mock.calls[0] ?? [];
    expect(payload).toEqual(
      expect.objectContaining({
        enabledTools: ['write_file', 'smart_search'],
      })
    );
  });
});
