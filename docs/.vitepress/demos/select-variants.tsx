/**
 * Select Variants Demo
 * Shows different select configurations
 */
import React, { useState } from 'react'

export default function SelectVariantsDemo() {
  const [selected, setSelected] = useState('')

  return (
    <div className="p-6 bg-background space-y-6">
      <h3 className="text-sm font-semibold">Select Configurations</h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Basic Select</label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Choose an option</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
            <option value="3">Option 3</option>
          </select>
        </div>

        {/* With Labels */}
        <div className="space-y-2">
          <label className="text-sm font-medium">With Option Groups</label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <optgroup label="Fruits">
              <option value="apple">Apple</option>
              <option value="banana">Banana</option>
              <option value="orange">Orange</option>
            </optgroup>
            <optgroup label="Vegetables">
              <option value="carrot">Carrot</option>
              <option value="broccoli">Broccoli</option>
            </optgroup>
          </select>
        </div>

        {/* Controlled Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Controlled Select</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select...</option>
            <option value="react">React</option>
            <option value="vue">Vue</option>
            <option value="angular">Angular</option>
          </select>
          <p className="text-xs text-muted-foreground">Selected: {selected || '(none)'}</p>
        </div>

        {/* Disabled Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Disabled Select</label>
          <select
            disabled
            className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm opacity-50 cursor-not-allowed"
          >
            <option value="">Disabled select</option>
            <option value="1">Option 1</option>
          </select>
        </div>
      </div>

      {/* With Separators */}
      <div className="space-y-2">
        <label className="text-sm font-medium">With Separators</label>
        <select className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Select an action</option>
          <option value="edit">Edit</option>
          <option value="copy">Copy</option>
          <option value="move">Move</option>
          {/* Visual separator via disabled option */}
          <option disabled>──────────</option>
          <option value="delete" className="text-destructive">Delete</option>
        </select>
      </div>

      {/* Multiple Select */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Multiple Select (Hold Ctrl/Cmd)</label>
        <select
          multiple
          className="flex min-h-[100px] w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="js">JavaScript</option>
          <option value="ts">TypeScript</option>
          <option value="react">React</option>
        </select>
      </div>
    </div>
  )
}
