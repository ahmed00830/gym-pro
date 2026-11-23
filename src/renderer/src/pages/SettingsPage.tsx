import {
  Database,
  HardDrive,
  Languages,
  Palette,
  Settings2,
  ShieldCheck,
  TriangleAlert
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { formatBytes, formatDateTime } from '../lib/format'
import { useSystemInfo } from '../hooks/useSystemInfo'
import { useWorkspaceData } from '../workspace/WorkspaceProvider'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { EmptyState } from '../components/ui/EmptyState'
import { SectionCard } from '../components/ui/SectionCard'

function InfoRow({
  label,
  value,
  ltr = false
}: {
  label: string
  value: ReactNode
  ltr?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/[0.045] py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-[11px] text-muted">{label}</dt>
      <dd
        dir={ltr ? 'ltr' : undefined}
        className={`min-w-0 break-words text-[11px] font-medium text-primary ${
          ltr ? 'font-display sm:text-end' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

export function SettingsPage() {
  const { t, locale, direction } = useI18n()
  const snapshot = useWorkspaceData()
  const system = useSystemInfo()

  const databaseHealthy = system.health?.ok === true

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <SectionCard
          icon={Languages}
          title={t('settings.languageTitle')}
          subtitle={t('settings.languageDescription')}
          bodyClassName="px-5 pb-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-primary">
                {t('settings.languageSwitched')}
              </p>
              <p
                dir="ltr"
                className="mt-0.5 font-display text-[10px] uppercase tracking-[0.18em] text-dim"
              >
                {direction} · {locale}
              </p>
            </div>
            <LanguageSwitch />
          </div>
        </SectionCard>

        <SectionCard
          icon={Palette}
          title={t('settings.appearanceTitle')}
          subtitle={t('settings.appearanceDescription')}
          bodyClassName="px-5 pb-5"
        >
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-purple/20 bg-gradient-to-r from-purple/12 to-transparent px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-primary">
                {t('settings.darkTheme')}
              </p>
              <p className="mt-0.5 text-[10px] text-dim">
                {t('settings.darkThemeNote')}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-white/20 bg-[#0b0b10]"
              />
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-white/20 bg-[#17151e]"
              />
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-white/20 bg-purple shadow-[0_0_14px_rgba(168,85,247,0.6)]"
              />
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-white/20 bg-emerald shadow-[0_0_14px_rgba(16,217,160,0.5)]"
              />
            </span>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <SectionCard
          icon={Settings2}
          title={t('settings.workspaceTitle')}
          subtitle={t('settings.workspaceDescription')}
          bodyClassName="px-5 pb-4"
          action={
            system.status === 'ready' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/25 bg-emerald/10 px-2.5 py-1 text-[10px] font-medium text-emerald">
                <ShieldCheck className="size-3" />
                {t('system.statusReady')}
              </span>
            ) : null
          }
        >
          <dl>
            <InfoRow
              label={t('settings.version')}
              value={system.appInfo?.version ?? '—'}
              ltr
            />
            <InfoRow
              label={t('settings.electron')}
              value={system.appInfo?.electronVersion ?? '—'}
              ltr
            />
            <InfoRow
              label={t('settings.platform')}
              value={system.appInfo?.platform ?? '—'}
              ltr
            />
            <InfoRow
              label={t('settings.schema')}
              value={
                system.databaseInfo
                  ? `v${system.databaseInfo.schemaVersion}`
                  : '—'
              }
              ltr
            />
          </dl>
        </SectionCard>

        <SectionCard
          icon={Database}
          title={t('settings.databaseTitle')}
          subtitle={t('settings.databaseDescription')}
          bodyClassName="px-5 pb-4"
          action={
            system.status === 'ready' ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                  databaseHealthy
                    ? 'border-emerald/25 bg-emerald/10 text-emerald'
                    : 'border-amber/25 bg-amber/10 text-amber'
                }`}
              >
                {databaseHealthy ? (
                  <ShieldCheck className="size-3" />
                ) : (
                  <TriangleAlert className="size-3" />
                )}
                {t(
                  databaseHealthy
                    ? 'settings.healthy'
                    : 'settings.degraded'
                )}
              </span>
            ) : null
          }
        >
          <dl>
            <InfoRow
              label={t('settings.journal')}
              value={system.databaseInfo?.journalMode ?? '—'}
              ltr
            />
            <InfoRow
              label={t('settings.databaseSize')}
              value={
                system.databaseInfo
                  ? formatBytes(system.databaseInfo.sizeBytes, locale)
                  : '—'
              }
              ltr
            />
            <InfoRow
              label={t('settings.targetSchema')}
              value={
                system.databaseInfo
                  ? `v${system.databaseInfo.targetSchemaVersion}`
                  : '—'
              }
              ltr
            />
            <InfoRow
              label={t('settings.filePath')}
              value={system.databaseInfo?.filePath ?? '—'}
              ltr
            />
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        icon={HardDrive}
        title={t('settings.storedTitle')}
        subtitle={t('settings.storedDescription')}
        bodyClassName="px-5 pb-4"
      >
        {snapshot.settings.length === 0 ? (
          <EmptyState
            compact
            icon={Settings2}
            title={t('settings.noStoredSettings')}
          />
        ) : (
          <dl>
            {snapshot.settings.map((setting) => (
              <InfoRow
                key={setting.key}
                label={setting.key}
                ltr
                value={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-1.5 py-0.5 font-display text-[10px] text-muted">
                      {setting.valueType}
                    </span>
                    <span>{setting.value}</span>
                    <span className="text-[10px] text-dim">
                      {formatDateTime(setting.updatedAt, locale)}
                    </span>
                  </span>
                }
              />
            ))}
          </dl>
        )}
        <p className="mt-4 rounded-xl border border-white/[0.055] bg-white/[0.02] px-3 py-2.5 text-[10px] leading-relaxed text-dim">
          {t('settings.readOnlyNote')}
        </p>
      </SectionCard>
    </div>
  )
}
