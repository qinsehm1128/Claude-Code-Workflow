/**
 * Terminal Layout Presets Demo
 * Interactive layout preset buttons
 */
import React, { useState } from 'react'

export default function TerminalLayoutPresets() {
  const [layout, setLayout] = useState('grid-2x2')

  const layouts = {
    single: 'grid-cols-1 grid-rows-1',
    'split-h': 'grid-cols-2 grid-rows-1',
    'split-v': 'grid-cols-1 grid-rows-2',
    'grid-2x2': 'grid-cols-2 grid-rows-2',
  }

  return (
    <div className="p-6 bg-background space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Terminal Layout Presets</h3>
        <div className="flex gap-2">
          {Object.keys(layouts).map((preset) => (
            <button
              key={preset}
              onClick={() => setLayout(preset)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                layout === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-accent'
              }`}
            >
              {preset.replace('-', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-2 h-64 ${layouts[layout]}`}>
        {Array.from({ length: layout === 'single' ? 1 : layout.includes('2x') ? 4 : 2 }).map((_, i) => (
          <div key={i} className="bg-muted/20 border rounded p-4 font-mono text-xs">
            <div className="text-green-500">$ Terminal {i + 1}</div>
            <div className="text-muted-foreground mt-1">Ready for input...</div>
          </div>
        ))}
      </div>
    </div>
  )
}
