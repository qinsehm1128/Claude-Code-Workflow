/**
 * Session Carousel Demo
 * Auto-rotating session cards with navigation
 */
import React, { useState, useEffect } from 'react'

export default function SessionCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const sessions = [
    {
      name: 'Feature: User Authentication',
      status: 'running',
      tasks: [
        { name: 'Implement login form', status: 'completed' },
        { name: 'Add OAuth provider', status: 'in-progress' },
        { name: 'Create session management', status: 'pending' },
      ],
    },
    {
      name: 'Bug Fix: Memory Leak',
      status: 'running',
      tasks: [
        { name: 'Identify leak source', status: 'completed' },
        { name: 'Fix cleanup handlers', status: 'in-progress' },
        { name: 'Add unit tests', status: 'pending' },
      ],
    },
    {
      name: 'Refactor: API Layer',
      status: 'planning',
      tasks: [
        { name: 'Design new interface', status: 'pending' },
        { name: 'Migrate existing endpoints', status: 'pending' },
        { name: 'Update documentation', status: 'pending' },
      ],
    },
  ]

  const statusColors = {
    completed: 'bg-green-500',
    'in-progress': 'bg-amber-500',
    pending: 'bg-muted',
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % sessions.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [sessions.length])

  return (
    <div className="p-6 bg-background">
      <h3 className="text-sm font-semibold mb-4">Session Carousel (auto-rotates every 5s)</h3>
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Session {currentIndex + 1} of {sessions.length}</span>
          <div className="flex gap-1">
            {sessions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-4 bg-accent/20 rounded border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">{sessions[currentIndex].name}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              sessions[currentIndex].status === 'running' ? 'bg-green-500/20 text-green-600' : 'bg-blue-500/20 text-blue-600'
            }`}>
              {sessions[currentIndex].status}
            </span>
          </div>

          <div className="space-y-2">
            {sessions[currentIndex].tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded ${statusColors[task.status]}`}/>
                <span className={task.status === 'pending' ? 'text-muted-foreground' : ''}>{task.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-3">
          <button
            onClick={() => setCurrentIndex((i) => (i - 1 + sessions.length) % sessions.length)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentIndex((i) => (i + 1) % sessions.length)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
