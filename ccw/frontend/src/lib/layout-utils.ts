// ========================================
// Layout Utilities
// ========================================
// Pure functions for manipulating Allotment layout trees.
// Extracted from viewerStore for reuse across terminal grid and CLI viewer.

import type { AllotmentLayoutGroup, PaneId } from '@/stores/viewerStore';

/**
 * Check if a layout child is a PaneId (string) or a nested group
 */
export function isPaneId(value: PaneId | AllotmentLayoutGroup): value is PaneId {
  return typeof value === 'string';
}

/**
 * Find a pane ID in the layout tree
 */
export function findPaneInLayout(
  layout: AllotmentLayoutGroup,
  paneId: PaneId
): { found: boolean; parent: AllotmentLayoutGroup | null; index: number } {
  const search = (
    group: AllotmentLayoutGroup,
    _parent: AllotmentLayoutGroup | null
  ): { found: boolean; parent: AllotmentLayoutGroup | null; index: number } => {
    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
      if (isPaneId(child)) {
        if (child === paneId) {
          return { found: true, parent: group, index: i };
        }
      } else {
        const result = search(child, group);
        if (result.found) {
          return result;
        }
      }
    }
    return { found: false, parent: null, index: -1 };
  };

  return search(layout, null);
}

/**
 * Remove a pane from layout and clean up empty groups
 */
export function removePaneFromLayout(
  layout: AllotmentLayoutGroup,
  paneId: PaneId
): AllotmentLayoutGroup {
  const removeFromGroup = (group: AllotmentLayoutGroup): AllotmentLayoutGroup | null => {
    const newChildren: (PaneId | AllotmentLayoutGroup)[] = [];

    for (const child of group.children) {
      if (isPaneId(child)) {
        if (child !== paneId) {
          newChildren.push(child);
        }
      } else {
        const cleanedChild = removeFromGroup(child);
        if (cleanedChild && cleanedChild.children.length > 0) {
          if (cleanedChild.children.length === 1) {
            newChildren.push(cleanedChild.children[0]);
          } else {
            newChildren.push(cleanedChild);
          }
        }
      }
    }

    if (newChildren.length === 0) {
      return null;
    }

    const newSizes = group.sizes
      ? group.sizes.filter((_, i) => {
          const child = group.children[i];
          return !isPaneId(child) || child !== paneId;
        })
      : undefined;

    const normalizedSizes = newSizes
      ? (() => {
          const total = newSizes.reduce((sum, s) => sum + s, 0);
          return total > 0 ? newSizes.map((s) => (s / total) * 100) : undefined;
        })()
      : undefined;

    return {
      direction: group.direction,
      sizes: normalizedSizes,
      children: newChildren,
    };
  };

  const result = removeFromGroup(layout);
  return result || { direction: 'horizontal', children: [] };
}

/**
 * Add a pane to the layout at a specific position
 */
export function addPaneToLayout(
  layout: AllotmentLayoutGroup,
  newPaneId: PaneId,
  parentPaneId?: PaneId,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): AllotmentLayoutGroup {
  if (!parentPaneId) {
    if (layout.children.length === 0) {
      return {
        ...layout,
        children: [newPaneId],
        sizes: [100],
      };
    }

    if (layout.direction === direction) {
      const currentSizes = layout.sizes || layout.children.map(() => 100 / layout.children.length);
      const totalSize = currentSizes.reduce((sum, s) => sum + s, 0);
      const newSize = totalSize / (layout.children.length + 1);
      const scaleFactor = (totalSize - newSize) / totalSize;

      return {
        ...layout,
        children: [...layout.children, newPaneId],
        sizes: [...currentSizes.map((s) => s * scaleFactor), newSize],
      };
    }

    return {
      direction,
      sizes: [50, 50],
      children: [layout, newPaneId],
    };
  }

  const addRelativeTo = (group: AllotmentLayoutGroup): AllotmentLayoutGroup => {
    const newChildren: (PaneId | AllotmentLayoutGroup)[] = [];
    let newSizes: number[] | undefined = group.sizes ? [] : undefined;

    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
      const childSize = group.sizes ? group.sizes[i] : undefined;

      if (isPaneId(child)) {
        if (child === parentPaneId) {
          if (group.direction === direction) {
            const halfSize = (childSize || 50) / 2;
            newChildren.push(child, newPaneId);
            if (newSizes) {
              newSizes.push(halfSize, halfSize);
            }
          } else {
            const newGroup: AllotmentLayoutGroup = {
              direction,
              sizes: [50, 50],
              children: [child, newPaneId],
            };
            newChildren.push(newGroup);
            if (newSizes && childSize !== undefined) {
              newSizes.push(childSize);
            }
          }
        } else {
          newChildren.push(child);
          if (newSizes && childSize !== undefined) {
            newSizes.push(childSize);
          }
        }
      } else {
        const result = findPaneInLayout(child, parentPaneId);
        if (result.found) {
          newChildren.push(addRelativeTo(child));
        } else {
          newChildren.push(child);
        }
        if (newSizes && childSize !== undefined) {
          newSizes.push(childSize);
        }
      }
    }

    return {
      ...group,
      children: newChildren,
      sizes: newSizes,
    };
  };

  return addRelativeTo(layout);
}

/**
 * Get all pane IDs from layout
 */
export function getAllPaneIds(layout: AllotmentLayoutGroup): PaneId[] {
  const paneIds: PaneId[] = [];

  const traverse = (group: AllotmentLayoutGroup) => {
    for (const child of group.children) {
      if (isPaneId(child)) {
        paneIds.push(child);
      } else {
        traverse(child);
      }
    }
  };

  traverse(layout);
  return paneIds;
}
