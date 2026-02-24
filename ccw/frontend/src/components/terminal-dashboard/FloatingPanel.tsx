// ========================================
// FloatingPanel Component
// ========================================
// Generic floating panel container (Drawer style).
// Slides in from left or right side, overlaying the terminal grid.

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface FloatingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  width?: number | string;
  children: React.ReactNode;
}

// ========== Component ==========

export function FloatingPanel({
  isOpen,
  onClose,
  title,
  side = 'left',
  width = 320,
  children,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        style={{ top: '40px', bottom: 0, left: 0, right: 0 }}
        onClick={handleBackdropClick}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed z-50 flex flex-col bg-background border-border shadow-lg',
          'transition-transform duration-200 ease-out',
          side === 'left' && 'left-0 border-r',
          side === 'right' && 'right-0 border-l',
          // Transform based on open state and side
          side === 'left' && (isOpen ? 'translate-x-0' : '-translate-x-full'),
          side === 'right' && (isOpen ? 'translate-x-0' : 'translate-x-full'),
        )}
        style={{
          top: '40px', // Below toolbar
          height: 'calc(100vh - 40px)', // Full height below toolbar
          width: typeof width === 'number' ? `${width}px` : width,
        }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
