/**
 * Floating Panels Demo
 * Mutually exclusive overlay panels
 */
import React, { useState } from 'react'

export default function FloatingPanelsDemo() {
  const [activePanel, setActivePanel] = useState<string | null>(null)

  const panels = [
    { id: 'issues', title: 'Issues + Queue', side: 'left', width: 400 },
    { id: 'queue', title: 'Queue', side: 'right', width: 320 },
    { id: 'inspector', title: 'Inspector', side: 'right', width: 280 },
    { id: 'execution', title: 'Execution Monitor', side: 'right', width: 300 },
    { id: 'scheduler', title: 'Scheduler', side: 'right', width: 260 },
  ]

  return (
    <div className="relative h-[500px] p-6 bg-background border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Floating Panels</h3>
        <div className="flex gap-2 flex-wrap">
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActivePanel(activePanel === panel.id ? null : panel.id)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                activePanel === panel.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-accent'
              }`}
            >
              {panel.title}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[380px] bg-muted/20 border rounded flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {activePanel ? `"${panels.find((p) => p.id === activePanel)?.title}" panel is open` : 'Click a button to open a floating panel'}
        </p>
      </div>

      {/* Floating Panel Overlay */}
      {activePanel && (
        <div
          className={`absolute top-16 border rounded-lg shadow-lg bg-background ${
            panels.find((p) => p.id === activePanel)?.side === 'left' ? 'left-6' : 'right-6'
          }`}
          style={{ width: panels.find((p) => p.id === activePanel)?.width }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">{panels.find((p) => p.id === activePanel)?.title}</span>
            <button
              onClick={() => setActivePanel(null)}
              className="text-xs hover:bg-accent px-2 py-1 rounded"
            >
              ✕
            </button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"/>
                <span>Item 1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"/>
                <span>Item 2</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"/>
                <span>Item 3</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
