import {
  ArrowLeft,
  CalendarDays,
  RefreshCw,
  ScanLine,
  UserX,
  Wallet
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatTime,
  paymentMethodLabel,
  statusLabel
} from '../lib/format'
import { hrefFor } from '../lib/routes'
import { useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { SummaryStat } from '../components/ui/Controls'
import { MemberAvatar, StatusBadge } from '../components/ui/MemberAvatar'
import { SectionCard } from '../components/ui/SectionCard'
import {
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'

interface MemberProfilePageProps {
  memberId: number
}

function DetailItem({
  label,
  value,
  ltr = false
}: {
  label: string
  value: ReactNode
  ltr?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium text-dim">{label}</dt>
      <dd
        dir={ltr ? 'ltr' : undefined}
        className={`mt-1 break-words text-xs text-primary ${
          ltr ? 'text-start font-display' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

export function MemberProfilePage({ memberId }: MemberProfilePageProps) {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const member = snapshot.members.find((entry) => entry.id === memberId)

  if (!member) {
    return (
      <div className="animate-fade-in">
        <SectionCard>
          <a
            href={hrefFor('members')}
            className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-purple-soft transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" />
            {t('memberProfile.back')}
          </a>
          <EmptyState
            icon={UserX}
            title={t('memberProfile.notFoundTitle')}
            description={t('memberProfile.notFoundDescription')}
          />
        </SectionCard>
      </div>
    )
  }

  const subscriptions = snapshot.subscriptions.filter(
    (subscription) => subscription.memberId === memberId
  )
  const payments = snapshot.payments.filter(
    (payment) => payment.memberId === memberId
  )
  const attendance = snapshot.attendance.filter(
    (record) => record.memberId === memberId
  )
  const renewals = snapshot.renewals.filter(
    (record) => record.memberId === memberId
  )
  const totalPaid = payments.reduce((total, payment) => total + payment.amount, 0)
  const activeSubscription = subscriptions.find(
    (subscription) => subscription.status === 'active'
  )

  const genderLabel =
    member.gender === 'male'
      ? t('memberProfile.genderMale')
      : member.gender === 'female'
        ? t('memberProfile.genderFemale')
        : member.gender === 'other'
          ? t('memberProfile.genderOther')
          : t('common.notProvided')

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <section className="panel relative overflow-hidden rounded-[26px] p-5 sm:p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-24 size-64 rounded-full bg-purple/10 blur-3xl"
        />
        <a
          href={hrefFor('members')}
          className="relative inline-flex items-center gap-1.5 text-[11px] font-medium text-purple-soft transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          {t('memberProfile.back')}
        </a>

        <div className="relative mt-4 flex flex-wrap items-center gap-4">
          {member.photoData ? (
            <img
              src={member.photoData}
              alt={member.fullName}
              className="size-20 shrink-0 rounded-full border border-white/15 object-cover shadow-[0_0_30px_rgba(168,85,247,0.25)]"
            />
          ) : (
            <MemberAvatar name={member.fullName} size="xl" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate font-display text-xl font-semibold text-primary sm:text-2xl">
                {member.fullName}
              </h2>
              <StatusBadge status={member.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
              <span
                dir="ltr"
                className="font-display text-xs font-semibold tracking-wide text-purple-soft"
              >
                #{member.memberNumber}
              </span>
              <span dir="ltr" className="font-display tracking-wide">
                {member.memberCode}
              </span>
              {member.phone ? (
                <span dir="ltr" className="font-display">
                  {member.phone}
                </span>
              ) : null}
              <span>
                {activeSubscription
                  ? activeSubscription.planName
                  : t('members.noActivePlan')}
              </span>
            </div>
          </div>
          <div className="ms-auto hidden text-end sm:block">
            <p className="text-[10px] text-dim">
              {t('memberProfile.memberSince')}
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
              {formatDate(member.registrationDate, locale)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryStat
          icon={CalendarDays}
          label={t('memberProfile.memberSince')}
          value={formatDate(member.registrationDate, locale, {
            day: 'numeric',
            month: 'short'
          })}
          accent="purple"
        />
        <SummaryStat
          icon={Wallet}
          label={t('memberProfile.totalPaid')}
          value={formatCurrency(totalPaid, locale, t('common.currency'))}
          accent="emerald"
        />
        <SummaryStat
          icon={ScanLine}
          label={t('memberProfile.visits')}
          value={formatNumber(attendance.length, locale)}
          accent="purple"
        />
        <SummaryStat
          icon={RefreshCw}
          label={t('memberProfile.renewalsCount')}
          value={formatNumber(renewals.length, locale)}
          accent="amber"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <SectionCard
          title={t('memberProfile.contactTitle')}
          bodyClassName="px-5 pb-5"
        >
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailItem
              label={t('memberProfile.phone')}
              value={member.phone ?? t('common.notProvided')}
              ltr={Boolean(member.phone)}
            />
            <DetailItem
              label={t('memberProfile.secondaryPhone')}
              value={member.secondaryPhone ?? t('common.notProvided')}
              ltr={Boolean(member.secondaryPhone)}
            />
            <DetailItem
              label={t('memberProfile.address')}
              value={member.address ?? t('common.notProvided')}
            />
            <DetailItem
              label={t('memberProfile.emergencyContact')}
              value={member.emergencyContact ?? t('common.notProvided')}
              ltr={Boolean(member.emergencyContact)}
            />
          </dl>
        </SectionCard>

        <SectionCard
          title={t('memberProfile.detailsTitle')}
          bodyClassName="px-5 pb-5"
        >
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailItem
              label={t('common.memberNumber')}
              value={`#${member.memberNumber}`}
              ltr
            />
            <DetailItem
              label={t('memberProfile.gender')}
              value={genderLabel}
            />
            <DetailItem
              label={t('memberProfile.birthDate')}
              value={
                member.dateOfBirth
                  ? formatDate(member.dateOfBirth, locale)
                  : t('common.notProvided')
              }
            />
            <DetailItem
              label={t('memberProfile.registrationDate')}
              value={formatDate(member.registrationDate, locale)}
            />
            <DetailItem
              label={t('common.status')}
              value={statusLabel(member.status, t)}
            />
            <div className="sm:col-span-2">
              <DetailItem
                label={t('memberProfile.notes')}
                value={member.notes ?? t('common.notProvided')}
              />
            </div>
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title={t('memberProfile.subscriptionsTitle')}
        subtitle={`${formatNumber(subscriptions.length, locale)} ${t('common.records')}`}
        bodyClassName="px-0 pb-0"
      >
        {subscriptions.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarDays}
            title={t('memberProfile.noSubscriptions')}
          />
        ) : (
          <TableFrame
            caption={t('memberProfile.subscriptionsTitle')}
            minWidth="min-w-[720px]"
          >
            <TableHead>
              <Th>{t('common.plan')}</Th>
              <Th>{t('plans.duration')}</Th>
              <Th>{t('subscriptions.startDate')}</Th>
              <Th>{t('subscriptions.endDate')}</Th>
              <Th>{t('subscriptions.price')}</Th>
              <Th>{t('common.status')}</Th>
            </TableHead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr
                  key={subscription.id}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.022]"
                >
                  <Td className="text-xs font-medium text-primary">
                    {subscription.planName}
                  </Td>
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
                  <Td className="whitespace-nowrap font-display text-[11px] font-medium text-primary">
                    {formatCurrency(
                      subscription.finalPrice,
                      locale,
                      t('common.currency')
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={subscription.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <SectionCard
          title={t('memberProfile.paymentsTitle')}
          subtitle={`${formatNumber(payments.length, locale)} ${t('common.records')}`}
          bodyClassName="px-2 pb-2"
        >
          {payments.length === 0 ? (
            <EmptyState
              compact
              icon={Wallet}
              title={t('memberProfile.noPayments')}
            />
          ) : (
            <ul className="max-h-[340px] divide-y divide-white/[0.045] overflow-y-auto">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-primary">
                      {formatDate(payment.paymentDate, locale)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-dim">
                      {paymentMethodLabel(payment.paymentMethod, t)}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-xs font-semibold text-emerald">
                    +{formatCurrency(payment.amount, locale, t('common.currency'))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t('memberProfile.attendanceTitle')}
          subtitle={`${formatNumber(attendance.length, locale)} ${t('common.records')}`}
          bodyClassName="px-2 pb-2"
        >
          {attendance.length === 0 ? (
            <EmptyState
              compact
              icon={ScanLine}
              title={t('memberProfile.noAttendance')}
            />
          ) : (
            <ul className="max-h-[340px] divide-y divide-white/[0.045] overflow-y-auto">
              {attendance.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <p className="text-[11px] font-medium text-primary">
                    {formatDate(record.checkInDate, locale)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatTime(record.checkInTime, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
