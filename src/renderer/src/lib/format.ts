import type { MessageKey } from '../i18n'

const INTL_LOCALES = {
  ar: 'ar-EG-u-nu-latn',
  en: 'en-US'
} as const

type SupportedLocale = keyof typeof INTL_LOCALES

function intlLocale(locale: SupportedLocale): string {
  return INTL_LOCALES[locale]
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0)
}

export function formatNumber(
  value: number,
  locale: SupportedLocale
): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value)
}

export function formatCurrency(
  value: number,
  locale: SupportedLocale,
  currency = locale === 'ar' ? 'ج.م' : 'EGP'
): string {
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value)

  return `${formatted} ${currency}`
}

export function formatDate(
  value: string | null | undefined,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }
): string {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat(intlLocale(locale), options).format(
      parseLocalDate(value)
    )
  } catch {
    return value
  }
}

export function formatAxisDate(
  value: string,
  locale: SupportedLocale
): string {
  return formatDate(value, locale, { day: 'numeric', month: 'short' })
}

export function formatMonth(
  value: string,
  locale: SupportedLocale
): string {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, 1, 12, 0, 0, 0)

  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: 'short',
    year: 'numeric'
  }).format(date)
}

export function formatDateTime(
  value: string,
  locale: SupportedLocale
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export function formatTimeOfDay(
  value: string,
  locale: SupportedLocale
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export function formatTime(
  value: string,
  locale: SupportedLocale
): string {
  const [hours, minutes] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0)

  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export function formatBytes(bytes: number, locale: SupportedLocale): string {
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 1
  }).format(value)} ${units[unitIndex]}`
}

export function memberInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

const STATUS_KEYS: Record<string, MessageKey> = {
  active: 'status.active',
  inactive: 'status.inactive',
  frozen: 'status.frozen',
  expired: 'status.expired',
  blocked: 'status.blocked',
  archived: 'status.archived',
  pending: 'status.pending',
  cancelled: 'status.cancelled',
  completed: 'status.completed'
}

export function statusLabel(
  status: string,
  t: (key: MessageKey) => string
): string {
  const key = STATUS_KEYS[status.toLowerCase()]
  return key ? t(key) : status
}

const PAYMENT_METHOD_KEYS: Record<string, MessageKey> = {
  cash: 'paymentMethod.cash',
  card: 'paymentMethod.card',
  transfer: 'paymentMethod.transfer',
  bank_transfer: 'paymentMethod.transfer',
  wallet: 'paymentMethod.wallet',
  digital_wallet: 'paymentMethod.wallet',
  other: 'paymentMethod.other'
}

export function paymentMethodLabel(
  method: string,
  t: (key: MessageKey) => string
): string {
  const key = PAYMENT_METHOD_KEYS[method.toLowerCase()]
  return key ? t(key) : method
}

const EXPENSE_CATEGORY_KEYS: Record<string, MessageKey> = {
  operations: 'expenseCategory.operations',
  rent: 'expenseCategory.rent',
  salaries: 'expenseCategory.salaries',
  equipment: 'expenseCategory.equipment',
  utilities: 'expenseCategory.utilities',
  marketing: 'expenseCategory.marketing',
  maintenance: 'expenseCategory.maintenance',
  other: 'expenseCategory.other'
}

export function expenseCategoryLabel(
  category: string,
  t: (key: MessageKey) => string
): string {
  const key = EXPENSE_CATEGORY_KEYS[category.toLowerCase()]
  return key ? t(key) : category
}

export function subscriptionEffectiveStatus(
  subscription: {
    status: string
    endDate: string
    freezeStartDate: string | null
    freezeEndDate: string | null
    balance: number
  },
  today: string
): string {
  if (subscription.status === 'cancelled' || subscription.status === 'completed') {
    return subscription.status
  }

  if (
    subscription.freezeStartDate &&
    (subscription.freezeEndDate === null ||
      subscription.freezeEndDate >= today)
  ) {
    return 'frozen'
  }

  if (subscription.endDate < today) return 'expired'
  if (subscription.balance > 0) return 'pending'
  return 'active'
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((part / total) * 100))
}
