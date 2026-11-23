import {
  CalendarClock,
  CircleCheck,
  Database,
  DatabaseBackup,
  FileArchive,
  HardDrive,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Upload
} from 'lucide-react'
import { useI18n } from '../i18n'
import { formatBytes } from '../lib/format'
import { useSystemInfo } from '../hooks/useSystemInfo'
import { SectionCard } from '../components/ui/SectionCard'

export function BackupPage() {
  const { t, locale } = useI18n()
  const system = useSystemInfo()

  const databaseHealthy = system.health?.ok === true

  const roadmap = [
    { icon: FileArchive, label: t('backup.roadmapCreate') },
    { icon: Upload, label: t('backup.roadmapRestore') },
    { icon: CalendarClock, label: t('backup.roadmapSchedule') },
    { icon: ShieldCheck, label: t('backup.roadmapVerify') }
  ]

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      <section className="relative overflow-hidden rounded-[24px] border border-amber/25 bg-[radial-gradient(ellipse_70%_120%_at_100%_0%,rgba(251,191,36,0.14),transparent_58%),linear-gradient(145deg,#211b12_0%,#17151e_62%)] p-5 sm:p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-12 -top-16 size-48 rounded-full bg-amber/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-amber/25 bg-amber/10 text-amber">
            <ShieldAlert className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-base font-semibold text-primary sm:text-lg">
                {t('backup.noticeTitle')}
              </h2>
              <span className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[10px] font-medium text-amber">
                {t('backup.planned')}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-muted">
              {t('backup.noticeDescription')}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:gap-5">
        <SectionCard
          icon={Database}
          title={t('backup.databaseTitle')}
          subtitle={t('backup.databaseDescription')}
          bodyClassName="px-5 pb-5"
          action={
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
              {t(databaseHealthy ? 'settings.healthy' : 'settings.degraded')}
            </span>
          }
        >
          <dl className="space-y-0">
            <div className="flex flex-col gap-1 border-b border-white/[0.045] py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
                <HardDrive className="size-3.5 text-dim" />
                {t('backup.location')}
              </dt>
              <dd
                dir="ltr"
                className="min-w-0 break-all rounded-lg border border-white/[0.055] bg-white/[0.025] px-2.5 py-1.5 font-display text-[10px] text-primary sm:text-end"
              >
                {system.databaseInfo?.filePath ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-6 border-b border-white/[0.045] py-3">
              <dt className="flex items-center gap-2 text-[11px] text-muted">
                <FileArchive className="size-3.5 text-dim" />
                {t('backup.size')}
              </dt>
              <dd className="font-display text-[11px] font-medium text-primary">
                {system.databaseInfo
                  ? formatBytes(system.databaseInfo.sizeBytes, locale)
                  : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-6 border-b border-white/[0.045] py-3">
              <dt className="flex items-center gap-2 text-[11px] text-muted">
                <DatabaseBackup className="size-3.5 text-dim" />
                {t('backup.status')}
              </dt>
              <dd className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-medium text-muted">
                {t('backup.unavailableTitle')}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-6 py-3">
              <dt className="flex items-center gap-2 text-[11px] text-muted">
                <ShieldCheck className="size-3.5 text-dim" />
                {t('settings.schema')}
              </dt>
              <dd className="font-display text-[11px] font-medium text-primary">
                {system.databaseInfo
                  ? `v${system.databaseInfo.schemaVersion} / v${system.databaseInfo.targetSchemaVersion}`
                  : '—'}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          icon={CalendarClock}
          title={t('backup.roadmapTitle')}
          bodyClassName="px-5 pb-5"
        >
          <ul className="space-y-2.5">
            {roadmap.map((item) => {
              const Icon = item.icon

              return (
                <li
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.022] px-3 py-2.5"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-dim">
                    <Icon className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                    {item.label}
                  </span>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-dim">
                    {t('backup.planned')}
                  </span>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        icon={CircleCheck}
        title={t('backup.unavailableTitle')}
        bodyClassName="px-5 pb-5"
      >
        <p className="text-[11px] leading-relaxed text-muted">
          {t('backup.unavailableDescription')}
        </p>
      </SectionCard>
    </div>
  )
}
