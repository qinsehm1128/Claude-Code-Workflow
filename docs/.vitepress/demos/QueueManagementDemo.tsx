/**
 * Queue Management Demo
 * Shows scheduler controls and queue items list
 */
import React, { useState, useEffect } from 'react'

export default function QueueManagementDemo() {
  const [schedulerStatus, setSchedulerStatus] = useState('idle')
  const [progress, setProgress] = useState(0)

  const queueItems = [
    { id: '1', status: 'completed', issueId: 'ISSUE-1', sessionKey: 'session-1' },
    { id: '2', status: 'executing', issueId: 'ISSUE-2', sessionKey: 'session-2' },
    { id: '3', status: 'pending', issueId: 'ISSUE-3', sessionKey: null },
    { id: '4', status: 'pending', issueId: 'ISSUE-4', sessionKey: null },
    { id: '5', status: 'blocked', issueId: 'ISSUE-5', sessionKey: null },
  ]

  const statusConfig = {
    idle: { label: 'Idle', color: 'bg-gray-500/20 text-gray-600 border-gray-500' },
    running: { label: 'Running', color: 'bg-green-500/20 text-green-600 border-green-500' },
    paused: { label: 'Paused', color: 'bg-amber-500/20 text-amber-600 border-amber-500' },
  }

  const itemStatusConfig = {
    completed: { icon: '✓', color: 'text-green-500', label: 'Completed' },
    executing: { icon: '▶', color: 'text-blue-500', label: 'Executing' },
    pending: { icon: '○', color: 'text-gray-400', label: 'Pending' },
    blocked: { icon: '✕', color: 'text-red-500', label: 'Blocked' },
    failed: { icon: '!', color: 'text-red-500', label: 'Failed' },
  }

  useEffect(() => {
    if (schedulerStatus === 'running') {
      const interval = setInterval(() => {
        setProgress((p) => (p >= 100 ? 0 : p + 10))
      }, 500)
      return () => clearInterval(interval)
    }
  }, [schedulerStatus])

  const handleStart = () => {
    if (schedulerStatus === 'idle' || schedulerStatus === 'paused') {
      setSchedulerStatus('running')
    }
  }

  const handlePause = () => {
    if (schedulerStatus === 'running') {
      setSchedulerStatus('paused')
    }
  }

  const handleStop = () => {
    setSchedulerStatus('idle')
    setProgress(0)
  }

  const currentConfig = statusConfig[schedulerStatus as keyof typeof statusConfig]

  return (
    <div className="p-6 bg-background space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Queue Management</h3>
          <p className="text-sm text-muted-foreground">Manage issue execution queue</p>
        </div>
      </div>

      {/* Scheduler Status Bar */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 rounded text-xs font-medium border ${currentConfig.color}`}>
            {currentConfig.label}
          </span>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{queueItems.filter((i) => i.status === 'completed').length}/{queueItems.length} items</span>
            <span>2/2 concurrent</span>
          </div>
        </div>

        {/* Progress Bar */}
        {schedulerStatus === 'running' && (
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{progress}% complete</span>
          </div>
        )}

        {/* Scheduler Controls */}
        <div className="flex items-center gap-2">
          {(schedulerStatus === 'idle' || schedulerStatus === 'paused') && (
            <button
              onClick={handleStart}
              className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              <span>▶</span> Start
            </button>
          )}
          {schedulerStatus === 'running' && (
            <button
              onClick={handlePause}
              className="px-4 py-2 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 flex items-center gap-2"
            >
              <span>⏸</span> Pause
            </button>
          )}
          {schedulerStatus !== 'idle' && (
            <button
              onClick={handleStop}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
            >
              <span>⬛</span> Stop
            </button>
          )}
          <button className="px-4 py-2 text-sm border rounded hover:bg-accent">
            Config
          </button>
        </div>
      </div>

      {/* Queue Items List */}
      <div className="border rounded-lg">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h4 className="text-sm font-semibold">Queue Items</h4>
        </div>
        <div className="divide-y max-h-80 overflow-auto">
          {queueItems.map((item) => {
            const config = itemStatusConfig[item.status as keyof typeof itemStatusConfig]
            return (
              <div key={item.id} className="px-4 py-3 flex items-center gap-4 hover:bg-accent/50">
                <span className={`text-lg ${config.color}`}>{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.issueId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.color} bg-opacity-10`}>
                      {config.label}
                    </span>
                  </div>
                  {item.sessionKey && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Session: {item.sessionKey}
                    </div>
                  )}
                </div>
                {item.status === 'executing' && (
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }}/>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
