// ========================================
// HookCard UX Tests - Delete Confirmation
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { HookCard } from './HookCard';
import type { HookCardData } from './HookCard';

// Mock translations
const mockMessages = {
  'cliHooks.trigger.SessionStart': 'Session Start',
  'cliHooks.trigger.UserPromptSubmit': 'User Prompt Submit',
  'cliHooks.trigger.PreToolUse': 'Pre Tool Use',
  'cliHooks.trigger.PostToolUse': 'Post Tool Use',
  'cliHooks.trigger.Stop': 'Stop',
  'cliHooks.trigger.Notification': 'Notification',
  'cliHooks.trigger.SubagentStart': 'Subagent Start',
  'cliHooks.trigger.SubagentStop': 'Subagent Stop',
  'cliHooks.trigger.PreCompact': 'Pre Compact',
  'cliHooks.trigger.SessionEnd': 'Session End',
  'cliHooks.trigger.PostToolUseFailure': 'Post Tool Use Failure',
  'cliHooks.trigger.PermissionRequest': 'Permission Request',
  'cliHooks.allTools': 'All Tools',
  'common.status.enabled': 'Enabled',
  'common.status.disabled': 'Disabled',
  'common.actions.edit': 'Edit',
  'common.actions.delete': 'Delete',
  'cliHooks.actions.enable': 'Enable',
  'cliHooks.actions.disable': 'Disable',
  'cliHooks.actions.expand': 'Expand',
  'cliHooks.actions.collapse': 'Collapse',
  'cliHooks.form.description': 'Description',
  'cliHooks.form.matcher': 'Matcher',
  'cliHooks.form.command': 'Command',
};

function renderWithIntl(component: React.ReactElement) {
  return render(
    <IntlProvider messages={mockMessages} locale="en">
      {component}
    </IntlProvider>
  );
}

describe('HookCard - Delete Confirmation UX Pattern', () => {
  const mockHook: HookCardData = {
    name: 'test-hook',
    description: 'Test hook description',
    enabled: true,
    trigger: 'PreToolUse',
    matcher: '.*',
    command: 'echo "test"',
  };

  const mockHandlers = {
    onToggleExpand: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show confirmation dialog when delete button is clicked', async () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    // Click delete button
    const deleteButton = screen.getByTitle('Delete');
    fireEvent.click(deleteButton);

    // Verify dialog appears
    await waitFor(() => {
      expect(screen.getByText('Delete CLI Hook?')).toBeInTheDocument();
    });
  });

  it('should display hook name in confirmation dialog', async () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      const dialog = screen.getByText(/This action cannot be undone/);
      expect(dialog).toBeInTheDocument();
      expect(dialog.textContent).toContain('test-hook');
    });
  });

  it('should call onDelete when confirm is clicked', async () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: /Delete/i });
      fireEvent.click(confirmButton);
    });

    expect(mockHandlers.onDelete).toHaveBeenCalledWith('test-hook');
  });

  it('should NOT call onDelete when cancel is clicked', async () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);
    });

    expect(mockHandlers.onDelete).not.toHaveBeenCalled();
  });

  it('should close dialog when cancel is clicked', async () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(screen.getByText('Delete CLI Hook?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Delete CLI Hook?')).not.toBeInTheDocument();
    });
  });

  it('should close dialog after successful deletion', async () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(screen.getByText('Delete CLI Hook?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(screen.queryByText('Delete CLI Hook?')).not.toBeInTheDocument();
    });
  });

  it('should have delete button with destructive styling', () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    const deleteButton = screen.getByTitle('Delete');
    expect(deleteButton).toHaveClass('text-destructive');
  });

  it('should not show dialog on initial render', () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    expect(screen.queryByText('Delete CLI Hook?')).not.toBeInTheDocument();
  });
});

describe('HookCard - State Update UX', () => {
  const mockHook: HookCardData = {
    name: 'state-test-hook',
    enabled: true,
    trigger: 'SessionStart',
  };

  const mockHandlers = {
    onToggleExpand: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  it('should call onToggle with correct parameters', () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    const toggleButton = screen.getByTitle('Disable');
    fireEvent.click(toggleButton);

    expect(mockHandlers.onToggle).toHaveBeenCalledWith('state-test-hook', false);
  });

  it('should call onEdit when edit button is clicked', () => {
    renderWithIntl(
      <HookCard
        hook={mockHook}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    const editButton = screen.getByTitle('Edit');
    fireEvent.click(editButton);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockHook);
  });

  it('should show enabled status badge', () => {
    renderWithIntl(
      <HookCard
        hook={{ ...mockHook, enabled: true }}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('should show disabled status badge', () => {
    renderWithIntl(
      <HookCard
        hook={{ ...mockHook, enabled: false }}
        isExpanded={false}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });
});
