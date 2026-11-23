import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  messages,
  type Locale,
  type MessageKey
} from './messages'
import {
  applyDocumentLocale,
  localeDirection,
  persistLocale,
  readStoredLocale,
  type Direction
} from './locale'

interface I18nContextValue {
  locale: Locale
  direction: Direction
  setLocale: (locale: Locale) => void
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale())

  useEffect(() => {
    applyDocumentLocale(locale)
    persistLocale(locale)
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
  }, [])

  const t = useCallback(
    (key: MessageKey): string => messages[locale][key],
    [locale]
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: localeDirection[locale],
      setLocale,
      t
    }),
    [locale, setLocale, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside an I18nProvider.')
  }

  return context
}
