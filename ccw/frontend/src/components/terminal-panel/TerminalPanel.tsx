// ========================================
// TerminalPanel Component
// ========================================
// Right-side sliding panel for terminal monitoring.
// Follows IssueDrawer pattern: overlay + fixed panel + translate-x animation.

import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { TerminalNavBar } from './TerminalNavBar';
import { TerminalMainArea } from './TerminalMainArea';

export function TerminalPanel() {
  const isPanelOpen = useTerminalPanelStore((s) => s.isPanelOpen);
  const closePanel = useTerminalPanelStore((s) => s.closePanel);

  const handleClose = useCallback(() => {
    closePanel();
  }, [closePanel]);

  // ESC key to close
  useEffect(() => {
    if (!isPanelOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPanelOpen, handleClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-1/2 bg-background border-l border-border shadow-2xl z-50 flex flex-row transition-transform duration-300 ease-in-out',
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        style={{ minWidth: '400px', maxWidth: '800px' }}
      >
        {/* Left: Icon Navigation */}
        <TerminalNavBar />

        {/* Right: Main Content */}
        <TerminalMainArea onClose={handleClose} />
      </div>
    </>
  );
}
