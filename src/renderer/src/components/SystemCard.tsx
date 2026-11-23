import { Check, RotateCw, ShieldCheck } from 'lucide-react'
import type { AppInfoResult } from '../hooks/useAppInfo'
import { useI18n, type MessageKey } from '../i18n'
import { BrandMark } from './BrandMark'

interface SystemCardProps {
  appInfo: AppInfoResult
  className?: string
}

interface RoadmapStep {
  number: string
  titleKey: MessageKey
  statusKey: MessageKey
  state: 'complete' | 'upcoming'
  detailKey?: MessageKey
}

const roadmapSteps: readonly RoadmapStep[] = [
  {
    number: '01',
    titleKey: 'roadmap.foundation',
    statusKey: 'roadmap.complete',
    state: 'complete'
  },
  {
    number: '02',
    titleKey: 'roadmap.database',
    statusKey: 'roadmap.upcoming',
    state: 'upcoming'
  },
  {
    number: '03',
    titleKey: 'roadmap.memberships',
    statusKey: 'roadmap.upcoming',
    state: 'upcoming',
    detailKey: 'roadmap.idFormat'
  }
]

const statusChipStyles = {
  loading: 'border-white/10 bg-white/[0.03] text-mist-400',
  ready: 'border-neon-400/20 bg-neon-400/[0.06] text-neon-300',
  error: 'border-red-400/20 bg-red-400/[0.05] text-red-300'
} as const

const statusDotStyles = {
  loading: 'animate-pulse bg-mist-400 motion-reduce:animate-none',
  ready:
    'bg-neon-400 shadow-[0_0_8px_rgba(201,255,69,0.9)]',
  error: 'bg-red-400'
} as const

function formatPlatform(platform: string, arch: string): string {
  const platformNames: Record<string, string> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux'
  }

  return `${platformNames[platform] ?? platform} · ${arch}`
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <dt className="text-[11px] text-mist-500">{label}</dt>
      <dd
        dir="ltr"
        className="truncate text-[11px] font-medium tabular-nums tracking-[0.02em] text-mist-200"
      >
        {value}
      </dd>
    </div>
  )
}

function Metadata({ appInfo }: { appInfo: AppInfoResult }) {
  const { t } = useI18n()

  if (appInfo.status === 'loading') {
    return (
      <div
        role="status"
        className="min-h-[136px] overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-950/40 p-4"
      >
        <span className="sr-only">{t('system.loading')}</span>
        <div
          aria-hidden="true"
          className="animate-pulse space-y-3.5 motion-reduce:animate-none"
        >
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between gap-6">
              <div className="h-2 w-16 rounded-full bg-white/10" />
              <div className="h-2 w-20 rounded-full bg-white/[0.07]" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (appInfo.status === 'error' || !appInfo.data) {
    return (
      <div
        role="alert"
        title={appInfo.error ?? undefined}
        className="flex min-h-[136px] flex-col items-start justify-center gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-4"
      >
        <p className="text-[11px] leading-5 text-mist-300">
          {t('system.error')}
        </p>
        <button
          type="button"
          onClick={appInfo.reload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-mist-200 transition-colors hover:border-neon-400/25 hover:text-neon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
        >
          <RotateCw className="size-3" strokeWidth={2} aria-hidden="true" />
          {t('system.retry')}
        </button>
      </div>
    )
  }

  const info = appInfo.data
  const mode = info.isPackaged
    ? t('system.modeInstalled')
    : t('system.modeDevelopment')

  return (
    <dl className="overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-950/40">
      <div className="divide-y divide-white/[0.045]">
        <InfoRow label={t('system.version')} value={info.version} />
        <InfoRow label={t('system.electron')} value={info.electronVersion} />
        <InfoRow
          label={t('system.platform')}
          value={formatPlatform(info.platform, info.arch)}
        />
        <InfoRow label={t('system.mode')} value={mode} />
      </div>
    </dl>
  )
}

export function SystemCard({ appInfo, className = '' }: SystemCardProps) {
  const { t } = useI18n()

  const statusLabel =
    appInfo.status === 'ready'
      ? t('system.statusReady')
      : appInfo.status === 'error'
        ? t('system.statusError')
        : t('system.statusLoading')

  return (
    <aside
      aria-labelledby="system-card-title"
      className={`relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-ink-900/70 p-1.5 shadow-[0_32px_80px_-36px_rgba(0,0,0,0.95)] backdrop-blur-xl ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-neon-400/60 to-transparent"
      />

      <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.008)_55%,rgba(255,255,255,0.016)_100%)] p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 end-0 size-56 rounded-full bg-neon-400/[0.055] blur-3xl"
        />

        <header className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="system-card-title"
              className="text-sm font-medium text-mist-100"
            >
              {t('system.status')}
            </h2>
            <p className="mt-1 text-[10px] text-mist-500">
              {t('system.subtitle')}
            </p>
          </div>

          <span
            aria-live="polite"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusChipStyles[appInfo.status]}`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${statusDotStyles[appInfo.status]}`}
            />
            {statusLabel}
          </span>
        </header>

        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.055] bg-ink-950/50 px-4 py-3.5">
          <span
            aria-hidden="true"
            className="absolute -end-1 -top-5 select-none font-display text-[76px] font-semibold leading-none text-white/[0.025]"
          >
            01
          </span>
          <div className="relative flex items-center gap-3">
            <BrandMark size="sm" />
            <div className="min-w-0">
              <p
                dir="ltr"
                className="truncate font-display text-[13px] font-semibold tracking-[0.18em] text-mist-50"
              >
                GYM PRO
              </p>
              <p className="mt-1 truncate text-[10px] text-mist-500">
                {t('system.phaseLabel')}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-4">
          <Metadata appInfo={appInfo} />
        </div>

        <div className="relative mt-auto pt-5">
          <div className="mb-2.5 flex items-center justify-between gap-4">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-mist-500">
              {t('roadmap.title')}
            </h3>
            <span
              dir="ltr"
              className="font-display text-[10px] tracking-[0.18em] text-mist-500"
            >
              01 / 03
            </span>
          </div>

          <ol className="space-y-1.5">
            {roadmapSteps.map((step) => {
              const isComplete = step.state === 'complete'

              return (
                <li
                  key={step.number}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                    isComplete
                      ? 'border-neon-400/[0.13] bg-neon-400/[0.035]'
                      : 'border-white/[0.045] bg-white/[0.012]'
                  }`}
                >
                  <span
                    className={`mt-px font-display text-[10px] font-semibold tracking-[0.12em] ${
                      isComplete ? 'text-neon-400' : 'text-mist-500'
                    }`}
                  >
                    {step.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[11px] font-medium leading-4 ${
                        isComplete ? 'text-mist-100' : 'text-mist-400'
                      }`}
                    >
                      {t(step.titleKey)}
                    </p>
                    {step.detailKey ? (
                      <p className="mt-0.5 text-[10px] leading-4 text-mist-500">
                        {t(step.detailKey)}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-medium ${
                      isComplete ? 'text-neon-300' : 'text-mist-500'
                    }`}
                  >
                    {isComplete ? (
                      <Check
                        className="size-3"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    ) : null}
                    {t(step.statusKey)}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <p className="relative mt-4 flex items-start gap-1.5 border-t border-white/[0.05] pt-3.5 text-[10px] leading-4 text-mist-500">
          <ShieldCheck
            className="mt-px size-3.5 shrink-0 text-neon-400/70"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>{t('system.secureIpc')}</span>
        </p>
      </div>
    </aside>
  )
}
