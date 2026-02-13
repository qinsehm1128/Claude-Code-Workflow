// ========================================
// Config Type Toggle Component
// ========================================
// Toggle between .mcp.json and .claude.json config storage formats with localStorage persistence

import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { cn } from '@/lib/utils';

// ========== Types ==========

/**
 * MCP config file type
 */
export type McpConfigType = 'mcp-json' | 'claude-json';

/**
 * Props for ConfigTypeToggle component
 */
export interface ConfigTypeToggleProps {
  /** Current config type */
  currentType: McpConfigType;
  /** Callback when config type changes */
  onTypeChange: (type: McpConfigType) => void;
  /** Whether to show warning when switching (default: true) */
  showWarning?: boolean;
  /** Number of existing servers in current config (for warning message) */
  existingServersCount?: number;
}

// ========== Constants ==========

/**
 * localStorage key for config type persistence
 */
const CONFIG_TYPE_STORAGE_KEY = 'mcp-config-type';

/**
 * Default config type
 */
const DEFAULT_CONFIG_TYPE: McpConfigType = 'mcp-json';

// ========== Helper Functions ==========

/**
 * Load config type from localStorage
 */
export function loadConfigType(): McpConfigType {
  try {
    const stored = localStorage.getItem(CONFIG_TYPE_STORAGE_KEY);
    if (stored === 'mcp-json' || stored === 'claude-json') {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_CONFIG_TYPE;
}

/**
 * Save config type to localStorage
 */
export function saveConfigType(type: McpConfigType): void {
  try {
    localStorage.setItem(CONFIG_TYPE_STORAGE_KEY, type);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get file extension for config type
 */
export function getConfigFileExtension(type: McpConfigType): string {
  switch (type) {
    case 'mcp-json':
      return '.mcp.json';
    case 'claude-json':
      return '.claude.json';
    default:
      return '.json';
  }
}

// ========== Component ==========

/**
 * Config type toggle segmented control
 */
export function ConfigTypeToggle({
  currentType,
  onTypeChange,
  showWarning = true,
  existingServersCount = 0,
}: ConfigTypeToggleProps) {
  const { formatMessage } = useIntl();
  const [internalType, setInternalType] = useState<McpConfigType>(currentType);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingType, setPendingType] = useState<McpConfigType | null>(null);

  // Sync internal state with prop changes
  useEffect(() => {
    setInternalType(currentType);
  }, [currentType]);

  // Load saved preference on mount (only if no current type is set)
  useEffect(() => {
    if (!currentType || currentType === DEFAULT_CONFIG_TYPE) {
      const savedType = loadConfigType();
      if (savedType !== currentType) {
        setInternalType(savedType);
        onTypeChange(savedType);
      }
    }
  }, []); // Run once on mount

  // Handle type toggle click
  const handleTypeClick = (type: McpConfigType) => {
    if (type === internalType) return;

    if (showWarning && existingServersCount > 0) {
      setPendingType(type);
      setShowWarningDialog(true);
    } else {
      applyTypeChange(type);
    }
  };

  // Apply the type change
  const applyTypeChange = (type: McpConfigType) => {
    setInternalType(type);
    saveConfigType(type);
    onTypeChange(type);
    setShowWarningDialog(false);
    setPendingType(null);
  };

  // Handle warning dialog confirm
  const handleWarningConfirm = () => {
    if (pendingType) {
      applyTypeChange(pendingType);
    }
  };

  // Handle warning dialog cancel
  const handleWarningCancel = () => {
    setShowWarningDialog(false);
    setPendingType(null);
  };

  return (
    <>
      {/* Compact inline toggle */}
      <div className="flex items-center gap-1.5 p-0.5 bg-muted rounded-md h-9">
        <button
          type="button"
          onClick={() => handleTypeClick('mcp-json')}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded transition-all',
            internalType === 'mcp-json'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          .mcp.json
        </button>
        <button
          type="button"
          onClick={() => handleTypeClick('claude-json')}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded transition-all',
            internalType === 'claude-json'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          .claude.json
        </button>
      </div>

      {/* Warning Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {formatMessage({ id: 'mcp.configType.switchConfirm' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage({ id: 'mcp.configType.switchWarning' })}
              {existingServersCount > 0 && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  {existingServersCount} {formatMessage({ id: 'mcp.stats.total' }).toLowerCase()}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWarningCancel}>
              {formatMessage({ id: 'mcp.configType.switchCancel' })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleWarningConfirm}>
              {formatMessage({ id: 'mcp.configType.switchConfirm' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ConfigTypeToggle;
