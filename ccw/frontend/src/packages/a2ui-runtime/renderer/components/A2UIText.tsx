// ========================================
// A2UI Text Component Renderer
// ========================================
// Maps A2UI Text component to HTML elements

import React from 'react';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveTextContent } from '../A2UIRenderer';

/**
 * A2UI Text Component Renderer
 * Maps A2UI Text usageHint to HTML elements (h1, h2, h3, p, span, code)
 */
export const A2UIText: ComponentRenderer = ({ component, resolveBinding }) => {
  const { Text } = component as { Text: { text: unknown; usageHint?: string } };

  // Resolve text content
  const text = resolveTextContent(Text.text as { literalString: string } | { path: string }, resolveBinding);
  const usageHint = Text.usageHint || 'span';

  // Map usageHint to HTML elements
  const elementMap: Record<string, React.ElementType> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    p: 'p',
    span: 'span',
    code: 'code',
    small: 'small',
  };

  // Map usageHint to Tailwind classes
  const classMap: Record<string, string> = {
    h1: 'text-2xl font-bold leading-tight',
    h2: 'text-xl font-bold leading-tight',
    h3: 'text-lg font-semibold leading-tight',
    h4: 'text-base font-semibold leading-tight',
    h5: 'text-sm font-semibold leading-tight',
    h6: 'text-xs font-semibold leading-tight',
    p: 'text-sm leading-relaxed',
    span: 'text-sm',
    code: 'font-mono text-sm bg-muted px-1 py-0.5 rounded',
    small: 'text-xs text-muted-foreground',
  };

  const ElementType = elementMap[usageHint] || 'span';
  const className = classMap[usageHint] || classMap.span;

  return <ElementType className={className}>{text}</ElementType>;
};
