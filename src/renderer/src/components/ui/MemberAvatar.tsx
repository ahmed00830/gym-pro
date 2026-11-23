import { useI18n } from '../../i18n'
import { memberInitial, statusLabel } from '../../lib/format'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-lg',
  xl: 'size-20 text-3xl'
}

const palettes = [
  'from-[#a855f7] to-[#5b21b6] shadow-[0_0_24px_-10px_rgba(168,85,247,0.9)]',
  'from-[#10d9a0] to-[#047857] shadow-[0_0_24px_-10px_rgba(16,217,160,0.85)]',
  'from-[#f472b6] to-[#9d174d] shadow-[0_0_24px_-10px_rgba(244,114,182,0.7)]',
  'from-[#38bdf8] to-[#1e40af] shadow-[0_0_24px_-10px_rgba(56,189,248,0.7)]'
]

interface MemberAvatarProps {
  name: string
  size?: AvatarSize
  className?: string
}

export function MemberAvatar({
  name,
  size = 'md',
  className = ''
}: MemberAvatarProps) {
  const seed = Array.from(name).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  )
  const palette = palettes[seed % palettes.length]

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full border border-white/15 bg-gradient-to-br font-display font-semibold text-white ${sizes[size]} ${palette} ${className}`}
    >
      {memberInitial(name)}
    </span>
  )
}

interface StatusBadgeProps {
  status: string
}

const badgeStyles: Record<string, string> = {
  active: 'border-emerald/25 bg-emerald/10 text-emerald',
  pending: 'border-amber/25 bg-amber/10 text-amber',
  completed: 'border-purple/25 bg-purple/12 text-purple-soft',
  frozen: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  expired: 'border-rose/25 bg-rose/10 text-rose',
  cancelled: 'border-rose/25 bg-rose/10 text-rose',
  blocked: 'border-rose/25 bg-rose/10 text-rose',
  inactive: 'border-white/10 bg-white/[0.045] text-muted',
  archived: 'border-white/10 bg-white/[0.045] text-muted'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useI18n()
  const style = badgeStyles[status.toLowerCase()] ?? badgeStyles.inactive

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium ${style}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabel(status, t)}
    </span>
  )
}
