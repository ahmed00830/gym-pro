import { ChevronRight, Users, Wallet } from 'lucide-react'
import { useI18n } from '../../i18n'
import {
  formatCurrency,
  formatDate,
  paymentMethodLabel
} from '../../lib/format'
import { hrefFor } from '../../lib/routes'
import { useWorkspaceData } from '../../workspace/WorkspaceProvider'
import { MemberAvatar, StatusBadge } from '../ui/MemberAvatar'
import { EmptyState } from '../ui/EmptyState'
import { SectionCard } from '../ui/SectionCard'

export function RecentMembers() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const members = snapshot.members.slice(0, 5)

  return (
    <SectionCard
      title={t('dashboard.recentMembers')}
      subtitle={t('dashboard.recentMembersSubtitle')}
      bodyClassName="px-2 pb-2"
      action={
        <a
          href={hrefFor('members')}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-purple-soft transition-colors hover:text-primary"
        >
          {t('common.viewAll')}
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </a>
      }
    >
      {members.length === 0 ? (
        <EmptyState
          compact
          icon={Users}
          title={t('dashboard.emptyMembersTitle')}
          description={t('dashboard.emptyMembersDescription')}
        />
      ) : (
        <ul className="divide-y divide-white/[0.045]">
          {members.map((member) => (
            <li key={member.id}>
              <a
                href={hrefFor('memberProfile', member.id)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
              >
                <MemberAvatar name={member.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-primary">
                    {member.fullName}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-0.5 text-start font-display text-[10px] tracking-wide text-dim"
                  >
                    {member.memberCode}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={member.status} />
                  <span className="hidden text-[10px] text-dim sm:block">
                    {formatDate(member.registrationDate, locale, {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export function RecentPayments() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const payments = snapshot.payments.slice(0, 5)

  return (
    <SectionCard
      title={t('dashboard.recentPayments')}
      subtitle={t('dashboard.recentPaymentsSubtitle')}
      bodyClassName="px-2 pb-2"
      action={
        <a
          href={hrefFor('payments')}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-purple-soft transition-colors hover:text-primary"
        >
          {t('common.viewAll')}
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </a>
      }
    >
      {payments.length === 0 ? (
        <EmptyState
          compact
          icon={Wallet}
          title={t('dashboard.emptyPaymentsTitle')}
          description={t('dashboard.emptyPaymentsDescription')}
        />
      ) : (
        <ul className="divide-y divide-white/[0.045]">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-purple/20 bg-purple/10 text-purple-soft">
                <Wallet className="size-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-primary">
                  {payment.memberName}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-dim">
                  {formatDate(payment.paymentDate, locale)} ·{' '}
                  {paymentMethodLabel(payment.paymentMethod, t)}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="font-display text-xs font-semibold text-emerald">
                  +{formatCurrency(payment.amount, locale, t('common.currency'))}
                </p>
                <p
                  dir="ltr"
                  className="mt-0.5 font-display text-[10px] tracking-wide text-dim"
                >
                  {payment.memberCode}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
