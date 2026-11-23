import { ChevronDown, Search, type LucideIcon } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = ''
}: SearchInputProps) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-dim"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pe-3 ps-10 text-sm text-primary placeholder:text-dim transition-colors focus:border-purple/45 focus:bg-white/[0.04] focus:outline-none"
      />
    </div>
  )
}

interface FilterOption {
  value: string
  label: string
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  ariaLabel: string
  className?: string
}

export function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = ''
}: FilterSelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className="h-10 w-full appearance-none rounded-xl border border-white/[0.07] bg-[#1a1721] pe-9 ps-3.5 text-sm text-primary transition-colors focus:border-purple/45 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-dim"
      />
    </div>
  )
}

interface SummaryStatProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  accent?: 'purple' | 'emerald' | 'amber' | 'rose' | 'neutral'
}

const summaryAccents = {
  purple: 'border-purple/20 bg-purple/10 text-purple-soft',
  emerald: 'border-emerald/20 bg-emerald/10 text-emerald',
  amber: 'border-amber/20 bg-amber/10 text-amber',
  rose: 'border-rose/20 bg-rose/10 text-rose',
  neutral: 'border-white/10 bg-white/[0.05] text-muted'
} as const

export function SummaryStat({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'neutral'
}: SummaryStatProps) {
  return (
    <div className="panel flex min-w-0 items-center gap-3.5 rounded-2xl px-4 py-4">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl border ${summaryAccents[accent]}`}
      >
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted">{label}</p>
        <p className="mt-0.5 truncate font-display text-[22px] font-semibold leading-tight text-primary">
          {value}
        </p>
        {hint ? (
          <p className="truncate text-[10px] text-dim">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
