import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'
      }`}
    >
      <span className="mb-1 grid size-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.035] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  )
}
