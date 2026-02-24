// ========================================
// TerminalGrid Component
// ========================================
// Recursive Allotment renderer for the terminal split pane layout.
// Mirrors the LayoutContainer pattern from cli-viewer but renders
// TerminalPane components as leaf nodes.

import { useCallback, useMemo } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { cn } from '@/lib/utils';
import { isPaneId } from '@/lib/layout-utils';
import {
  useTerminalGridStore,
  selectTerminalGridLayout,
  selectTerminalGridPanes,
} from '@/stores/terminalGridStore';
import type { AllotmentLayoutGroup } from '@/stores/viewerStore';
import { TerminalPane } from './TerminalPane';

// ========== Types ==========

interface GridGroupRendererProps {
  group: AllotmentLayoutGroup;
  minSize: number;
  depth?: number;
}

// ========== Recursive Group Renderer ==========

function GridGroupRenderer({ group, minSize, depth = 0 }: GridGroupRendererProps) {
  const panes = useTerminalGridStore(selectTerminalGridPanes);
  const updateLayoutSizes = useTerminalGridStore((s) => s.updateLayoutSizes);

  const handleChange = useCallback(
    (sizes: number[]) => {
      updateLayoutSizes(sizes);
    },
    [updateLayoutSizes]
  );

  const validChildren = useMemo(() => {
    return group.children.filter((child) => {
      if (isPaneId(child)) {
        return panes[child] !== undefined;
      }
      return true;
    });
  }, [group.children, panes]);

  if (validChildren.length === 0) {
    return null;
  }

  // Generate stable key based on children
  const groupKey = useMemo(() => {
    return validChildren.map(c => isPaneId(c) ? c : 'group').join('-');
  }, [validChildren]);

  return (
    <Allotment
      key={groupKey}
      vertical={group.direction === 'vertical'}
      defaultSizes={group.sizes}
      onChange={handleChange}
    >
      {validChildren.map((child, index) => (
        <Allotment.Pane key={isPaneId(child) ? child : `group-${depth}-${index}`} minSize={minSize}>
          {isPaneId(child) ? (
            <TerminalPane paneId={child} />
          ) : (
            <GridGroupRenderer
              group={child}
              minSize={minSize}
              depth={depth + 1}
            />
          )}
        </Allotment.Pane>
      ))}
    </Allotment>
  );
}

// ========== Main Component ==========

export function TerminalGrid({ className }: { className?: string }) {
  const layout = useTerminalGridStore(selectTerminalGridLayout);
  const panes = useTerminalGridStore(selectTerminalGridPanes);

  const content = useMemo(() => {
    if (!layout.children || layout.children.length === 0) {
      return null;
    }

    // Single pane: render directly without Allotment wrapper
    if (layout.children.length === 1 && isPaneId(layout.children[0])) {
      const paneId = layout.children[0];
      if (!panes[paneId]) return null;
      return <TerminalPane paneId={paneId} />;
    }

    return (
      <GridGroupRenderer
        group={layout}
        minSize={150}
        depth={0}
      />
    );
  }, [layout, panes]);

  return (
    <div className={cn('h-full w-full overflow-hidden bg-background', className)}>
      {content}
    </div>
  );
}
