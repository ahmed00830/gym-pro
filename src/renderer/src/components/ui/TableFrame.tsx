import type { ReactNode } from 'react'

interface TableFrameProps {
  children: ReactNode
  caption: string
  minWidth?: string
}

export function TableFrame({
  children,
  caption,
  minWidth = 'min-w-[720px]'
}: TableFrameProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${minWidth}`}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-white/[0.06] text-[11px] font-medium text-dim">
        {children}
      </tr>
    </thead>
  )
}

export function Th({
  children,
  className = ''
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-5 py-3 text-start font-medium ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = ''
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <td className={`px-5 py-3.5 align-middle ${className}`}>{children}</td>
  )
}

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  previousLabel: string
  nextLabel: string
  pageLabel: string
  ofLabel: string
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  previousLabel,
  nextLabel,
  pageLabel,
  ofLabel
}: PaginationProps) {
  if (pageCount <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.055] px-5 py-3.5">
      <p className="text-[11px] text-muted">
        {pageLabel} <span dir="ltr">{page}</span> {ofLabel}{' '}
        <span dir="ltr">{pageCount}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-white/15 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {previousLabel}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-white/15 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
