/**
 * Terminal Dashboard Overview Demo
 * Shows the three-column layout with resizable panes and toolbar
 */
import React, { useState } from 'react'

export default function TerminalDashboardOverview() {
  const [fileSidebarOpen, setFileSidebarOpen] = useState(true)
  const [sessionSidebarOpen, setSessionSidebarOpen] = useState(true)
  const [activePanel, setActivePanel] = useState<string | null>(null)

  return (
    <div className="h-[600px] flex flex-col bg-background relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Terminal Dashboard</span>
        </div>
        <div className="flex items-center gap-1">
          {['Sessions', 'Files', 'Issues', 'Queue', 'Inspector', 'Scheduler'].map((item) => (
            <button
              key={item}
              onClick={() => {
                if (item === 'Sessions') setSessionSidebarOpen(!sessionSidebarOpen)
                else if (item === 'Files') setFileSidebarOpen(!fileSidebarOpen)
                else setActivePanel(activePanel === item.toLowerCase() ? null : item.toLowerCase())
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                (item === 'Sessions' && sessionSidebarOpen) ||
                (item === 'Files' && fileSidebarOpen) ||
                activePanel === item.toLowerCase()
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Session Sidebar */}
        {sessionSidebarOpen && (
          <div className="w-60 border-r flex flex-col">
            <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
              Session Groups
            </div>
            <div className="flex-1 p-2 space-y-1 text-sm overflow-auto">
              {['Active Sessions', 'Completed', 'Archived'].map((group) => (
                <div key={group}>
                  <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer">
                    <span className="text-xs">▼</span>
                    <span>{group}</span>
                  </div>
                  <div className="ml-4 space-y-0.5">
                    <div className="px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded cursor-pointer">
                      Session 1
                    </div>
                    <div className="px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded cursor-pointer">
                      Session 2
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terminal Grid */}
        <div className="flex-1 bg-muted/20 p-2">
          <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-background border rounded p-3 font-mono text-xs">
                <div className="text-green-500 mb-2">$ Terminal {i}</div>
                <div className="text-muted-foreground">
                  <div>Working directory: /project</div>
                  <div>Type a command to begin...</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File Sidebar */}
        {fileSidebarOpen && (
          <div className="w-64 border-l flex flex-col">
            <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
              Project Files
            </div>
            <div className="flex-1 p-2 text-sm overflow-auto">
              <div className="space-y-1">
                {['src', 'docs', 'tests', 'package.json', 'README.md'].map((item) => (
                  <div key={item} className="px-2 py-1 rounded hover:bg-accent cursor-pointer flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">📁</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Panel */}
      {activePanel && (
        <div className="absolute top-12 right-4 w-80 bg-background border rounded-lg shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium capitalize">{activePanel} Panel</span>
            <button onClick={() => setActivePanel(null)} className="text-xs hover:bg-accent px-2 py-1 rounded">
              ✕
            </button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            {activePanel} content placeholder
          </div>
        </div>
      )}
    </div>
  )
}
