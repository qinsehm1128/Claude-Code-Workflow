/**
 * Badge Variants Demo
 * Shows all available badge variants
 */
import React from 'react'

export default function BadgeVariantsDemo() {
  const variants = [
    { name: 'default', class: 'bg-primary text-primary-foreground' },
    { name: 'secondary', class: 'bg-secondary text-secondary-foreground' },
    { name: 'destructive', class: 'bg-destructive text-destructive-foreground' },
    { name: 'outline', class: 'border text-foreground' },
    { name: 'success', class: 'bg-success text-white' },
    { name: 'warning', class: 'bg-warning text-white' },
    { name: 'info', class: 'bg-info text-white' },
    { name: 'review', class: 'bg-purple-500 text-white' },
    { name: 'gradient', class: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' },
  ]

  return (
    <div className="p-6 bg-background space-y-6">
      <h3 className="text-sm font-semibold">Badge Variants</h3>
      
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {variants.map((v) => (
            <span
              key={v.name}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${v.class}`}
            >
              {v.name}
            </span>
          ))}
        </div>
      </div>

      {/* Usage Examples */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Usage Examples</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 border rounded">
            <span className="font-medium">Status:</span>
            <span className="inline-flex items-center rounded-full bg-success px-2 py-0.5 text-xs text-white">Active</span>
          </div>
          <div className="flex items-center gap-2 p-2 border rounded">
            <span className="font-medium">Priority:</span>
            <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs text-white">High</span>
          </div>
          <div className="flex items-center gap-2 p-2 border rounded">
            <span className="font-medium">Type:</span>
            <span className="inline-flex items-center rounded-full bg-info px-2 py-0.5 text-xs text-white">Feature</span>
          </div>
        </div>
      </div>
    </div>
  )
}
