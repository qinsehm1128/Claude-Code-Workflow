/**
 * Mini Stat Cards Demo
 * Individual statistics cards with sparkline trends
 */
import React from 'react'

export default function MiniStatCards() {
  const stats = [
    { label: 'Active Sessions', value: 12, trend: [8, 10, 9, 11, 10, 12, 12], color: 'blue' },
    { label: 'Total Tasks', value: 48, trend: [40, 42, 45, 44, 46, 47, 48], color: 'green' },
    { label: 'Completed', value: 35, trend: [25, 28, 30, 32, 33, 34, 35], color: 'emerald' },
    { label: 'Pending', value: 8, trend: [12, 10, 11, 9, 8, 7, 8], color: 'amber' },
    { label: 'Failed', value: 5, trend: [3, 4, 3, 5, 4, 5, 5], color: 'red' },
    { label: 'Today Activity', value: 23, trend: [5, 10, 15, 18, 20, 22, 23], color: 'purple' },
  ]

  const colorMap = {
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-green-500 bg-green-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
    red: 'text-red-500 bg-red-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  }

  return (
    <div className="p-6 bg-background">
      <h3 className="text-sm font-semibold mb-4">Statistics with Sparklines</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <div className={`w-2 h-2 rounded-full ${colorMap[stat.color].split(' ')[1]}`}/>
            </div>
            <div className={`text-2xl font-bold ${colorMap[stat.color].split(' ')[0]}`}>{stat.value}</div>
            <div className="mt-2 h-8 flex items-end gap-0.5">
              {stat.trend.map((v, j) => (
                <div
                  key={j}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${(v / Math.max(...stat.trend)) * 100}%`,
                    backgroundColor: v === stat.value ? 'currentColor' : 'rgba(59, 130, 246, 0.3)',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
