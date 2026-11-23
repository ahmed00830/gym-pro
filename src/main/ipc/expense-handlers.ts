import { ipcMain } from 'electron'
import type { ExpenseCategoryInput, ExpenseInput } from '../../shared/analytics'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { assertTrustedIpcSender } from '../security'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
const CATEGORY_KEY_PATTERN = /^[a-z0-9_]{2,40}$/

function cleanOptionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null
  const text = String(value).trim()
  if (!text) return null
  if (text.length > maxLength) throw new Error('Text is too long.')
  return text
}

function validateExpenseInput(value: unknown): ExpenseInput {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expense data is invalid.')
  }

  const candidate = value as Record<string, unknown>

  const description =
    typeof candidate.description === 'string' ? candidate.description.trim() : ''
  if (!description) throw new Error('Description is required.')
  if (description.length > 500) throw new Error('Description is too long.')

  if (
    typeof candidate.amount !== 'number' ||
    !Number.isFinite(candidate.amount) ||
    candidate.amount <= 0
  ) {
    throw new Error('Expense amount must be greater than zero.')
  }

  if (
    typeof candidate.category !== 'string' ||
    !CATEGORY_KEY_PATTERN.test(candidate.category)
  ) {
    throw new Error('Expense category is invalid.')
  }

  if (
    typeof candidate.paymentMethod !== 'string' ||
    !candidate.paymentMethod.trim()
  ) {
    throw new Error('Payment method is required.')
  }

  if (
    typeof candidate.expenseDate !== 'string' ||
    !ISO_DATE_PATTERN.test(candidate.expenseDate)
  ) {
    throw new Error('Expense date must be a valid date.')
  }

  const [year, month, day] = candidate.expenseDate.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Expense date must be a valid date.')
  }

  let expenseTime: string | null = null

  if (
    candidate.expenseTime !== undefined &&
    candidate.expenseTime !== null &&
    candidate.expenseTime !== ''
  ) {
    if (
      typeof candidate.expenseTime !== 'string' ||
      !TIME_PATTERN.test(candidate.expenseTime)
    ) {
      throw new Error('Expense time must be a valid time.')
    }

    expenseTime = candidate.expenseTime
  }

  return {
    description,
    category: candidate.category,
    amount: Math.round(candidate.amount * 100) / 100,
    paymentMethod: candidate.paymentMethod.trim(),
    expenseDate: candidate.expenseDate,
    expenseTime,
    recordedBy: cleanOptionalText(candidate.recordedBy, 120),
    notes: cleanOptionalText(candidate.notes, 500)
  }
}

function validateId(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} is invalid.`)
  }

  return value
}

function validateCategoryInput(value: unknown): ExpenseCategoryInput {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Category data is invalid.')
  }

  const candidate = value as Record<string, unknown>

  const key =
    typeof candidate.key === 'string' ? candidate.key.trim().toLowerCase() : ''

  if (!CATEGORY_KEY_PATTERN.test(key)) {
    throw new Error('Category key must be 2-40 lowercase letters, digits, or underscores.')
  }

  const nameAr =
    typeof candidate.nameAr === 'string' ? candidate.nameAr.trim() : ''
  const nameEn =
    typeof candidate.nameEn === 'string' ? candidate.nameEn.trim() : ''

  if (!nameAr || !nameEn) {
    throw new Error('Both the Arabic and English names are required.')
  }

  if (nameAr.length > 80 || nameEn.length > 80) {
    throw new Error('Category names must be at most 80 characters.')
  }

  return { key, nameAr, nameEn }
}

export function registerExpenseIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.expenses.create, (event, rawInput: unknown) => {
    assertTrustedIpcSender(event)

    try {
      const input = validateExpenseInput(rawInput)
      return getDatabaseService().createExpense(input)
    } catch (error) {
      console.error('[GYM PRO] Expense creation failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Expense could not be created.'
      )
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.expenses.update,
    (event, rawId: unknown, rawInput: unknown) => {
      assertTrustedIpcSender(event)

      try {
        const id = validateId(rawId, 'Expense ID')
        const input = validateExpenseInput(rawInput)
        return getDatabaseService().updateExpense(id, input)
      } catch (error) {
        console.error('[GYM PRO] Expense update failed:', error)
        throw new Error(
          error instanceof Error ? error.message : 'Expense could not be updated.'
        )
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.expenses.archive, (event, rawId: unknown) => {
    assertTrustedIpcSender(event)

    try {
      const id = validateId(rawId, 'Expense ID')
      return getDatabaseService().archiveExpense(id)
    } catch (error) {
      console.error('[GYM PRO] Expense archival failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Expense could not be archived.'
      )
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.expenses.createCategory,
    (event, rawInput: unknown) => {
      assertTrustedIpcSender(event)

      try {
        const input = validateCategoryInput(rawInput)
        return getDatabaseService().createExpenseCategory(input)
      } catch (error) {
        console.error('[GYM PRO] Category creation failed:', error)
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Expense category could not be created.'
        )
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.expenses.setCategoryActive,
    (event, rawKey: unknown, rawIsActive: unknown) => {
      assertTrustedIpcSender(event)

      try {
        const key =
          typeof rawKey === 'string' ? rawKey.trim().toLowerCase() : ''

        if (!CATEGORY_KEY_PATTERN.test(key)) {
          throw new Error('Expense category is invalid.')
        }

        if (typeof rawIsActive !== 'boolean') {
          throw new Error('The active flag must be a boolean.')
        }

        return getDatabaseService().setExpenseCategoryActive(key, rawIsActive)
      } catch (error) {
        console.error('[GYM PRO] Category update failed:', error)
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Expense category could not be updated.'
        )
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.expenses.renameCategory,
    (event, rawKey: unknown, rawNameAr: unknown, rawNameEn: unknown) => {
      assertTrustedIpcSender(event)

      try {
        const key =
          typeof rawKey === 'string' ? rawKey.trim().toLowerCase() : ''

        if (!CATEGORY_KEY_PATTERN.test(key)) {
          throw new Error('Expense category is invalid.')
        }

        const nameAr =
          typeof rawNameAr === 'string' ? rawNameAr.trim() : ''
        const nameEn =
          typeof rawNameEn === 'string' ? rawNameEn.trim() : ''

        if (!nameAr || !nameEn) {
          throw new Error('Both the Arabic and English names are required.')
        }

        if (nameAr.length > 80 || nameEn.length > 80) {
          throw new Error('Category names must be at most 80 characters.')
        }

        return getDatabaseService().renameExpenseCategory(key, nameAr, nameEn)
      } catch (error) {
        console.error('[GYM PRO] Category rename failed:', error)
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Expense category could not be renamed.'
        )
      }
    }
  )
}
