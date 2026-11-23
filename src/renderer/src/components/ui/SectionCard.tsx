import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SectionCardProps {
  icon?: LucideIcon
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  headerClassName?: string
}

export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = 'px-5 pb-5',
  headerClassName = 'px-5 pt-5 pb-4'
}: SectionCardProps) {
  return (
    <section className={`panel min-w-0 rounded-[24px] ${className}`}>
      {title || action ? (
        <header
          className={`flex flex-wrap items-start justify-between gap-3 ${headerClassName}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-purple-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 className="text-sm font-semibold text-primary">{title}</h2>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-xs text-muted">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
