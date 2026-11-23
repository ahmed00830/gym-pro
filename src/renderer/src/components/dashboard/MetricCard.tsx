import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface MetricCardProps {
  accent: 'purple' | 'emerald'
  icon: LucideIcon
  label: string
  value: string
  note: string
  footer?: ReactNode
  sparkData: number[]
}

const accents = {
  purple: {
    card: 'hero-purple',
    icon: 'text-purple-soft',
    line: '#c084fc',
    gradient: 'rgba(192, 132, 252, 0.32)'
  },
  emerald: {
    card: 'hero-emerald',
    icon: 'text-emerald',
    line: '#10d9a0',
    gradient: 'rgba(16, 217, 160, 0.28)'
  }
} as const

export function MetricCard({
  accent,
  icon: Icon,
  label,
  value,
  note,
  footer,
  sparkData
}: MetricCardProps) {
  const style = accents[accent]
  const gradientId = `metric-${useId().replace(/:/g, '')}`
  const chartData = sparkData.map((entry, index) => ({ index, entry }))

  return (
    <article
      className={`${style.card} hero-texture relative min-w-0 overflow-hidden rounded-[26px] p-5 sm:p-6`}
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted sm:text-xs">
            {label}
          </p>
          <p className="mt-2 truncate font-display text-[32px] font-semibold leading-none tracking-tight text-primary sm:text-[38px]">
            {value}
          </p>
          <p className="mt-2.5 truncate text-[11px] text-muted">{note}</p>
        </div>
        <span className={`icon-tile size-11 shrink-0 rounded-2xl sm:size-12 ${style.icon}`}>
          <Icon className="size-5 sm:size-[22px]" strokeWidth={1.8} />
        </span>
      </div>

      <div className="relative z-10 mt-5 flex items-end justify-between gap-4">
        <div className="min-w-0 text-[11px] text-muted">{footer}</div>
        <div className="h-11 w-28 shrink-0 sm:w-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={style.gradient} stopOpacity={1} />
                  <stop offset="100%" stopColor={style.gradient} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="entry"
                stroke={style.line}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  )
}
