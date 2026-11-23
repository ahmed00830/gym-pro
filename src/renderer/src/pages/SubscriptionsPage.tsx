import {
  CalendarClock,
  CreditCard,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  StopCircle,
  Wallet
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  statusLabel,
  subscriptionEffectiveStatus
} from '../lib/format'
import { useWorkspace, useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterSelect, SearchInput, SummaryStat } from '../components/ui/Controls'
import { StatusBadge } from '../components/ui/MemberAvatar'
import { SectionCard } from '../components/ui/SectionCard'
import { SubscriptionFormModal } from '../components/subscriptions/SubscriptionFormModal'
import { FreezeModal } from '../components/subscriptions/FreezeModal'
import { PaymentModal } from '../components/subscriptions/PaymentModal'
import {
  Pagination,
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'
import type { SubscriptionRecord } from '@shared/analytics'

const PAGE_SIZE = 9
const subscriptionStatuses = ['active', 'pending', 'frozen', 'expired', 'cancelled', 'completed'] as const

export function SubscriptionsPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const { refresh } = useWorkspace()
  const today = new Date().toISOString().slice(0, 10)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [freezeTarget, setFreezeTarget] = useState<SubscriptionRecord | null>(null)
  const [freezeSubmitting, setFreezeSubmitting] = useState(false)

  const [paymentTarget, setPaymentTarget] = useState<SubscriptionRecord | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  const [busyId, setBusyId] = useState<number | null>(null)

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return snapshot.subscriptions.filter((subscription) => {
      const effective = subscriptionEffectiveStatus(subscription, today)
      const matchesStatus = statusFilter === 'all' || effective === statusFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        subscription.memberName.toLowerCase().includes(normalizedQuery) ||
        subscription.memberCode.toLowerCase().includes(normalizedQuery) ||
        String(subscription.memberNumber).includes(normalizedQuery) ||
        subscription.planName.toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesQuery
    })
  }, [query, snapshot.subscriptions, statusFilter, today])

  const pageCount = Math.max(1, Math.ceil(filteredSubscriptions.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleSubscriptions = filteredSubscriptions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const statusOptions = [
    { value: 'all', label: t('common.all') },
    ...subscriptionStatuses.map((status) => ({
      value: status,
      label: statusLabel(status, t)
    }))
  ]

  const handleCreate = async (input: Parameters<typeof window.gymPro.subscriptions.create>[0]) => {
    setSubmitting(true)
    setActionError(null)
    try {
      await window.gymPro.subscriptions.create(input)
      setFormOpen(false)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleFreeze = async (startDate: string, endDate: string | null, reason: string | null) => {
    if (!freezeTarget) return
    setFreezeSubmitting(true)
    setActionError(null)
    try {
      await window.gymPro.subscriptions.freeze(freezeTarget.id, startDate, endDate, reason)
      setFreezeTarget(null)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
    } finally {
      setFreezeSubmitting(false)
    }
  }

  const handleResume = async (subscription: SubscriptionRecord) => {
    setBusyId(subscription.id)
    setActionError(null)
    try {
      await window.gymPro.subscriptions.resume(subscription.id, today)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (subscription: SubscriptionRecord) => {
    setBusyId(subscription.id)
    setActionError(null)
    try {
      await window.gymPro.subscriptions.cancel(subscription.id)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
    } finally {
      setBusyId(null)
    }
  }

  const handlePayment = async (amount: number, method: string, date: string, notes: string | null) => {
    if (!paymentTarget) return
    setPaymentSubmitting(true)
    setActionError(null)
    try {
      await window.gymPro.subscriptions.recordPayment(paymentTarget.id, amount, method, date, notes)
      setPaymentTarget(null)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
    } finally {
      setPaymentSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      {actionError ? (
        <div className="rounded-xl border border-rose/25 bg-rose/10 px-3 py-2 text-[11px] text-rose">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <SummaryStat
          icon={ShieldCheck}
          label={t('subscriptions.active')}
          value={formatNumber(snapshot.totals.activeSubscriptions, locale)}
          accent="emerald"
        />
        <SummaryStat
          icon={CreditCard}
          label={t('subscriptions.total')}
          value={formatNumber(snapshot.totals.totalSubscriptions, locale)}
          accent="purple"
        />
        <SummaryStat
          icon={CalendarClock}
          label={t('subscriptions.expiring')}
          value={formatNumber(snapshot.totals.expiringMemberships, locale)}
          accent="amber"
        />
      </div>

      <SectionCard
        title={t('nav.subscriptions')}
        subtitle={`${formatNumber(filteredSubscriptions.length, locale)} ${t('common.records')}`}
        bodyClassName="px-0 pb-0"
        action={
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/15 px-3.5 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/25 hover:text-primary"
          >
            <Plus className="size-3.5" />
            {t('subscriptions.newSubscription')}
          </button>
        }
      >
        <div className="flex flex-col gap-3 px-5 pb-4 sm:flex-row">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value)
              setPage(1)
            }}
            placeholder={t('subscriptions.searchPlaceholder')}
            className="flex-1"
          />
          <FilterSelect
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
            options={statusOptions}
            ariaLabel={t('subscriptions.filterStatus')}
            className="w-full sm:w-48"
          />
        </div>

        {snapshot.subscriptions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={t('subscriptions.emptyTitle')}
            description={t('subscriptions.emptyDescription')}
          />
        ) : filteredSubscriptions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={t('subscriptions.noResultsTitle')}
            description={t('subscriptions.noResultsDescription')}
          />
        ) : (
          <>
            <TableFrame caption={t('nav.subscriptions')} minWidth="min-w-[1080px]">
              <TableHead>
                <Th>{t('common.member')}</Th>
                <Th>{t('common.plan')}</Th>
                <Th>{t('plans.duration')}</Th>
                <Th>{t('subscriptions.startDate')}</Th>
                <Th>{t('subscriptions.endDate')}</Th>
                <Th>{t('common.amount')}</Th>
                <Th>{t('common.status')}</Th>
                <Th className="text-end">{t('common.value')}</Th>
              </TableHead>
              <tbody>
                {visibleSubscriptions.map((subscription) => {
                  const effective = subscriptionEffectiveStatus(subscription, today)
                  const isBusy = busyId === subscription.id

                  return (
                    <tr
                      key={subscription.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.022]"
                    >
                      <Td>
                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate text-xs font-medium text-primary">
                            {subscription.memberName}
                          </p>
                          <p
                            dir="ltr"
                            className="mt-0.5 font-display text-[10px] tracking-wide text-dim"
                          >
                            #{subscription.memberNumber} · {subscription.memberCode}
                          </p>
                        </div>
                      </Td>
                      <Td className="text-xs text-muted">{subscription.planName}</Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {formatNumber(subscription.durationDays, locale)}{' '}
                        {t('plans.durationUnit')}
                      </Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {formatDate(subscription.startDate, locale)}
                      </Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {formatDate(subscription.endDate, locale)}
                      </Td>
                      <Td>
                        <div className="text-end">
                          <p className="font-display text-[11px] font-medium text-primary">
                            {formatCurrency(subscription.finalPrice, locale, t('common.currency'))}
                          </p>
                          <p className="mt-0.5 text-[10px] text-dim">
                            {formatCurrency(subscription.balance, locale, t('common.currency'))}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <StatusBadge status={effective} />
                      </Td>
                      <Td className="text-end">
                        <div className="inline-flex items-center gap-1">
                          {effective === 'frozen' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleResume(subscription)}
                              aria-label={t('common.retry')}
                              className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-emerald/30 hover:text-emerald disabled:opacity-50"
                            >
                              <Play className="size-3.5" />
                            </button>
                          ) : effective === 'active' || effective === 'pending' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setFreezeTarget(subscription)}
                              aria-label={t('status.frozen')}
                              className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-amber/30 hover:text-amber disabled:opacity-50"
                            >
                              <Pause className="size-3.5" />
                            </button>
                          ) : null}
                          {subscription.balance > 0 ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setPaymentTarget(subscription)}
                              aria-label={t('payments.method')}
                              className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-emerald/30 hover:text-emerald disabled:opacity-50"
                            >
                              <Wallet className="size-3.5" />
                            </button>
                          ) : null}
                          {effective !== 'cancelled' && effective !== 'completed' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleCancel(subscription)}
                              aria-label={t('status.cancelled')}
                              className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-rose/30 hover:text-rose disabled:opacity-50"
                            >
                              <StopCircle className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableFrame>
            <Pagination
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
              previousLabel={t('common.previous')}
              nextLabel={t('common.next')}
              pageLabel={t('common.page')}
              ofLabel={t('common.of')}
            />
          </>
        )}
      </SectionCard>

      <SubscriptionFormModal
        open={formOpen}
        members={snapshot.members}
        plans={snapshot.plans}
        submitting={submitting}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />

      <FreezeModal
        open={Boolean(freezeTarget)}
        submitting={freezeSubmitting}
        onClose={() => setFreezeTarget(null)}
        onSubmit={handleFreeze}
      />

      <PaymentModal
        open={Boolean(paymentTarget)}
        subscription={paymentTarget}
        submitting={paymentSubmitting}
        onClose={() => setPaymentTarget(null)}
        onSubmit={handlePayment}
      />
    </div>
  )
}
