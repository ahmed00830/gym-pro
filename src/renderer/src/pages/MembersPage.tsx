import {
  ArrowUpDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserPlus,
  Users
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { formatDate, formatNumber, statusLabel } from '../lib/format'
import { hrefFor } from '../lib/routes'
import { useWorkspace, useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterSelect, SearchInput, SummaryStat } from '../components/ui/Controls'
import { MemberAvatar, StatusBadge } from '../components/ui/MemberAvatar'
import { SectionCard } from '../components/ui/SectionCard'
import { MemberFormModal } from '../components/members/MemberFormModal'
import { QuickRegisterModal } from '../components/quick/QuickRegisterModal'
import { QuickRenewModal } from '../components/quick/QuickRenewModal'
import {
  Pagination,
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'
import type { MemberRecord } from '@shared/analytics'

const PAGE_SIZE = 8

const memberStatuses = [
  'active',
  'inactive',
  'frozen',
  'expired',
  'blocked',
  'archived'
] as const

type SortKey = 'name' | 'joined' | 'status'

export function MembersPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const { refresh } = useWorkspace()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('joined')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false)
  const [quickRenewMember, setQuickRenewMember] = useState<MemberRecord | null>(null)
  const [quickRenewOpen, setQuickRenewOpen] = useState(false)
  const [quickSubmitting, setQuickSubmitting] = useState(false)

  const activeSubscriptions = useMemo(() => {
    const byMember = new Map<number, { planName: string; endDate: string }>()

    for (const subscription of snapshot.subscriptions) {
      if (
        subscription.status === 'active' &&
        !byMember.has(subscription.memberId)
      ) {
        byMember.set(subscription.memberId, {
          planName: subscription.planName,
          endDate: subscription.endDate
        })
      }
    }

    return byMember
  }, [snapshot.subscriptions])

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = snapshot.members.filter((member) => {
      const matchesStatus =
        statusFilter === 'all' || member.status === statusFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        member.fullName.toLowerCase().includes(normalizedQuery) ||
        member.memberCode.toLowerCase().includes(normalizedQuery) ||
        String(member.memberNumber).includes(normalizedQuery) ||
        (member.phone ?? '').toLowerCase().includes(normalizedQuery) ||
        (member.secondaryPhone ?? '').toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesQuery
    })

    const sorted = [...filtered].sort((left, right) => {
      let comparison = 0

      if (sortKey === 'name') {
        comparison = left.fullName.localeCompare(right.fullName)
      } else if (sortKey === 'joined') {
        comparison = left.registrationDate.localeCompare(right.registrationDate)
      } else {
        comparison = left.status.localeCompare(right.status)
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [query, snapshot.members, sortDirection, sortKey, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleMembers = filteredMembers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const statusOptions = [
    { value: 'all', label: t('common.all') },
    ...memberStatuses.map((status) => ({
      value: status,
      label: statusLabel(status, t)
    }))
  ]

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) =>
        direction === 'asc' ? 'desc' : 'asc'
      )
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const openCreate = () => {
    setEditingMember(null)
    setActionError(null)
    setFormOpen(true)
  }

  const openEdit = (member: MemberRecord) => {
    setEditingMember(member)
    setActionError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (submitting) return
    setFormOpen(false)
    setEditingMember(null)
  }

  const handleSubmit = async (input: Parameters<typeof window.gymPro.members.create>[0]) => {
    setSubmitting(true)
    setActionError(null)

    try {
      if (editingMember) {
        await window.gymPro.members.update(editingMember.id, input)
      } else {
        await window.gymPro.members.create(input)
      }

      setFormOpen(false)
      setEditingMember(null)
      await refresh()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t('errors.workspaceDescription')
      )
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setActionError(null)

    try {
      await window.gymPro.members.delete(deleteTarget.id)
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t('errors.workspaceDescription')
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryStat
          icon={Users}
          label={t('nav.members')}
          value={formatNumber(snapshot.totals.totalMembers, locale)}
          accent="purple"
        />
        <SummaryStat
          icon={UserCheck}
          label={t('status.active')}
          value={formatNumber(snapshot.totals.activeMembers, locale)}
          accent="emerald"
        />
        <SummaryStat
          icon={UserPlus}
          label={t('dashboard.newRegistrations')}
          value={formatNumber(snapshot.totals.newRegistrations, locale)}
          hint={t('common.thisMonth')}
          accent="purple"
        />
        <SummaryStat
          icon={Users}
          label={t('dashboard.expiring')}
          value={formatNumber(snapshot.totals.expiringMemberships, locale)}
          hint={t('dashboard.expiringNote')}
          accent="rose"
        />
      </div>

      <SectionCard
        title={t('nav.members')}
        subtitle={`${formatNumber(filteredMembers.length, locale)} ${t('common.membersCount')}`}
        bodyClassName="px-0 pb-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickRegisterOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald/30 bg-emerald/12 px-3.5 py-2 text-xs font-medium text-emerald transition-colors hover:bg-emerald/20"
            >
              <Plus className="size-3.5" />
              {t('members.addMember')}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/15 px-3.5 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/25 hover:text-primary"
            >
              <Plus className="size-3.5" />
              {t('members.editMember')}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 px-5 pb-4 sm:flex-row">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value)
              setPage(1)
            }}
            placeholder={t('members.searchPlaceholder')}
            className="flex-1"
          />
          <FilterSelect
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
            options={statusOptions}
            ariaLabel={t('members.filterStatus')}
            className="w-full sm:w-52"
          />
        </div>

        {actionError ? (
          <div className="mx-5 mb-3 rounded-xl border border-rose/25 bg-rose/10 px-3 py-2 text-[11px] text-rose">
            {actionError}
          </div>
        ) : null}

        {snapshot.members.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('members.emptyTitle')}
            description={t('members.emptyDescription')}
          />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('members.noResultsTitle')}
            description={t('members.noResultsDescription')}
          />
        ) : (
          <>
            <TableFrame caption={t('nav.members')} minWidth="min-w-[1000px]">
              <TableHead>
                <Th>
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1.5"
                  >
                    {t('members.member')}
                    <ArrowUpDown className="size-3" />
                  </button>
                </Th>
                <Th>{t('common.memberNumber')}</Th>
                <Th>{t('memberProfile.phone')}</Th>
                <Th>
                  <button
                    type="button"
                    onClick={() => toggleSort('joined')}
                    className="inline-flex items-center gap-1.5"
                  >
                    {t('members.joinDate')}
                    <ArrowUpDown className="size-3" />
                  </button>
                </Th>
                <Th>{t('members.membership')}</Th>
                <Th>
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-1.5"
                  >
                    {t('common.status')}
                    <ArrowUpDown className="size-3" />
                  </button>
                </Th>
                <Th className="text-end">{t('common.value')}</Th>
              </TableHead>
              <tbody>
                {visibleMembers.map((member) => {
                  const activeSubscription = activeSubscriptions.get(member.id)

                  return (
                    <tr
                      key={member.id}
                      className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.022]"
                    >
                      <Td>
                        <a
                          href={hrefFor('memberProfile', member.id)}
                          className="flex items-center gap-3"
                        >
                          {member.photoData ? (
                            <img
                              src={member.photoData}
                              alt=""
                              className="size-9 shrink-0 rounded-full border border-white/15 object-cover"
                            />
                          ) : (
                            <MemberAvatar name={member.fullName} size="sm" />
                          )}
                          <span className="min-w-0">
                            <span className="block max-w-[200px] truncate text-xs font-medium text-primary">
                              {member.fullName}
                            </span>
                            <span
                              dir="ltr"
                              className="mt-0.5 block font-display text-[10px] tracking-wide text-dim"
                            >
                              {member.memberCode}
                            </span>
                          </span>
                        </a>
                      </Td>
                      <Td>
                        <span
                          dir="ltr"
                          className="font-display text-[11px] font-semibold text-purple-soft"
                        >
                          #{member.memberNumber}
                        </span>
                      </Td>
                      <Td>
                        <span
                          dir="ltr"
                          className="whitespace-nowrap font-display text-[11px] text-muted"
                        >
                          {member.phone ?? '—'}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {formatDate(member.registrationDate, locale)}
                      </Td>
                      <Td>
                        {activeSubscription ? (
                          <span className="block">
                            <span className="block max-w-[160px] truncate text-[11px] font-medium text-primary">
                              {activeSubscription.planName}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-dim">
                              {formatDate(activeSubscription.endDate, locale, {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-dim">
                            {t('members.noActivePlan')}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={member.status} />
                      </Td>
                      <Td className="text-end">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickRenewMember(member)
                              setQuickRenewOpen(true)
                            }}
                            aria-label={t('renewals.thisMonth')}
                            className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-emerald/30 hover:text-emerald"
                          >
                            <Plus className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(member)}
                            aria-label={t('members.editMember')}
                            className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-purple/30 hover:text-purple-soft"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(member)}
                            aria-label={t('members.deleteMember')}
                            className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-rose/30 hover:text-rose"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                          <a
                            href={hrefFor('memberProfile', member.id)}
                            aria-label={t('members.openProfile')}
                            className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-purple/30 hover:text-purple-soft"
                          >
                            <ChevronRight className="size-3.5 rtl:rotate-180" />
                          </a>
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

      <MemberFormModal
        open={formOpen}
        mode={editingMember ? 'edit' : 'create'}
        initial={editingMember}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

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
        currentSubscription={
          quickRenewMember
            ? snapshot.subscriptions
                .filter((s) => s.memberId === quickRenewMember.id)
                .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null
            : null
        }
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

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => !deleting && setDeleteTarget(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[#15131c] p-6 shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]"
          >
            <h2 className="font-display text-base font-semibold text-primary">
              {t('members.deleteMember')}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {deleteTarget.fullName} — {deleteTarget.memberCode}
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-dim">
              {t('members.deleteConfirm')}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-primary disabled:opacity-50"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/15 px-4 py-2 text-xs font-medium text-rose transition-colors hover:bg-rose/25 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {t('members.deleteMember')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
