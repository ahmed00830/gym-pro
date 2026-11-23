import { CheckCircle2, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { formatCurrency, formatDate } from '../../lib/format'
import type { PlanRecord, QuickRegisterResult } from '@shared/analytics'

interface QuickRegisterModalProps {
  open: boolean
  plans: PlanRecord[]
  submitting: boolean
  onClose: () => void
  onSubmit: (input: {
    fullName: string
    phone: string
    planId: number
    startDate: string
    paymentMethod: string
    paymentDate: string
    notes: string | null
  }) => Promise<QuickRegisterResult>
}

const paymentMethods = ['cash', 'card', 'transfer', 'wallet', 'other']

export function QuickRegisterModal({
  open,
  plans,
  submitting,
  onClose,
  onSubmit
}: QuickRegisterModalProps) {
  const { t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [planId, setPlanId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentDate, setPaymentDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuickRegisterResult | null>(null)

  const activePlans = plans.filter((plan) => plan.isActive)
  const selectedPlan = plans.find((plan) => plan.id === planId)
  const price = selectedPlan?.price ?? 0

  useEffect(() => {
    if (!open) return
    setFullName('')
    setPhone('')
    setPlanId('')
    setStartDate(today)
    setPaymentMethod('cash')
    setPaymentDate(today)
    setNotes('')
    setErrors({})
    setResult(null)
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

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}
    if (!fullName.trim()) nextErrors.fullName = t('common.noData')
    if (!phone.trim()) nextErrors.phone = t('common.noData')
    if (planId === '') nextErrors.planId = t('common.noData')
    if (!startDate) nextErrors.startDate = t('common.noData')
    if (!paymentMethod) nextErrors.paymentMethod = t('common.noData')
    if (!paymentDate) nextErrors.paymentDate = t('common.noData')
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    const response = await onSubmit({
      fullName: fullName.trim(),
      phone: phone.trim(),
      planId: Number(planId),
      startDate,
      paymentMethod,
      paymentDate,
      notes: notes.trim() || null
    })

    setResult(response)
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
            {t('members.addMember')}
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

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald/25 bg-emerald/10 px-4 py-3">
              <CheckCircle2 className="size-5 text-emerald" />
              <div>
                <p className="text-sm font-semibold text-primary">
                  {result.member.fullName}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  <span dir="ltr" className="font-display font-semibold text-purple-soft">
                    #{result.member.memberNumber}
                  </span>
                  {' · '}
                  <span dir="ltr">{result.member.memberCode}</span>
                  {' · '}
                  {formatDate(result.subscription.endDate, 'en')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-purple/30 bg-purple/20 px-4 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/30 hover:text-primary"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('members.member')}
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
              {errors.fullName ? (
                <span className="text-[10px] text-rose">{errors.fullName}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('memberProfile.phone')}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
              {errors.phone ? (
                <span className="text-[10px] text-rose">{errors.phone}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('common.plan')}
              </span>
              <select
                value={planId}
                onChange={(event) =>
                  setPlanId(event.target.value ? Number(event.target.value) : '')
                }
                className="h-10 rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              >
                <option value="">{t('common.all')}</option>
                {activePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {plan.durationDays} days — {plan.price}
                  </option>
                ))}
              </select>
              {errors.planId ? (
                <span className="text-[10px] text-rose">{errors.planId}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('subscriptions.startDate')}
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('payments.method')}
              </span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="h-10 rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {t(`paymentMethod.${method}` as 'paymentMethod.cash')}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('common.date')}
              </span>
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('common.notes')}
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
            </label>

            {selectedPlan ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t('finance.netPrice')}</span>
                  <span className="font-display font-semibold text-emerald">
                    {formatCurrency(price, 'en', t('common.currency'))}
                  </span>
                </div>
              </div>
            ) : null}

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
        )}
      </div>
    </div>
  )
}
