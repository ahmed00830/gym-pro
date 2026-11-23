import {
  AlertTriangle,
  CheckCircle2,
  ScanLine,
  Search,
  UserCheck
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import {
  formatDate,
  formatNumber,
  formatTime,
  subscriptionEffectiveStatus
} from '../lib/format'
import { useWorkspace, useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { SectionCard } from '../components/ui/SectionCard'
import { MemberAvatar, StatusBadge } from '../components/ui/MemberAvatar'
import {
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'
import type { MemberRecord, SubscriptionRecord } from '@shared/analytics'

function localIsoDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)
}

interface SuccessMessage {
  name: string
  time: string
}

export function AttendancePage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const { refresh } = useWorkspace()
  const today = localIsoDate()
  const searchRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null)
  const [registering, setRegistering] = useState(false)
  const [success, setSuccess] = useState<SuccessMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []

    return snapshot.members
      .filter(
        (member) =>
          member.fullName.toLowerCase().includes(normalized) ||
          member.memberCode.toLowerCase().includes(normalized) ||
          String(member.memberNumber).includes(normalized) ||
          (member.phone ?? '').toLowerCase().includes(normalized) ||
          (member.secondaryPhone ?? '').toLowerCase().includes(normalized)
      )
      .slice(0, 6)
  }, [query, snapshot.members])

  // Typing a complete member number selects that member immediately.
  useEffect(() => {
    const normalized = query.trim()
    if (!normalized) return

    const exact = snapshot.members.find(
      (member) => String(member.memberNumber) === normalized
    )

    if (exact) {
      setSelectedMember(exact)
      setError(null)
    }
  }, [query, snapshot.members])

  const currentSubscription: SubscriptionRecord | null = selectedMember
    ? snapshot.subscriptions
        .filter((subscription) => subscription.memberId === selectedMember.id)
        .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null
    : null

  const effectiveStatus = currentSubscription
    ? subscriptionEffectiveStatus(currentSubscription, today)
    : 'inactive'

  const displayStatus =
    effectiveStatus === 'cancelled' || effectiveStatus === 'completed'
      ? 'inactive'
      : effectiveStatus

  const remainingDays = currentSubscription
    ? daysBetween(today, currentSubscription.endDate)
    : 0

  const todayRecord = selectedMember
    ? snapshot.attendance.find(
        (record) =>
          record.memberId === selectedMember.id && record.checkInDate === today
      )
    : null

  const memberAttendance = selectedMember
    ? snapshot.attendance.filter((record) => record.memberId === selectedMember.id)
    : []

  const todayAttendance = snapshot.attendance.filter(
    (record) => record.checkInDate === today
  )

  const warning = useMemo(() => {
    if (!currentSubscription || displayStatus === 'active') return null

    if (displayStatus === 'expired') {
      return `${t('attendance.expiredOn')} ${formatDate(
        currentSubscription.endDate,
        locale
      )} · ${t('attendance.remainingDays')}: ${formatNumber(
        Math.max(0, remainingDays),
        locale
      )}`
    }

    if (displayStatus === 'frozen') return t('attendance.frozenWarning')
    if (displayStatus === 'pending') return t('attendance.pendingWarning')
    return t('attendance.inactiveWarning')
  }, [currentSubscription, displayStatus, locale, remainingDays, t])

  const handleSelect = (member: MemberRecord) => {
    setSelectedMember(member)
    setError(null)
    setSuccess(null)
  }

  const handleClear = () => {
    setSelectedMember(null)
    setQuery('')
    setError(null)
    searchRef.current?.focus()
  }

  const handleRegister = async () => {
    if (!selectedMember) return

    setRegistering(true)
    setError(null)
    setSuccess(null)

    try {
      await window.gymPro.attendance.register(selectedMember.id)

      setSuccess({
        name: selectedMember.fullName,
        time: formatTime(
          new Date().toTimeString().slice(0, 8),
          locale
        )
      })
      setSelectedMember(null)
      setQuery('')
      searchRef.current?.focus()
      await refresh()
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : t('errors.workspaceDescription')
      )
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <SectionCard
        title={t('attendance.searchTitle')}
        subtitle={t('attendance.searchSubtitle')}
      >
        <div className="px-5 pb-5">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-dim"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedMember(null)
                setError(null)
                setSuccess(null)
              }}
              placeholder={t('attendance.searchPlaceholder')}
              aria-label={t('attendance.searchPlaceholder')}
              autoComplete="off"
              inputMode="numeric"
              className="h-14 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] pe-4 ps-12 text-base text-primary placeholder:text-dim transition-colors focus:border-purple/50 focus:bg-white/[0.045] focus:outline-none"
            />
          </div>

          <p className="mt-2 text-[11px] text-dim">{t('attendance.searchHint')}</p>

          {success ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald/25 bg-emerald/10 px-4 py-3 text-sm text-emerald">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                <span className="font-medium">{t('attendance.successTitle')}</span>
                {' · '}
                {success.name}
                {' · '}
                <span dir="ltr">{success.time}</span>
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose/25 bg-rose/10 px-4 py-3 text-sm text-rose">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {matches.length > 0 && !selectedMember ? (
            <ul className="mt-3 divide-y divide-white/[0.045] overflow-hidden rounded-2xl border border-white/[0.06]">
              {matches.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(member)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-white/[0.03]"
                  >
                    <MemberAvatar name={member.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-primary">
                        {member.fullName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-dim">
                        <span dir="ltr">#{member.memberNumber}</span>
                        {' · '}
                        <span dir="ltr">{member.memberCode}</span>
                        {' · '}
                        {member.phone ?? '—'}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SectionCard>

      {selectedMember ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-5">
          <SectionCard
            title={selectedMember.fullName}
            subtitle={`#${selectedMember.memberNumber} · ${selectedMember.memberCode}`}
            action={
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-white/[0.07] px-2.5 py-1 text-[10px] text-muted transition-colors hover:text-primary"
              >
                {t('common.close')}
              </button>
            }
          >
            <div className="px-5 pb-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-purple/20 bg-purple/[0.07] px-3 py-2.5">
                  <p className="text-[10px] text-dim">
                    {t('attendance.memberNumber')}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-0.5 font-display text-lg font-semibold text-purple-soft"
                  >
                    #{selectedMember.memberNumber}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">{t('common.member')}</p>
                  <p className="mt-0.5 truncate text-sm text-primary">
                    {selectedMember.fullName}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">{t('memberProfile.phone')}</p>
                  <p dir="ltr" className="mt-0.5 font-display text-sm text-primary">
                    {selectedMember.phone ?? '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">{t('common.plan')}</p>
                  <p className="mt-0.5 truncate text-sm text-primary">
                    {currentSubscription?.planName ?? t('members.noActivePlan')}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">
                    {t('attendance.startDate')}
                  </p>
                  <p className="mt-0.5 text-sm text-primary">
                    {currentSubscription
                      ? formatDate(currentSubscription.startDate, locale)
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">
                    {t('subscriptions.endDate')}
                  </p>
                  <p className="mt-0.5 text-sm text-primary">
                    {currentSubscription
                      ? formatDate(currentSubscription.endDate, locale)
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">
                    {t('attendance.remainingDays')}
                  </p>
                  <p className="mt-0.5 font-display text-sm text-primary">
                    {currentSubscription
                      ? formatNumber(Math.max(0, remainingDays), locale)
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">{t('common.status')}</p>
                  <div className="mt-1">
                    <StatusBadge status={displayStatus} />
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <p className="text-[10px] text-dim">
                    {t('attendance.todayStatus')}
                  </p>
                  <p className="mt-0.5 text-sm text-primary">
                    {todayRecord
                      ? `${t('attendance.registeredToday')} · ${formatTime(
                          todayRecord.checkInTime,
                          locale
                        )}`
                      : t('attendance.notRegisteredToday')}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {todayRecord ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald/25 bg-emerald/10 px-4 py-3 text-sm text-emerald">
                    <CheckCircle2 className="size-4" />
                    {t('attendance.registeredToday')}
                    {' · '}
                    <span dir="ltr">
                      {formatTime(todayRecord.checkInTime, locale)}
                    </span>
                  </div>
                ) : warning ? (
                  <div className="flex items-start gap-2 rounded-xl border border-rose/25 bg-rose/10 px-4 py-3 text-sm text-rose">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-medium">
                        {t('attendance.warningTitle')}
                      </span>
                      {' · '}
                      {warning}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRegister}
                    disabled={registering}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple/30 bg-purple/20 px-4 py-3.5 text-sm font-medium text-purple-soft transition-colors hover:bg-purple/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UserCheck className="size-4" />
                    {t('attendance.register')}
                  </button>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t('attendance.memberHistoryTitle')}
            subtitle={`${formatNumber(memberAttendance.length, locale)} ${t(
              'common.records'
            )}`}
            bodyClassName="px-0 pb-0"
          >
            {memberAttendance.length === 0 ? (
              <EmptyState
                compact
                icon={ScanLine}
                title={t('attendance.emptyTitle')}
                description={t('attendance.emptyDescription')}
              />
            ) : (
              <TableFrame caption={t('attendance.memberHistoryTitle')} minWidth="min-w-[320px]">
                <TableHead>
                  <Th>{t('common.date')}</Th>
                  <Th>{t('attendance.checkInTime')}</Th>
                </TableHead>
                <tbody>
                  {memberAttendance.slice(0, 10).map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-white/[0.04] last:border-0"
                    >
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {formatDate(record.checkInDate, locale)}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald/20 bg-emerald/10 px-2 py-1 font-display text-[10px] font-medium text-emerald">
                          <ScanLine className="size-3" />
                          {formatTime(record.checkInTime, locale)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            )}
          </SectionCard>
        </div>
      ) : (
        <SectionCard>
          <EmptyState
            icon={ScanLine}
            title={t('attendance.noMemberSelectedTitle')}
            description={t('attendance.noMemberSelectedDescription')}
          />
        </SectionCard>
      )}

      <SectionCard
        title={t('attendance.todayListTitle')}
        subtitle={`${formatNumber(todayAttendance.length, locale)} ${t(
          'common.records'
        )}`}
        bodyClassName="px-0 pb-0"
      >
        {todayAttendance.length === 0 ? (
          <EmptyState
            compact
            icon={ScanLine}
            title={t('attendance.emptyTitle')}
            description={t('attendance.emptyDescription')}
          />
        ) : (
          <TableFrame
            caption={t('attendance.todayListTitle')}
            minWidth="min-w-[520px]"
          >
            <TableHead>
              <Th>{t('attendance.memberNumber')}</Th>
              <Th>{t('common.member')}</Th>
              <Th>{t('common.date')}</Th>
              <Th>{t('attendance.checkInTime')}</Th>
            </TableHead>
            <tbody>
              {todayAttendance.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-white/[0.04] last:border-0"
                >
                  <Td>
                    <span
                      dir="ltr"
                      className="font-display text-[11px] font-semibold text-purple-soft"
                    >
                      #{record.memberNumber}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <MemberAvatar name={record.memberName} size="sm" />
                      <div className="min-w-0">
                        <p className="max-w-[180px] truncate text-xs font-medium text-primary">
                          {record.memberName}
                        </p>
                        <p
                          dir="ltr"
                          className="mt-0.5 font-display text-[10px] tracking-wide text-dim"
                        >
                          {record.memberCode}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-[11px] text-muted">
                    {formatDate(record.checkInDate, locale)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald/20 bg-emerald/10 px-2 py-1 font-display text-[10px] font-medium text-emerald">
                      <ScanLine className="size-3" />
                      {formatTime(record.checkInTime, locale)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </SectionCard>
    </div>
  )
}
