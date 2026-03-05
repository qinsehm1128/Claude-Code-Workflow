/**
 * Vite plugin for handling inline demo blocks as virtual modules.
 * This allows React JSX code embedded in markdown :::demo blocks to be
 * dynamically compiled and executed as proper React components.
 */

import type { Plugin } from 'vite'
import type { DemoBlockMeta } from './markdownTransform'

// Global registry for inline demos (populated during markdown transform)
const inlineDemoRegistry = new Map<string, { code: string; name: string }>()

// Virtual module prefix
const VIRTUAL_PREFIX = 'virtual:inline-demo:'
const VIRTUAL_PREFIX_FULL = '\0' + VIRTUAL_PREFIX

/**
 * Register an inline demo during markdown transformation.
 * Returns a virtual module ID that can be imported.
 */
export function registerInlineDemo(
  demoId: string,
  code: string,
  name: string
): string {
  inlineDemoRegistry.set(demoId, { code, name })
  return VIRTUAL_PREFIX + demoId
}

/**
 * Get registered inline demo by ID
 */
export function getInlineDemo(demoId: string) {
  return inlineDemoRegistry.get(demoId)
}

/**
 * Clear all registered demos (useful for rebuilds)
 */
export function clearInlineDemos() {
  inlineDemoRegistry.clear()
}

/**
 * Vite plugin that resolves virtual inline-demo modules.
 * These modules contain the React/JSX code from markdown :::demo blocks.
 */
export function inlineDemoPlugin(): Plugin {
  return {
    name: 'vitepress-inline-demo-plugin',
    enforce: 'pre',

    resolveId(id) {
      // Handle virtual module resolution
      if (id.startsWith(VIRTUAL_PREFIX)) {
        return VIRTUAL_PREFIX_FULL + id.slice(VIRTUAL_PREFIX.length)
      }
      return null
    },

    load(id) {
      // Load virtual module content
      if (id.startsWith(VIRTUAL_PREFIX_FULL)) {
        const demoId = id.slice(VIRTUAL_PREFIX_FULL.length)
        const demo = inlineDemoRegistry.get(demoId)

        if (!demo) {
          return `export default function MissingDemo() {
            return React.createElement('div', { className: 'demo-error' },
              'Demo not found: ${demoId}'
            )
          }`
        }

        // Wrap the inline code in an ESM module
        // The code should export a React component
        return `
import React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// User's inline demo code:
${demo.code}

// Auto-export fallback if no default export
export default ${demo.name} || (() => React.createElement('div', null, 'Demo component "${demo.name}" not found'));
`
      }
      return null
    },

    // Handle HMR for inline demos
    handleHotUpdate({ file, server }) {
      // When markdown files change, clear the registry
      if (file.endsWith('.md')) {
        clearInlineDemos()
        server.ws.send({
          type: 'full-reload',
          path: file
        })
      }
    }
  }
}

/**
 * Transform inline demo code to ensure it has proper exports.
 * This wraps bare JSX in a function component if needed.
 */
export function wrapDemoCode(code: string, componentName: string): string {
  // If code already has export, return as-is
  if (code.includes('export ')) {
    return code
  }

  // If code is just JSX (starts with <), wrap it
  const trimmedCode = code.trim()
  if (trimmedCode.startsWith('<') || trimmedCode.startsWith('React.createElement')) {
    return `
function ${componentName}() {
  return (
    ${trimmedCode}
  );
}
export default ${componentName};
`
  }

  // Otherwise return as-is and hope it defines the component
  return code + `\nexport default ${componentName};`
}
