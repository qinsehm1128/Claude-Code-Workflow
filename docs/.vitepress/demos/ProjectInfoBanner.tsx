/**
 * Project Info Banner Demo
 * Expandable project information with tech stack
 */
import React, { useState } from 'react'

export default function ProjectInfoBanner() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="p-6 bg-background">
      <h3 className="text-sm font-semibold mb-4">Project Info Banner</h3>
      <div className="border rounded-lg overflow-hidden">
        {/* Banner Header */}
        <div className="p-4 bg-muted/30 flex items-center justify-between">
          <div>
            <h4 className="font-semibold">My Awesome Project</h4>
            <p className="text-sm text-muted-foreground">A modern web application built with React</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-md hover:bg-accent"
          >
            <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Tech Stack Badges */}
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {['TypeScript', 'React', 'Vite', 'Tailwind CSS', 'Zustand'].map((tech) => (
            <span key={tech} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
              {tech}
            </span>
          ))}
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="p-4 border-t bg-muted/20 space-y-4">
            <div>
              <h5 className="text-xs font-semibold mb-2">Architecture</h5>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• Component-based UI architecture</div>
                <div>• Centralized state management</div>
                <div>• RESTful API integration</div>
              </div>
            </div>
            <div>
              <h5 className="text-xs font-semibold mb-2">Key Components</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {['Session Manager', 'Dashboard', 'Task Scheduler', 'Analytics'].map((comp) => (
                  <div key={comp} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"/>
                    {comp}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
