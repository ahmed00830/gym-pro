import { useI18n } from '../i18n'

interface AppFooterProps {
  version?: string
}

export function AppFooter({ version }: AppFooterProps) {
  const { t } = useI18n()

  return (
    <footer className="relative z-10 border-t border-white/[0.055] bg-ink-950/45">
      <div className="mx-auto flex min-h-[54px] w-full max-w-[1320px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 text-[10px] text-mist-500 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-neon-400/80" />
          <span>{t('footer.local')}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>{t('footer.windows')}</span>
          <span aria-hidden="true" className="h-3 w-px bg-white/10" />
          <span
            dir="ltr"
            className="font-display font-medium tracking-[0.08em] text-mist-400"
          >
            GYM PRO{version ? ` · v${version}` : ''}
          </span>
        </div>
      </div>
    </footer>
  )
}
