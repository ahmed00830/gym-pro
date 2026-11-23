import { RefreshCw, Repeat2, TrendingUp, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  percentage
} from '../lib/format'
import { useWorkspace, useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { SearchInput, SummaryStat } from '../components/ui/Controls'
import { StatusBadge } from '../components/ui/MemberAvatar'
import { SectionCard } from '../components/ui/SectionCard'
import { QuickRenewModal } from '../components/quick/QuickRenewModal'
import {
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'
import type { MemberRecord } from '@shared/analytics'

export function RenewalsPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const { refresh } = useWorkspace()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [renewMember, setRenewMember] = useState<MemberRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const filteredRenewals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return snapshot.renewals.filter(
      (renewal) =>
        normalizedQuery.length === 0 ||
        renewal.memberName.toLowerCase().includes(normalizedQuery) ||
        renewal.memberCode.toLowerCase().includes(normalizedQuery) ||
        String(renewal.memberNumber).includes(normalizedQuery) ||
        renewal.planName.toLowerCase().includes(normalizedQuery)
    )
  }, [query, snapshot.renewals])

  const renewMemberCurrent = renewMember
    ? snapshot.subscriptions
        .filter((subscription) => subscription.memberId === renewMember.id)
        .sort((left, right) => right.endDate.localeCompare(left.endDate))[0] ??
      null
    : null

  const repeatShare = percentage(
    snapshot.totals.totalRenewals,
    snapshot.totals.totalSubscriptions
  )

  const openQuickRenew = (member: MemberRecord | null) => {
    setRenewMember(member)
    setActionError(null)
    setFormOpen(true)
  }

  const handleQuickRenew = async (input: {
    memberId: number
    planId: number
    paymentMethod: string
    paymentDate: string
    startDate: string | null
    notes: string | null
  }) => {
    setSubmitting(true)
    setActionError(null)

    try {
      await window.gymPro.subscriptions.quickRenew(input)
      setFormOpen(false)
      setRenewMember(null)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
    } finally {
      setSubmitting(false)
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
          icon={RefreshCw}
          label={t('renewals.thisMonth')}
          value={formatNumber(snapshot.totals.membershipRenewals, locale)}
          accent="amber"
        />
        <SummaryStat
          icon={Repeat2}
          label={t('renewals.total')}
          value={formatNumber(snapshot.totals.totalRenewals, locale)}
          accent="purple"
        />
        <SummaryStat
          icon={TrendingUp}
          label={t('renewals.repeatRate')}
          value={`${formatNumber(repeatShare, locale)}%`}
          accent="emerald"
        />
      </div>

      <SectionCard
        title={t('nav.renewals')}
        subtitle={`${formatNumber(filteredRenewals.length, locale)} ${t('common.records')}`}
        bodyClassName="px-0 pb-0"
        action={
          <button
            type="button"
            onClick={() => openQuickRenew(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/15 px-3.5 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/25 hover:text-primary"
          >
            <Plus className="size-3.5" />
            {t('renewals.renew')}
          </button>
        }
      >
        <div className="px-5 pb-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t('renewals.searchPlaceholder')}
          />
        </div>

        {snapshot.renewals.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title={t('renewals.emptyTitle')}
            description={t('renewals.emptyDescription')}
          />
        ) : filteredRenewals.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title={t('members.noResultsTitle')}
            description={t('members.noResultsDescription')}
          />
        ) : (
          <TableFrame caption={t('nav.renewals')} minWidth="min-w-[1000px]">
            <TableHead>
              <Th>{t('common.member')}</Th>
              <Th>{t('common.plan')}</Th>
              <Th>{t('plans.duration')}</Th>
              <Th>{t('renewals.renewalNumber')}</Th>
              <Th>{t('subscriptions.startDate')}</Th>
              <Th>{t('subscriptions.endDate')}</Th>
              <Th>{t('subscriptions.price')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="text-end">{t('common.value')}</Th>
            </TableHead>
            <tbody>
              {filteredRenewals.map((renewal) => (
                <tr
                  key={renewal.id}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.022]"
                >
                  <Td>
                    <div className="min-w-0">
                      <p className="max-w-[180px] truncate text-xs font-medium text-primary">
                        {renewal.memberName}
                      </p>
                      <p
                        dir="ltr"
                        className="mt-0.5 font-display text-[10px] tracking-wide text-dim"
                      >
                        #{renewal.memberNumber} · {renewal.memberCode}
                      </p>
                    </div>
                  </Td>
                  <Td className="text-xs text-muted">{renewal.planName}</Td>
                  <Td className="whitespace-nowrap text-[11px] text-muted">
                    {formatNumber(renewal.durationDays, locale)}{' '}
                    {t('plans.durationUnit')}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-purple/20 bg-purple/10 px-2 py-1 font-display text-[10px] font-semibold text-purple-soft">
                      <Repeat2 className="size-3" />
                      {formatNumber(renewal.renewalNumber, locale)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-[11px] text-muted">
                    {formatDate(renewal.startDate, locale)}
                  </Td>
                  <Td className="whitespace-nowrap text-[11px] text-muted">
                    {formatDate(renewal.endDate, locale)}
                  </Td>
                  <Td className="whitespace-nowrap font-display text-[11px] font-medium text-primary">
                    {formatCurrency(renewal.finalPrice, locale, t('common.currency'))}
                  </Td>
                  <Td>
                    <StatusBadge status={renewal.status} />
                  </Td>
                  <Td className="text-end">
                    <button
                      type="button"
                      onClick={() => {
                        const member = snapshot.members.find(
                          (entry) => entry.id === renewal.memberId
                        )
                        openQuickRenew(member ?? null)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-purple/20 bg-purple/10 px-2 py-1 text-[10px] font-medium text-purple-soft transition-colors hover:bg-purple/20"
                    >
                      <RefreshCw className="size-3" />
                      {t('renewals.renew')}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </SectionCard>

      <QuickRenewModal
        open={formOpen}
        member={renewMember}
        members={snapshot.members}
        subscriptions={snapshot.subscriptions}
        currentSubscription={renewMemberCurrent}
        plans={snapshot.plans}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false)
          setRenewMember(null)
        }}
        onSubmit={handleQuickRenew}
      />
    </div>
  )
}
