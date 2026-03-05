/**
 * Queue Item Status Demo
 * Shows all possible queue item states
 */
import React from 'react'

export default function QueueItemStatusDemo() {
  const itemStates = [
    { status: 'pending', issueId: 'ISSUE-101', sessionKey: null },
    { status: 'executing', issueId: 'ISSUE-102', sessionKey: 'cli-session-abc' },
    { status: 'completed', issueId: 'ISSUE-103', sessionKey: 'cli-session-def' },
    { status: 'blocked', issueId: 'ISSUE-104', sessionKey: null },
    { status: 'failed', issueId: 'ISSUE-105', sessionKey: 'cli-session-ghi' },
  ]

  const statusConfig = {
    pending: { icon: '○', color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Pending' },
    executing: { icon: '▶', color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Executing' },
    completed: { icon: '✓', color: 'text-green-500', bg: 'bg-green-500/10', label: 'Completed' },
    blocked: { icon: '✕', color: 'text-red-500', bg: 'bg-red-500/10', label: 'Blocked' },
    failed: { icon: '!', color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  }

  return (
    <div className="p-6 bg-background space-y-4">
      <h3 className="text-sm font-semibold">Queue Item Status States</h3>
      <div className="space-y-2">
        {itemStates.map((item) => {
          const config = statusConfig[item.status as keyof typeof statusConfig]
          return (
            <div key={item.status} className="border rounded-lg p-4 flex items-center gap-4">
              <span className={`text-2xl ${config.color}`}>{config.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.issueId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                {item.sessionKey && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Bound session: <code className="text-xs bg-muted px-1 rounded">{item.sessionKey}</code>
                  </div>
                )}
              </div>
              {item.status === 'executing' && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }}/>
                  </div>
                  <span className="text-xs text-muted-foreground">60%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
