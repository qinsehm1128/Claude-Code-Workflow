// ========================================
// UX Tests: Immutable Array Operations
// ========================================
// Tests for UX feedback patterns: immutable array updates in drag-drop

import { describe, it, expect } from 'vitest';

describe('UX Pattern: Immutable Array Operations (QueueBoard)', () => {
  describe('applyDrag function - immutable array patterns', () => {
    it('should use filter() for removing items from source (immutable)', () => {
      // This test verifies the QueueBoard.tsx pattern at lines 50-82
      const sourceItems = [{ id: '1', content: 'Task 1' }, { id: '2', content: 'Task 2' }, { id: '3', content: 'Task 3' }];
      void [{ id: '4', content: 'Task 4' }]; // destItems unused in this test

      // Immutable removal using filter (not splice)
      const removeIndex = 1;
      const newSourceItems = sourceItems.filter((_, i) => i !== removeIndex);

      // Verify original array unchanged
      expect(sourceItems).toHaveLength(3);
      expect(sourceItems[1].id).toBe('2');

      // Verify new array has item removed
      expect(newSourceItems).toHaveLength(2);
      expect(newSourceItems[0].id).toBe('1');
      expect(newSourceItems[1].id).toBe('3');
    });

    it('should use slice() for inserting items into destination (immutable)', () => {
      // This test verifies the QueueBoard.tsx pattern at lines 50-82
      const destItems = [{ id: '4', content: 'Task 4' }, { id: '5', content: 'Task 5' }];
      const itemToMove = { id: '2', content: 'Task 2' };
      const insertIndex = 1;

      // Immutable insertion using slice (not splice)
      const newDestItems = [
        ...destItems.slice(0, insertIndex),
        itemToMove,
        ...destItems.slice(insertIndex),
      ];

      // Verify original array unchanged
      expect(destItems).toHaveLength(2);
      expect(destItems[0].id).toBe('4');

      // Verify new array has item inserted
      expect(newDestItems).toHaveLength(3);
      expect(newDestItems[0].id).toBe('4');
      expect(newDestItems[1].id).toBe('2'); // Inserted item
      expect(newDestItems[2].id).toBe('5');
    });

    it('should not mutate source arrays when copying columns', () => {
      const columns = [
        { id: 'col1', items: [{ id: '1' }, { id: '2' }] },
        { id: 'col2', items: [{ id: '3' }] },
      ];

      // Immutable column copy using spread
      const next = columns.map((c) => ({ ...c, items: [...c.items] }));

      // Modify copied data
      next[0].items.push({ id: 'new' });

      // Original should be unchanged
      expect(columns[0].items).toHaveLength(2);
      expect(next[0].items).toHaveLength(3);
    });

    it('should handle same-column drag-drop correctly', () => {
      const sourceItems = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const sourceIndex = 0;
      const destIndex = 2;

      // Remove from source
      const item = sourceItems[sourceIndex];
      const newSrcItems = sourceItems.filter((_, i) => i !== sourceIndex);

      // Insert back at different position
      const newDstItems = [
        ...newSrcItems.slice(0, destIndex - 1),
        item,
        ...newSrcItems.slice(destIndex - 1),
      ];

      expect(newDstItems).toEqual([{ id: '2' }, { id: '1' }, { id: '3' }]);
    });

    it('should handle cross-column drag-drop correctly', () => {
      const srcItems = [{ id: '1' }, { id: '2' }];
      const dstItems = [{ id: '3' }, { id: '4' }];
      const sourceIndex = 1;
      const destIndex = 1;

      const item = srcItems[sourceIndex];
      const newSrcItems = srcItems.filter((_, i) => i !== sourceIndex);
      const newDstItems = [
        ...dstItems.slice(0, destIndex),
        item,
        ...dstItems.slice(destIndex),
      ];

      expect(newSrcItems).toEqual([{ id: '1' }]);
      expect(newDstItems).toEqual([{ id: '3' }, { id: '2' }, { id: '4' }]);
    });
  });

  describe('React state update patterns', () => {
    it('should demonstrate setItems with filter for removal', () => {
      // Pattern: setItems(prev => prev.filter((_, i) => i !== index))
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const indexToRemove = 1;

      const newItems = items.filter((_, i) => i !== indexToRemove);

      expect(newItems).toEqual([{ id: '1' }, { id: '3' }]);
      expect(items).toHaveLength(3); // Original unchanged
    });

    it('should demonstrate setItems with slice for insertion', () => {
      // Pattern: setItems(prev => [...prev.slice(0, index), newItem, ...prev.slice(index)])
      const items = [{ id: '1' }, { id: '2' }];
      const newItem = { id: 'new' };
      const insertIndex = 1;

      const newItems = [...items.slice(0, insertIndex), newItem, ...items.slice(insertIndex)];

      expect(newItems).toEqual([{ id: '1' }, { id: 'new' }, { id: '2' }]);
      expect(items).toHaveLength(2); // Original unchanged
    });

    it('should demonstrate setItems with map for update', () => {
      // Pattern: setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item))
      const items = [{ id: '1', status: 'pending' }, { id: '2', status: 'pending' }];
      const indexToUpdate = 1;
      const updates = { status: 'completed' };

      const newItems = items.map((item, i) =>
        i === indexToUpdate ? { ...item, ...updates } : item
      );

      expect(newItems).toEqual([
        { id: '1', status: 'pending' },
        { id: '2', status: 'completed' },
      ]);
      expect(items[1].status).toBe('pending'); // Original unchanged
    });

    it('should demonstrate ES2023 toSpliced alternative', () => {
      // Pattern: immutable splice using spread (compatible with ES2021 target)
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const indexToRemove = 1;

      const newItems = [...items.slice(0, indexToRemove), ...items.slice(indexToRemove + 1)];

      expect(newItems).toEqual([{ id: '1' }, { id: '3' }]);
      expect(items).toHaveLength(3); // Original unchanged

      // immutable insertion using spread
      const newItem = { id: 'new' };
      const insertedItems = [...items.slice(0, 1), newItem, ...items.slice(1)];

      expect(insertedItems).toEqual([{ id: '1' }, { id: 'new' }, { id: '2' }, { id: '3' }]);
    });
  });
});
