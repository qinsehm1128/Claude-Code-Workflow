/**
 * Resizable Panes Demo
 * Simulates the Allotment resizable split behavior
 */
import React, { useState, useEffect } from 'react'

export default function ResizablePanesDemo() {
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(280)
  const [isDragging, setIsDragging] = useState<string | null>(null)

  const handleDragStart = (side: string) => (e: React.MouseEvent) => {
    setIsDragging(side)
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging === 'left') {
        setLeftWidth(Math.max(180, Math.min(320, e.clientX - 24)))
      } else if (isDragging === 'right') {
        setRightWidth(Math.max(200, Math.min(400, window.innerWidth - e.clientX - 24)))
      }
    }

    const handleMouseUp = () => setIsDragging(null)

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  return (
    <div className="h-[400px] flex bg-background border rounded-lg overflow-hidden">
      {/* Left Sidebar */}
      <div style={{ width: leftWidth }} className="border-r flex flex-col min-w-[180px]">
        <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
          Session Groups
        </div>
        <div className="flex-1 p-2 text-sm space-y-1">
          {['Active Sessions', 'Completed'].map((g) => (
            <div key={g} className="px-2 py-1 hover:bg-accent rounded cursor-pointer">{g}</div>
          ))}
        </div>
      </div>

      {/* Left Drag Handle */}
      <div
        onMouseDown={handleDragStart('left')}
        className={`w-1 bg-border hover:bg-primary cursor-col-resize transition-colors ${
          isDragging === 'left' ? 'bg-primary' : ''
        }`}
      />

      {/* Main Content */}
      <div className="flex-1 bg-muted/20 flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Terminal Grid Area</span>
      </div>

      {/* Right Drag Handle */}
      <div
        onMouseDown={handleDragStart('right')}
        className={`w-1 bg-border hover:bg-primary cursor-col-resize transition-colors ${
          isDragging === 'right' ? 'bg-primary' : ''
        }`}
      />

      {/* Right Sidebar */}
      <div style={{ width: rightWidth }} className="border-l flex flex-col min-w-[200px]">
        <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/30">
          Project Files
        </div>
        <div className="flex-1 p-2 text-sm space-y-1">
          {['src/', 'docs/', 'tests/'].map((f) => (
            <div key={f} className="px-2 py-1 hover:bg-accent rounded cursor-pointer">{f}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
