import { CreditCard, Landmark, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatTimeOfDay,
  paymentMethodLabel,
  percentage
} from '../lib/format'
import { useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import {
  FilterSelect,
  SearchInput,
  SummaryStat
} from '../components/ui/Controls'
import { SectionCard } from '../components/ui/SectionCard'
import {
  Pagination,
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'

const PAGE_SIZE = 9
const paymentMethodOptions = ['cash', 'card', 'transfer', 'wallet', 'other'] as const

export function PaymentsPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [page, setPage] = useState(1)

  const resetPage = () => setPage(1)

  const filteredPayments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return snapshot.payments.filter((payment) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        payment.memberName.toLowerCase().includes(normalizedQuery) ||
        payment.memberCode.toLowerCase().includes(normalizedQuery) ||
        String(payment.memberNumber).includes(normalizedQuery) ||
        (payment.planName ?? '').toLowerCase().includes(normalizedQuery) ||
        paymentMethodLabel(payment.paymentMethod, t)
          .toLowerCase()
          .includes(normalizedQuery)

      const matchesFrom =
        fromDate.length === 0 || payment.paymentDate >= fromDate
      const matchesTo = toDate.length === 0 || payment.paymentDate <= toDate
      const matchesMethod =
        methodFilter === 'all' || payment.paymentMethod === methodFilter

      return matchesQuery && matchesFrom && matchesTo && matchesMethod
    })
  }, [query, fromDate, toDate, methodFilter, snapshot.payments, t])

  const pageCount = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visiblePayments = filteredPayments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const averagePayment =
    snapshot.totals.totalPayments > 0
      ? snapshot.totals.totalRevenue / snapshot.totals.totalPayments
      : 0

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryStat
          icon={Wallet}
          label={t('payments.todayRevenue')}
          value={formatCurrency(
            snapshot.totals.revenueToday,
            locale,
            t('common.currency')
          )}
          accent="emerald"
        />
        <SummaryStat
          icon={Wallet}
          label={t('payments.totalRevenue')}
          value={formatCurrency(
            snapshot.totals.totalRevenue,
            locale,
            t('common.currency')
          )}
          accent="emerald"
        />
        <SummaryStat
          icon={Landmark}
          label={t('payments.thisMonth')}
          value={formatCurrency(
            snapshot.totals.revenueThisMonth,
            locale,
            t('common.currency')
          )}
          accent="purple"
        />
        <SummaryStat
          icon={CreditCard}
          label={t('payments.entries')}
          value={formatNumber(snapshot.totals.totalPayments, locale)}
          accent="purple"
        />
        <SummaryStat
          icon={Wallet}
          label={t('payments.average')}
          value={formatCurrency(averagePayment, locale, t('common.currency'))}
          accent="neutral"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-5">
        <SectionCard
          title={t('nav.payments')}
          subtitle={`${formatNumber(filteredPayments.length, locale)} ${t('common.records')}`}
          bodyClassName="px-0 pb-0"
        >
          <div className="flex flex-col gap-3 px-5 pb-4 xl:flex-row xl:flex-wrap xl:items-center">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value)
                resetPage()
              }}
              placeholder={t('renewals.searchMemberNumber')}
              className="flex-1"
            />
            <FilterSelect
              value={methodFilter}
              onChange={(value) => {
                setMethodFilter(value)
                resetPage()
              }}
              options={[
                { value: 'all', label: t('common.all') },
                ...paymentMethodOptions.map((method) => ({
                  value: method,
                  label: paymentMethodLabel(method, t)
                }))
              ]}
              ariaLabel={t('payments.filterMethod')}
              className="w-full xl:w-44"
            />
            <label className="flex items-center gap-2 text-[11px] text-muted">
              {t('common.from')}
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  resetPage()
                }}
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary focus:border-purple/45 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted">
              {t('common.to')}
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value)
                  resetPage()
                }}
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary focus:border-purple/45 focus:outline-none"
              />
            </label>
          </div>

          {snapshot.payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t('payments.emptyTitle')}
              description={t('payments.emptyDescription')}
            />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t('payments.noResultsTitle')}
              description={t('payments.noResultsDescription')}
            />
          ) : (
            <>
              <TableFrame caption={t('nav.payments')} minWidth="min-w-[1080px]">
                <TableHead>
                  <Th>{t('payments.transactionId')}</Th>
                  <Th>{t('attendance.memberNumber')}</Th>
                  <Th>{t('common.member')}</Th>
                  <Th>{t('common.plan')}</Th>
                  <Th className="text-end">{t('common.amount')}</Th>
                  <Th>{t('payments.method')}</Th>
                  <Th>{t('common.date')}</Th>
                  <Th>{t('payments.time')}</Th>
                  <Th>{t('common.type')}</Th>
                </TableHead>
                <tbody>
                  {visiblePayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.022]"
                    >
                      <Td>
                        <span
                          dir="ltr"
                          className="font-display text-[11px] text-dim"
                        >
                          #{payment.id}
                        </span>
                      </Td>
                      <Td>
                        <span
                          dir="ltr"
                          className="font-display text-[11px] font-semibold text-purple-soft"
                        >
                          #{payment.memberNumber}
                        </span>
                      </Td>
                      <Td>
                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate text-xs font-medium text-primary">
                            {payment.memberName}
                          </p>
                          <p
                            dir="ltr"
                            className="mt-0.5 font-display text-[10px] tracking-wide text-dim"
                          >
                            {payment.memberCode}
                          </p>
                        </div>
                      </Td>
                      <Td className="max-w-[160px] truncate text-[11px] text-muted">
                        {payment.planName ?? '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-end font-display text-xs font-semibold text-emerald">
                        +{formatCurrency(payment.amount, locale, t('common.currency'))}
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple/20 bg-purple/10 px-2 py-1 text-[10px] font-medium text-purple-soft">
                          <CreditCard className="size-3" />
                          {paymentMethodLabel(payment.paymentMethod, t)}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {formatDate(payment.paymentDate, locale)}
                      </Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {formatTimeOfDay(payment.createdAt, locale)}
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-medium ${
                            payment.paymentType === 'renewal'
                              ? 'border-purple/20 bg-purple/10 text-purple-soft'
                              : 'border-emerald/20 bg-emerald/10 text-emerald'
                          }`}
                        >
                          {payment.paymentType === 'renewal'
                            ? t('payments.renewalType')
                            : t('subscriptions.newSubscription')}
                        </span>
                      </Td>
                    </tr>
                  ))}
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

        <SectionCard
          title={t('payments.methodsTitle')}
          className="h-fit"
          bodyClassName="px-5 pb-5"
        >
          {snapshot.paymentMethods.length === 0 ? (
            <EmptyState
              compact
              icon={CreditCard}
              title={t('payments.emptyTitle')}
            />
          ) : (
            <ul className="space-y-4">
              {snapshot.paymentMethods.map((method) => {
                const share = percentage(method.total, snapshot.totals.totalRevenue)

                return (
                  <li key={method.method}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[11px] font-medium text-primary">
                        {paymentMethodLabel(method.method, t)}
                      </span>
                      <span className="shrink-0 font-display text-[11px] font-semibold text-primary">
                        {formatCurrency(method.total, locale, t('common.currency'))}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple to-purple-soft shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-dim">
                      {formatNumber(method.count, locale)} {t('common.records')} ·{' '}
                      {formatNumber(share, locale)}%
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
