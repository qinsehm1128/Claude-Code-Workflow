/**
 * Card Variants Demo
 * Shows different card layouts
 */
import React from 'react'

export default function CardVariantsDemo() {
  return (
    <div className="p-6 bg-background space-y-6">
      <h3 className="text-sm font-semibold">Card Variants</h3>
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* Basic Card */}
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <h4 className="font-semibold">Basic Card</h4>
            <p className="text-sm text-muted-foreground">With header and content</p>
          </div>
          <div className="p-4">
            <p className="text-sm">Card content goes here.</p>
          </div>
        </div>

        {/* Card with Footer */}
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <h4 className="font-semibold">Card with Footer</h4>
          </div>
          <div className="p-4">
            <p className="text-sm">Main content area.</p>
          </div>
          <div className="p-4 border-t bg-muted/20">
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded">Action</button>
              <button className="px-3 py-1.5 text-xs border rounded">Cancel</button>
            </div>
          </div>
        </div>

        {/* Gradient Border Card */}
        <div className="border-2 border-transparent bg-gradient-to-r from-blue-500 to-purple-500 p-[2px] rounded-lg">
          <div className="bg-background rounded-lg p-4">
            <h4 className="font-semibold">Gradient Border</h4>
            <p className="text-sm text-muted-foreground mt-1">Card with gradient border effect.</p>
          </div>
        </div>

        {/* Settings Card */}
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <h4 className="font-semibold">Settings</h4>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Enable notifications</span>
              <div className="w-9 h-5 bg-primary rounded-full relative">
                <div className="absolute right-[2px] top-[2px] w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Dark mode</span>
              <div className="w-9 h-5 bg-muted rounded-full relative">
                <div className="absolute left-[2px] top-[2px] w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
