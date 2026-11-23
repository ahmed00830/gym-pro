import { useI18n } from '../i18n'
import { BrandMark } from './BrandMark'
import { LanguageSwitch } from './LanguageSwitch'

export function AppHeader() {
  const { t } = useI18n()

  return (
    <header className="relative z-20 border-b border-white/[0.055] bg-ink-950/55 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1320px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark />
          <div className="min-w-0">
            <p
              dir="ltr"
              className="truncate font-display text-[15px] font-semibold tracking-[0.22em] text-mist-50"
            >
              GYM PRO
            </p>
            <p className="mt-1 truncate text-[10px] font-medium tracking-wide text-mist-500">
              {t('brand.tagline')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[10px] font-medium text-mist-400 md:inline-flex">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-neon-400 shadow-[0_0_8px_rgba(201,255,69,0.8)]"
            />
            {t('header.phase')}
          </span>
          <LanguageSwitch />
        </div>
      </div>
    </header>
  )
}
