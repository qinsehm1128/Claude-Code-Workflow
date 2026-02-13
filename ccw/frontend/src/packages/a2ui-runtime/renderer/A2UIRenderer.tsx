// ========================================
// A2UI Renderer Component
// ========================================
// React component that renders A2UI surfaces

import { useState, useCallback } from 'react';
import type { SurfaceUpdate, A2UIComponent, LiteralString, Binding } from '../core/A2UITypes';
import { a2uiRegistry, type A2UIState, type ActionHandler, type BindingResolver } from '../core/A2UIComponentRegistry';

// ========== Renderer Props ==========

interface A2UIRendererProps {
  /** Surface update to render */
  surface: SurfaceUpdate;
  /** Optional external action handler */
  onAction?: ActionHandler;
  /** Optional className for the container */
  className?: string;
}

// ========== Main Renderer Component ==========

/**
 * A2UI Surface Renderer
 * Renders A2UI surface updates as interactive React components
 */
export function A2UIRenderer({ surface, onAction, className = '' }: A2UIRendererProps) {
  // Local state initialized with surface's initial state
  const [localState] = useState<A2UIState>(surface.initialState || {});

  // Handle action from components
  const handleAction = useCallback<ActionHandler>(
    async (actionId, params) => {
      if (onAction) {
        await onAction(actionId, { ...params, ...localState });
      }
    },
    [onAction, localState]
  );

  // Resolve binding path to state value
  const resolveBinding = useCallback<BindingResolver>(
    (binding) => {
      const path = binding.path.replace(/^\//, '').split('/');
      let value: unknown = localState;

      for (const key of path) {
        if (value && typeof value === 'object' && key in value) {
          value = (value as Record<string, unknown>)[key];
        } else {
          return undefined;
        }
      }

      return value;
    },
    [localState]
  );

  return (
    <div className={`a2ui-surface ${className}`} data-surface-id={surface.surfaceId}>
      {surface.components.map((comp) => (
        <ComponentRenderer
          key={comp.id}
          id={comp.id}
          component={comp.component}
          state={localState}
          onAction={handleAction}
          resolveBinding={resolveBinding}
        />
      ))}
    </div>
  );
}

// ========== Component Renderer ==========

interface ComponentRendererProps {
  id: string;
  component: A2UIComponent;
  state: A2UIState;
  onAction: ActionHandler;
  resolveBinding: BindingResolver;
}

function ComponentRenderer({ id, component, state, onAction, resolveBinding }: ComponentRendererProps): JSX.Element | null {
  // Get component type (discriminated union key)
  const componentType = Object.keys(component)[0];

  // Get renderer from registry
  const renderer = a2uiRegistry.get(componentType as any);

  if (!renderer) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[A2UIRenderer] Unknown component type: ${componentType}`);
    }
    return (
      <div className="a2ui-error" data-component-id={id}>
        Unknown component type: {componentType}
      </div>
    );
  }

  // Render component
  try {
    return renderer({ component, state, onAction, resolveBinding });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[A2UIRenderer] Error rendering component ${id}:`, error);
    }
    return (
      <div className="a2ui-error" data-component-id={id}>
        Error rendering component: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }
}

// ========== Helper Functions ==========

/**
 * Resolve literal or binding to actual value
 * @param content - Content to resolve (literal or binding)
 * @param resolveBinding - Binding resolver function
 * @returns Resolved value
 */
export function resolveLiteralOrBinding(
  content: LiteralString | Binding | { literalNumber?: number; literalBoolean?: boolean },
  resolveBinding: BindingResolver
): string | number | boolean {
  // Check for literal string
  if ('literalString' in content) {
    return content.literalString;
  }

  // Check for literal number
  if ('literalNumber' in content && typeof content.literalNumber === 'number') {
    return content.literalNumber;
  }

  // Check for literal boolean
  if ('literalBoolean' in content && typeof content.literalBoolean === 'boolean') {
    return content.literalBoolean;
  }

  // Resolve binding
  const value = resolveBinding(content as Binding);

  // Return resolved value or empty string as fallback
  return (value ?? '') as string | number | boolean;
}

/**
 * Resolve text content to string
 * @param content - Text content to resolve
 * @param resolveBinding - Binding resolver function
 * @returns Resolved string value
 */
export function resolveTextContent(
  content: LiteralString | Binding,
  resolveBinding: BindingResolver
): string {
  const value = resolveLiteralOrBinding(content, resolveBinding);
  return String(value ?? '');
}

// ========== Export Helper Types ==========

export type { A2UIState, ActionHandler, BindingResolver };
