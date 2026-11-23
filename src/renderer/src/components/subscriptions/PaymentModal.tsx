import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { formatCurrency } from '../../lib/format'
import type { SubscriptionRecord } from '@shared/analytics'

interface PaymentModalProps {
  open: boolean
  subscription: SubscriptionRecord | null
  submitting: boolean
  onClose: () => void
  onSubmit: (amount: number, method: string, date: string, notes: string | null) => Promise<void>
}

const paymentMethods = ['cash', 'card', 'transfer', 'wallet', 'other']

export function PaymentModal({ open, subscription, submitting, onClose, onSubmit }: PaymentModalProps) {
  const { t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount(subscription?.balance ?? 0)
    setMethod('cash')
    setDate(today)
    setNotes('')
  }, [open, subscription, today])

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
    await onSubmit(amount, method, date, notes.trim() || null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('common.close')} onClick={() => !submitting && onClose()} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-[26px] border border-white/[0.08] bg-[#15131c] p-6 shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]">
        {subscription ? (
          <div className="mb-4 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">{t('finance.netPrice')}</span>
              <span className="font-display font-semibold text-primary">
                {formatCurrency(subscription.finalPrice, 'en', t('common.currency'))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">{t('finance.totalPaid')}</span>
              <span className="font-display font-semibold text-primary">
                {formatCurrency(subscription.paidAmount, 'en', t('common.currency'))}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.05] pt-2">
              <span className="font-medium text-primary">{t('finance.remaining')}</span>
              <span
                className={`font-display font-semibold ${
                  subscription.balance > 0 ? 'text-amber' : 'text-emerald'
                }`}
              >
                {formatCurrency(subscription.balance, 'en', t('common.currency'))}
              </span>
            </div>
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">{t('common.amount')}</span>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">{t('payments.method')}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none">
              {paymentMethods.map((m) => (
                <option key={m} value={m}>{t(`paymentMethod.${m}` as 'paymentMethod.cash')}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">{t('common.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">{t('common.notes')}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-primary focus:border-purple/45 focus:outline-none" />
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
