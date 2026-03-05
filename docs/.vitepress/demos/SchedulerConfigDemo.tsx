/**
 * Scheduler Config Demo
 * Interactive configuration panel
 */
import React, { useState } from 'react'

export default function SchedulerConfigDemo() {
  const [config, setConfig] = useState({
    maxConcurrentSessions: 2,
    sessionIdleTimeoutMs: 60000,
    resumeKeySessionBindingTimeoutMs: 300000,
  })

  const formatMs = (ms: number) => {
    if (ms >= 60000) return `${ms / 60000}m`
    if (ms >= 1000) return `${ms / 1000}s`
    return `${ms}ms`
  }

  return (
    <div className="p-6 bg-background space-y-6 max-w-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scheduler Configuration</h3>
        <button className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90">
          Save
        </button>
      </div>

      <div className="space-y-4">
        {/* Max Concurrent Sessions */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Max Concurrent Sessions</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="8"
              value={config.maxConcurrentSessions}
              onChange={(e) => setConfig({ ...config, maxConcurrentSessions: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-8 text-center">{config.maxConcurrentSessions}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum number of sessions to run simultaneously
          </p>
        </div>

        {/* Session Idle Timeout */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Session Idle Timeout</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10000"
              max="300000"
              step="10000"
              value={config.sessionIdleTimeoutMs}
              onChange={(e) => setConfig({ ...config, sessionIdleTimeoutMs: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">{formatMs(config.sessionIdleTimeoutMs)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Time before idle session is terminated
          </p>
        </div>

        {/* Resume Key Binding Timeout */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Resume Key Binding Timeout</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="60000"
              max="600000"
              step="60000"
              value={config.resumeKeySessionBindingTimeoutMs}
              onChange={(e) => setConfig({ ...config, resumeKeySessionBindingTimeoutMs: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">{formatMs(config.resumeKeySessionBindingTimeoutMs)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Time to preserve resume key session binding
          </p>
        </div>
      </div>

      {/* Current Config Display */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <h4 className="text-xs font-semibold mb-3">Current Configuration</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Max Concurrent</dt>
            <dd className="font-medium">{config.maxConcurrentSessions} sessions</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Idle Timeout</dt>
            <dd className="font-medium">{formatMs(config.sessionIdleTimeoutMs)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Binding Timeout</dt>
            <dd className="font-medium">{formatMs(config.resumeKeySessionBindingTimeoutMs)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
