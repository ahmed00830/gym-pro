import { Languages, ShieldCheck, WifiOff } from 'lucide-react'
import type { AppInfoResult } from '../hooks/useAppInfo'
import { useI18n } from '../i18n'
import { SystemCard } from './SystemCard'

interface WelcomeScreenProps {
  appInfo: AppInfoResult
}

const features = [
  {
    Icon: ShieldCheck,
    titleKey: 'features.security.title',
    descriptionKey: 'features.security.description'
  },
  {
    Icon: Languages,
    titleKey: 'features.bilingual.title',
    descriptionKey: 'features.bilingual.description'
  },
  {
    Icon: WifiOff,
    titleKey: 'features.offline.title',
    descriptionKey: 'features.offline.description'
  }
] as const

export function WelcomeScreen({ appInfo }: WelcomeScreenProps) {
  const { t } = useI18n()

  return (
    <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:items-center lg:gap-12 xl:gap-16">
      <section
        aria-labelledby="welcome-heading"
        className="animate-rise motion-reduce:animate-none"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-400/20 bg-neon-400/[0.06] px-3 py-1.5 text-[10px] font-medium tracking-wide text-neon-300">
          <span className="relative flex size-1.5">
            <span
              aria-hidden="true"
              className="absolute inline-flex size-full animate-ping rounded-full bg-neon-400/60 motion-reduce:hidden"
            />
            <span
              aria-hidden="true"
              className="relative inline-flex size-1.5 rounded-full bg-neon-400"
            />
          </span>
          {t('hero.badge')}
        </div>

        <h1 id="welcome-heading" className="mt-5 sm:mt-6">
          <span className="block text-sm font-medium text-mist-400">
            {t('hero.welcome')}
          </span>
          <span
            dir="ltr"
            className="mt-2 block w-fit font-display text-[clamp(3.6rem,7vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-mist-50"
          >
            GYM{' '}
            <span className="text-neon-400 [text-shadow:0_0_50px_rgba(201,255,69,0.25)]">
              PRO
            </span>
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-balance text-xl font-medium leading-9 text-mist-100 sm:text-2xl sm:leading-10">
          {t('hero.title')}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-7 text-mist-400">
          {t('hero.description')}
        </p>

        <ul className="mt-7 grid gap-2.5">
          {features.map(({ Icon, titleKey, descriptionKey }) => (
            <li
              key={titleKey}
              className="flex items-start gap-3.5 rounded-2xl border border-white/[0.055] bg-white/[0.018] px-4 py-3 transition-colors duration-300 hover:border-white/[0.09] hover:bg-white/[0.028]"
            >
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px] border border-neon-400/15 bg-neon-400/[0.06] text-neon-300">
                <Icon
                  className="size-[18px]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-mist-100">
                  {t(titleKey)}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-mist-500">
                  {t(descriptionKey)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <SystemCard
        appInfo={appInfo}
        className="animate-rise [animation-delay:120ms] motion-reduce:animate-none"
      />
    </div>
  )
}
