import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { formatCurrency } from '../../lib/format'
import type { MemberRecord, PlanRecord, SubscriptionInput } from '@shared/analytics'

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  date.setDate(date.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const paymentMethods = ['cash', 'card', 'transfer', 'wallet', 'other']

interface SubscriptionFormModalProps {
  open: boolean
  members: MemberRecord[]
  plans: PlanRecord[]
  submitting: boolean
  onClose: () => void
  onSubmit: (input: SubscriptionInput) => Promise<void>
}

export function SubscriptionFormModal({
  open,
  members,
  plans,
  submitting,
  onClose,
  onSubmit
}: SubscriptionFormModalProps) {
  const { t, locale } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const [memberId, setMemberId] = useState<number | ''>('')
  const [planId, setPlanId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentDate, setPaymentDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activePlans = plans.filter((plan) => plan.isActive)
  const selectedPlan = plans.find((plan) => plan.id === planId)
  const price = selectedPlan?.price ?? 0

  useEffect(() => {
    if (!open) return
    setMemberId('')
    setPlanId('')
    setStartDate(today)
    setEndDate(today)
    setPaymentMethod('cash')
    setPaymentDate(today)
    setNotes('')
    setErrors({})
  }, [open, today])

  useEffect(() => {
    if (!open || !selectedPlan) return
    setEndDate(addDays(startDate, selectedPlan.durationDays))
  }, [open, selectedPlan, startDate])

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
    if (memberId === '') nextErrors.memberId = t('common.noData')
    if (planId === '') nextErrors.planId = t('common.noData')
    if (!startDate) nextErrors.startDate = t('common.noData')
    if (!endDate || endDate < startDate) nextErrors.endDate = t('common.noData')
    if (!paymentMethod) nextErrors.paymentMethod = t('common.noData')
    if (!paymentDate) nextErrors.paymentDate = t('common.noData')
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      memberId: Number(memberId),
      planId: Number(planId),
      startDate,
      endDate,
      price,
      discount: 0,
      paymentAmount: price,
      paymentMethod,
      paymentDate,
      paymentNotes: null,
      subscriptionNotes: notes.trim() || null
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
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#15131c] shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-primary">
            {t('nav.subscriptions')}
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label={t('common.close')}
            className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-muted transition-colors hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                  {t('common.member')}
                </span>
                <select
                  value={memberId}
                  onChange={(event) =>
                    setMemberId(event.target.value ? Number(event.target.value) : '')
                  }
                  className="h-10 rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
                >
                  <option value="">{t('common.all')}</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} — #{member.memberNumber} · {member.memberCode}
                    </option>
                  ))}
                </select>
                {errors.memberId ? (
                  <span className="text-[10px] text-rose">{errors.memberId}</span>
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
                      {plan.name} — {plan.durationDays} {t('plans.durationUnit')} —{' '}
                      {formatCurrency(plan.price, locale, t('common.currency'))}
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
                  {t('subscriptions.endDate')}
                </span>
                <input
                  type="date"
                  value={endDate}
                  disabled
                  aria-readonly="true"
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.015] px-3 text-sm text-muted focus:outline-none"
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

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-medium text-muted">
                  {t('common.notes')}
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-primary focus:border-purple/45 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">{t('finance.originalPrice')}</span>
                <span className="font-display font-semibold text-primary">
                  {formatCurrency(price, 'en', t('common.currency'))}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/[0.05] pt-1">
                <span className="font-medium text-primary">{t('finance.netPrice')}</span>
                <span className="font-display font-semibold text-emerald">
                  {formatCurrency(price, 'en', t('common.currency'))}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted">{t('finance.totalPaid')}</span>
                <span className="font-display font-semibold text-primary">
                  {formatCurrency(price, 'en', t('common.currency'))}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted">{t('finance.remaining')}</span>
                <span className="font-display font-semibold text-emerald">
                  {formatCurrency(0, 'en', t('common.currency'))}
                </span>
              </div>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">
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
          </footer>
        </form>
      </div>
    </div>
  )
}
