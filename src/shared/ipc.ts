/**
 * Contract shared by the Electron main process, the sandboxed preload script,
 * and the React renderer. Keep this file free of Node.js and DOM APIs.
 */

import type { AnalyticsApi } from './analytics'
import type {
  AttendanceRecord,
  MemberInput,
  MemberRecord,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseInput,
  ExpenseRecord,
  PaymentRecord,
  PlanInput,
  PlanRecord,
  QuickRegisterInput,
  QuickRegisterResult,
  QuickRenewInput,
  SubscriptionInput,
  SubscriptionRecord
} from './analytics'
import type { DatabaseApi } from './database'

export const IPC_CHANNELS = {
  app: {
    getInfo: 'app:get-info'
  },
  database: {
    healthCheck: 'database:health-check',
    getInitializationStatus: 'database:get-initialization-status',
    getInfo: 'database:get-info'
  },
  analytics: {
    getSnapshot: 'analytics:get-snapshot',
    getRangeReport: 'analytics:get-range-report'
  },
  members: {
    create: 'members:create',
    update: 'members:update',
    delete: 'members:delete',
    quickRegister: 'members:quick-register'
  },
  plans: {
    create: 'plans:create',
    update: 'plans:update',
    setActive: 'plans:set-active'
  },
  subscriptions: {
    create: 'subscriptions:create',
    freeze: 'subscriptions:freeze',
    resume: 'subscriptions:resume',
    cancel: 'subscriptions:cancel',
    recordPayment: 'subscriptions:record-payment',
    quickRenew: 'subscriptions:quick-renew'
  },
  attendance: {
    register: 'attendance:register'
  },
  expenses: {
    create: 'expenses:create',
    update: 'expenses:update',
    archive: 'expenses:archive',
    createCategory: 'expenses:create-category',
    setCategoryActive: 'expenses:set-category-active',
    renameCategory: 'expenses:rename-category'
  }
} as const

export interface AppInfo {
  name: string
  version: string
  electronVersion: string
  chromeVersion: string
  platform: string
  arch: string
  isPackaged: boolean
}

/**
 * The complete surface exposed to the renderer through `window.gymPro`.
 * Never expose `ipcRenderer`, `require`, raw SQL, a database handle, or
 * filesystem access here.
 */
export interface MemberApi {
  create: (input: MemberInput) => Promise<MemberRecord>
  update: (id: number, input: MemberInput) => Promise<MemberRecord>
  delete: (id: number) => Promise<{ archived: boolean; deleted: boolean }>
  quickRegister: (input: QuickRegisterInput) => Promise<QuickRegisterResult>
}

export interface PlanApi {
  create: (input: PlanInput) => Promise<PlanRecord>
  update: (id: number, input: PlanInput) => Promise<PlanRecord>
  setActive: (id: number, isActive: boolean) => Promise<PlanRecord>
}

export interface SubscriptionApi {
  create: (input: SubscriptionInput) => Promise<SubscriptionRecord>
  freeze: (
    id: number,
    startDate: string,
    endDate: string | null,
    reason: string | null
  ) => Promise<SubscriptionRecord>
  resume: (id: number, resumeDate: string) => Promise<SubscriptionRecord>
  cancel: (id: number) => Promise<SubscriptionRecord>
  recordPayment: (
    subscriptionId: number,
    amount: number,
    method: string,
    paymentDate: string,
    notes: string | null
  ) => Promise<PaymentRecord>
  quickRenew: (input: QuickRenewInput) => Promise<SubscriptionRecord>
}

export interface AttendanceApi {
  register: (memberId: number) => Promise<AttendanceRecord>
}

export interface ExpenseApi {
  create: (input: ExpenseInput) => Promise<ExpenseRecord>
  update: (id: number, input: ExpenseInput) => Promise<ExpenseRecord>
  archive: (id: number) => Promise<ExpenseRecord>
  createCategory: (input: ExpenseCategoryInput) => Promise<ExpenseCategory>
  setCategoryActive: (key: string, isActive: boolean) => Promise<ExpenseCategory>
  renameCategory: (
    key: string,
    nameAr: string,
    nameEn: string
  ) => Promise<ExpenseCategory>
}

export interface GymProApi {
  app: {
    getInfo: () => Promise<AppInfo>
  }
  database: DatabaseApi
  analytics: AnalyticsApi
  members: MemberApi
  plans: PlanApi
  subscriptions: SubscriptionApi
  attendance: AttendanceApi
  expenses: ExpenseApi
}
