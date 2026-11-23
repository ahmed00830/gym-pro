import {
  BarChart3,
  CreditCard,
  DatabaseBackup,
  LayoutDashboard,
  Layers,
  RefreshCw,
  Receipt,
  ScanLine,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon
} from 'lucide-react'
import { useI18n, type MessageKey } from '../../i18n'
import { activeNavFor, hrefFor, type AppRouteName } from '../../lib/routes'
import { BrandMark } from '../BrandMark'

interface NavLink {
  route: AppRouteName
  labelKey: MessageKey
  icon: LucideIcon
}

const operationLinks: NavLink[] = [
  { route: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { route: 'members', labelKey: 'nav.members', icon: Users },
  { route: 'plans', labelKey: 'nav.plans', icon: Layers },
  { route: 'subscriptions', labelKey: 'nav.subscriptions', icon: CreditCard },
  { route: 'renewals', labelKey: 'nav.renewals', icon: RefreshCw },
  { route: 'attendance', labelKey: 'nav.attendance', icon: ScanLine },
  { route: 'payments', labelKey: 'nav.payments', icon: Wallet },
  { route: 'expenses', labelKey: 'nav.expenses', icon: Receipt },
  { route: 'reports', labelKey: 'nav.reports', icon: BarChart3 }
]

const systemLinks: NavLink[] = [
  { route: 'settings', labelKey: 'nav.settings', icon: Settings },
  { route: 'backup', labelKey: 'nav.backup', icon: DatabaseBackup }
]

interface SidebarProps {
  activeRoute: AppRouteName
  databaseReady: boolean
  onNavigate: () => void
  onClose?: () => void
}

function NavSection({
  title,
  links,
  activeRoute,
  onNavigate
}: {
  title: string
  links: NavLink[]
  activeRoute: AppRouteName
  onNavigate: () => void
}) {
  const { t } = useI18n()
  const active = activeNavFor(activeRoute)

  return (
    <div>
      <p className="px-3 pb-1.5 pt-4 text-[10px] font-medium text-dim">
        {title}
      </p>
      <ul className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = active === link.route

          return (
            <li key={link.route}>
              <a
                href={hrefFor(link.route)}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all duration-200 ${
                  isActive
                    ? 'nav-active font-medium text-primary'
                    : 'text-muted hover:bg-white/[0.035] hover:text-primary'
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg transition-colors ${
                    isActive
                      ? 'bg-purple/15 text-purple-soft'
                      : 'text-dim group-hover:bg-white/[0.04] group-hover:text-muted'
                  }`}
                >
                  <Icon className="size-[17px]" strokeWidth={1.8} />
                </span>
                <span className="truncate">{t(link.labelKey)}</span>
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="ms-auto size-1.5 rounded-full bg-purple shadow-[0_0_10px_2px_rgba(168,85,247,0.55)]"
                  />
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Sidebar({
  activeRoute,
  databaseReady,
  onNavigate,
  onClose
}: SidebarProps) {
  const { t } = useI18n()

  return (
    <aside className="sidebar-surface flex h-full w-full flex-col border-e border-white/[0.055]">
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <a
          href={hrefFor('dashboard')}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <BrandMark />
          <span className="min-w-0">
            <span
              dir="ltr"
              className="block truncate font-display text-[15px] font-bold tracking-[0.2em] text-primary"
            >
              GYM PRO
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-dim">
              {t('brand.suite')}
            </span>
          </span>
        </a>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('topbar.closeMenu')}
            className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-muted transition-colors hover:text-primary lg:hidden"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <nav
        aria-label={t('brand.suite')}
        className="scrollbar-none flex-1 overflow-y-auto px-3 pb-3"
      >
        <NavSection
          title={t('nav.section.operations')}
          links={operationLinks}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
        <div className="mx-3 my-2 h-px bg-white/[0.055]" />
        <NavSection
          title={t('nav.section.system')}
          links={systemLinks}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="border-t border-white/[0.055] p-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                databaseReady
                  ? 'bg-emerald shadow-[0_0_10px_2px_rgba(16,217,160,0.45)]'
                  : 'bg-rose shadow-[0_0_10px_2px_rgba(251,113,133,0.4)]'
              }`}
            />
            <p className="truncate text-[11px] font-medium text-primary">
              {t(
                databaseReady
                  ? 'sidebar.databaseReady'
                  : 'sidebar.databaseUnavailable'
              )}
            </p>
          </div>
          <p className="mt-1 truncate text-[10px] text-dim">
            {t('sidebar.offline')}
          </p>
        </div>
      </div>
    </aside>
  )
}
