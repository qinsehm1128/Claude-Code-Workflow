// ========================================
// CCW Logo Component
// ========================================
// Line-style logo for Claude Code Workflow

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CCWLogoProps {
  /** Size of the icon */
  size?: number;
  /** Additional class names */
  className?: string;
  /** Whether to show the status dot */
  showDot?: boolean;
}

/**
 * Hook to get reactive theme accent color
 */
function useThemeAccentColor(): string {
  const [accentColor, setAccentColor] = useState<string>(() => {
    if (typeof document === 'undefined') return 'hsl(220, 60%, 65%)';
    const root = document.documentElement;
    const accentValue = getComputedStyle(root).getPropertyValue('--accent').trim();
    return accentValue ? `hsl(${accentValue})` : 'hsl(220, 60%, 65%)';
  });

  useEffect(() => {
    const updateAccentColor = () => {
      const root = document.documentElement;
      const accentValue = getComputedStyle(root).getPropertyValue('--accent').trim();
      setAccentColor(accentValue ? `hsl(${accentValue})` : 'hsl(220, 60%, 65%)');
    };

    // Initial update
    updateAccentColor();

    // Watch for theme changes via MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateAccentColor();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return accentColor;
}

/**
 * Line-style CCW logo component
 * Features three horizontal lines with a status dot that follows theme color
 */
export function CCWLogo({ size = 24, className, showDot = true }: CCWLogoProps) {
  const accentColor = useThemeAccentColor();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('ccw-logo', className)}
      style={{ color: accentColor }}
      aria-label="Claude Code Workflow"
    >
      {/* Three horizontal lines - line style */}
      <line
        x1="3"
        y1="6"
        x2="18"
        y2="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="12"
        x2="15"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="18"
        x2="12"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Status dot - follows theme color via currentColor */}
      {showDot && (
        <circle
          cx="19"
          cy="17"
          r="3"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

export default CCWLogo;
