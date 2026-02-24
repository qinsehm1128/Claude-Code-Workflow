// ========================================
// Layout Utilities Tests
// ========================================
// Tests for Allotment layout tree manipulation functions

import { describe, it, expect } from 'vitest';
import {
  isPaneId,
  findPaneInLayout,
  removePaneFromLayout,
  addPaneToLayout,
  getAllPaneIds,
} from './layout-utils';
import type { AllotmentLayoutGroup } from '@/stores/viewerStore';

describe('layout-utils', () => {
  // Helper to create test layouts
  const createSimpleLayout = (): AllotmentLayoutGroup => ({
    direction: 'horizontal',
    children: ['pane-1', 'pane-2', 'pane-3'],
    sizes: [33, 33, 34],
  });

  const createNestedLayout = (): AllotmentLayoutGroup => ({
    direction: 'horizontal',
    children: [
      'pane-1',
      {
        direction: 'vertical',
        children: ['pane-2', 'pane-3'],
        sizes: [50, 50],
      },
      'pane-4',
    ],
    sizes: [25, 50, 25],
  });

  describe('isPaneId', () => {
    it('should return true for string values (PaneId)', () => {
      expect(isPaneId('pane-1')).toBe(true);
      expect(isPaneId('any-string')).toBe(true);
    });

    it('should return false for group objects', () => {
      const group: AllotmentLayoutGroup = {
        direction: 'horizontal',
        children: ['pane-1'],
      };
      expect(isPaneId(group)).toBe(false);
    });
  });

  describe('findPaneInLayout', () => {
    it('should find existing pane in simple layout', () => {
      const layout = createSimpleLayout();
      const result = findPaneInLayout(layout, 'pane-2');

      expect(result.found).toBe(true);
      expect(result.index).toBe(1);
      expect(result.parent).toBe(layout);
    });

    it('should return not found for non-existing pane', () => {
      const layout = createSimpleLayout();
      const result = findPaneInLayout(layout, 'non-existing');

      expect(result.found).toBe(false);
      expect(result.index).toBe(-1);
      expect(result.parent).toBeNull();
    });

    it('should find pane in nested layout', () => {
      const layout = createNestedLayout();
      const result = findPaneInLayout(layout, 'pane-3');

      expect(result.found).toBe(true);
      expect(result.index).toBe(1);
      expect(result.parent).toEqual({
        direction: 'vertical',
        children: ['pane-2', 'pane-3'],
        sizes: [50, 50],
      });
    });

    it('should find pane at root level in nested layout', () => {
      const layout = createNestedLayout();
      const result = findPaneInLayout(layout, 'pane-1');

      expect(result.found).toBe(true);
      expect(result.index).toBe(0);
    });
  });

  describe('removePaneFromLayout', () => {
    it('should remove pane from simple layout', () => {
      const layout = createSimpleLayout();
      const result = removePaneFromLayout(layout, 'pane-2');

      expect(result.children).toEqual(['pane-1', 'pane-3']);
      expect(result.children).toHaveLength(2);
    });

    it('should update sizes after removal', () => {
      const layout = createSimpleLayout();
      const result = removePaneFromLayout(layout, 'pane-2');

      expect(result.sizes).toBeDefined();
      expect(result.sizes?.length).toBe(2);
      // Sizes should be normalized to sum ~100
      const sum = result.sizes?.reduce((a, b) => a + b, 0) ?? 0;
      expect(Math.round(sum)).toBeCloseTo(100, 0);
    });

    it('should handle removal from empty layout', () => {
      const layout: AllotmentLayoutGroup = {
        direction: 'horizontal',
        children: [],
      };
      const result = removePaneFromLayout(layout, 'pane-1');

      expect(result.children).toEqual([]);
    });

    it('should remove pane from nested layout', () => {
      const layout = createNestedLayout();
      const result = removePaneFromLayout(layout, 'pane-3');

      const allPanes = getAllPaneIds(result);
      expect(allPanes).not.toContain('pane-3');
      expect(allPanes).toContain('pane-1');
      expect(allPanes).toContain('pane-2');
      expect(allPanes).toContain('pane-4');
    });

    it('should handle removal of non-existing pane', () => {
      const layout = createSimpleLayout();
      const result = removePaneFromLayout(layout, 'non-existing');

      expect(result.children).toEqual(['pane-1', 'pane-2', 'pane-3']);
    });

    it('should clean up empty groups after removal', () => {
      const layout: AllotmentLayoutGroup = {
        direction: 'horizontal',
        children: [
          {
            direction: 'vertical',
            children: ['only-pane'],
            sizes: [100],
          },
        ],
        sizes: [100],
      };

      const result = removePaneFromLayout(layout, 'only-pane');
      expect(result.children).toEqual([]);
    });
  });

  describe('addPaneToLayout', () => {
    it('should add pane to empty layout', () => {
      const layout: AllotmentLayoutGroup = {
        direction: 'horizontal',
        children: [],
      };
      const result = addPaneToLayout(layout, 'new-pane');

      expect(result.children).toEqual(['new-pane']);
      expect(result.sizes).toEqual([100]);
    });

    it('should add pane to layout with same direction', () => {
      const layout = createSimpleLayout();
      const result = addPaneToLayout(layout, 'new-pane');

      expect(result.children).toHaveLength(4);
      expect(result.children).toContain('new-pane');
    });

    it('should add pane next to specific parent pane', () => {
      const layout = createSimpleLayout();
      const result = addPaneToLayout(layout, 'new-pane', 'pane-2', 'horizontal');

      expect(result.children).toContain('new-pane');
      // The new pane should be added relative to pane-2
    });

    it('should create nested group when direction differs', () => {
      const layout: AllotmentLayoutGroup = {
        direction: 'horizontal',
        children: ['pane-1'],
        sizes: [100],
      };
      const result = addPaneToLayout(layout, 'new-pane', undefined, 'vertical');

      // Should create a vertical group containing the original layout and new pane
      expect(result.direction).toBe('vertical');
    });

    it('should handle deeply nested layouts', () => {
      const layout = createNestedLayout();
      const result = addPaneToLayout(layout, 'new-pane', 'pane-3', 'horizontal');

      const allPanes = getAllPaneIds(result);
      expect(allPanes).toContain('new-pane');
      expect(allPanes).toContain('pane-3');
    });

    it('should distribute sizes when adding to same direction', () => {
      const layout = createSimpleLayout();
      const result = addPaneToLayout(layout, 'new-pane');

      // Should have 4 children with distributed sizes
      expect(result.sizes).toHaveLength(4);
      const sum = result.sizes?.reduce((a, b) => a + b, 0) ?? 0;
      expect(Math.round(sum)).toBeCloseTo(100, 0);
    });
  });

  describe('getAllPaneIds', () => {
    it('should get all pane IDs from simple layout', () => {
      const layout = createSimpleLayout();
      const result = getAllPaneIds(layout);

      expect(result).toEqual(['pane-1', 'pane-2', 'pane-3']);
    });

    it('should get all pane IDs from nested layout', () => {
      const layout = createNestedLayout();
      const result = getAllPaneIds(layout);

      expect(result).toHaveLength(4);
      expect(result).toContain('pane-1');
      expect(result).toContain('pane-2');
      expect(result).toContain('pane-3');
      expect(result).toContain('pane-4');
    });

    it('should return empty array for empty layout', () => {
      const layout: AllotmentLayoutGroup = {
        direction: 'horizontal',
        children: [],
      };
      const result = getAllPaneIds(layout);

      expect(result).toEqual([]);
    });

    it('should handle deeply nested layouts', () => {
      const layout: AllotmentLayoutGroup = {
        direction: 'horizontal',
        children: [
          {
            direction: 'vertical',
            children: [
              'pane-1',
              {
                direction: 'horizontal',
                children: ['pane-2', 'pane-3'],
              },
            ],
          },
          'pane-4',
        ],
      };

      const result = getAllPaneIds(layout);
      expect(result).toHaveLength(4);
      expect(result).toContain('pane-1');
      expect(result).toContain('pane-2');
      expect(result).toContain('pane-3');
      expect(result).toContain('pane-4');
    });
  });

  describe('integration: remove then add', () => {
    it('should maintain layout integrity after remove and add', () => {
      const layout = createNestedLayout();

      // Remove a pane
      const afterRemove = removePaneFromLayout(layout, 'pane-2');
      expect(getAllPaneIds(afterRemove)).not.toContain('pane-2');

      // Add a new pane
      const afterAdd = addPaneToLayout(afterRemove, 'new-pane');
      const allPanes = getAllPaneIds(afterAdd);

      expect(allPanes).toContain('new-pane');
      expect(allPanes).not.toContain('pane-2');
      expect(allPanes).toContain('pane-3');
    });
  });
});
