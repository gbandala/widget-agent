'use client'

interface WeekData {
  label: string
  conversations: number
  threats: number
}

export default function ConversacionesChart({ weeks }: { weeks: WeekData[] }) {
  const maxVal = Math.max(...weeks.flatMap(w => [w.conversations, w.threats]), 1)
  const BAR_H = 80
  const BAR_W = 18
  const GAP = 6
  const GROUP_W = BAR_W * 2 + GAP + 20

  return (
    <div className="bg-white rounded-xl border p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Actividad por semana</h2>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />
            Conversaciones
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />
            Amenazas
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          width={weeks.length * GROUP_W + 8}
          height={BAR_H + 36}
          className="block"
        >
          {weeks.map((w, i) => {
            const x = i * GROUP_W + 4
            const convH = Math.round((w.conversations / maxVal) * BAR_H)
            const threH = Math.round((w.threats / maxVal) * BAR_H)
            return (
              <g key={w.label}>
                {/* conversations bar */}
                <rect
                  x={x}
                  y={BAR_H - convH}
                  width={BAR_W}
                  height={convH || 2}
                  rx={3}
                  fill="#60a5fa"
                />
                {w.conversations > 0 && (
                  <text x={x + BAR_W / 2} y={BAR_H - convH - 3} textAnchor="middle" fontSize={9} fill="#6b7280">
                    {w.conversations}
                  </text>
                )}
                {/* threats bar */}
                <rect
                  x={x + BAR_W + GAP}
                  y={BAR_H - threH}
                  width={BAR_W}
                  height={threH || 2}
                  rx={3}
                  fill="#fb923c"
                />
                {w.threats > 0 && (
                  <text x={x + BAR_W + GAP + BAR_W / 2} y={BAR_H - threH - 3} textAnchor="middle" fontSize={9} fill="#6b7280">
                    {w.threats}
                  </text>
                )}
                {/* week label */}
                <text x={x + BAR_W + GAP / 2} y={BAR_H + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">
                  {w.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
