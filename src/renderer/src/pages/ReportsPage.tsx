import {
  BarChart3,
  CalendarClock,
  TrendingDown,
  TrendingUp,
  UserPlus
} from 'lucide-react'
import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useI18n } from '../i18n'
import {
  expenseCategoryLabel,
  formatCurrency,
  formatDate,
  formatMonth,
  formatNumber,
  paymentMethodLabel,
  percentage,
  subscriptionEffectiveStatus
} from '../lib/format'
import { useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { SummaryStat } from '../components/ui/Controls'
import { StatusBadge } from '../components/ui/MemberAvatar'
import { SectionCard } from '../components/ui/SectionCard'
import {
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'

const EXPIRING_OPTIONS = [
  { value: '3', label: '≤ 3' },
  { value: '7', label: '≤ 7' },
  { value: '14', label: '≤ 14' },
  { value: '30', label: '≤ 30' }
] as const

function localIsoDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)
}

interface TooltipEntry {
  dataKey?: string | number
  value?: number | string
}

interface ReportTooltipProps {
  active?: boolean
  label?: string
  payload?: TooltipEntry[]
}

function ReportTooltip({ active, label, payload }: ReportTooltipProps) {
  const { t, locale } = useI18n()

  if (!active || !payload || payload.length === 0) return null

  const labels: Record<string, string> = {
    revenue: t('reports.revenue'),
    expenses: t('reports.expenses'),
    net: t('reports.net')
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1723]/95 px-3 py-2.5 shadow-2xl backdrop-blur-sm">
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-4 text-[11px]"
          >
            <span className="text-muted">
              {labels[String(entry.dataKey)] ?? entry.dataKey}
            </span>
            <span className="font-display font-semibold text-primary">
              {formatCurrency(Number(entry.value ?? 0), locale, t('common.currency'))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReportsPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const today = localIsoDate()
  const [expiringWindow, setExpiringWindow] = useState<string>('7')

  const phoneById = new Map(
    snapshot.members.map((member) => [member.id, member.phone ?? '—'] as const)
  )

  const catalogNames = new Map(
    snapshot.expenseCatalog.map((entry) => [entry.key, entry] as const)
  )
  const categoryLabelOf = (key: string): string => {
    const entry = catalogNames.get(key)

    if (entry) {
      return locale === 'ar' ? entry.nameAr : entry.nameEn
    }

    return expenseCategoryLabel(key, t)
  }

  const expiringSubscriptions = snapshot.subscriptions
    .filter((subscription) => {
      const effective = subscriptionEffectiveStatus(subscription, today)
      return (
        (effective === 'active' ||
          effective === 'frozen' ||
          effective === 'pending') &&
        subscription.endDate >= today
      )
    })
    .map((subscription) => ({
      subscription,
      remainingDays: daysBetween(today, subscription.endDate)
    }))
    .filter(
      (entry) =>
        expiringWindow === 'all' ||
        entry.remainingDays <= Number(expiringWindow)
    )
    .sort(
      (left, right) =>
        left.subscription.endDate.localeCompare(right.subscription.endDate) ||
        left.subscription.id - right.subscription.id
    )

  const chartData = snapshot.monthlyReport.map((point) => ({
    ...point,
    label: formatMonth(point.month, locale),
    net: point.revenue - point.expenses
  }))

  const hasFinancialData =
    snapshot.totals.totalRevenue > 0 || snapshot.totals.totalExpenses > 0
  const netThisMonth =
    snapshot.totals.revenueThisMonth - snapshot.totals.expensesThisMonth

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryStat
          icon={TrendingUp}
          label={t('reports.todayRevenue')}
          value={formatCurrency(
            snapshot.totals.revenueToday,
            locale,
            t('common.currency')
          )}
          accent="emerald"
        />
        <SummaryStat
          icon={TrendingUp}
          label={t('reports.thisMonthRevenue')}
          value={formatCurrency(
            snapshot.totals.revenueThisMonth,
            locale,
            t('common.currency')
          )}
          accent="emerald"
        />
        <SummaryStat
          icon={TrendingDown}
          label={t('reports.thisMonthExpenses')}
          value={formatCurrency(
            snapshot.totals.expensesThisMonth,
            locale,
            t('common.currency')
          )}
          accent="rose"
        />
        <SummaryStat
          icon={BarChart3}
          label={t('reports.thisMonthNet')}
          value={formatCurrency(netThisMonth, locale, t('common.currency'))}
          accent={netThisMonth >= 0 ? 'purple' : 'rose'}
        />
        <SummaryStat
          icon={UserPlus}
          label={t('reports.thisMonthMembers')}
          value={formatNumber(snapshot.totals.newRegistrations, locale)}
          accent="amber"
        />
      </div>

      <SectionCard
        title={t('reports.monthlyTitle')}
        subtitle={t('reports.monthlySubtitle')}
        action={
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-purple"
              />
              {t('reports.revenue')}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-rose"
              />
              {t('reports.expenses')}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-emerald"
              />
              {t('reports.net')}
            </span>
          </div>
        }
      >
        {!hasFinancialData ? (
          <div className="px-5 pb-3">
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] text-dim">
              {t('reports.noDataDescription')}
            </p>
          </div>
        ) : null}
        <div className="h-[280px] w-full sm:h-[320px]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="report-revenue-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.45} />
                </linearGradient>
                <linearGradient id="report-expense-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#9f1239" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="rgba(255,255,255,0.055)"
                strokeDasharray="3 7"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6f6f7e', fontSize: 10 }}
                tickMargin={11}
                minTickGap={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={44}
                allowDecimals={false}
                tick={{ fill: '#6f6f7e', fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.035)' }}
                content={<ReportTooltip />}
              />
              <Bar
                dataKey="revenue"
                fill="url(#report-revenue-bar)"
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
              />
              <Bar
                dataKey="expenses"
                fill="url(#report-expense-bar)"
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#10d9a0"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: '#10d9a0',
                  stroke: '#0b0b10',
                  strokeWidth: 2
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <SectionCard
          title={t('reports.paymentBreakdown')}
          bodyClassName="px-5 pb-5"
        >
          {snapshot.paymentMethods.length === 0 ? (
            <EmptyState
              compact
              icon={TrendingUp}
              title={t('reports.noDataTitle')}
              description={t('reports.noDataDescription')}
            />
          ) : (
            <ul className="space-y-4">
              {snapshot.paymentMethods.map((method) => {
                const share = percentage(
                  method.total,
                  snapshot.totals.totalRevenue
                )

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
                      {formatNumber(method.count, locale)} {t('common.records')}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t('reports.expenseBreakdown')}
          bodyClassName="px-5 pb-5"
        >
          {snapshot.expenseCategories.length === 0 ? (
            <EmptyState
              compact
              icon={TrendingDown}
              title={t('reports.noDataTitle')}
              description={t('reports.noDataDescription')}
            />
          ) : (
            <ul className="space-y-4">
              {snapshot.expenseCategories.map((category) => {
                const share = percentage(
                  category.total,
                  snapshot.totals.totalExpenses
                )

                return (
                  <li key={category.category}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[11px] font-medium text-primary">
                        {categoryLabelOf(category.category)}
                      </span>
                      <span className="shrink-0 font-display text-[11px] font-semibold text-primary">
                        {formatCurrency(category.total, locale, t('common.currency'))}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber to-rose shadow-[0_0_12px_rgba(251,113,133,0.4)]"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-dim">
                      {formatNumber(category.count, locale)} {t('common.records')}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={t('subscriptions.expiringTitle')}
        subtitle={t('subscriptions.expiringSubtitle')}
        bodyClassName="px-0 pb-0"
        action={
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t('subscriptions.expiringTitle')}
          >
            {EXPIRING_OPTIONS.map((option) => {
              const isActive = expiringWindow === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpiringWindow(option.value)}
                  aria-pressed={isActive}
                  className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${
                    isActive
                      ? 'border-purple/40 bg-purple/20 text-purple-soft'
                      : 'border-white/[0.08] text-muted hover:text-primary'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setExpiringWindow('all')}
              aria-pressed={expiringWindow === 'all'}
              className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${
                expiringWindow === 'all'
                  ? 'border-purple/40 bg-purple/20 text-purple-soft'
                  : 'border-white/[0.08] text-muted hover:text-primary'
              }`}
            >
              {t('common.all')}
            </button>
          </div>
        }
      >
        {expiringSubscriptions.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarClock}
            title={t('subscriptions.expiringTitle')}
            description={t('subscriptions.emptyDescription')}
          />
        ) : (
          <TableFrame
            caption={t('subscriptions.expiringTitle')}
            minWidth="min-w-[880px]"
          >
            <TableHead>
              <Th>{t('attendance.memberNumber')}</Th>
              <Th>{t('common.member')}</Th>
              <Th>{t('memberProfile.phone')}</Th>
              <Th>{t('common.plan')}</Th>
              <Th>{t('subscriptions.endDate')}</Th>
              <Th>{t('attendance.remainingDays')}</Th>
              <Th>{t('common.status')}</Th>
            </TableHead>
            <tbody>
              {expiringSubscriptions.slice(0, 10).map(
                ({ subscription, remainingDays }) => (
                  <tr
                    key={subscription.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.022]"
                  >
                    <Td>
                      <span
                        dir="ltr"
                        className="font-display text-[11px] font-semibold text-purple-soft"
                      >
                        #{subscription.memberNumber}
                      </span>
                    </Td>
                    <Td>
                      <p className="max-w-[160px] truncate text-xs font-medium text-primary">
                        {subscription.memberName}
                      </p>
                    </Td>
                    <Td>
                      <span
                        dir="ltr"
                        className="whitespace-nowrap font-display text-[11px] text-muted"
                      >
                        {phoneById.get(subscription.memberId) ?? '—'}
                      </span>
                    </Td>
                    <Td className="max-w-[160px] truncate text-[11px] text-muted">
                      {subscription.planName}
                    </Td>
                    <Td className="whitespace-nowrap text-[11px] text-muted">
                      {formatDate(subscription.endDate, locale)}
                    </Td>
                    <Td>
                      <span
                        className={`font-display text-[11px] font-semibold ${
                          remainingDays <= 3 ? 'text-rose' : 'text-amber'
                        }`}
                      >
                        {formatNumber(remainingDays, locale)}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge
                        status={subscriptionEffectiveStatus(subscription, today)}
                      />
                    </Td>
                  </tr>
                )
              )}
            </tbody>
          </TableFrame>
        )}
      </SectionCard>
    </div>
  )
}
