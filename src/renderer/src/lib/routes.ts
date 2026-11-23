import type { MessageKey } from '../i18n'

export type AppRouteName =
  | 'dashboard'
  | 'members'
  | 'memberProfile'
  | 'plans'
  | 'subscriptions'
  | 'renewals'
  | 'attendance'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'backup'

export interface AppRoute {
  name: AppRouteName
  memberId: number | null
}

const ROUTE_PATHS: Record<Exclude<AppRouteName, 'memberProfile'>, string> = {
  dashboard: 'dashboard',
  members: 'members',
  plans: 'plans',
  subscriptions: 'subscriptions',
  renewals: 'renewals',
  attendance: 'attendance',
  payments: 'payments',
  expenses: 'expenses',
  reports: 'reports',
  settings: 'settings',
  backup: 'backup'
}

export function parseHash(hash: string): AppRoute {
  const clean = hash.replace(/^#\/?/, '').split('?')[0]
  const [segment, parameter] = clean.split('/')

  if (segment === 'members' && parameter) {
    const memberId = Number(parameter)

    if (Number.isInteger(memberId) && memberId > 0) {
      return { name: 'memberProfile', memberId }
    }
  }

  const entry = Object.entries(ROUTE_PATHS).find(
    ([, path]) => path === segment
  )

  if (!entry) {
    return { name: 'dashboard', memberId: null }
  }

  return { name: entry[0] as keyof typeof ROUTE_PATHS, memberId: null }
}

export function hrefFor(
  route: AppRouteName,
  memberId?: number
): string {
  if (route === 'memberProfile') {
    return `#/members/${memberId ?? ''}`
  }

  return `#/${ROUTE_PATHS[route]}`
}

export const PAGE_TITLES: Record<
  AppRouteName,
  { title: MessageKey; subtitle: MessageKey }
> = {
  dashboard: {
    title: 'page.dashboard.title',
    subtitle: 'page.dashboard.subtitle'
  },
  members: {
    title: 'page.members.title',
    subtitle: 'page.members.subtitle'
  },
  memberProfile: {
    title: 'page.memberProfile.title',
    subtitle: 'page.memberProfile.subtitle'
  },
  plans: {
    title: 'page.plans.title',
    subtitle: 'page.plans.subtitle'
  },
  subscriptions: {
    title: 'page.subscriptions.title',
    subtitle: 'page.subscriptions.subtitle'
  },
  renewals: {
    title: 'page.renewals.title',
    subtitle: 'page.renewals.subtitle'
  },
  attendance: {
    title: 'page.attendance.title',
    subtitle: 'page.attendance.subtitle'
  },
  payments: {
    title: 'page.payments.title',
    subtitle: 'page.payments.subtitle'
  },
  expenses: {
    title: 'page.expenses.title',
    subtitle: 'page.expenses.subtitle'
  },
  reports: {
    title: 'page.reports.title',
    subtitle: 'page.reports.subtitle'
  },
  settings: {
    title: 'page.settings.title',
    subtitle: 'page.settings.subtitle'
  },
  backup: {
    title: 'page.backup.title',
    subtitle: 'page.backup.subtitle'
  }
}

export function activeNavFor(route: AppRouteName): AppRouteName {
  return route === 'memberProfile' ? 'members' : route
}
