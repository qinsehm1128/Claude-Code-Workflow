/**
 * Button Variants Demo
 * Shows all visual variants of the button component
 */
import React, { useState } from 'react'

export default function ButtonVariantsDemo() {
  const [variant, setVariant] = useState('default')

  const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'gradient']

  const getButtonClass = (v: string) => {
    const base = 'px-4 py-2 rounded-md text-sm transition-colors'
    switch (v) {
      case 'default': return `${base} bg-primary text-primary-foreground hover:opacity-90`
      case 'destructive': return `${base} bg-destructive text-destructive-foreground hover:opacity-90`
      case 'outline': return `${base} border bg-background hover:bg-accent`
      case 'secondary': return `${base} bg-secondary text-secondary-foreground hover:opacity-80`
      case 'ghost': return `${base} hover:bg-accent`
      case 'link': return `${base} text-primary underline-offset-4 hover:underline`
      case 'gradient': return `${base} bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90`
      default: return base
    }
  }

  return (
    <div className="p-6 bg-background space-y-6">
      <h3 className="text-sm font-semibold">Button Variants</h3>
      
      {/* Variant Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Select Variant</label>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={`px-3 py-1.5 text-xs rounded capitalize transition-colors ${
                variant === v ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Preview</label>
        <div className="p-4 border rounded-lg bg-muted/20">
          <button className={getButtonClass(variant)}>
            Button
          </button>
        </div>
      </div>

      {/* All Variants */}
      <div className="space-y-3">
        <label className="text-sm font-medium">All Variants</label>
        <div className="flex flex-wrap gap-3 p-4 border rounded-lg">
          {variants.map((v) => (
            <button key={v} className={getButtonClass(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sizes */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Sizes</label>
        <div className="flex items-center gap-3 flex-wrap p-4 border rounded-lg">
          <button className={`${getButtonClass(variant)} h-8 px-3 text-xs`}>Small</button>
          <button className={`${getButtonClass(variant)} h-10 px-4`}>Default</button>
          <button className={`${getButtonClass(variant)} h-11 px-8`}>Large</button>
          <button className={`${getButtonClass(variant)} h-10 w-10`}>⚙</button>
        </div>
      </div>
    </div>
  )
}
