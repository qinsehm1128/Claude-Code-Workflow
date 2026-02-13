// ========================================
// A2UI Component Registry Unit Tests
// ========================================
// Tests for component registry operations

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { A2UIComponentRegistry, a2uiRegistry } from '../core/A2UIComponentRegistry';
import type { A2UIState, ActionHandler, BindingResolver } from '../core/A2UIComponentRegistry';
import type { A2UIComponent } from '../core/A2UITypes';

// Import component renderers to trigger auto-registration
import '../renderer/components';

// Mock component renderer
const mockRenderer: any = vi.fn(() => null);
const anotherMockRenderer: any = vi.fn(() => null);

describe('A2UIComponentRegistry', () => {
  let registry: A2UIComponentRegistry;

  beforeEach(() => {
    // Create a fresh registry for each test
    registry = new A2UIComponentRegistry();
  });

  describe('register()', () => {
    it('should register a component renderer', () => {
      registry.register('TestComponent' as any, mockRenderer);
      expect(registry.has('TestComponent' as any)).toBe(true);
    });

    it('should allow overriding existing renderer', () => {
      registry.register('TestComponent' as any, mockRenderer);
      registry.register('TestComponent' as any, anotherMockRenderer);

      const retrieved = registry.get('TestComponent' as any);
      expect(retrieved).toBe(anotherMockRenderer);
    });

    it('should register multiple component types', () => {
      registry.register('Text', mockRenderer);
      registry.register('Button', mockRenderer);
      registry.register('Card', anotherMockRenderer);

      expect(registry.has('Text')).toBe(true);
      expect(registry.has('Button')).toBe(true);
      expect(registry.has('Card')).toBe(true);
    });
  });

  describe('unregister()', () => {
    it('should remove a registered renderer', () => {
      registry.register('TestComponent' as any, mockRenderer);
      expect(registry.has('TestComponent' as any)).toBe(true);

      registry.unregister('TestComponent' as any);
      expect(registry.has('TestComponent' as any)).toBe(false);
    });

    it('should be idempotent for non-existent components', () => {
      expect(() => registry.unregister('NonExistent' as any)).not.toThrow();
      expect(registry.has('NonExistent' as any)).toBe(false);
    });
  });

  describe('get()', () => {
    it('should return registered renderer', () => {
      registry.register('TestComponent' as any, mockRenderer);
      const retrieved = registry.get('TestComponent' as any);

      expect(retrieved).toBe(mockRenderer);
    });

    it('should return undefined for unregistered component', () => {
      const retrieved = registry.get('NonExistent' as any);
      expect(retrieved).toBeUndefined();
    });

    it('should return correct renderer after multiple registrations', () => {
      registry.register('First' as any, mockRenderer);
      registry.register('Second' as any, anotherMockRenderer);

      expect(registry.get('First' as any)).toBe(mockRenderer);
      expect(registry.get('Second' as any)).toBe(anotherMockRenderer);
    });
  });

  describe('has()', () => {
    it('should return true for registered components', () => {
      registry.register('TestComponent' as any, mockRenderer);
      expect(registry.has('TestComponent' as any)).toBe(true);
    });

    it('should return false for unregistered components', () => {
      expect(registry.has('NonExistent' as any)).toBe(false);
    });

    it('should return false after unregistering', () => {
      registry.register('TestComponent' as any, mockRenderer);
      expect(registry.has('TestComponent' as any)).toBe(true);

      registry.unregister('TestComponent' as any);
      expect(registry.has('TestComponent' as any)).toBe(false);
    });
  });

  describe('getRegisteredTypes()', () => {
    it('should return empty array for new registry', () => {
      const types = registry.getRegisteredTypes();
      expect(types).toEqual([]);
    });

    it('should return all registered component types', () => {
      registry.register('Text', mockRenderer);
      registry.register('Button', mockRenderer);
      registry.register('Card', anotherMockRenderer);

      const types = registry.getRegisteredTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain('Text');
      expect(types).toContain('Button');
      expect(types).toContain('Card');
    });

    it('should update after unregister', () => {
      registry.register('Text', mockRenderer);
      registry.register('Button', mockRenderer);
      registry.register('Card', anotherMockRenderer);

      registry.unregister('Button');
      const types = registry.getRegisteredTypes();

      expect(types).toHaveLength(2);
      expect(types).not.toContain('Button');
    });
  });

  describe('clear()', () => {
    it('should remove all registered renderers', () => {
      registry.register('Text', mockRenderer);
      registry.register('Button', mockRenderer);
      registry.register('Card', anotherMockRenderer);

      registry.clear();

      expect(registry.has('Text')).toBe(false);
      expect(registry.has('Button')).toBe(false);
      expect(registry.has('Card')).toBe(false);
      expect(registry.size).toBe(0);
    });

    it('should be idempotent', () => {
      registry.register('Test' as any, mockRenderer);
      registry.clear();
      expect(registry.size).toBe(0);

      registry.clear(); // Clear again
      expect(registry.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for new registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should increment on registration', () => {
      registry.register('Text', mockRenderer);
      expect(registry.size).toBe(1);

      registry.register('Button', mockRenderer);
      expect(registry.size).toBe(2);
    });

    it('should not increment on duplicate registration', () => {
      registry.register('Text', mockRenderer);
      expect(registry.size).toBe(1);

      registry.register('Text', anotherMockRenderer);
      expect(registry.size).toBe(1);
    });

    it('should decrement on unregistration', () => {
      registry.register('Text', mockRenderer);
      registry.register('Button', mockRenderer);
      expect(registry.size).toBe(2);

      registry.unregister('Text');
      expect(registry.size).toBe(1);
    });

    it('should reset on clear', () => {
      registry.register('Text', mockRenderer);
      registry.register('Button', mockRenderer);
      expect(registry.size).toBe(2);

      registry.clear();
      expect(registry.size).toBe(0);
    });
  });
});

describe('Global a2uiRegistry', () => {
  it('should be a singleton instance', () => {
    expect(a2uiRegistry).toBeInstanceOf(A2UIComponentRegistry);
  });

  it('should have built-in components registered', () => {
    // The global registry should have components registered by registry.ts
    const types = a2uiRegistry.getRegisteredTypes();
    
    // At minimum, these should be registered
    expect(types.length).toBeGreaterThan(0);
    expect(a2uiRegistry.has('Text')).toBe(true);
    expect(a2uiRegistry.has('Button')).toBe(true);
  });

  it('should allow custom component registration', () => {
    const customRenderer: any = vi.fn(() => null);
    const testType = 'TestCustomComponent' as any;

    // Register custom component
    a2uiRegistry.register(testType, customRenderer);
    expect(a2uiRegistry.has(testType)).toBe(true);

    // Clean up
    a2uiRegistry.unregister(testType);
    expect(a2uiRegistry.has(testType)).toBe(false);
  });
});

describe('Component Renderer Interface', () => {
  it('should accept all required parameters', () => {
    const mockComponent: A2UIComponent = {
      Text: { text: { literalString: 'Test' } },
    };

    const mockState: A2UIState = { key: 'value' };
    const mockOnAction: ActionHandler = vi.fn();
    const mockResolveBinding: BindingResolver = vi.fn(() => 'resolved');

    const renderer: any = (props: {
      component: A2UIComponent;
      state: A2UIState;
      onAction: ActionHandler;
      resolveBinding: BindingResolver;
    }) => {
      expect(props.component).toBeDefined();
      expect(props.state).toBeDefined();
      expect(props.onAction).toBeDefined();
      expect(props.resolveBinding).toBeDefined();
      return null;
    };

    renderer({
      component: mockComponent,
      state: mockState,
      onAction: mockOnAction,
      resolveBinding: mockResolveBinding,
    });
  });

  it('should support async action handlers', async () => {
    const asyncAction: ActionHandler = async (_actionId, _params) => {
      await Promise.resolve();
      return;
    };

    const mockComponent: A2UIComponent = {
      Button: {
        onClick: { actionId: 'click' },
        content: { Text: { text: { literalString: 'Click' } } },
      },
    };

    const mockState: A2UIState = {};
    const mockResolveBinding: BindingResolver = vi.fn();

    const renderer: any = async (props: {
      component: A2UIComponent;
      state: A2UIState;
      onAction: ActionHandler;
      resolveBinding: BindingResolver;
    }) => {
      // Should not throw with async handler
      await props.onAction('test-action', {});
      return null;
    };

    await renderer({
      component: mockComponent,
      state: mockState,
      onAction: asyncAction,
      resolveBinding: mockResolveBinding,
    });
  });
});
