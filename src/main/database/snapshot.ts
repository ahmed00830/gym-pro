import type {
  AttendanceRecord,
  AttendanceSeriesPoint,
  ExpenseCategory,
  ExpenseCategoryBreakdown,
  ExpenseRecord,
  FreezeRecord,
  MemberRecord,
  MemberStatus,
  MemberStatusCount,
  MonthlyReportPoint,
  NotificationRecord,
  PaymentMethodBreakdown,
  PaymentRecord,
  PlanRecord,
  RenewalRecord,
  SettingRecord,
  SubscriptionRecord,
  WorkspaceSnapshot,
  WorkspaceTotals
} from '../../shared/analytics'
import { addDaysToLocalIsoDate, toLocalIsoDate, toUtcIsoTimestamp } from './date-time'
import type { SqliteDatabase } from './connection'

const MEMBER_STATUSES: readonly MemberStatus[] = [
  'active',
  'inactive',
  'frozen',
  'expired',
  'blocked',
  'archived'
]

function readCount(
  database: SqliteDatabase,
  sql: string,
  ...params: Array<string | number>
): number {
  const row = database.prepare(sql).get(...params) as
    | { value: number | null }
    | undefined

  return Number(row?.value ?? 0)
}

/**
 * Produces the read-only workspace snapshot from the existing schema.
 *
 * Everything here is derived from stored rows. An empty database yields zero
 * totals and empty collections — no demonstration records are inserted and no
 * statistics are invented.
 */
export function readWorkspaceSnapshot(
  database: SqliteDatabase
): WorkspaceSnapshot {
  const today = toLocalIsoDate()
  const monthStart = `${today.slice(0, 7)}-01`
  const weekStart = addDaysToLocalIsoDate(today, -6)
  const weekEnd = today
  const expiringEnd = addDaysToLocalIsoDate(today, 7)

  const todayDate = new Date()
  const reportMonths: string[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const anchor = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth() - offset,
      1,
      12,
      0,
      0,
      0
    )
    reportMonths.push(
      `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`
    )
  }

  const reportStart = `${reportMonths[0]}-01`

  const totals: WorkspaceTotals = {
    totalRevenue: readCount(database, 'SELECT COALESCE(SUM(amount), 0) AS value FROM payments'),
    revenueThisMonth: readCount(
      database,
      'SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE payment_date >= ?',
      monthStart
    ),
    revenueToday: readCount(
      database,
      'SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE payment_date = ?',
      today
    ),
    totalExpenses: readCount(
      database,
      "SELECT COALESCE(SUM(amount), 0) AS value FROM expenses WHERE status = 'active'"
    ),
    expensesThisMonth: readCount(
      database,
      "SELECT COALESCE(SUM(amount), 0) AS value FROM expenses WHERE expense_date >= ? AND status = 'active'",
      monthStart
    ),
    totalPayments: readCount(database, 'SELECT COUNT(*) AS value FROM payments'),
    totalExpenseEntries: readCount(
      database,
      "SELECT COUNT(*) AS value FROM expenses WHERE status = 'active'"
    ),
    expensesToday: readCount(
      database,
      "SELECT COALESCE(SUM(amount), 0) AS value FROM expenses WHERE expense_date = ? AND status = 'active'",
      today
    ),
    activeMembers: readCount(
      database,
      "SELECT COUNT(*) AS value FROM members WHERE status = 'active'"
    ),
    totalMembers: readCount(database, 'SELECT COUNT(*) AS value FROM members'),
    newRegistrations: readCount(
      database,
      'SELECT COUNT(*) AS value FROM members WHERE registration_date >= ?',
      monthStart
    ),
    todayAttendance: readCount(
      database,
      'SELECT COUNT(*) AS value FROM attendance WHERE check_in_date = ?',
      today
    ),
    attendanceThisMonth: readCount(
      database,
      'SELECT COUNT(*) AS value FROM attendance WHERE check_in_date >= ?',
      monthStart
    ),
    totalAttendance: readCount(database, 'SELECT COUNT(*) AS value FROM attendance'),
    membershipRenewals: readCount(
      database,
      `SELECT COUNT(*) AS value
       FROM subscriptions s
       WHERE s.start_date >= ?
         AND EXISTS (
           SELECT 1
           FROM subscriptions earlier
           WHERE earlier.member_id = s.member_id
             AND (
               earlier.start_date < s.start_date
               OR (earlier.start_date = s.start_date AND earlier.id < s.id)
             )
         )`,
      monthStart
    ),
    totalRenewals: readCount(
      database,
      `SELECT COUNT(*) AS value
       FROM subscriptions s
       WHERE EXISTS (
         SELECT 1
         FROM subscriptions earlier
         WHERE earlier.member_id = s.member_id
           AND (
             earlier.start_date < s.start_date
             OR (earlier.start_date = s.start_date AND earlier.id < s.id)
           )
       )`
    ),
    expiringMemberships: readCount(
      database,
      `SELECT COUNT(DISTINCT member_id) AS value
       FROM subscriptions
       WHERE status = 'active'
         AND end_date >= ?
         AND end_date <= ?`,
      today,
      expiringEnd
    ),
    activeSubscriptions: readCount(
      database,
      "SELECT COUNT(*) AS value FROM subscriptions WHERE status = 'active'"
    ),
    totalSubscriptions: readCount(database, 'SELECT COUNT(*) AS value FROM subscriptions'),
    totalPlans: readCount(database, 'SELECT COUNT(*) AS value FROM membership_plans'),
    activePlans: readCount(
      database,
      'SELECT COUNT(*) AS value FROM membership_plans WHERE is_active = 1'
    ),
    unreadNotifications: readCount(
      database,
      'SELECT COUNT(*) AS value FROM notifications WHERE is_read = 0'
    )
  }

  const attendanceRows = database
    .prepare(
      `SELECT check_in_date AS date, COUNT(*) AS attendance
       FROM attendance
       WHERE check_in_date BETWEEN ? AND ?
       GROUP BY check_in_date`
    )
    .all(weekStart, weekEnd) as Array<{ date: string; attendance: number }>

  const registrationRows = database
    .prepare(
      `SELECT registration_date AS date, COUNT(*) AS registrations
       FROM members
       WHERE registration_date BETWEEN ? AND ?
       GROUP BY registration_date`
    )
    .all(weekStart, weekEnd) as Array<{ date: string; registrations: number }>

  const attendanceByDate = new Map(
    attendanceRows.map((row) => [row.date, Number(row.attendance)])
  )
  const registrationsByDate = new Map(
    registrationRows.map((row) => [row.date, Number(row.registrations)])
  )
  const attendanceSeries: AttendanceSeriesPoint[] = []

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysToLocalIsoDate(weekStart, offset)
    attendanceSeries.push({
      date,
      attendance: attendanceByDate.get(date) ?? 0,
      registrations: registrationsByDate.get(date) ?? 0
    })
  }

  const members = database
    .prepare(
      `SELECT id, member_code, member_number, full_name, phone, secondary_phone, address,
              gender, date_of_birth, registration_date, emergency_contact,
              notes, status, photo_data, created_at, updated_at
       FROM members
       ORDER BY registration_date DESC, id DESC`
    )
    .all() as Array<{
    id: number
    member_code: string
    member_number: number
    full_name: string
    phone: string | null
    secondary_phone: string | null
    address: string | null
    gender: MemberRecord['gender']
    date_of_birth: string | null
    registration_date: string
    emergency_contact: string | null
    notes: string | null
    status: MemberStatus
    photo_data: string | null
    created_at: string
    updated_at: string
  }>

  const statusCountRows = database
    .prepare(
      `SELECT status, COUNT(*) AS count
       FROM members
       GROUP BY status`
    )
    .all() as Array<{ status: MemberStatus; count: number }>
  const statusCounts = new Map(
    statusCountRows.map((row) => [row.status, Number(row.count)])
  )
  const memberStatusCounts: MemberStatusCount[] = MEMBER_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0
  }))

  const planRows = database
    .prepare(
      `SELECT p.id, p.name, p.duration_days, p.price, p.description, p.is_active,
              (
                SELECT COUNT(*)
                FROM subscriptions s
                WHERE s.plan_id = p.id AND s.status = 'active'
              ) AS active_subscribers
       FROM membership_plans p
       ORDER BY p.is_active DESC, p.price ASC, p.id ASC`
    )
    .all() as Array<{
    id: number
    name: string
    duration_days: number
    price: number
    description: string | null
    is_active: number
    active_subscribers: number
  }>

  const subscriptionRows = database
    .prepare(
      `SELECT s.id, s.member_id, m.member_number, m.member_code, m.full_name AS member_name,
              s.plan_id, COALESCE(s.plan_name, p.name) AS plan_name,
              COALESCE(s.duration_days, p.duration_days) AS duration_days,
              s.start_date, s.end_date,
              s.price, s.discount, s.final_price, s.status,
              s.freeze_start_date, s.freeze_end_date, s.freeze_reason
       FROM subscriptions s
       JOIN members m ON m.id = s.member_id
       JOIN membership_plans p ON p.id = s.plan_id
       ORDER BY s.start_date DESC, s.id DESC`
    )
    .all() as Array<{
    id: number
    member_id: number
    member_number: number
    member_code: string
    member_name: string
    plan_id: number
    plan_name: string
    duration_days: number
    start_date: string
    end_date: string
    price: number
    discount: number
    final_price: number
    status: SubscriptionRecord['status']
    freeze_start_date: string | null
    freeze_end_date: string | null
    freeze_reason: string | null
  }>

  const renewalRows = database
    .prepare(
      `WITH ranked AS (
         SELECT s.*,
                ROW_NUMBER() OVER (
                  PARTITION BY s.member_id
                  ORDER BY s.start_date ASC, s.id ASC
                ) AS renewal_number
         FROM subscriptions s
       )
       SELECT r.id, r.member_id, m.member_number, m.member_code, m.full_name AS member_name,
               r.plan_id, COALESCE(r.plan_name, p.name) AS plan_name,
               COALESCE(r.duration_days, p.duration_days) AS duration_days,
               r.start_date, r.end_date,
              r.price, r.discount, r.final_price, r.status,
              r.freeze_start_date, r.freeze_end_date, r.freeze_reason,
              r.renewal_number
       FROM ranked r
       JOIN members m ON m.id = r.member_id
       JOIN membership_plans p ON p.id = r.plan_id
       WHERE r.renewal_number > 1
       ORDER BY r.start_date DESC, r.id DESC`
    )
    .all() as Array<{
    id: number
    member_id: number
    member_number: number
    member_code: string
    member_name: string
    plan_id: number
    plan_name: string
    duration_days: number
    start_date: string
    end_date: string
    price: number
    discount: number
    final_price: number
    status: SubscriptionRecord['status']
    freeze_start_date: string | null
    freeze_end_date: string | null
    freeze_reason: string | null
    renewal_number: number
  }>

  const paymentRows = database
    .prepare(
      `SELECT p.id, p.member_id, p.subscription_id, m.member_number, m.member_code,
              m.full_name AS member_name,
              COALESCE(s.plan_name, pl.name) AS plan_name,
              (SELECT COUNT(*) FROM subscriptions earlier
               WHERE earlier.member_id = s.member_id
                 AND (earlier.start_date < s.start_date
                   OR (earlier.start_date = s.start_date AND earlier.id < s.id)))
                AS prior_subscriptions,
              p.amount, p.payment_method, p.payment_date, p.notes, p.created_at
       FROM payments p
       JOIN members m ON m.id = p.member_id
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       LEFT JOIN membership_plans pl ON pl.id = s.plan_id
       ORDER BY p.payment_date DESC, p.id DESC`
    )
    .all() as Array<{
    id: number
    member_id: number
    member_number: number
    subscription_id: number | null
    member_code: string
    member_name: string
    plan_name: string | null
    prior_subscriptions: number | null
    amount: number
    payment_method: string
    payment_date: string
    notes: string | null
    created_at: string
  }>

  const attendanceRowsAll = database
    .prepare(
      `SELECT a.id, a.member_id, m.member_number, m.member_code, m.full_name AS member_name,
              a.check_in_date, a.check_in_time, a.created_at
       FROM attendance a
       JOIN members m ON m.id = a.member_id
       ORDER BY a.check_in_date DESC, a.check_in_time DESC, a.id DESC`
    )
    .all() as Array<{
    id: number
    member_id: number
    member_number: number
    member_code: string
    member_name: string
    check_in_date: string
    check_in_time: string
    created_at: string
  }>

  const expenseRows = database
    .prepare(
      `SELECT id, description, category, amount, payment_method, expense_date,
              expense_time, recorded_by, status, notes, created_at
       FROM expenses
       ORDER BY expense_date DESC, expense_time DESC, id DESC`
    )
    .all() as Array<{
    id: number
    description: string
    category: string
    amount: number
    payment_method: string
    expense_date: string
    expense_time: string | null
    recorded_by: string | null
    status: ExpenseRecord['status']
    notes: string | null
    created_at: string
  }>

  const notificationRows = database
    .prepare(
      `SELECT id, type, title, message, severity, is_read, created_at
       FROM notifications
       ORDER BY created_at DESC, id DESC`
    )
    .all() as Array<{
    id: number
    type: string
    title: string
    message: string
    severity: NotificationRecord['severity']
    is_read: number
    created_at: string
  }>

  const settingRows = database
    .prepare(
      `SELECT "key", value, value_type, updated_at
       FROM settings
       ORDER BY "key" ASC`
    )
    .all() as Array<{
    key: string
    value: string
    value_type: SettingRecord['valueType']
    updated_at: string
  }>

  const monthlyRevenueRows = database
    .prepare(
      `SELECT substr(payment_date, 1, 7) AS month,
              COALESCE(SUM(amount), 0) AS revenue
       FROM payments
       WHERE payment_date >= ?
       GROUP BY month`
    )
    .all(reportStart) as Array<{ month: string; revenue: number }>

  const monthlyExpenseRows = database
    .prepare(
      `SELECT substr(expense_date, 1, 7) AS month,
              COALESCE(SUM(amount), 0) AS expenses
       FROM expenses
       WHERE expense_date >= ? AND status = 'active'
       GROUP BY month`
    )
    .all(reportStart) as Array<{ month: string; expenses: number }>

  const monthlyMemberRows = database
    .prepare(
      `SELECT substr(registration_date, 1, 7) AS month,
              COUNT(*) AS new_members
       FROM members
       WHERE registration_date >= ?
       GROUP BY month`
    )
    .all(reportStart) as Array<{ month: string; new_members: number }>

  const revenueByMonth = new Map(
    monthlyRevenueRows.map((row) => [row.month, Number(row.revenue)])
  )
  const expensesByMonth = new Map(
    monthlyExpenseRows.map((row) => [row.month, Number(row.expenses)])
  )
  const membersByMonth = new Map(
    monthlyMemberRows.map((row) => [row.month, Number(row.new_members)])
  )
  const monthlyReport: MonthlyReportPoint[] = reportMonths.map((month) => ({
    month,
    revenue: revenueByMonth.get(month) ?? 0,
    expenses: expensesByMonth.get(month) ?? 0,
    newMembers: membersByMonth.get(month) ?? 0
  }))

  const paymentMethods = database
    .prepare(
      `SELECT payment_method AS method, COUNT(*) AS count,
              COALESCE(SUM(amount), 0) AS total
       FROM payments
       GROUP BY payment_method
       ORDER BY total DESC, method ASC`
    )
    .all() as PaymentMethodBreakdown[]

  const expenseCategories = database
    .prepare(
      `SELECT category, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE status = 'active'
       GROUP BY category
       ORDER BY total DESC, category ASC`
    )
    .all() as ExpenseCategoryBreakdown[]

  const membersResult: MemberRecord[] = members.map((row) => ({
    id: row.id,
    memberCode: row.member_code,
    memberNumber: row.member_number,
    fullName: row.full_name,
    phone: row.phone,
    secondaryPhone: row.secondary_phone,
    address: row.address,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    registrationDate: row.registration_date,
    emergencyContact: row.emergency_contact,
    notes: row.notes,
    status: row.status,
    photoData: row.photo_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  const plans: PlanRecord[] = planRows.map((row) => ({
    id: row.id,
    name: row.name,
    durationDays: row.duration_days,
    price: row.price,
    description: row.description,
    isActive: row.is_active === 1,
    activeSubscribers: Number(row.active_subscribers)
  }))

  const paidBySubscription = new Map<number, number>()
  const paidRows = database
    .prepare(
      `SELECT subscription_id AS id, COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE subscription_id IS NOT NULL
       GROUP BY subscription_id`
    )
    .all() as Array<{ id: number; total: number }>
  for (const row of paidRows) {
    paidBySubscription.set(row.id, Number(row.total))
  }

  const subscriptions: SubscriptionRecord[] = subscriptionRows.map((row) => {
    const paidAmount = paidBySubscription.get(row.id) ?? 0
    return {
      id: row.id,
      memberId: row.member_id,
      memberNumber: row.member_number,
      memberCode: row.member_code,
      memberName: row.member_name,
      planId: row.plan_id,
      planName: row.plan_name,
      durationDays: row.duration_days,
      startDate: row.start_date,
      endDate: row.end_date,
      price: row.price,
      discount: row.discount,
      finalPrice: row.final_price,
      status: row.status,
      paidAmount,
      balance: Math.max(0, row.final_price - paidAmount),
      freezeStartDate: row.freeze_start_date,
      freezeEndDate: row.freeze_end_date,
      freezeReason: row.freeze_reason
    }
  })

  const renewals: RenewalRecord[] = renewalRows.map((row) => {
    const paidAmount = paidBySubscription.get(row.id) ?? 0
    return {
      id: row.id,
      memberId: row.member_id,
      memberNumber: row.member_number,
      memberCode: row.member_code,
      memberName: row.member_name,
      planId: row.plan_id,
      planName: row.plan_name,
      startDate: row.start_date,
      durationDays: row.duration_days,
      endDate: row.end_date,
      price: row.price,
      discount: row.discount,
      finalPrice: row.final_price,
      status: row.status,
      paidAmount,
      balance: Math.max(0, row.final_price - paidAmount),
      freezeStartDate: row.freeze_start_date,
      freezeEndDate: row.freeze_end_date,
      freezeReason: row.freeze_reason,
      renewalNumber: row.renewal_number
    }
  })

  const freezeRows = database
    .prepare(
      `SELECT id, subscription_id, start_date, end_date, reason, created_at
       FROM subscription_freezes
       ORDER BY start_date DESC, id DESC`
    )
    .all() as Array<{
    id: number
    subscription_id: number
    start_date: string
    end_date: string | null
    reason: string | null
    created_at: string
  }>

  const freezes: FreezeRecord[] = freezeRows.map((row) => ({
    id: row.id,
    subscriptionId: row.subscription_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    createdAt: row.created_at
  }))

  const payments: PaymentRecord[] = paymentRows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberNumber: row.member_number,
    subscriptionId: row.subscription_id,
    memberCode: row.member_code,
    memberName: row.member_name,
    planName: row.plan_name,
    paymentType: Number(row.prior_subscriptions ?? 0) > 0 ? 'renewal' : 'new',
    amount: row.amount,
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date,
    notes: row.notes,
    createdAt: row.created_at
  }))

  const attendance: AttendanceRecord[] = attendanceRowsAll.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberNumber: row.member_number,
    memberCode: row.member_code,
    memberName: row.member_name,
    checkInDate: row.check_in_date,
    checkInTime: row.check_in_time,
    createdAt: row.created_at
  }))

  const expenses: ExpenseRecord[] = expenseRows.map((row) => ({
    id: row.id,
    description: row.description,
    category: row.category,
    amount: row.amount,
    paymentMethod: row.payment_method,
    expenseDate: row.expense_date,
    expenseTime: row.expense_time,
    recordedBy: row.recorded_by,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at
  }))

  const notifications: NotificationRecord[] = notificationRows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    isRead: row.is_read === 1,
    createdAt: row.created_at
  }))

  const settings: SettingRecord[] = settingRows.map((row) => ({
    key: row.key,
    value: row.value,
    valueType: row.value_type,
    updatedAt: row.updated_at
  }))

  const catalogRows = database
    .prepare(
      `SELECT key, name_ar, name_en, is_active, sort_order
       FROM expense_categories
       ORDER BY sort_order ASC, key ASC`
    )
    .all() as Array<{
    key: string
    name_ar: string
    name_en: string
    is_active: number
    sort_order: number
  }>

  const expenseCatalog: ExpenseCategory[] = catalogRows.map((row) => ({
    key: row.key,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order
  }))

  return {
    generatedAt: toUtcIsoTimestamp(),
    totals,
    attendanceSeries,
    members: membersResult,
    memberStatusCounts,
    plans,
    subscriptions,
    renewals,
    freezes,
    payments,
    attendance,
    expenses,
    notifications,
    settings,
    expenseCatalog,
    monthlyReport,
    paymentMethods,
    expenseCategories
  }
}
