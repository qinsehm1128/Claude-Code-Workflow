/**
 * Dashboard Overview Demo
 * Shows the main dashboard layout with widgets
 */
import React from 'react'

export default function DashboardOverview() {
  return (
    <div className="space-y-6 p-6 bg-background min-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Project overview and activity monitoring
          </p>
        </div>
        <button className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent">
          Refresh
        </button>
      </div>

      {/* Workflow Stats Widget */}
      <div className="border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold">Project Overview & Statistics</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Statistics</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Active Sessions', value: '12', color: 'text-blue-500' },
                  { label: 'Total Tasks', value: '48', color: 'text-green-500' },
                  { label: 'Completed', value: '35', color: 'text-emerald-500' },
                  { label: 'Pending', value: '8', color: 'text-amber-500' },
                ].map((stat, i) => (
                  <div key={i} className="p-2 bg-muted/50 rounded">
                    <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Workflow Status</div>
              <div className="flex items-center justify-center h-24">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted opacity-20"/>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-500" strokeDasharray="70 100"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">70%</div>
                </div>
              </div>
              <div className="text-xs text-center space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"/>
                  <span>Completed: 70%</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Recent Session</div>
              <div className="p-3 bg-accent/20 rounded border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Feature: Auth Flow</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600">Running</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-green-500"/>
                    <span>Implement login</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-amber-500"/>
                    <span>Add OAuth</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-muted"/>
                    <span className="text-muted-foreground">Test flow</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions Widget */}
      <div className="border rounded-lg overflow-hidden">
        <div className="border-b bg-muted/30">
          <div className="flex gap-1 p-2">
            {['All Tasks', 'Workflow', 'Lite Tasks'].map((tab, i) => (
              <button
                key={tab}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  i === 0 ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-foreground/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'Refactor UI Components', status: 'In Progress', progress: 65 },
              { name: 'Fix Login Bug', status: 'Pending', progress: 0 },
              { name: 'Add Dark Mode', status: 'Completed', progress: 100 },
            ].map((task, i) => (
              <div key={i} className="p-3 bg-muted/30 rounded border cursor-pointer hover:border-primary/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium line-clamp-1">{task.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    task.status === 'Completed' ? 'bg-green-500/20 text-green-600' :
                    task.status === 'In Progress' ? 'bg-blue-500/20 text-blue-600' :
                    'bg-gray-500/20 text-gray-600'
                  }`}>{task.status}</span>
                </div>
                {task.progress > 0 && task.progress < 100 && (
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${task.progress}%` }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
