import {
  CalendarClock,
  CreditCard,
  RefreshCw,
  ScanLine,
  Plus,
  TrendingUp,
  UserPlus,
  Users,
  Wallet
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n, type MessageKey } from '../i18n'
import { formatCurrency, formatDate, formatNumber } from '../lib/format'
import { useWorkspace, useWorkspaceData } from '../workspace/WorkspaceProvider'
import { SummaryStat } from '../components/ui/Controls'
import { AttendanceChart } from '../components/dashboard/AttendanceChart'
import { MetricCard } from '../components/dashboard/MetricCard'
import { MiniStatCard } from '../components/dashboard/MiniStatCard'
import { QuickRegisterModal } from '../components/quick/QuickRegisterModal'
import { QuickRenewModal } from '../components/quick/QuickRenewModal'
import {
  RecentMembers,
  RecentPayments
} from '../components/dashboard/RecentActivity'
import type { AnalyticsRangeReport } from '@shared/analytics'

type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

const RANGE_PRESETS: ReadonlyArray<{ key: RangeKey; labelKey: MessageKey }> = [
  { key: 'today', labelKey: 'reportRange.today' },
  { key: 'yesterday', labelKey: 'reportRange.yesterday' },
  { key: 'week', labelKey: 'reportRange.week' },
  { key: 'month', labelKey: 'reportRange.month' },
  { key: 'custom', labelKey: 'reportRange.custom' }
]

function localIsoDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const anchor = new Date(year, (month ?? 1) - 1, (day ?? 1) + days, 12, 0, 0, 0)
  return localIsoDate(anchor)
}

export function DashboardPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const { refresh } = useWorkspace()
  const totals = snapshot.totals
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false)
  const [quickRenewOpen, setQuickRenewOpen] = useState(false)
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const [quickRenewMember, setQuickRenewMember] = useState<typeof snapshot.members[number] | null>(null)

  const today = localIsoDate()
  const [rangeKey, setRangeKey] = useState<RangeKey>('today')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [rangeReport, setRangeReport] = useState<AnalyticsRangeReport | null>(null)
  const [rangeLoading, setRangeLoading] = useState(false)
  const [rangeError, setRangeError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const range = useMemo(() => {
    switch (rangeKey) {
      case 'yesterday': {
        const yesterday = addDays(today, -1)
        return { from: yesterday, to: yesterday }
      }
      case 'week': {
        const day = new Date().getDay()
        const offset = (day + 6) % 7
        return { from: addDays(today, -offset), to: today }
      }
      case 'month':
        return { from: `${today.slice(0, 7)}-01`, to: today }
      case 'custom':
        return customFrom <= customTo
          ? { from: customFrom, to: customTo }
          : { from: customTo, to: customFrom }
      case 'today':
      default:
        return { from: today, to: today }
    }
  }, [rangeKey, today, customFrom, customTo])

  useEffect(() => {
    let active = true
    setRangeLoading(true)
    setRangeError(false)

    window.gymPro.analytics
      .getRangeReport(range.from, range.to)
      .then((data) => {
        if (active) setRangeReport(data)
      })
      .catch(() => {
        if (active) {
          setRangeReport(null)
          setRangeError(true)
        }
      })
      .finally(() => {
        if (active) setRangeLoading(false)
      })

    return () => {
      active = false
    }
  }, [range.from, range.to, reloadKey])

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setQuickRegisterOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald/30 bg-emerald/12 px-4 py-2 text-xs font-medium text-emerald transition-colors hover:bg-emerald/20"
        >
          <Plus className="size-3.5" />
          {t('members.addMember')}
        </button>
        <button
          type="button"
          onClick={() => {
            setQuickRenewMember(null)
            setQuickRenewOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/15 px-4 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/25 hover:text-primary"
        >
          <Plus className="size-3.5" />
          {t('renewals.renew')}
        </button>
      </div>

      <section
        className="panel rounded-[24px] p-4 sm:p-5"
        aria-label={t('reportRange.label')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-primary">
              {t('reportRange.label')}
            </h2>
            <p className="mt-0.5 text-[10px] text-dim">
              {t('reportRange.inRange')}
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={t('reportRange.label')}
          >
            {RANGE_PRESETS.map((preset) => {
              const isActive = rangeKey === preset.key
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setRangeKey(preset.key)}
                  aria-pressed={isActive}
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'border-purple/40 bg-purple/20 text-purple-soft'
                      : 'border-white/[0.08] text-muted hover:text-primary'
                  }`}
                >
                  {t(preset.labelKey)}
                </button>
              )
            })}
          </div>
        </div>

        {rangeKey === 'custom' ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 px-1">
            <label className="flex items-center gap-2 text-[11px] text-muted">
              {t('common.from')}
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-9 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary focus:border-purple/45 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted">
              {t('common.to')}
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-9 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary focus:border-purple/45 focus:outline-none"
              />
            </label>
          </div>
        ) : null}

        {rangeError ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose/25 bg-rose/10 px-4 py-3 text-[11px] text-rose">
            <span>{t('errors.workspaceDescription')}</span>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="rounded-lg border border-rose/30 px-3 py-1.5 font-medium transition-colors hover:bg-rose/15"
            >
              {t('errors.retry')}
            </button>
          </div>
        ) : null}

        {rangeReport === null ? (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
            aria-hidden="true"
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]"
              />
            ))}
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 ${
              rangeLoading ? 'opacity-70' : ''
            }`}
          >
            <SummaryStat
              icon={Wallet}
              label={t('dashboard.collectedRevenue')}
              value={formatCurrency(
                rangeReport.collectedRevenue,
                locale,
                t('common.currency')
              )}
              hint={`${formatDate(range.from, locale, {
                day: 'numeric',
                month: 'short'
              })} — ${formatDate(range.to, locale, { day: 'numeric', month: 'short' })}`}
              accent="emerald"
            />
            <SummaryStat
              icon={CreditCard}
              label={t('dashboard.subscriptionPayments')}
              value={formatNumber(rangeReport.subscriptionPayments, locale)}
              accent="purple"
            />
            <SummaryStat
              icon={UserPlus}
              label={t('dashboard.newSubscriptions')}
              value={formatNumber(rangeReport.newSubscriptions, locale)}
              accent="purple"
            />
            <SummaryStat
              icon={RefreshCw}
              label={t('dashboard.renewals')}
              value={formatNumber(rangeReport.renewals, locale)}
              accent="amber"
            />
            <SummaryStat
              icon={TrendingUp}
              label={t('dashboard.netCollected')}
              value={formatCurrency(
                rangeReport.netRevenue,
                locale,
                t('common.currency')
              )}
              accent={rangeReport.netRevenue >= 0 ? 'emerald' : 'rose'}
            />
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:gap-5">
        <MetricCard
          accent="purple"
          icon={Wallet}
          label={t('dashboard.totalRevenue')}
          value={formatCurrency(
            totals.totalRevenue,
            locale,
            t('common.currency')
          )}
          note={t('dashboard.revenueNote')}
          sparkData={snapshot.monthlyReport.map((month) => month.revenue)}
          footer={
            <p className="truncate">
              <span className="font-display font-semibold text-purple-soft">
                {formatCurrency(
                  totals.revenueThisMonth,
                  locale,
                  t('common.currency')
                )}
              </span>{' '}
              <span className="text-muted">{t('common.thisMonth')}</span>
            </p>
          }
        />
        <MetricCard
          accent="emerald"
          icon={Users}
          label={t('dashboard.activeMembers')}
          value={formatNumber(totals.activeMembers, locale)}
          note={t('dashboard.activeMembersNote')}
          sparkData={snapshot.attendanceSeries.map(
            (point) => point.registrations
          )}
          footer={
            <p className="truncate">
              <span className="font-display font-semibold text-emerald">
                {formatNumber(totals.activeMembers, locale)}
              </span>{' '}
              <span className="text-muted">
                {t('dashboard.activeOfTotal')}{' '}
                {formatNumber(totals.totalMembers, locale)}
              </span>
            </p>
          }
        />
      </div>

      <div className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)] min-[1180px]:gap-5">
        <AttendanceChart />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <MiniStatCard
            icon={UserPlus}
            label={t('dashboard.newRegistrations')}
            value={formatNumber(totals.newRegistrations, locale)}
            note={t('dashboard.newRegistrationsNote')}
            accent="purple"
          />
          <MiniStatCard
            icon={ScanLine}
            label={t('dashboard.todayAttendance')}
            value={formatNumber(totals.todayAttendance, locale)}
            note={t('dashboard.todayAttendanceNote')}
            accent="emerald"
          />
          <MiniStatCard
            icon={RefreshCw}
            label={t('dashboard.renewals')}
            value={formatNumber(totals.membershipRenewals, locale)}
            note={t('dashboard.renewalsNote')}
            accent="amber"
          />
          <MiniStatCard
            icon={CalendarClock}
            label={t('dashboard.expiring')}
            value={formatNumber(totals.expiringMemberships, locale)}
            note={t('dashboard.expiringNote')}
            accent="rose"
          />
        </div>
      </div>

      <div className="grid gap-4 min-[1180px]:grid-cols-2 min-[1180px]:gap-5">
        <RecentMembers />
        <RecentPayments />
      </div>

      <QuickRegisterModal
        open={quickRegisterOpen}
        plans={snapshot.plans}
        submitting={quickSubmitting}
        onClose={() => setQuickRegisterOpen(false)}
        onSubmit={async (input) => {
          setQuickSubmitting(true)
          try {
            const result = await window.gymPro.members.quickRegister(input)
            setQuickRegisterOpen(false)
            await refresh()
            return result
          } finally {
            setQuickSubmitting(false)
          }
        }}
      />

      <QuickRenewModal
        open={quickRenewOpen}
        member={quickRenewMember}
        members={snapshot.members}
        subscriptions={snapshot.subscriptions}
        currentSubscription={null}
        plans={snapshot.plans}
        submitting={quickSubmitting}
        onClose={() => {
          setQuickRenewOpen(false)
          setQuickRenewMember(null)
        }}
        onSubmit={async (input) => {
          setQuickSubmitting(true)
          try {
            await window.gymPro.subscriptions.quickRenew(input)
            setQuickRenewOpen(false)
            setQuickRenewMember(null)
            await refresh()
          } finally {
            setQuickSubmitting(false)
          }
        }}
      />
    </div>
  )
}
