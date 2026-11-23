import { Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { formatCurrency, formatDate, subscriptionEffectiveStatus } from '../../lib/format'
import { MemberAvatar, StatusBadge } from '../ui/MemberAvatar'
import type { MemberRecord, PlanRecord, SubscriptionRecord } from '@shared/analytics'

function localIsoDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  date.setDate(date.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const paymentMethods = ['cash', 'card', 'transfer', 'wallet', 'other']

interface QuickRenewModalProps {
  open: boolean
  /** Pre-selected member when renewing from a specific context (member lists). */
  member: MemberRecord | null
  members: MemberRecord[]
  /** Used to show the selected member's current subscription. */
  subscriptions?: SubscriptionRecord[]
  /** Optional precomputed current subscription (takes priority when it matches the member). */
  currentSubscription: SubscriptionRecord | null
  plans: PlanRecord[]
  submitting: boolean
  onClose: () => void
  onSubmit: (input: {
    memberId: number
    planId: number
    paymentMethod: string
    paymentDate: string
    startDate: string | null
    notes: string | null
  }) => Promise<void>
}

export function QuickRenewModal({
  open,
  member,
  members,
  subscriptions,
  currentSubscription,
  plans,
  submitting,
  onClose,
  onSubmit
}: QuickRenewModalProps) {
  const { t, locale } = useI18n()
  const today = localIsoDate()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [planId, setPlanId] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentDate, setPaymentDate] = useState(today)
  const [startDate, setStartDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activeMember =
    member ?? members.find((entry) => entry.id === selectedMemberId) ?? null

  const activePlans = plans.filter((plan) => plan.isActive)
  const selectedPlan = plans.find((plan) => plan.id === planId)
  const price = selectedPlan?.price ?? 0

  const currentSub = useMemo(() => {
    if (!activeMember) return null

    if (
      currentSubscription &&
      currentSubscription.memberId === activeMember.id
    ) {
      return currentSubscription
    }

    if (subscriptions) {
      const own = subscriptions
        .filter((subscription) => subscription.memberId === activeMember.id)
        .sort(
          (left, right) =>
            right.endDate.localeCompare(left.endDate) || right.id - left.id
        )
      return own[0] ?? null
    }

    return currentSubscription
  }, [activeMember, currentSubscription, subscriptions])

  const memberMatches = useMemo(() => {
    if (member) return []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []

    return members
      .filter(
        (entry) =>
          entry.fullName.toLowerCase().includes(normalized) ||
          entry.memberCode.toLowerCase().includes(normalized) ||
          String(entry.memberNumber).includes(normalized) ||
          (entry.phone ?? '').toLowerCase().includes(normalized) ||
          (entry.secondaryPhone ?? '').toLowerCase().includes(normalized)
      )
      .slice(0, 6)
  }, [member, members, query])

  const computedStart =
    currentSub && currentSub.endDate >= today
      ? addDays(currentSub.endDate, 1)
      : today
  const computedEnd = selectedPlan
    ? addDays(startDate || computedStart, selectedPlan.durationDays)
    : ''

  // Resetting when opening.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedMemberId(null)
    setPlanId('')
    setPaymentMethod('cash')
    setPaymentDate(today)
    setNotes('')
    setErrors({})
    setStartDate(today)
  }, [open, today])

  // Typing a complete member number selects that member immediately.
  useEffect(() => {
    if (member) return
    const normalized = query.trim()
    if (!normalized) return

    const exact = members.find(
      (entry) => String(entry.memberNumber) === normalized
    )

    if (exact) setSelectedMemberId(exact.id)
  }, [member, members, query])

  useEffect(() => {
    if (!open) return
    setStartDate(computedStart)
  }, [computedStart, open])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
  }, [open])

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
    if (!activeMember) nextErrors.member = t('common.noData')
    if (planId === '') nextErrors.planId = t('common.noData')
    if (!paymentMethod) nextErrors.paymentMethod = t('common.noData')
    if (!paymentDate) nextErrors.paymentDate = t('common.noData')
    if (!startDate) nextErrors.startDate = t('common.noData')
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      memberId: activeMember!.id,
      planId: Number(planId),
      paymentMethod,
      paymentDate,
      startDate: startDate || null,
      notes: notes.trim() || null
    })
  }

  const currentEffectiveStatus = currentSub
    ? subscriptionEffectiveStatus(currentSub, today)
    : null

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
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[26px] border border-white/[0.08] bg-[#15131c] p-6 shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-primary">
            {t('renewals.renew')}
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

        {!member ? (
          <div className="mb-4">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-dim"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelectedMemberId(null)
                }}
                placeholder={t('renewals.searchMemberNumber')}
                aria-label={t('renewals.searchMemberNumber')}
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pe-3 ps-10 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
              />
            </div>

            {memberMatches.length > 0 && !activeMember ? (
              <ul className="mt-2 divide-y divide-white/[0.045] overflow-hidden rounded-xl border border-white/[0.06]">
                {memberMatches.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemberId(entry.id)
                        setQuery(String(entry.memberNumber))
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-white/[0.03]"
                    >
                      <MemberAvatar name={entry.fullName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-primary">
                          {entry.fullName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-dim">
                          <span dir="ltr">#{entry.memberNumber}</span>
                          {' · '}
                          <span dir="ltr">{entry.memberCode}</span>
                          {' · '}
                          {entry.phone ?? '—'}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {errors.member ? (
              <span className="mt-1 block text-[10px] text-rose">
                {errors.member}
              </span>
            ) : null}
          </div>
        ) : null}

        {activeMember ? (
          <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-primary">{activeMember.fullName}</p>
                <p className="mt-0.5 text-[10px] text-dim">
                  <span dir="ltr" className="font-display font-semibold text-purple-soft">
                    #{activeMember.memberNumber}
                  </span>
                  {' · '}
                  <span dir="ltr">{activeMember.memberCode}</span>
                  {' · '}
                  {activeMember.phone ?? '—'}
                </p>
              </div>
            </div>
            {currentSub ? (
              <div className="mt-2 border-t border-white/[0.05] pt-2">
                <p className="text-[10px] text-dim">
                  {t('renewals.currentSubscription')}
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-primary">
                    {currentSub.planName}
                    {' · '}
                    {formatDate(currentSub.startDate, locale)} —{' '}
                    {formatDate(currentSub.endDate, locale)}
                  </p>
                  <StatusBadge status={currentEffectiveStatus ?? 'inactive'} />
                </div>
              </div>
            ) : (
              <p className="mt-2 border-t border-white/[0.05] pt-2 text-[10px] text-dim">
                {t('members.noActivePlan')}
              </p>
            )}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('common.plan')}
            </span>
            <select
              value={planId}
              onChange={(event) =>
                setPlanId(event.target.value ? Number(event.target.value) : '')
              }
              className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
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

          <div className="grid grid-cols-2 gap-3">
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
              {errors.startDate ? (
                <span className="text-[10px] text-rose">{errors.startDate}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('subscriptions.endDate')}
              </span>
              <input
                type="date"
                value={computedEnd}
                disabled
                aria-readonly="true"
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.015] px-3 text-sm text-muted focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('payments.method')}
            </span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
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
            {errors.paymentDate ? (
              <span className="text-[10px] text-rose">{errors.paymentDate}</span>
            ) : null}
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
                  {formatCurrency(price, locale, t('common.currency'))}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/[0.05] pt-1">
                <span className="text-muted">{t('finance.totalPaid')}</span>
                <span className="font-display font-semibold text-primary">
                  {formatCurrency(price, locale, t('common.currency'))}
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
      </div>
    </div>
  )
}
