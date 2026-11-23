import { Dumbbell } from 'lucide-react'

type BrandMarkSize = 'sm' | 'md' | 'lg'

const sizes: Record<BrandMarkSize, { container: string; icon: string }> = {
  sm: {
    container: 'size-8 rounded-[10px]',
    icon: 'size-4'
  },
  md: {
    container: 'size-10 rounded-xl',
    icon: 'size-5'
  },
  lg: {
    container: 'size-14 rounded-2xl',
    icon: 'size-7'
  }
}

interface BrandMarkProps {
  size?: BrandMarkSize
  className?: string
}

export function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center bg-[linear-gradient(145deg,#d8b4fe_0%,#a855f7_46%,#6d28d9_100%)] text-white shadow-[0_0_30px_rgba(168,85,247,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/20 ${sizes[size].container} ${className}`}
    >
      <Dumbbell className={sizes[size].icon} strokeWidth={2.3} />
    </span>
  )
}
