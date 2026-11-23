import type { LucideIcon } from 'lucide-react'

interface MiniStatCardProps {
  icon: LucideIcon
  label: string
  value: string
  note: string
  accent: 'purple' | 'emerald' | 'amber' | 'rose'
}

const accents = {
  purple: {
    tile: 'border-purple/20 bg-purple/10 text-purple-soft',
    glow: 'bg-purple/20'
  },
  emerald: {
    tile: 'border-emerald/20 bg-emerald/10 text-emerald',
    glow: 'bg-emerald/20'
  },
  amber: {
    tile: 'border-amber/20 bg-amber/10 text-amber',
    glow: 'bg-amber/20'
  },
  rose: {
    tile: 'border-rose/20 bg-rose/10 text-rose',
    glow: 'bg-rose/20'
  }
} as const

export function MiniStatCard({
  icon: Icon,
  label,
  value,
  note,
  accent
}: MiniStatCardProps) {
  const style = accents[accent]

  return (
    <article className="panel panel-hover group relative min-w-0 overflow-hidden rounded-[22px] p-4 sm:p-5">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -end-8 -top-8 size-24 rounded-full blur-2xl ${style.glow}`}
      />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl border ${style.tile}`}
        >
          <Icon className="size-[18px]" strokeWidth={1.8} />
        </span>
      </div>
      <p className="relative z-10 mt-4 text-[11px] leading-snug text-muted">
        {label}
      </p>
      <p className="relative z-10 mt-1 font-display text-[26px] font-semibold leading-none tracking-tight text-primary sm:text-[30px]">
        {value}
      </p>
      <p className="relative z-10 mt-2 text-[10px] text-dim">{note}</p>
    </article>
  )
}
