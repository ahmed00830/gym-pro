import {
  Bell,
  Dumbbell,
  Inbox,
  Loader2,
  Menu,
  RefreshCw
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n, type MessageKey } from '../../i18n'
import { formatDateTime } from '../../lib/format'
import { useWorkspace } from '../../workspace/WorkspaceProvider'
import { LanguageSwitch } from '../LanguageSwitch'

interface TopbarProps {
  titleKey: MessageKey
  subtitleKey: MessageKey
  onOpenMenu: () => void
}

const severityStyles: Record<string, string> = {
  info: 'bg-sky-400',
  success: 'bg-emerald',
  warning: 'bg-amber',
  error: 'bg-rose'
}

export function Topbar({ titleKey, subtitleKey, onOpenMenu }: TopbarProps) {
  const { t, locale } = useI18n()
  const { snapshot, refresh, refreshing } = useWorkspace()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notificationsOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  const notifications = snapshot?.notifications ?? []
  const unreadCount = snapshot?.totals.unreadNotifications ?? 0

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.055] bg-[#0b0b10]/80 backdrop-blur-xl">
      <div className="flex min-h-[76px] w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label={t('topbar.menu')}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-muted transition-colors hover:text-primary lg:hidden"
          >
            <Menu className="size-[18px]" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[19px] font-semibold leading-tight text-primary sm:text-[21px]">
              {t(titleKey)}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-muted sm:text-xs">
              {t(subtitleKey)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label={t('topbar.refresh')}
            title={t('topbar.refresh')}
            className="grid size-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-muted transition-colors hover:border-purple/30 hover:text-purple-soft disabled:cursor-wait"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </button>

          <LanguageSwitch />

          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-label={t('topbar.notifications')}
              aria-expanded={notificationsOpen}
              aria-haspopup="true"
              className="relative grid size-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-muted transition-colors hover:border-purple/30 hover:text-primary"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <span className="absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full border border-[#0b0b10] bg-purple px-1 text-[9px] font-semibold leading-4 text-white shadow-[0_0_12px_rgba(168,85,247,0.65)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div
                role="region"
                aria-label={t('topbar.notifications')}
                className="absolute end-0 top-[calc(100%+10px)] z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15131c] shadow-[0_28px_70px_-20px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <h2 className="text-xs font-semibold text-primary">
                    {t('topbar.notifications')}
                  </h2>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-purple/15 px-2 py-0.5 text-[10px] font-medium text-purple-soft">
                      {unreadCount}
                    </span>
                  ) : null}
                </div>

                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
                    <Inbox className="size-6 text-dim" strokeWidth={1.6} />
                    <p className="text-xs font-medium text-primary">
                      {t('topbar.noNotifications')}
                    </p>
                    <p className="text-[11px] leading-relaxed text-dim">
                      {t('topbar.noNotificationsHint')}
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-[330px] divide-y divide-white/[0.045] overflow-y-auto">
                    {notifications.slice(0, 8).map((notification) => (
                      <li
                        key={notification.id}
                        className="flex gap-3 px-4 py-3"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                            severityStyles[notification.severity] ??
                            severityStyles.info
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-primary">
                            {notification.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-dim">
                            {formatDateTime(notification.createdAt, locale)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <span
            aria-hidden="true"
            className="mx-1 hidden h-7 w-px bg-white/[0.07] sm:block"
          />

          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(145deg,#d8b4fe_0%,#a855f7_48%,#6d28d9_100%)] text-white shadow-[0_0_22px_rgba(168,85,247,0.3)]">
              <Dumbbell className="size-[18px]" strokeWidth={2.2} />
            </span>
            <div className="hidden min-w-0 xl:block">
              <p className="truncate text-[11px] font-medium leading-tight text-primary">
                {t('topbar.localOperator')}
              </p>
              <p className="truncate text-[10px] leading-tight text-dim">
                {t('topbar.localWorkspace')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
