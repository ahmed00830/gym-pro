import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { useHashRoute } from '../../hooks/useHashRoute'
import { PAGE_TITLES, type AppRoute } from '../../lib/routes'
import { useWorkspace } from '../../workspace/WorkspaceProvider'
import { BrandMark } from '../BrandMark'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { DashboardPage } from '../../pages/DashboardPage'
import { MembersPage } from '../../pages/MembersPage'
import { MemberProfilePage } from '../../pages/MemberProfilePage'
import { PlansPage } from '../../pages/PlansPage'
import { SubscriptionsPage } from '../../pages/SubscriptionsPage'
import { RenewalsPage } from '../../pages/RenewalsPage'
import { AttendancePage } from '../../pages/AttendancePage'
import { PaymentsPage } from '../../pages/PaymentsPage'
import { ExpensesPage } from '../../pages/ExpensesPage'
import { ReportsPage } from '../../pages/ReportsPage'
import { SettingsPage } from '../../pages/SettingsPage'
import { BackupPage } from '../../pages/BackupPage'

function LoadingScreen() {
  const { t } = useI18n()

  return (
    <div className="app-canvas flex min-h-screen flex-col items-center justify-center gap-5 px-6">
      <BrandMark size="lg" />
      <div className="flex items-center gap-2.5 text-muted">
        <Loader2 className="size-4 animate-spin text-purple-soft" />
        <p className="text-xs">{t('common.loading')}</p>
      </div>
    </div>
  )
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <div className="app-canvas flex min-h-screen items-center justify-center px-6">
      <div className="panel w-full max-w-md rounded-[26px] p-7 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-rose/25 bg-rose/10 text-rose">
          <AlertTriangle className="size-5" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 font-display text-lg font-semibold text-primary">
          {t('errors.workspaceTitle')}
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {t('errors.workspaceDescription')}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/15 px-4 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/25 hover:text-primary"
        >
          <RefreshCw className="size-3.5" />
          {t('errors.retry')}
        </button>
      </div>
    </div>
  )
}

function RouteView({ route }: { route: AppRoute }) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />
    case 'members':
      return <MembersPage />
    case 'memberProfile':
      return <MemberProfilePage memberId={route.memberId ?? 0} />
    case 'plans':
      return <PlansPage />
    case 'subscriptions':
      return <SubscriptionsPage />
    case 'renewals':
      return <RenewalsPage />
    case 'attendance':
      return <AttendancePage />
    case 'payments':
      return <PaymentsPage />
    case 'expenses':
      return <ExpensesPage />
    case 'reports':
      return <ReportsPage />
    case 'settings':
      return <SettingsPage />
    case 'backup':
      return <BackupPage />
  }
}

export function AppShell() {
  const { t } = useI18n()
  const route = useHashRoute()
  const { status, snapshot, refresh } = useWorkspace()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [route.memberId, route.name])

  useEffect(() => {
    if (!menuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  if (status === 'loading' && !snapshot) {
    return <LoadingScreen />
  }

  if (!snapshot) {
    return <ErrorScreen onRetry={refresh} />
  }

  const pageTitle = PAGE_TITLES[route.name]

  return (
    <div className="app-canvas min-h-screen">
      <div className="fixed inset-y-0 start-0 z-40 hidden w-[264px] lg:block">
        <Sidebar
          activeRoute={route.name}
          databaseReady={status !== 'error'}
          onNavigate={() => undefined}
        />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t('topbar.closeMenu')}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 start-0 w-[282px] max-w-[86vw] shadow-[24px_0_80px_-20px_rgba(0,0,0,0.9)]">
            <Sidebar
              activeRoute={route.name}
              databaseReady={status !== 'error'}
              onNavigate={() => setMenuOpen(false)}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 lg:ms-[264px]">
        <Topbar
          titleKey={pageTitle.title}
          subtitleKey={pageTitle.subtitle}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 xl:px-8 xl:py-6">
          <RouteView route={route} />
        </main>
      </div>
    </div>
  )
}
