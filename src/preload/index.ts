import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type AppInfo,
  type GymProApi
} from '../shared/ipc'
import type {
  DatabaseHealthCheck,
  DatabaseInfo,
  DatabaseInitializationStatus
} from '../shared/database'
import type {
  AttendanceRecord,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseInput,
  ExpenseRecord,
  MemberInput,
  MemberRecord,
  PaymentRecord,
  PlanInput,
  PlanRecord,
  QuickRegisterInput,
  QuickRegisterResult,
  QuickRenewInput,
  SubscriptionInput,
  SubscriptionRecord,
  WorkspaceSnapshot,
  AnalyticsRangeReport
} from '../shared/analytics'

const appApi = Object.freeze({
  getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getInfo) as Promise<AppInfo>
})

const databaseApi = Object.freeze({
  healthCheck: () =>
    ipcRenderer.invoke(
      IPC_CHANNELS.database.healthCheck
    ) as Promise<DatabaseHealthCheck>,
  getInitializationStatus: () =>
    ipcRenderer.invoke(
      IPC_CHANNELS.database.getInitializationStatus
    ) as Promise<DatabaseInitializationStatus>,
  getInfo: () =>
    ipcRenderer.invoke(IPC_CHANNELS.database.getInfo) as Promise<DatabaseInfo>
})

const analyticsApi = Object.freeze({
  getSnapshot: () =>
    ipcRenderer.invoke(IPC_CHANNELS.analytics.getSnapshot) as Promise<WorkspaceSnapshot>,
  getRangeReport: (from: string, to: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.analytics.getRangeReport,
      from,
      to
    ) as Promise<AnalyticsRangeReport>
})

const membersApi = Object.freeze({
  create: (input: MemberInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.members.create,
      input
    ) as Promise<MemberRecord>,
  update: (id: number, input: MemberInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.members.update,
      id,
      input
    ) as Promise<MemberRecord>,
  delete: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.members.delete, id) as Promise<{
      archived: boolean
      deleted: boolean
    }>,
  quickRegister: (input: QuickRegisterInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.members.quickRegister,
      input
    ) as Promise<QuickRegisterResult>
})

const plansApi = Object.freeze({
  create: (input: PlanInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.plans.create, input) as Promise<PlanRecord>,
  update: (id: number, input: PlanInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.plans.update, id, input) as Promise<PlanRecord>,
  setActive: (id: number, isActive: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.plans.setActive, id, isActive) as Promise<PlanRecord>
})

const subscriptionsApi = Object.freeze({
  create: (input: SubscriptionInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.subscriptions.create,
      input
    ) as Promise<SubscriptionRecord>,
  freeze: (
    id: number,
    startDate: string,
    endDate: string | null,
    reason: string | null
  ) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.subscriptions.freeze,
      id,
      startDate,
      endDate,
      reason
    ) as Promise<SubscriptionRecord>,
  resume: (id: number, resumeDate: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.subscriptions.resume,
      id,
      resumeDate
    ) as Promise<SubscriptionRecord>,
  cancel: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.subscriptions.cancel, id) as Promise<SubscriptionRecord>,
  recordPayment: (
    subscriptionId: number,
    amount: number,
    method: string,
    paymentDate: string,
    notes: string | null
  ) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.subscriptions.recordPayment,
      subscriptionId,
      amount,
      method,
      paymentDate,
      notes
    ) as Promise<PaymentRecord>,
  quickRenew: (input: QuickRenewInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.subscriptions.quickRenew,
      input
    ) as Promise<SubscriptionRecord>
})

const expensesApi = Object.freeze({
  create: (input: ExpenseInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.expenses.create,
      input
    ) as Promise<ExpenseRecord>,
  update: (id: number, input: ExpenseInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.expenses.update,
      id,
      input
    ) as Promise<ExpenseRecord>,
  archive: (id: number) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.expenses.archive,
      id
    ) as Promise<ExpenseRecord>,
  createCategory: (input: ExpenseCategoryInput) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.expenses.createCategory,
      input
    ) as Promise<ExpenseCategory>,
  setCategoryActive: (key: string, isActive: boolean) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.expenses.setCategoryActive,
      key,
      isActive
    ) as Promise<ExpenseCategory>,
  renameCategory: (key: string, nameAr: string, nameEn: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.expenses.renameCategory,
      key,
      nameAr,
      nameEn
    ) as Promise<ExpenseCategory>
})

const attendanceApi = Object.freeze({
  register: (memberId: number) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.attendance.register,
      memberId
    ) as Promise<AttendanceRecord>
})

const api: GymProApi = Object.freeze({
  app: appApi,
  database: databaseApi,
  analytics: analyticsApi,
  members: membersApi,
  plans: plansApi,
  subscriptions: subscriptionsApi,
  attendance: attendanceApi,
  expenses: expensesApi
})

/**
 * Expose a deliberately small, frozen API. The renderer never receives
 * `ipcRenderer`, `require`, `process`, a SQLite handle, or filesystem access.
 */
contextBridge.exposeInMainWorld('gymPro', api)