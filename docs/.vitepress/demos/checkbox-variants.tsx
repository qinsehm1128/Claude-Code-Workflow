/**
 * Checkbox Variants Demo
 * Shows different checkbox states
 */
import React, { useState } from 'react'

export default function CheckboxVariantsDemo() {
  const [checked, setChecked] = useState({ a: true, b: false, c: true })

  return (
    <div className="p-6 bg-background space-y-6">
      <h3 className="text-sm font-semibold">Checkbox States</h3>
      
      <div className="space-y-4">
        {/* Checked */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked.a}
            onChange={(e) => setChecked({ ...checked, a: e.target.checked })}
            className="h-4 w-4 rounded border border-primary accent-primary"
          />
          <span className="text-sm">Checked checkbox</span>
        </label>

        {/* Unchecked */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked.b}
            onChange={(e) => setChecked({ ...checked, b: e.target.checked })}
            className="h-4 w-4 rounded border border-primary accent-primary"
          />
          <span className="text-sm">Unchecked checkbox</span>
        </label>

        {/* Disabled */}
        <label className="flex items-center gap-3 cursor-not-allowed opacity-50">
          <input
            type="checkbox"
            disabled
            className="h-4 w-4 rounded border border-primary"
          />
          <span className="text-sm">Disabled checkbox</span>
        </label>

        {/* Disabled Checked */}
        <label className="flex items-center gap-3 cursor-not-allowed opacity-50">
          <input
            type="checkbox"
            disabled
            defaultChecked
            className="h-4 w-4 rounded border border-primary accent-primary"
          />
          <span className="text-sm">Disabled checked checkbox</span>
        </label>
      </div>

      {/* Usage Example */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Usage Example</h4>
        <div className="p-4 border rounded-lg space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border accent-primary" />
            <span className="text-sm">Accept terms and conditions</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border accent-primary" />
            <span className="text-sm">Subscribe to newsletter</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border accent-primary" />
            <span className="text-sm">Remember me</span>
          </label>
        </div>
      </div>
    </div>
  )
}
