import {
  defaultLocale,
  messages,
  supportedLocales,
  type Locale
} from './messages'

const LOCALE_STORAGE_KEY = 'gympro.locale'

export type Direction = 'rtl' | 'ltr'

export const localeDirection: Record<Locale, Direction> = {
  ar: 'rtl',
  en: 'ltr'
}

function isSupportedLocale(value: string): value is Locale {
  return (supportedLocales as readonly string[]).includes(value)
}

export function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return stored && isSupportedLocale(stored) ? stored : defaultLocale
  } catch {
    return defaultLocale
  }
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // The interface still works if local storage is unavailable.
  }
}

export function applyDocumentLocale(locale: Locale): void {
  const direction = localeDirection[locale]

  document.documentElement.lang = locale
  document.documentElement.dir = direction
  document.title = messages[locale]['app.title']
}

/**
 * Runs before React mounts so a saved English preference never flashes a
 * right-to-left layout on startup. Arabic remains the default.
 */
export function initializeLocale(): Locale {
  const locale = readStoredLocale()
  applyDocumentLocale(locale)
  return locale
}
