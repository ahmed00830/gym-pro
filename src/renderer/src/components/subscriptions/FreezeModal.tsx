import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'

interface FreezeModalProps {
  open: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (startDate: string, endDate: string | null, reason: string | null) => Promise<void>
}

export function FreezeModal({ open, submitting, onClose, onSubmit }: FreezeModalProps) {
  const { t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setStartDate(today)
    setEndDate('')
    setReason('')
  }, [open, today])

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit(startDate, endDate || null, reason.trim() || null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('common.close')} onClick={() => !submitting && onClose()} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-[26px] border border-white/[0.08] bg-[#15131c] p-6 shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-primary">{t('status.frozen')}</h2>
          <button type="button" onClick={() => !submitting && onClose()} aria-label={t('common.close')} className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-muted transition-colors hover:text-primary">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">{t('common.date')}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">{t('subscriptions.endDate')}</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">{t('common.notes')}</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-primary focus:border-purple/45 focus:outline-none" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => !submitting && onClose()} disabled={submitting} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-primary disabled:opacity-50">
              {t('common.close')}
            </button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/20 px-4 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/30 hover:text-primary disabled:opacity-60">
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
