/**
 * Read-only analytics and directory data shared by the main process and the
 * renderer. These types intentionally contain no SQL or database handles.
 *
 * The snapshot is a presentation-oriented view over the existing Phase 2
 * schema. It never writes data and never invents records: an empty database
 * produces zero totals and empty collections.
 */

export type MemberStatus =
  | 'active'
  | 'inactive'
  | 'frozen'
  | 'expired'
  | 'blocked'
  | 'archived'

export type SubscriptionStatus =
  | 'pending'
  | 'active'
  | 'frozen'
  | 'expired'
  | 'cancelled'
  | 'completed'

export type Gender = 'male' | 'female' | 'other'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export type SettingValueType = 'string' | 'number' | 'boolean' | 'json'

export interface MemberRecord {
  id: number
  memberCode: string
  /** Permanent sequential membership number (1, 2, 3, ...). */
  memberNumber: number
  fullName: string
  phone: string | null
  secondaryPhone: string | null
  address: string | null
  gender: Gender | null
  dateOfBirth: string | null
  registrationDate: string
  emergencyContact: string | null
  notes: string | null
  status: MemberStatus
  photoData: string | null
  createdAt: string
  updatedAt: string
}

export interface MemberStatusCount {
  status: MemberStatus
  count: number
}

export interface PlanRecord {
  id: number
  name: string
  durationDays: number
  price: number
  description: string | null
  isActive: boolean
  activeSubscribers: number
}

export interface SubscriptionRecord {
  id: number
  memberId: number
  /** Permanent membership number of the member at purchase time. */
  memberNumber: number
  memberCode: string
  memberName: string
  planId: number
  /** Plan name snapshot at purchase time; survives later plan renames. */
  planName: string
  /** Plan duration at purchase time; survives later plan edits. */
  durationDays: number
  startDate: string
  endDate: string
  finalPrice: number
  price: number
  discount: number
  status: SubscriptionStatus
  paidAmount: number
  balance: number
  freezeStartDate: string | null
  freezeEndDate: string | null
  freezeReason: string | null
}

export interface RenewalRecord extends SubscriptionRecord {
  /** 2 for the member's second subscription, 3 for the third, and so on. */
  renewalNumber: number
}

export interface QuickRegisterInput {
  fullName: string
  phone: string
  planId: number
  startDate: string
  paymentMethod: string
  paymentDate: string
  notes: string | null
}

export interface QuickRegisterResult {
  member: MemberRecord
  subscription: SubscriptionRecord
}

export interface QuickRenewInput {
  memberId: number
  planId: number
  paymentMethod: string
  paymentDate: string
  startDate: string | null
  notes: string | null
}
export interface FreezeRecord {
  id: number
  subscriptionId: number
  startDate: string
  endDate: string | null
  reason: string | null
  createdAt: string
}

export type PaymentType = 'new' | 'renewal'

export interface PaymentRecord {
  id: number
  memberId: number
  subscriptionId: number | null
  /** Permanent membership number of the paying member. */
  memberNumber: number
  memberCode: string
  memberName: string
  /** Plan name snapshot of the subscription this payment belongs to. */
  planName: string | null
  /** 'renewal' when the payment activates a member's renewing subscription. */
  paymentType: PaymentType
  amount: number
  paymentMethod: string
  paymentDate: string
  notes: string | null
  createdAt: string
}

export interface AttendanceRecord {
  id: number
  memberId: number
  memberNumber: number
  memberCode: string
  memberName: string
  checkInDate: string
  checkInTime: string
  createdAt: string
}

export type ExpenseStatus = 'active' | 'archived'

export interface ExpenseRecord {
  id: number
  description: string
  category: string
  amount: number
  paymentMethod: string
  expenseDate: string
  /** Local time the expense happened (HH:MM:SS). */
  expenseTime: string | null
  /** Employee who registered the expense, when recorded. */
  recordedBy: string | null
  /** 'archived' expenses are voided for totals but never deleted. */
  status: ExpenseStatus
  notes: string | null
  createdAt: string
}

  /** Input for creating or updating an expense. */
export interface ExpenseInput {
  description: string
  category: string
  amount: number
  paymentMethod: string
  expenseDate: string
  /** Local time the expense happened (HH:MM:SS). Defaults to now. */
  expenseTime: string | null
  recordedBy: string | null
  notes: string | null
}

export interface ExpenseCategoryInput {
  key: string
  nameAr: string
  nameEn: string
}

/** Stored, bilingual expense category managed by administrators. */
export interface ExpenseCategory {
  key: string
  nameAr: string
  nameEn: string
  isActive: boolean
  sortOrder: number
}

export interface NotificationRecord {
  id: number
  type: string
  title: string
  message: string
  severity: NotificationSeverity
  isRead: boolean
  createdAt: string
}

export interface SettingRecord {
  key: string
  value: string
  valueType: SettingValueType
  updatedAt: string
}

export interface AttendanceSeriesPoint {
  date: string
  attendance: number
  registrations: number
}

export interface MonthlyReportPoint {
  month: string
  revenue: number
  expenses: number
  newMembers: number
}

export interface PaymentMethodBreakdown {
  method: string
  count: number
  total: number
}

export interface ExpenseCategoryBreakdown {
  category: string
  count: number
  total: number
}

/**
 * Financial summary for a selected date range. All amounts come from recorded
 * payments only; pending or unpaid transactions are never counted as revenue.
 */
export interface AnalyticsRangeReport {
  from: string
  to: string
  /** Sum of completed payments in the range. */
  collectedRevenue: number
  /** Number of payments recorded in the range. */
  subscriptionPayments: number
  /** Subscriptions activated by payments recorded in the range, including renewals. */
  newSubscriptions: number
  /** Subscription payments in the range that activate a member's renewal. */
  renewals: number
  /** Recorded expenses in the range (0 when none exist). */
  expenses: number
  /** collectedRevenue minus expenses in the range. */
  netRevenue: number
  paymentMethods: PaymentMethodBreakdown[]
}

export interface WorkspaceTotals {
  totalRevenue: number
  revenueThisMonth: number
  /** Sum of completed payments recorded today. */
  revenueToday: number
  totalExpenses: number
  expensesThisMonth: number
  /** Sum of active expenses recorded today. */
  expensesToday: number
  totalPayments: number
  totalExpenseEntries: number
  activeMembers: number
  totalMembers: number
  newRegistrations: number
  todayAttendance: number
  attendanceThisMonth: number
  totalAttendance: number
  /** Repeat subscriptions started this month, not a separate renewal table. */
  membershipRenewals: number
  totalRenewals: number
  expiringMemberships: number
  activeSubscriptions: number
  totalSubscriptions: number
  totalPlans: number
  activePlans: number
  unreadNotifications: number
}

export interface WorkspaceSnapshot {
  generatedAt: string
  totals: WorkspaceTotals
  attendanceSeries: AttendanceSeriesPoint[]
  members: MemberRecord[]
  memberStatusCounts: MemberStatusCount[]
  plans: PlanRecord[]
  subscriptions: SubscriptionRecord[]
  renewals: RenewalRecord[]
  freezes: FreezeRecord[]
  payments: PaymentRecord[]
  attendance: AttendanceRecord[]
  expenses: ExpenseRecord[]
  notifications: NotificationRecord[]
  settings: SettingRecord[]
  expenseCatalog: ExpenseCategory[]
  monthlyReport: MonthlyReportPoint[]
  paymentMethods: PaymentMethodBreakdown[]
  expenseCategories: ExpenseCategoryBreakdown[]
}

/**
 * Input for creating or updating a member. Validation is enforced in the main
 * process; the renderer only collects and forwards this data.
 */
export interface PlanInput {
  name: string
  durationDays: number
  price: number
  description: string | null
  isActive: boolean
}

export interface SubscriptionInput {
  memberId: number
  planId: number
  startDate: string
  endDate: string
  price: number
  discount: number
  paymentAmount: number
  paymentMethod: string
  paymentDate: string
  paymentNotes: string | null
  subscriptionNotes: string | null
}

export interface MemberInput {
  fullName: string
  phone: string
  secondaryPhone: string | null
  address: string | null
  gender: Gender | null
  dateOfBirth: string | null
  emergencyContact: string | null
  notes: string | null
  registrationDate: string
  photoData: string | null
}

/** Read-only analytics surface exposed through the preload bridge. */
export interface AnalyticsApi {
  getSnapshot: () => Promise<WorkspaceSnapshot>
  getRangeReport: (from: string, to: string) => Promise<AnalyticsRangeReport>
}
