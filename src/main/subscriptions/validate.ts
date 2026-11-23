import type { SubscriptionInput } from '../../shared/analytics'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validateDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${field} must be a valid date.`)
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${field} must be a valid date.`)
  }

  return value
}

export function validateSubscriptionInput(value: unknown): SubscriptionInput {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Subscription data is invalid.')
  }

  const candidate = value as Record<string, unknown>

  if (
    typeof candidate.memberId !== 'number' ||
    !Number.isInteger(candidate.memberId) ||
    candidate.memberId <= 0
  ) {
    throw new Error('Member is required.')
  }

  if (
    typeof candidate.planId !== 'number' ||
    !Number.isInteger(candidate.planId) ||
    candidate.planId <= 0
  ) {
    throw new Error('Plan is required.')
  }

  const startDate = validateDate(candidate.startDate, 'Start date')
  const endDate = validateDate(candidate.endDate, 'End date')

  if (endDate < startDate) {
    throw new Error('End date must be after the start date.')
  }

  if (typeof candidate.price !== 'number' || candidate.price < 0) {
    throw new Error('Original price is invalid.')
  }

  const discount =
    candidate.discount === undefined || candidate.discount === null
      ? 0
      : Math.round(Number(candidate.discount) * 100) / 100

  if (typeof discount !== 'number' || discount < 0 || discount > candidate.price) {
    throw new Error('Discount is invalid.')
  }

  const paymentAmount =
    candidate.paymentAmount === undefined || candidate.paymentAmount === null
      ? 0
      : Math.round(Number(candidate.paymentAmount) * 100) / 100

  if (
    typeof paymentAmount !== 'number' ||
    paymentAmount < 0 ||
    paymentAmount > candidate.price - discount
  ) {
    throw new Error('Payment amount is invalid.')
  }

  if (typeof candidate.paymentMethod !== 'string' || !candidate.paymentMethod.trim()) {
    throw new Error('Payment method is required.')
  }

  const paymentDate = validateDate(candidate.paymentDate, 'Payment date')

  const paymentNotes =
    candidate.paymentNotes === null ||
    candidate.paymentNotes === undefined ||
    candidate.paymentNotes === ''
      ? null
      : typeof candidate.paymentNotes === 'string'
        ? candidate.paymentNotes.trim() || null
        : (() => {
            throw new Error('Payment notes must be text.')
          })()

  const subscriptionNotes =
    candidate.subscriptionNotes === null ||
    candidate.subscriptionNotes === undefined ||
    candidate.subscriptionNotes === ''
      ? null
      : typeof candidate.subscriptionNotes === 'string'
        ? candidate.subscriptionNotes.trim() || null
        : (() => {
            throw new Error('Subscription notes must be text.')
          })()

  return {
    memberId: candidate.memberId,
    planId: candidate.planId,
    startDate,
    endDate,
    price: Math.round(candidate.price * 100) / 100,
    discount,
    paymentAmount,
    paymentMethod: candidate.paymentMethod.trim(),
    paymentDate,
    paymentNotes,
    subscriptionNotes
  }
}

export function validateSubscriptionId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('Subscription ID is invalid.')
  }

  return value
}

export function validateFreezeInput(value: unknown): {
  startDate: string
  endDate: string | null
  reason: string | null
} {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Freeze data is invalid.')
  }

  const candidate = value as Record<string, unknown>
  const startDate = validateDate(candidate.startDate, 'Freeze start date')

  let endDate: string | null = null
  if (candidate.endDate !== null && candidate.endDate !== undefined && candidate.endDate !== '') {
    endDate = validateDate(candidate.endDate, 'Freeze end date')
    if (endDate < startDate) {
      throw new Error('Freeze end date must be after the start date.')
    }
  }

  const reason =
    candidate.reason === null ||
    candidate.reason === undefined ||
    candidate.reason === ''
      ? null
      : typeof candidate.reason === 'string'
        ? candidate.reason.trim() || null
        : (() => {
            throw new Error('Freeze reason must be text.')
          })()

  return { startDate, endDate, reason }
}
