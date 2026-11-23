import {
  Archive,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Tags,
  Trash2,
  Wallet
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import {
  expenseCategoryLabel,
  formatCurrency,
  formatDate,
  formatNumber,
  paymentMethodLabel
} from '../lib/format'
import { useWorkspace, useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import {
  FilterSelect,
  SearchInput,
  SummaryStat
} from '../components/ui/Controls'
import { SectionCard } from '../components/ui/SectionCard'
import { ExpenseFormModal } from '../components/expenses/ExpenseFormModal'
import {
  Pagination,
  TableFrame,
  TableHead,
  Td,
  Th
} from '../components/ui/TableFrame'
import type { ExpenseInput, ExpenseRecord } from '@shared/analytics'

const PAGE_SIZE = 8

export function ExpensesPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const { refresh } = useWorkspace()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null)
  const [archiving, setArchiving] = useState<ExpenseRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [newKey, setNewKey] = useState('')
  const [newAr, setNewAr] = useState('')
  const [newEn, setNewEn] = useState('')
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [categorySubmitting, setCategorySubmitting] = useState(false)
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [renameAr, setRenameAr] = useState('')
  const [renameEn, setRenameEn] = useState('')

  const catalog = snapshot.expenseCatalog
  const catalogMap = useMemo(
    () => new Map(catalog.map((entry) => [entry.key, entry] as const)),
    [catalog]
  )
  const activeCatalog = useMemo(
    () => catalog.filter((entry) => entry.isActive),
    [catalog]
  )

  const categoryLabel = (key: string): string => {
    const entry = catalogMap.get(key)

    if (entry) {
      return locale === 'ar' ? entry.nameAr : entry.nameEn
    }

    return expenseCategoryLabel(key, t)
  }

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return snapshot.expenses.filter((expense) => {
      const matchesStatus =
        statusFilter === 'all' || expense.status === statusFilter
      const matchesCategory =
        categoryFilter === 'all' || expense.category === categoryFilter
      const matchesFrom =
        fromDate.length === 0 || expense.expenseDate >= fromDate
      const matchesTo = toDate.length === 0 || expense.expenseDate <= toDate
      const matchesQuery =
        normalizedQuery.length === 0 ||
        expense.description.toLowerCase().includes(normalizedQuery) ||
        expense.category.toLowerCase().includes(normalizedQuery) ||
        categoryLabel(expense.category).toLowerCase().includes(normalizedQuery) ||
        (expense.recordedBy ?? '').toLowerCase().includes(normalizedQuery) ||
        (expense.notes ?? '').toLowerCase().includes(normalizedQuery) ||
        String(expense.id).includes(normalizedQuery)

      return (
        matchesStatus &&
        matchesCategory &&
        matchesFrom &&
        matchesTo &&
        matchesQuery
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    categoryFilter,
    statusFilter,
    fromDate,
    toDate,
    snapshot.expenses,
    catalogMap,
    locale
  ])

  const pageCount = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleExpenses = filteredExpenses.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const resetPage = () => setPage(1)

  const collectedTotal = snapshot.totals.totalRevenue
  const expensesTotal = snapshot.totals.totalExpenses
  const balanceTotal = Math.round((collectedTotal - expensesTotal) * 100) / 100

  const collectedToday = snapshot.totals.revenueToday
  const expensesToday = snapshot.totals.expensesToday
  const balanceToday = Math.round((collectedToday - expensesToday) * 100) / 100

  const collectedMonth = snapshot.totals.revenueThisMonth
  const expensesMonth = snapshot.totals.expensesThisMonth
  const balanceMonth = Math.round((collectedMonth - expensesMonth) * 100) / 100

  const openCreate = () => {
    setEditingExpense(null)
    setActionError(null)
    setFormOpen(true)
  }

  const openEdit = (expense: ExpenseRecord) => {
    setEditingExpense(expense)
    setActionError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (submitting) return
    setFormOpen(false)
    setEditingExpense(null)
  }

  const handleSubmit = async (input: ExpenseInput) => {
    setSubmitting(true)
    setActionError(null)

    try {
      if (editingExpense) {
        await window.gymPro.expenses.update(editingExpense.id, input)
      } else {
        await window.gymPro.expenses.create(input)
      }

      setFormOpen(false)
      setEditingExpense(null)
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

  const handleArchive = async () => {
    if (!archiving) return

    setSubmitting(true)
    setActionError(null)

    try {
      await window.gymPro.expenses.archive(archiving.id)
      setArchiving(null)
      await refresh()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t('errors.workspaceDescription')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateCategory = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setCategorySubmitting(true)
    setCategoryError(null)

    try {
      await window.gymPro.expenses.createCategory({
        key: newKey.trim().toLowerCase(),
        nameAr: newAr.trim(),
        nameEn: newEn.trim()
      })
      setNewKey('')
      setNewAr('')
      setNewEn('')
      await refresh()
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : t('errors.workspaceDescription')
      )
    } finally {
      setCategorySubmitting(false)
    }
  }

  const handleToggleCategory = async (
    key: string,
    isActive: boolean
  ) => {
    setCategorySubmitting(true)
    setCategoryError(null)

    try {
      await window.gymPro.expenses.setCategoryActive(key, isActive)
      await refresh()
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : t('errors.workspaceDescription')
      )
    } finally {
      setCategorySubmitting(false)
    }
  }

  const handleRename = async (key: string) => {
    setCategorySubmitting(true)
    setCategoryError(null)

    try {
      await window.gymPro.expenses.renameCategory(
        key,
        renameAr.trim(),
        renameEn.trim()
      )
      setRenamingKey(null)
      await refresh()
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : t('errors.workspaceDescription')
      )
    } finally {
      setCategorySubmitting(false)
    }
  }

  const statusOptions = [
    { value: 'active', label: t('expenses.activeOnly') },
    { value: 'archived', label: t('expenses.statusArchivedOnly') },
    { value: 'all', label: t('common.all') }
  ]

  const categoryOptions = [
    { value: 'all', label: t('common.all') },
    ...activeCatalog.map((entry) => ({
      value: entry.key,
      label: locale === 'ar' ? entry.nameAr : entry.nameEn
    }))
  ]

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      {actionError ? (
        <div className="rounded-xl border border-rose/25 bg-rose/10 px-3 py-2 text-[11px] text-rose">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryStat
          icon={Wallet}
          label={t('dashboard.collectedRevenue')}
          value={formatCurrency(
            collectedTotal,
            locale,
            t('common.currency')
          )}
          hint={t('common.all')}
          accent="emerald"
        />
        <SummaryStat
          icon={Receipt}
          label={t('expenses.total')}
          value={formatCurrency(
            expensesTotal,
            locale,
            t('common.currency')
          )}
          hint={t('common.all')}
          accent="rose"
        />
        <SummaryStat
          icon={Scale}
          label={t('expenses.cashBalance')}
          value={formatCurrency(
            balanceTotal,
            locale,
            t('common.currency')
          )}
          hint={t('common.all')}
          accent={balanceTotal >= 0 ? 'emerald' : 'rose'}
        />

        <SummaryStat
          icon={Wallet}
          label={t('payments.todayRevenue')}
          value={formatCurrency(
            collectedToday,
            locale,
            t('common.currency')
          )}
          hint={t('common.today')}
          accent="emerald"
        />
        <SummaryStat
          icon={Receipt}
          label={t('expenses.expensesToday')}
          value={formatCurrency(
            expensesToday,
            locale,
            t('common.currency')
          )}
          hint={t('common.today')}
          accent="rose"
        />
        <SummaryStat
          icon={Scale}
          label={t('expenses.balanceToday')}
          value={formatCurrency(
            balanceToday,
            locale,
            t('common.currency')
          )}
          hint={t('common.today')}
          accent={balanceToday >= 0 ? 'emerald' : 'rose'}
        />

        <SummaryStat
          icon={Wallet}
          label={t('payments.thisMonth')}
          value={formatCurrency(
            collectedMonth,
            locale,
            t('common.currency')
          )}
          hint={t('common.thisMonth')}
          accent="emerald"
        />
        <SummaryStat
          icon={Receipt}
          label={t('expenses.thisMonth')}
          value={formatCurrency(
            expensesMonth,
            locale,
            t('common.currency')
          )}
          hint={t('common.thisMonth')}
          accent="rose"
        />
        <SummaryStat
          icon={Scale}
          label={t('expenses.balanceMonth')}
          value={formatCurrency(
            balanceMonth,
            locale,
            t('common.currency')
          )}
          hint={t('common.thisMonth')}
          accent={balanceMonth >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      <p className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-2.5 text-[10px] leading-relaxed text-dim">
        {t('expenses.cashRegisterNote')}
      </p>

      <SectionCard
        title={t('nav.expenses')}
        subtitle={`${formatNumber(filteredExpenses.length, locale)} ${t(
          'common.records'
        )}`}
        bodyClassName="px-0 pb-0"
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/15 px-3.5 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/25 hover:text-primary"
          >
            <Plus className="size-3.5" />
            {t('expenses.addExpense')}
          </button>
        }
      >
        <div className="flex flex-col gap-3 px-5 pb-4 xl:flex-row xl:flex-wrap xl:items-center">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value)
              resetPage()
            }}
            placeholder={t('expenses.searchPlaceholder')}
            className="flex-1"
          />
          <FilterSelect
            value={categoryFilter}
            onChange={(value) => {
              setCategoryFilter(value)
              resetPage()
            }}
            options={categoryOptions}
            ariaLabel={t('expenses.filterCategory')}
            className="w-full xl:w-48"
          />
          <FilterSelect
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              resetPage()
            }}
            options={statusOptions}
            ariaLabel={t('expenses.filterExpenseStatus')}
            className="w-full xl:w-40"
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

        {snapshot.expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('expenses.emptyTitle')}
            description={t('expenses.emptyDescription')}
          />
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('expenses.noResultsTitle')}
            description={t('expenses.noResultsDescription')}
          />
        ) : (
          <>
            <TableFrame caption={t('nav.expenses')} minWidth="min-w-[1120px]">
              <TableHead>
                <Th>{t('payments.transactionId')}</Th>
                <Th>{t('expenses.category')}</Th>
                <Th>{t('expenses.description')}</Th>
                <Th>{t('payments.method')}</Th>
                <Th className="text-end">{t('common.amount')}</Th>
                <Th>{t('common.date')}</Th>
                <Th>{t('expenses.recordedBy')}</Th>
                <Th className="text-end">{t('common.value')}</Th>
              </TableHead>
              <tbody>
                {visibleExpenses.map((expense) => {
                  const isArchived = expense.status === 'archived'

                  return (
                    <tr
                      key={expense.id}
                      className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.022] ${
                        isArchived ? 'opacity-60' : ''
                      }`}
                    >
                      <Td>
                        <span
                          dir="ltr"
                          className="font-display text-[11px] text-dim"
                        >
                          #{expense.id}
                        </span>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber/20 bg-amber/10 px-2 py-1 text-[10px] font-medium text-amber">
                          <Tags className="size-3" />
                          {categoryLabel(expense.category)}
                        </span>
                      </Td>
                      <Td>
                        <p className="max-w-[220px] truncate text-xs font-medium text-primary">
                          {expense.description}
                        </p>
                        {isArchived ? (
                          <p className="mt-0.5 text-[9px] text-dim">
                            {t('expenses.statusArchivedOnly')}
                          </p>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap text-[11px] text-muted">
                        {paymentMethodLabel(expense.paymentMethod, t)}
                      </Td>
                      <Td className="whitespace-nowrap text-end font-display text-xs font-semibold text-rose">
                        -{formatCurrency(
                          expense.amount,
                          locale,
                          t('common.currency')
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="block text-[11px] text-muted">
                          {formatDate(expense.expenseDate, locale)}
                        </span>
                        {expense.expenseTime ? (
                          <span
                            dir="ltr"
                            className="mt-0.5 block font-display text-[10px] text-dim"
                          >
                            {expense.expenseTime.slice(0, 5)}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="max-w-[140px] truncate text-[11px] text-muted">
                        {expense.recordedBy ?? '—'}
                      </Td>
                      <Td className="text-end">
                        {isArchived ? (
                          <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] text-muted">
                            {t('status.archived')}
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(expense)}
                              aria-label={t('expenses.editExpense')}
                              className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-purple/30 hover:text-purple-soft"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setArchiving(expense)}
                              aria-label={t('expenses.archiveExpense')}
                              className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-rose/30 hover:text-rose"
                            >
                              <Archive className="size-3.5" />
                            </button>
                          </div>
                        )}
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

      <SectionCard
        title={t('expenses.manageCategories')}
        subtitle={t('expenses.adminOnlyWarning')}
        bodyClassName="px-5 pb-5"
      >
        {categoryError ? (
          <div className="mb-3 rounded-xl border border-rose/25 bg-rose/10 px-3 py-2 text-[11px] text-rose">
            {categoryError}
          </div>
        ) : null}

        <ul className="divide-y divide-white/[0.045]">
          {catalog.map((entry) => {
            const isRenaming = renamingKey === entry.key

            return (
              <li
                key={entry.key}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  {isRenaming ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={renameAr}
                        onChange={(event) => setRenameAr(event.target.value)}
                        aria-label={t('expenses.nameAr')}
                        className="h-9 w-40 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary focus:border-purple/45 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={renameEn}
                        onChange={(event) => setRenameEn(event.target.value)}
                        aria-label={t('expenses.nameEn')}
                        dir="ltr"
                        className="h-9 w-40 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary focus:border-purple/45 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRename(entry.key)}
                        disabled={
                          categorySubmitting ||
                          renameAr.trim().length === 0 ||
                          renameEn.trim().length === 0
                        }
                        className="rounded-lg border border-purple/30 bg-purple/15 px-3 py-1.5 text-[11px] font-medium text-purple-soft transition-colors hover:bg-purple/25 disabled:opacity-50"
                      >
                        {t('expenses.saveNames')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingKey(null)}
                        disabled={categorySubmitting}
                        className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-primary"
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-primary">
                        {locale === 'ar' ? entry.nameAr : entry.nameEn}
                        {entry.isActive ? null : (
                          <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[9px] text-muted">
                            {t('status.archived')}
                          </span>
                        )}
                      </p>
                      <p dir="ltr" className="mt-0.5 font-display text-[10px] text-dim">
                        {entry.key}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isRenaming ? null : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingKey(entry.key)
                          setRenameAr(entry.nameAr)
                          setRenameEn(entry.nameEn)
                        }}
                        disabled={categorySubmitting}
                        aria-label={t('expenses.saveNames')}
                        className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-purple/30 hover:text-purple-soft disabled:opacity-50"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(entry.key, !entry.isActive)}
                        disabled={categorySubmitting}
                        className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                          entry.isActive
                            ? 'border-rose/25 text-rose hover:bg-rose/10'
                            : 'border-emerald/25 text-emerald hover:bg-emerald/10'
                        }`}
                      >
                        {entry.isActive
                          ? t('expenses.deactivateCategory')
                          : t('expenses.activateCategory')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <form
          onSubmit={handleCreateCategory}
          className="mt-4 grid gap-3 border-t border-white/[0.055] pt-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <input
            type="text"
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder={t('expenses.categoryKey')}
            dir="ltr"
            aria-label={t('expenses.categoryKey')}
            className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
          />
          <input
            type="text"
            value={newAr}
            onChange={(event) => setNewAr(event.target.value)}
            placeholder={t('expenses.nameAr')}
            aria-label={t('expenses.nameAr')}
            className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
          />
          <input
            type="text"
            value={newEn}
            onChange={(event) => setNewEn(event.target.value)}
            placeholder={t('expenses.nameEn')}
            dir="ltr"
            aria-label={t('expenses.nameEn')}
            className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
          />
          <button
            type="submit"
            disabled={categorySubmitting || !newKey.trim() || !newAr.trim() || !newEn.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-purple/30 bg-purple/20 px-4 text-[11px] font-medium text-purple-soft transition-colors hover:bg-purple/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {t('expenses.addCategory')}
          </button>
        </form>
      </SectionCard>

      <ExpenseFormModal
        open={formOpen}
        initial={editingExpense}
        categories={catalog}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      {archiving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => !submitting && setArchiving(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[#15131c] p-6 shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]"
          >
            <h2 className="font-display text-base font-semibold text-primary">
              {t('expenses.archiveExpense')}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {archiving.description} —{' '}
              {formatCurrency(archiving.amount, locale, t('common.currency'))}
            </p>
            <p className="mt-3 text-[11px] font-medium text-rose">
              {t('expenses.adminOnlyWarning')}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">
              {t('expenses.archiveConfirm')}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !submitting && setArchiving(null)}
                disabled={submitting}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-primary disabled:opacity-50"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/15 px-4 py-2 text-xs font-medium text-rose transition-colors hover:bg-rose/25 disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                {t('expenses.archiveExpense')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
