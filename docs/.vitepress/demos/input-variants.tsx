/**
 * Input Variants Demo
 * Shows all input states
 */
import React, { useState } from 'react'

export default function InputVariantsDemo() {
  const [value, setValue] = useState('')

  return (
    <div className="p-6 bg-background space-y-6">
      <h3 className="text-sm font-semibold">Input States</h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Default */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Default</label>
          <input
            type="text"
            placeholder="Enter text..."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* With Value */}
        <div className="space-y-2">
          <label className="text-sm font-medium">With Value</label>
          <input
            type="text"
            value="John Doe"
            readOnly
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Error State */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Error State</label>
          <input
            type="text"
            placeholder="Invalid input"
            className="flex h-10 w-full rounded-md border border-destructive bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
          />
          <p className="text-xs text-destructive">This field is required</p>
        </div>

        {/* Disabled */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Disabled</label>
          <input
            type="text"
            disabled
            placeholder="Disabled input"
            className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm opacity-50 cursor-not-allowed"
          />
        </div>

        {/* With Icon */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search Input</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
            <input
              type="text"
              placeholder="Search..."
              className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Controlled */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Controlled Input</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type something..."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Value: {value || '(empty)'}</p>
        </div>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Textarea</label>
        <textarea
          placeholder="Enter multi-line text..."
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  )
}
