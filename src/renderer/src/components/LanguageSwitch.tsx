import { useI18n } from '../i18n'

const options = [
  { locale: 'ar', shortLabel: 'AR', labelKey: 'language.arabic' },
  { locale: 'en', shortLabel: 'EN', labelKey: 'language.english' }
] as const

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('header.language')}
      className="flex h-9 items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-0.5"
    >
      {options.map((option) => {
        const isActive = option.locale === locale

        return (
          <button
            key={option.locale}
            type="button"
            lang={option.locale}
            aria-label={t(option.labelKey)}
            aria-pressed={isActive}
            onClick={() => setLocale(option.locale)}
            className={`h-7 min-w-8 rounded-[9px] px-2 font-display text-[10px] font-semibold tracking-[0.12em] transition-all duration-200 ${
              isActive
                ? 'bg-purple/20 text-purple-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_-6px_rgba(168,85,247,0.8)]'
                : 'text-dim hover:text-muted'
            }`}
          >
            {option.shortLabel}
          </button>
        )
      })}
    </div>
  )
}
