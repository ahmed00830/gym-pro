import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import type { PlanInput, PlanRecord } from '@shared/analytics'

interface PlanFormModalProps {
  open: boolean
  initial: PlanRecord | null
  submitting: boolean
  onClose: () => void
  onSubmit: (input: PlanInput) => Promise<void>
}

const PRESET_DURATIONS = [
  { days: 15, labelKey: 'plans.durationHalfMonth' as const },
  { days: 30, labelKey: 'plans.durationOneMonth' as const },
  { days: 60, labelKey: 'plans.durationTwoMonths' as const },
  { days: 90, labelKey: 'plans.durationThreeMonths' as const }
]

export function PlanFormModal({
  open,
  initial,
  submitting,
  onClose,
  onSubmit
}: PlanFormModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [price, setPrice] = useState(0)
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setDurationDays(initial?.durationDays ?? 30)
    setPrice(initial?.price ?? 0)
    setDescription(initial?.description ?? '')
    setIsActive(initial?.isActive ?? true)
    setErrors({})
  }, [initial, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, open, submitting])

  if (!open) return null

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = t('common.noData')
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      nextErrors.durationDays = t('common.noData')
    }
    if (price < 0) nextErrors.price = t('common.noData')
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      name: name.trim(),
      durationDays,
      price,
      description: description.trim() || null,
      isActive
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-[26px] border border-white/[0.08] bg-[#15131c] p-6 shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-primary">
            {initial ? t('plans.editPlan') : t('plans.addPlan')}
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label={t('common.close')}
            className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-muted transition-colors hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('common.value')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
            />
            {errors.name ? (
              <span className="text-[10px] text-rose">{errors.name}</span>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {PRESET_DURATIONS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => setDurationDays(preset.days)}
                aria-pressed={durationDays === preset.days}
                className={`rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  durationDays === preset.days
                    ? 'border-purple/40 bg-purple/20 text-purple-soft'
                    : 'border-white/[0.08] text-muted hover:text-primary'
                }`}
              >
                {t(preset.labelKey)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('plans.durationCustom')}
              </span>
              <input
                type="number"
                min={1}
                max={3650}
                value={durationDays}
                onChange={(event) => setDurationDays(Number(event.target.value))}
                required
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
              {errors.durationDays ? (
                <span className="text-[10px] text-rose">
                  {errors.durationDays}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('plans.price')}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                required
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
              {errors.price ? (
                <span className="text-[10px] text-rose">{errors.price}</span>
              ) : null}
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('common.notes')}
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-primary focus:border-purple/45 focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4 rounded border-white/20 bg-white/[0.03]"
            />
            {t('status.active')}
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-primary disabled:opacity-50"
            >
              {t('common.close')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/20 px-4 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/30 hover:text-primary disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
