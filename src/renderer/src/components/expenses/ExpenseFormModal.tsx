import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import type { ExpenseCategory, ExpenseInput, ExpenseRecord } from '@shared/analytics'

const paymentMethods = ['cash', 'card', 'transfer', 'wallet', 'other'] as const

function localIsoDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localIsoTime(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

interface ExpenseFormModalProps {
  open: boolean
  initial: ExpenseRecord | null
  categories: ExpenseCategory[]
  submitting: boolean
  onClose: () => void
  onSubmit: (input: ExpenseInput) => Promise<void>
}

export function ExpenseFormModal({
  open,
  initial,
  categories,
  submitting,
  onClose,
  onSubmit
}: ExpenseFormModalProps) {
  const { t, locale } = useI18n()
  const today = localIsoDate()
  const now = localIsoTime()

  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [expenseDate, setExpenseDate] = useState(today)
  const [expenseTime, setExpenseTime] = useState(now)
  const [recordedBy, setRecordedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activeCategories = categories.filter((entry) => entry.isActive)
  const categoryName = (entry: ExpenseCategory): string =>
    locale === 'ar' ? entry.nameAr : entry.nameEn

  useEffect(() => {
    if (!open) return

    setDescription(initial?.description ?? '')
    setCategory(initial?.category ?? activeCategories[0]?.key ?? '')
    setAmount(initial ? String(initial.amount) : '')
    setPaymentMethod(initial?.paymentMethod ?? 'cash')
    setExpenseDate(initial?.expenseDate ?? today)
    setExpenseTime(initial?.expenseTime ?? now)
    setRecordedBy(initial?.recordedBy ?? '')
    setNotes(initial?.notes ?? '')
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, today])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, open, submitting])

  if (!open) return null

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!description.trim()) nextErrors.description = t('common.noData')

    const amountValue = Number(amount)

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      nextErrors.amount = t('common.noData')
    }

    if (!category) nextErrors.category = t('common.noData')
    if (!expenseDate) nextErrors.expenseDate = t('common.noData')
    if (!expenseTime) nextErrors.expenseTime = t('common.noData')
    if (!paymentMethod) nextErrors.paymentMethod = t('common.noData')

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      description: description.trim(),
      category,
      amount: Number(amount),
      paymentMethod,
      expenseDate,
      expenseTime: expenseTime || null,
      recordedBy: recordedBy.trim() || null,
      notes: notes.trim() || null
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[26px] border border-white/[0.08] bg-[#15131c] p-6 shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-primary">
            {initial ? t('expenses.editExpense') : t('expenses.addExpense')}
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label={t('common.close')}
            className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-muted transition-colors hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('expenses.description')}
            </span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
            />
            {errors.description ? (
              <span className="text-[10px] text-rose">{errors.description}</span>
            ) : null}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('expenses.category')}
              </span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              >
                {activeCategories.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {categoryName(entry)}
                  </option>
                ))}
              </select>
              {errors.category ? (
                <span className="text-[10px] text-rose">{errors.category}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('common.amount')}
              </span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
              {errors.amount ? (
                <span className="text-[10px] text-rose">{errors.amount}</span>
              ) : null}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('common.date')}
              </span>
              <input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
              {errors.expenseDate ? (
                <span className="text-[10px] text-rose">
                  {errors.expenseDate}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted">
                {t('payments.time')}
              </span>
              <input
                type="time"
                step={1}
                value={expenseTime}
                onChange={(event) => setExpenseTime(event.target.value)}
                required
                className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
              />
              {errors.expenseTime ? (
                <span className="text-[10px] text-rose">
                  {errors.expenseTime}
                </span>
              ) : null}
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('payments.method')}
            </span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-10 rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {t(`paymentMethod.${method}` as 'paymentMethod.cash')}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('expenses.recordedBy')}
            </span>
            <input
              type="text"
              value={recordedBy}
              onChange={(event) => setRecordedBy(event.target.value)}
              placeholder={t('expenses.recordedByPlaceholder')}
              className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t('common.notes')}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-primary focus:border-purple/45 focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-primary disabled:opacity-50"
            >
              {t('common.close')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/20 px-4 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/30 hover:text-primary disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
