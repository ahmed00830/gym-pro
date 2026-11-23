import { app } from 'electron'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  rmSync,
  statSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { SqliteDatabase } from '../src/main/database/connection'
import { createDatabaseConnection } from '../src/main/database/connection'
import {
  addDaysToLocalIsoDate,
  toLocalIsoDate
} from '../src/main/database/date-time'
import { GymProDatabase } from '../src/main/database/GymProDatabase'
import { listAppliedMigrations, runMigrations } from '../src/main/database/migrate'
import { MIGRATIONS } from '../src/main/database/migrations'

const TEST_ROOT = join(tmpdir(), 'gympro-database-foundation-tests')
const TEST_DB_PATH = join(TEST_ROOT, 'persistence', 'gym-pro.db')
const PHASE = process.argv.includes('verify') ? 'verify' : 'seed'

const APPLICATION_TABLES = [
  'activity_logs',
  'attendance',
  'expenses',
  'expense_categories',
  'members',
  'member_number_sequence',
  'membership_plans',
  'notifications',
  'payments',
  'settings',
  'subscriptions',
  'users'
] as const

let passed = 0
let failed = 0

function runTest(name: string, test: () => void): void {
  try {
    test()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(error instanceof Error ? error.stack : error)
  }
}

function getTableNames(database: SqliteDatabase): string[] {
  return (
    database
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name)
}

function getCount(database: SqliteDatabase, table: string): number {
  const allowedTables = new Set<string>([
    ...APPLICATION_TABLES,
    'schema_migrations'
  ])

  if (!allowedTables.has(table)) {
    throw new Error(`Invalid test table: ${table}`)
  }

  return (
    database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number
    }
  ).count
}

function isoDateRegex(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function utcTimestampRegex(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
}

function seedPhase(): void {
  rmSync(TEST_ROOT, { recursive: true, force: true })
  mkdirSync(TEST_ROOT, { recursive: true })

  let service: GymProDatabase | null = null
  let inspection: SqliteDatabase | null = null

  const closeResources = (): void => {
    if (inspection) inspection.close()
    if (service) service.close()
  }

  try {
    runTest('fresh database reports pending, then initializes', () => {
      service = new GymProDatabase(TEST_DB_PATH)

      const before = service.getInitializationStatus()
      assert.equal(before.state, 'pending')
      assert.equal(before.initialized, false)
      assert.equal(before.schemaVersion, 0)
      assert.equal(before.targetSchemaVersion, 9)
      assert.equal(before.pendingMigrationCount, 9)

      const after = service.initialize()
      assert.equal(after.state, 'ready')
      assert.equal(after.initialized, true)
      assert.equal(after.schemaVersion, 9)
      assert.equal(after.pendingMigrationCount, 0)
      assert.equal(after.appliedMigrations.length, 9)
      assert.equal(after.error, null)
      assert.equal(existsSync(TEST_DB_PATH), true)

      const health = service.healthCheck()
      assert.equal(health.ok, true)
      assert.equal(health.integrityCheck, 'ok')
      assert.equal(health.foreignKeysEnabled, true)
      assert.equal(health.foreignKeyViolations, 0)
      assert.equal(health.journalMode, 'wal')

      const info = service.getInfo()
      assert.equal(info.engine, 'SQLite')
      assert.equal(info.fileName, 'gym-pro.db')
      assert.equal(info.filePath, TEST_DB_PATH)
      assert.equal(info.schemaVersion, 9)
      assert.equal(info.applicationTableCount, 13)
      assert.equal(info.foreignKeysEnabled, true)
      assert.equal(info.journalMode, 'wal')
      assert.match(info.sqliteVersion, /^3\.\d+\.\d+$/)
      assert.ok(info.sizeBytes > 0)
      assert.ok(info.pageSize > 0)
      assert.ok(info.initializedAt && utcTimestampRegex(info.initializedAt))
    })

    runTest('all required tables, indexes, and migration history exist', () => {
      assert.ok(service)
      inspection = createDatabaseConnection(TEST_DB_PATH)
      const tables = getTableNames(inspection)

      for (const table of APPLICATION_TABLES) {
        assert.ok(tables.includes(table), `Missing table: ${table}`)
      }

      assert.ok(tables.includes('schema_migrations'))
      const history = listAppliedMigrations(inspection)
      assert.deepEqual(
        history.map((migration) => ({
          version: migration.version,
          name: migration.name
        })),
        [
          { version: 1, name: 'core_schema' },
          { version: 2, name: 'system_tables' },
          { version: 3, name: 'member_photo' },
          { version: 4, name: 'subscription_freezes' },
          { version: 5, name: 'attendance_unique_member_date' },
          { version: 6, name: 'member_numbers' },
          { version: 7, name: 'subscription_history_snapshots' },
          { version: 8, name: 'expenses_hardening' },
          { version: 9, name: 'expense_categories' }
        ]
      )
      assert.ok(history.every((migration) => utcTimestampRegex(migration.appliedAt)))

      const foreignKeys = inspection.pragma('foreign_keys', {
        simple: true
      })
      assert.equal(foreignKeys, 1)
    })

    runTest('migrations apply stepwise in order and are idempotent', () => {
      const stepPath = join(TEST_ROOT, 'stepwise', 'stepwise.db')
      const stepDatabase = createDatabaseConnection(stepPath)

      try {
        const first = runMigrations(stepDatabase, MIGRATIONS.slice(0, 1))
        assert.equal(first.fromVersion, 0)
        assert.equal(first.toVersion, 1)
        assert.deepEqual(
          first.appliedMigrations.map((migration) => migration.version),
          [1]
        )

        const afterFirst = getTableNames(stepDatabase)
        assert.ok(afterFirst.includes('members'))
        assert.ok(afterFirst.includes('subscriptions'))
        assert.ok(afterFirst.includes('expenses'))
        assert.equal(afterFirst.includes('users'), false)
        assert.equal(afterFirst.includes('notifications'), false)

        const second = runMigrations(stepDatabase, MIGRATIONS)
        assert.equal(second.fromVersion, 1)
        assert.equal(second.toVersion, 9)
        assert.deepEqual(
          second.appliedMigrations.map((migration) => migration.version),
          [2, 3, 4, 5, 6, 7, 8, 9]
        )

        const afterSecond = getTableNames(stepDatabase)
        for (const table of APPLICATION_TABLES) {
          assert.ok(afterSecond.includes(table), `Missing table: ${table}`)
        }

        const noOp = runMigrations(stepDatabase, MIGRATIONS)
        assert.equal(noOp.fromVersion, 9)
        assert.equal(noOp.toVersion, 9)
        assert.deepEqual(noOp.appliedMigrations, [])
      } finally {
        stepDatabase.close()
      }
    })

    runTest('member codes are generated, unique, and never reused', () => {
      assert.ok(inspection)
      const insertMember = inspection.prepare(
        `INSERT INTO members (full_name, phone, notes)
         VALUES (?, ?, ?)`
      )

      const marker = insertMember.run(
        'Persistence Marker',
        '01000000000',
        'persistence-marker'
      )
      const second = insertMember.run('Second Member', '01111111111', null)
      assert.equal(Number(marker.lastInsertRowid), 1)
      assert.equal(Number(second.lastInsertRowid), 2)

      const firstCodes = inspection
        .prepare('SELECT member_code FROM members ORDER BY id ASC')
        .all() as Array<{ member_code: string }>
      assert.deepEqual(
        firstCodes.map((row) => row.member_code),
        ['GYM-000001', 'GYM-000002']
      )

      const uniqueCodes = (
        inspection
          .prepare(
            'SELECT COUNT(DISTINCT member_code) AS count FROM members'
          )
          .get() as { count: number }
      ).count
      assert.equal(uniqueCodes, firstCodes.length)

      const indexes = inspection.prepare("PRAGMA index_list('members')").all() as Array<{
        name: string
        unique: number
      }>
      const uniqueIndexes = indexes.filter((index) => index.unique === 1)
      const indexColumns = (indexName: string): string[] =>
        (
          inspection!
            .prepare(`PRAGMA index_info(${JSON.stringify(indexName)})`)
            .all() as Array<{ name: string }>
        ).map((column) => column.name)

      const codeIndex = uniqueIndexes.find(
        (index) =>
          JSON.stringify(indexColumns(index.name)) ===
          JSON.stringify(['member_code'])
      )
      assert.ok(codeIndex, 'member_code must have a UNIQUE index')

      const numberIndex = uniqueIndexes.find(
        (index) =>
          JSON.stringify(indexColumns(index.name)) ===
          JSON.stringify(['member_number'])
      )
      assert.ok(numberIndex, 'member_number must have a UNIQUE index')

      assert.throws(
        () =>
          inspection!
            .prepare(
              `INSERT INTO members (member_code, full_name)
               VALUES (?, ?)`
            )
            .run('GYM-000001', 'Forbidden Duplicate'),
        /generated column/i
      )

      inspection.prepare('DELETE FROM members WHERE id = ?').run(2)
      insertMember.run('Third Member', '01222222222', null)

      const thirdCode = (
        inspection
          .prepare('SELECT member_code FROM members WHERE id = ?')
          .get(3) as { member_code: string }
      ).member_code
      assert.equal(thirdCode, 'GYM-000003')
      assert.notEqual(thirdCode, 'GYM-000002')
    })

    runTest('foreign keys and financial history protections are enforced', () => {
      assert.ok(inspection)
      const today = toLocalIsoDate()
      const endDate = addDaysToLocalIsoDate(today, 30)

      const planId = Number(
        inspection
          .prepare(
            `INSERT INTO membership_plans
               (name, duration_days, price, description)
             VALUES (?, ?, ?, ?)`
          )
          .run('Monthly Standard', 30, 500, 'Integration test plan')
          .lastInsertRowid
      )

      const subscriptionId = Number(
        inspection
          .prepare(
            `INSERT INTO subscriptions
               (member_id, plan_id, start_date, end_date, price,
                discount, final_price, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(1, planId, today, endDate, 500, 50, 450, 'active')
          .lastInsertRowid
      )

      const paymentId = Number(
        inspection
          .prepare(
            `INSERT INTO payments
               (member_id, subscription_id, amount, payment_method,
                payment_date, notes)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(1, subscriptionId, 450, 'cash', today, 'Persistence payment')
          .lastInsertRowid
      )

      inspection
        .prepare('INSERT INTO attendance (member_id) VALUES (?)')
        .run(1)
      inspection
        .prepare(
          `INSERT INTO expenses
             (description, category, amount, payment_method)
           VALUES (?, ?, ?, ?)`
        )
        .run('Test expense', 'operations', 75, 'cash')

      const insertSubscription = inspection.prepare(
        `INSERT INTO subscriptions
           (member_id, plan_id, start_date, end_date, price,
            discount, final_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )

      assert.throws(
        () =>
          insertSubscription.run(
            999_999,
            planId,
            today,
            endDate,
            500,
            0,
            500,
            'active'
          ),
        /FOREIGN KEY constraint failed/
      )

      assert.throws(
        () =>
          inspection!
            .prepare(
              `INSERT INTO payments
                 (member_id, subscription_id, amount, payment_method)
               VALUES (?, ?, ?, ?)`
            )
            .run(1, 999_999, 10, 'cash'),
        /FOREIGN KEY constraint failed/
      )

      assert.throws(
        () =>
          inspection!
            .prepare('DELETE FROM members WHERE id = ?')
            .run(1),
        /FOREIGN KEY constraint failed/
      )

      assert.throws(
        () =>
          inspection!
            .prepare('DELETE FROM membership_plans WHERE id = ?')
            .run(planId),
        /FOREIGN KEY constraint failed/
      )

      assert.throws(
        () =>
          inspection!
            .prepare('DELETE FROM subscriptions WHERE id = ?')
            .run(subscriptionId),
        /Subscription history cannot be deleted/
      )

      assert.throws(
        () =>
          inspection!
            .prepare('DELETE FROM payments WHERE id = ?')
            .run(paymentId),
        /Payment history cannot be deleted/
      )

      const violations = inspection.pragma('foreign_key_check') as unknown[]
      assert.equal(violations.length, 0)
    })

    runTest('support tables work and activity logs preserve anonymous history', () => {
      assert.ok(inspection)
      const userId = Number(
        inspection
          .prepare(
            `INSERT INTO users (username, password_hash, full_name, role)
             VALUES (?, ?, ?, ?)`
          )
          .run(
            'test.operator',
            '$argon2id$integration-test-placeholder',
            'Test Operator',
            'admin'
          ).lastInsertRowid
      )

      inspection
        .prepare(
          `INSERT INTO settings ("key", value, value_type)
           VALUES (?, ?, ?)`
        )
        .run('locale', 'ar', 'string')

      inspection
        .prepare(
          `INSERT INTO notifications
             (type, title, message, severity, related_entity_type,
              related_entity_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('test', 'Integration test', 'Notification storage works.', 'info', 'member', 1)

      const logId = Number(
        inspection
          .prepare(
            `INSERT INTO activity_logs
               (user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(userId, 'test.action', 'member', 1, '{"test":true}')
          .lastInsertRowid
      )

      inspection.prepare('DELETE FROM users WHERE id = ?').run(userId)
      const log = inspection
        .prepare('SELECT user_id FROM activity_logs WHERE id = ?')
        .get(logId) as { user_id: number | null }
      assert.equal(log.user_id, null)

      assert.equal(getCount(inspection, 'settings'), 1)
      assert.equal(getCount(inspection, 'notifications'), 1)
      assert.equal(getCount(inspection, 'activity_logs'), 1)
    })

    runTest('workspace snapshot reports stored records without writing data', () => {
      assert.ok(service)
      assert.ok(inspection)
      const membersBefore = getCount(inspection, 'members')
      const snapshot = service.getWorkspaceSnapshot()

      assert.match(
        snapshot.generatedAt,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
      assert.equal(snapshot.totals.totalRevenue, 450)
      assert.equal(snapshot.totals.revenueThisMonth, 450)
      assert.equal(snapshot.totals.totalExpenses, 75)
      assert.equal(snapshot.totals.expensesThisMonth, 75)
      assert.equal(snapshot.totals.totalPayments, 1)
      assert.equal(snapshot.totals.totalExpenseEntries, 1)
      assert.equal(snapshot.totals.activeMembers, 2)
      assert.equal(snapshot.totals.totalMembers, 2)
      assert.equal(snapshot.totals.newRegistrations, 2)
      assert.equal(snapshot.totals.todayAttendance, 1)
      assert.equal(snapshot.totals.attendanceThisMonth, 1)
      assert.equal(snapshot.totals.totalAttendance, 1)
      assert.equal(snapshot.totals.membershipRenewals, 0)
      assert.equal(snapshot.totals.totalRenewals, 0)
      assert.equal(snapshot.totals.expiringMemberships, 0)
      assert.equal(snapshot.totals.activeSubscriptions, 1)
      assert.equal(snapshot.totals.totalSubscriptions, 1)
      assert.equal(snapshot.totals.totalPlans, 1)
      assert.equal(snapshot.totals.activePlans, 1)
      assert.equal(snapshot.totals.unreadNotifications, 1)

      assert.equal(snapshot.members.length, 2)
      assert.equal(snapshot.members[0].memberCode, 'GYM-000003')
      assert.equal(snapshot.memberStatusCounts.length, 6)
      assert.equal(
        snapshot.memberStatusCounts.find((entry) => entry.status === 'active')
          ?.count,
        2
      )
      assert.equal(snapshot.plans.length, 1)
      assert.equal(snapshot.plans[0].activeSubscribers, 1)
      assert.equal(snapshot.subscriptions.length, 1)
      assert.equal(snapshot.subscriptions[0].memberName, 'Persistence Marker')
      assert.equal(snapshot.subscriptions[0].planName, 'Monthly Standard')
      assert.equal(snapshot.renewals.length, 0)
      assert.equal(snapshot.payments.length, 1)
      assert.equal(snapshot.payments[0].amount, 450)
      assert.equal(snapshot.payments[0].paymentMethod, 'cash')
      assert.equal(snapshot.attendance.length, 1)
      assert.equal(snapshot.attendance[0].memberCode, 'GYM-000001')
      assert.equal(snapshot.expenses.length, 1)
      assert.equal(snapshot.expenses[0].category, 'operations')
      assert.equal(snapshot.notifications.length, 1)
      assert.equal(snapshot.notifications[0].isRead, false)
      assert.equal(snapshot.settings.length, 1)
      assert.equal(snapshot.settings[0].value, 'ar')

      assert.equal(snapshot.attendanceSeries.length, 7)
      assert.equal(snapshot.attendanceSeries[6].attendance, 1)
      assert.equal(snapshot.attendanceSeries[6].registrations, 2)
      assert.equal(snapshot.monthlyReport.length, 6)
      assert.equal(
        snapshot.monthlyReport[5].month,
        toLocalIsoDate().slice(0, 7)
      )
      assert.equal(snapshot.monthlyReport[5].revenue, 450)
      assert.equal(snapshot.monthlyReport[5].expenses, 75)
      assert.equal(snapshot.monthlyReport[5].newMembers, 2)

      assert.deepEqual(snapshot.paymentMethods, [
        { method: 'cash', count: 1, total: 450 }
      ])
      assert.deepEqual(snapshot.expenseCategories, [
        { category: 'operations', count: 1, total: 75 }
      ])

      assert.equal(getCount(inspection, 'members'), membersBefore)
    })

    runTest('related writes roll back atomically on failure', () => {
      assert.ok(inspection)
      const expensesBefore = getCount(inspection, 'expenses')
      const plansBefore = getCount(inspection, 'membership_plans')

      const failingTransaction = inspection.transaction(() => {
        inspection!
          .prepare(
            `INSERT INTO expenses
               (description, category, amount, payment_method)
             VALUES (?, ?, ?, ?)`
          )
          .run('Rolled back expense', 'test', 1, 'cash')

        inspection!
          .prepare(
            `INSERT INTO membership_plans
               (name, duration_days, price)
             VALUES (?, ?, ?)`
          )
          .run('Rolled back plan', 1, 1)

        throw new Error('forced rollback')
      })

      assert.throws(failingTransaction, /forced rollback/)
      assert.equal(getCount(inspection, 'expenses'), expensesBefore)
      assert.equal(getCount(inspection, 'membership_plans'), plansBefore)
    })

    runTest('local business dates and UTC audit timestamps are consistent', () => {
      assert.ok(inspection)
      assert.equal(toLocalIsoDate(new Date(2026, 10, 12, 23, 30)), '2026-11-12')
      assert.equal(
        addDaysToLocalIsoDate('2026-11-12', 30),
        '2026-12-12'
      )

      const attendance = inspection
        .prepare(
          `SELECT check_in_date, check_in_time, created_at
           FROM attendance
           ORDER BY id ASC
           LIMIT 1`
        )
        .get() as {
        check_in_date: string
        check_in_time: string
        created_at: string
      }

      assert.ok(isoDateRegex(attendance.check_in_date))
      assert.match(attendance.check_in_time, /^\d{2}:\d{2}:\d{2}$/)
      assert.ok(utcTimestampRegex(attendance.created_at))

      const today = inspection
        .prepare(
          `SELECT check_in_date = date('now', 'localtime') AS is_today
           FROM attendance
           ORDER BY id ASC
           LIMIT 1`
        )
        .get() as { is_today: number }
      assert.equal(today.is_today, 1)

      const marker = inspection
        .prepare(
          `SELECT registration_date, created_at
           FROM members WHERE id = 1`
        )
        .get() as { registration_date: string; created_at: string }
      assert.ok(isoDateRegex(marker.registration_date))
      assert.ok(utcTimestampRegex(marker.created_at))
    })

    runTest('initialized database is ready for a restart', () => {
      assert.equal(existsSync(TEST_DB_PATH), true)
      assert.ok(service)
      assert.equal(service.getInitializationStatus().state, 'ready')
      assert.ok(statSync(TEST_DB_PATH).size > 0)
    })
  } finally {
    closeResources()
  }

  memberNumberSeedPhase()
  subscriptionLifecycleSeedPhase()
  expenseLifecycleSeedPhase()
}

function subscriptionLifecycleSeedPhase(): void {
  const lifecycleDbPath = join(TEST_ROOT, 'lifecycle', 'lifecycle.db')
  mkdirSync(dirname(lifecycleDbPath), { recursive: true })

  let service: GymProDatabase | null = null
  let inspection: SqliteDatabase | null = null

  const closeResources = (): void => {
    if (inspection) inspection.close()
    if (service) service.close()
  }

  const memberInput = (
    fullName: string,
    phone: string
  ): Parameters<GymProDatabase['createMember']>[0] => ({
    fullName,
    phone,
    secondaryPhone: null,
    address: null,
    gender: null,
    dateOfBirth: null,
    emergencyContact: null,
    notes: null,
    registrationDate: toLocalIsoDate(),
    photoData: null
  })

  try {
    runTest('subscription lifecycle: plans, full payment, history, renewals, revenue', () => {
      service = new GymProDatabase(lifecycleDbPath)

      const status = service.initialize()
      assert.equal(status.state, 'ready')
      assert.equal(status.schemaVersion, 9)

      const today = toLocalIsoDate()

      const halfMonth = service.createPlan({
        name: 'Half Month',
        durationDays: 15,
        price: 400,
        description: null,
        isActive: true
      })
      assert.equal(halfMonth.durationDays, 15)

      const member = service.createMember(memberInput('Lifecycle Member', '01000000031'))
      assert.equal(member.memberNumber, 1)

      assert.equal(service.getWorkspaceSnapshot().subscriptions.length, 0)
      assert.throws(
        () =>
          service!.createSubscription({
            memberId: member.id,
            planId: halfMonth.id,
            startDate: today,
            endDate: addDaysToLocalIsoDate(today, 15),
            price: halfMonth.price,
            discount: 0,
            paymentAmount: 150,
            paymentMethod: 'cash',
            paymentDate: today,
            paymentNotes: null,
            subscriptionNotes: null
          }),
        /Full payment is required/
      )
      assert.equal(service.getWorkspaceSnapshot().subscriptions.length, 0)

      const subscription = service.createSubscription({
        memberId: member.id,
        planId: halfMonth.id,
        startDate: today,
        endDate: addDaysToLocalIsoDate(today, 15),
        price: halfMonth.price,
        discount: 0,
        paymentAmount: halfMonth.price,
        paymentMethod: 'card',
        paymentDate: today,
        paymentNotes: null,
        subscriptionNotes: null
      })
      assert.equal(subscription.status, 'active')
      assert.equal(subscription.planName, 'Half Month')
      assert.equal(subscription.durationDays, 15)
      assert.equal(subscription.memberNumber, member.memberNumber)
      assert.equal(subscription.finalPrice, 400)
      assert.equal(subscription.paidAmount, 400)

      service.updatePlan(halfMonth.id, {
        name: 'Renamed Plan',
        durationDays: 30,
        price: 550,
        description: null,
        isActive: true
      })
      const afterEdit = service
        .getWorkspaceSnapshot()
        .subscriptions.find((entry) => entry.id === subscription.id)
      assert.equal(afterEdit?.planName, 'Half Month')
      assert.equal(afterEdit?.durationDays, 15)
      assert.equal(afterEdit?.price, 400)
      assert.equal(afterEdit?.finalPrice, 400)

      const renewed = service.quickRenewSubscription({
        memberId: member.id,
        planId: halfMonth.id,
        paymentMethod: 'card',
        paymentDate: today,
        startDate: null,
        notes: null
      })
      assert.equal(renewed.status, 'active')
      assert.equal(renewed.finalPrice, 550)
      assert.equal(renewed.planName, 'Renamed Plan')
      assert.equal(renewed.durationDays, 30)

      const monthStart = `${today.slice(0, 7)}-01`
      const todayReport = service.getRangeReport(today, today)
      assert.equal(todayReport.collectedRevenue, 950)
      assert.equal(todayReport.subscriptionPayments, 2)
      assert.equal(todayReport.newSubscriptions, 2)
      assert.equal(todayReport.renewals, 1)
      assert.equal(todayReport.expenses, 0)
      assert.equal(todayReport.netRevenue, 950)

      const monthReport = service.getRangeReport(monthStart, today)
      assert.equal(monthReport.collectedRevenue, 950)
      assert.equal(monthReport.newSubscriptions, 2)
      assert.equal(monthReport.renewals, 1)

      const emptyReport = service.getRangeReport(
        addDaysToLocalIsoDate(today, -400),
        addDaysToLocalIsoDate(today, -390)
      )
      assert.equal(emptyReport.collectedRevenue, 0)
      assert.equal(emptyReport.subscriptionPayments, 0)

      assert.throws(
        () => service!.getRangeReport('2026-13-40', today),
        /invalid date/
      )
      assert.throws(
        () => service!.getRangeReport(today, '2020-01-01'),
        /after its end/
      )

      const expenseConnection = createDatabaseConnection(lifecycleDbPath)
      expenseConnection
        .prepare(
          `INSERT INTO expenses (description, category, amount, payment_method)
           VALUES (?, ?, ?, ?)`
        )
        .run('Range smoke expense', 'operations', 75, 'cash')
      expenseConnection.close()

      const withExpense = service.getRangeReport(today, today)
      assert.equal(withExpense.expenses, 75)
      assert.equal(withExpense.netRevenue, 875)

      const snapshot = service.getWorkspaceSnapshot()
      assert.equal(snapshot.subscriptions.length, 2)
      assert.equal(snapshot.payments.length, 2)
      assert.equal(snapshot.renewals.length, 1)
      assert.equal(snapshot.renewals[0].id, renewed.id)
      assert.equal(snapshot.renewals[0].planName, 'Renamed Plan')
      assert.equal(snapshot.totals.totalRevenue, 400 + 550)
      assert.equal(snapshot.totals.revenueThisMonth, 950)
      assert.equal(snapshot.totals.revenueToday, 950)

      inspection = createDatabaseConnection(lifecycleDbPath)
      const stored = inspection
        .prepare('SELECT plan_name, duration_days FROM subscriptions ORDER BY id ASC')
        .all() as Array<{ plan_name: string; duration_days: number }>
      assert.deepEqual(
        stored.map((row) => [row.plan_name, row.duration_days]),
        [
          ['Half Month', 15],
          ['Renamed Plan', 30]
        ]
      )
    })
  } finally {
    closeResources()
  }
}
function memberNumberSeedPhase(): void {
  const memberNumberDbPath = join(TEST_ROOT, 'member-numbers', 'member-numbers.db')
  mkdirSync(dirname(memberNumberDbPath), { recursive: true })

  let service: GymProDatabase | null = null
  let inspection: SqliteDatabase | null = null

  const closeResources = (): void => {
    if (inspection) inspection.close()
    if (service) service.close()
  }

  const memberInput = (
    fullName: string,
    phone: string
  ): Parameters<GymProDatabase['createMember']>[0] => ({
    fullName,
    phone,
    secondaryPhone: null,
    address: null,
    gender: null,
    dateOfBirth: null,
    emergencyContact: null,
    notes: null,
    registrationDate: toLocalIsoDate(),
    photoData: null
  })

  try {
    runTest('member numbers are sequential, permanent, and unique', () => {
      service = new GymProDatabase(memberNumberDbPath)

      const status = service.initialize()
      assert.equal(status.state, 'ready')
      assert.equal(status.schemaVersion, 9)

      inspection = createDatabaseConnection(memberNumberDbPath)

      const plan = service.createPlan({
        name: 'Number Test Plan',
        durationDays: 30,
        price: 500,
        description: null,
        isActive: true
      })

      const first = service.createMember(memberInput('First Member', '01000000001'))
      const second = service.createMember(memberInput('Second Member', '01000000002'))
      assert.equal(first.memberNumber, 1)
      assert.equal(second.memberNumber, 2)

      const renamed = service.updateMember(
        first.id,
        memberInput('First Member Renamed', '01000000001')
      )
      assert.equal(renamed.memberNumber, 1)

      const quick = service.quickRegisterMember({
        fullName: 'Quick Member',
        phone: '01000000003',
        planId: plan.id,
        startDate: toLocalIsoDate(),
        paymentMethod: 'cash',
        paymentDate: toLocalIsoDate(),
        notes: null
      })
      assert.equal(quick.member.memberNumber, 3)

      assert.throws(
        () =>
          inspection!
            .prepare(
              `INSERT INTO members (full_name, member_number)
               VALUES (?, ?)`
            )
            .run('Duplicate Number', 1),
        /UNIQUE constraint failed/
      )

      const sequence = inspection
        .prepare('SELECT last_number FROM member_number_sequence WHERE id = 1')
        .get() as { last_number: number }
      assert.equal(sequence.last_number, 3)
    })

    runTest('attendance requires an active subscription and blocks duplicates', () => {
      assert.ok(service)
      const today = toLocalIsoDate()

      const plan = service!.createPlan({
        name: 'Attendance Test Plan',
        durationDays: 30,
        price: 400,
        description: null,
        isActive: true
      })

      const activeMember = service!.createMember(
        memberInput('Active Attendee', '01000000011')
      )
      const activeSubscription = service!.createSubscription({
        memberId: activeMember.id,
        planId: plan.id,
        startDate: today,
        endDate: addDaysToLocalIsoDate(today, 30),
        price: plan.price,
        discount: 0,
        paymentAmount: plan.price,
        paymentMethod: 'cash',
        paymentDate: today,
        paymentNotes: null,
        subscriptionNotes: null
      })
      assert.equal(activeSubscription.status, 'active')

      const record = service!.registerAttendance(activeMember.id)
      assert.equal(record.memberNumber, activeMember.memberNumber)
      assert.equal(record.checkInDate, today)

      assert.throws(
        () => service!.registerAttendance(activeMember.id),
        /already registered/i
      )

      service!.freezeSubscription(activeSubscription.id, today, null, 'Test freeze')
      assert.throws(
        () => service!.registerAttendance(activeMember.id),
        /frozen/i
      )

      const expiredMember = service!.createMember(
        memberInput('Expired Attendee', '01000000012')
      )
      service!.createSubscription({
        memberId: expiredMember.id,
        planId: plan.id,
        startDate: addDaysToLocalIsoDate(today, -40),
        endDate: addDaysToLocalIsoDate(today, -10),
        price: plan.price,
        discount: 0,
        paymentAmount: plan.price,
        paymentMethod: 'cash',
        paymentDate: today,
        paymentNotes: null,
        subscriptionNotes: null
      })
      assert.throws(
        () => service!.registerAttendance(expiredMember.id),
        /expired/i
      )

      const noSubscriptionMember = service!.createMember(
        memberInput('No Subscription Attendee', '01000000013')
      )
      assert.throws(
        () => service!.registerAttendance(noSubscriptionMember.id),
        /No active subscription/
      )

      assert.throws(
        () =>
          inspection!
            .prepare(
              `INSERT INTO attendance (member_id, check_in_date)
               VALUES (?, ?)`
            )
            .run(activeMember.id, today),
        /UNIQUE constraint failed/
      )
    })
  } finally {
    closeResources()
  }
}

function expenseLifecycleSeedPhase(): void {
  const expensesDbPath = join(TEST_ROOT, 'expenses', 'expenses.db')
  mkdirSync(dirname(expensesDbPath), { recursive: true })

  let service: GymProDatabase | null = null
  let inspection: SqliteDatabase | null = null

  const closeResources = (): void => {
    if (inspection) inspection.close()
    if (service) service.close()
  }

  const memberInput = (
    fullName: string,
    phone: string
  ): Parameters<GymProDatabase['createMember']>[0] => ({
    fullName,
    phone,
    secondaryPhone: null,
    address: null,
    gender: null,
    dateOfBirth: null,
    emergencyContact: null,
    notes: null,
    registrationDate: toLocalIsoDate(),
    photoData: null
  })

  const expenseInput = (
    overrides: Partial<Parameters<GymProDatabase['createExpense']>[0]> = {}
  ): Parameters<GymProDatabase['createExpense']>[0] => ({
    description: 'Utility bill',
    category: 'electricity',
    amount: 120.5,
    paymentMethod: 'cash',
    expenseDate: toLocalIsoDate(),
    expenseTime: null,
    recordedBy: 'Ahmed',
    notes: null,
    ...overrides
  })

  try {
    runTest('expense ledger: create, edit, archive, audit, cash register', () => {
      service = new GymProDatabase(expensesDbPath)

      const status = service.initialize()
      assert.equal(status.state, 'ready')
      assert.equal(status.schemaVersion, 9)

      const today = toLocalIsoDate()

      const plan = service.createPlan({
        name: 'Expense Test Plan',
        durationDays: 30,
        price: 400,
        description: null,
        isActive: true
      })
      const member = service.createMember(
        memberInput('Expense Attendee', '01000000081')
      )
      service.createSubscription({
        memberId: member.id,
        planId: plan.id,
        startDate: today,
        endDate: addDaysToLocalIsoDate(today, 30),
        price: plan.price,
        discount: 0,
        paymentAmount: plan.price,
        paymentMethod: 'cash',
        paymentDate: today,
        paymentNotes: null,
        subscriptionNotes: null
      })

      let snapshot = service.getWorkspaceSnapshot()
      assert.equal(snapshot.totals.totalExpenses, 0)
      assert.equal(snapshot.totals.totalRevenue, 400)

      const expense = service.createExpense(expenseInput())
      assert.equal(expense.status, 'active')
      assert.equal(expense.recordedBy, 'Ahmed')
      assert.equal(expense.amount, 120.5)
      assert.equal(expense.category, 'electricity')
      assert.ok(expense.expenseTime)

      snapshot = service.getWorkspaceSnapshot()
      assert.equal(snapshot.totals.totalExpenses, 120.5)
      assert.equal(snapshot.totals.expensesToday, 120.5)

      const updated = service.updateExpense(
        expense.id,
        expenseInput({ amount: 220, recordedBy: 'Mostafa' })
      )
      assert.equal(updated.amount, 220)
      assert.equal(updated.recordedBy, 'Mostafa')

      snapshot = service.getWorkspaceSnapshot()
      assert.equal(snapshot.totals.totalExpenses, 220)

      assert.throws(
        () => service!.createExpense(expenseInput({ category: 'spaceships' })),
        /category/i
      )

      const archived = service.archiveExpense(expense.id)
      assert.equal(archived.status, 'archived')

      snapshot = service.getWorkspaceSnapshot()
      assert.equal(snapshot.totals.totalExpenses, 0)
      assert.equal(
        snapshot.expenses.find((entry) => entry.id === expense.id)?.status,
        'archived'
      )

      assert.throws(
        () => service!.archiveExpense(expense.id),
        /archived/i
      )
      assert.throws(
        () => service!.updateExpense(expense.id, expenseInput()),
        /archived/i
      )

      const created = service.createExpenseCategory({
        key: 'laundry',
        nameAr: 'مغسلة',
        nameEn: 'Laundry'
      })
      assert.equal(created.key, 'laundry')

      const laundryExpense = service.createExpense(
        expenseInput({
          description: 'Laundry supplies',
          category: 'laundry',
          amount: 30,
          recordedBy: null
        })
      )
      assert.equal(laundryExpense.category, 'laundry')

      service.setExpenseCategoryActive('laundry', false)
      assert.throws(
        () => service!.createExpense(expenseInput({ category: 'laundry' })),
        /category/i
      )

      snapshot = service.getWorkspaceSnapshot()
      assert.equal(snapshot.expenseCatalog.length, 9)
      assert.equal(
        snapshot.expenseCatalog.find((entry) => entry.key === 'laundry')?.isActive,
        false
      )
      assert.equal(snapshot.totals.totalExpenses, 30)

      inspection = createDatabaseConnection(expensesDbPath)
      const logs = inspection
        .prepare(
          'SELECT action, entity_type FROM activity_logs ORDER BY id ASC'
        )
        .all() as Array<{ action: string; entity_type: string }>
      const actions = new Set(logs.map((row) => row.action))
      assert.equal(actions.has('expense.create'), true)
      assert.equal(actions.has('expense.update'), true)
      assert.equal(actions.has('expense.archive'), true)
      assert.equal(actions.has('expense.category.create'), true)
      assert.equal(actions.has('expense.category.set_active'), true)
      assert.ok(
        logs.every((row) => row.entity_type.startsWith('expense'))
      )
    })
  } finally {
    closeResources()
  }
}

function verifyPersistencePhase(): void {
  let service: GymProDatabase | null = null
  let inspection: SqliteDatabase | null = null

  const closeResources = (): void => {
    if (inspection) inspection.close()
    if (service) service.close()
  }

  try {
    runTest('database persists across a fresh Electron process', () => {
      assert.equal(existsSync(TEST_DB_PATH), true)
      service = new GymProDatabase(TEST_DB_PATH)
      const status = service.initialize()

      assert.equal(status.state, 'ready')
      assert.equal(status.schemaVersion, 9)
      assert.equal(status.appliedMigrations.length, 9)
      assert.equal(service.healthCheck().ok, true)

      inspection = createDatabaseConnection(TEST_DB_PATH)
      const marker = inspection
        .prepare(
          `SELECT member_code, full_name, notes
           FROM members WHERE id = 1`
        )
        .get() as {
        member_code: string
        full_name: string
        notes: string
      }

      assert.deepEqual(marker, {
        member_code: 'GYM-000001',
        full_name: 'Persistence Marker',
        notes: 'persistence-marker'
      })

      const subscription = inspection
        .prepare('SELECT COUNT(*) AS count FROM subscriptions')
        .get() as { count: number }
      const payment = inspection
        .prepare('SELECT COUNT(*) AS count FROM payments')
        .get() as { count: number }
      const settings = inspection
        .prepare('SELECT COUNT(*) AS count FROM settings')
        .get() as { count: number }

      assert.equal(subscription.count, 1)
      assert.equal(payment.count, 1)
      assert.equal(settings.count, 1)
      assert.equal(
        (
          inspection
            .prepare('SELECT COUNT(*) AS count FROM schema_migrations')
            .get() as { count: number }
         ).count,
          9
       )
    })

    runTest('workspace snapshot remains available after a restart', () => {
      assert.ok(service)
      const snapshot = service.getWorkspaceSnapshot()

      assert.equal(snapshot.totals.totalRevenue, 450)
      assert.equal(snapshot.totals.activeMembers, 2)
      assert.equal(snapshot.totals.todayAttendance, 1)
      assert.equal(snapshot.members.length, 2)
      assert.equal(snapshot.plans.length, 1)
      assert.equal(snapshot.subscriptions.length, 1)
      assert.equal(snapshot.payments.length, 1)
      assert.equal(snapshot.attendance.length, 1)
      assert.equal(snapshot.notifications.length, 1)
      assert.equal(snapshot.settings.length, 1)
    })

    runTest('member numbers and attendance persist across a restart', () => {
      const memberNumberDbPath = join(
        TEST_ROOT,
        'member-numbers',
        'member-numbers.db'
      )
      assert.equal(existsSync(memberNumberDbPath), true)

      const reopened = new GymProDatabase(memberNumberDbPath)
      assert.equal(reopened.initialize().state, 'ready')

      const inspection = createDatabaseConnection(memberNumberDbPath)

      try {
        const numbers = inspection
          .prepare('SELECT member_number FROM members ORDER BY member_number ASC')
          .all() as Array<{ member_number: number }>
        assert.deepEqual(
          numbers.map((row) => row.member_number),
          [1, 2, 3, 4, 5, 6]
        )

        const attendanceCount = (
          inspection
            .prepare('SELECT COUNT(*) AS count FROM attendance')
            .get() as { count: number }
        ).count
        assert.equal(attendanceCount, 1)
      } finally {
        inspection.close()
        reopened.close()
      }
    })

    runTest('expense ledger and audit trail persist across a restart', () => {
      const expensesDbPath = join(
        TEST_ROOT,
        'expenses',
        'expenses.db'
      )
      assert.equal(existsSync(expensesDbPath), true)

      const reopened = new GymProDatabase(expensesDbPath)
      assert.equal(reopened.initialize().state, 'ready')

      const inspection = createDatabaseConnection(expensesDbPath)

      try {
        const active = (
          inspection
            .prepare("SELECT COUNT(*) AS count FROM expenses WHERE status = 'active'")
            .get() as { count: number }
        ).count
        assert.equal(active, 1)

        const archived = (
          inspection
            .prepare("SELECT COUNT(*) AS count FROM expenses WHERE status = 'archived'")
            .get() as { count: number }
        ).count
        assert.equal(archived, 1)

        const logs = (
          inspection
            .prepare('SELECT COUNT(*) AS count FROM activity_logs')
            .get() as { count: number }
        ).count
        assert.ok(logs >= 4)

        const snapshot = reopened.getWorkspaceSnapshot()
        assert.equal(snapshot.totals.totalExpenses, 30)
        assert.equal(snapshot.totals.expensesToday, 30)
        assert.equal(snapshot.expenseCatalog.length, 9)
      } finally {
        inspection.close()
        reopened.close()
      }
    })
    runTest('range report persists after a restart', () => {
      const lifecycleDbPath = join(
        TEST_ROOT,
        'lifecycle',
        'lifecycle.db'
      )
      assert.equal(existsSync(lifecycleDbPath), true)

      const reopened = new GymProDatabase(lifecycleDbPath)
      assert.equal(reopened.initialize().state, 'ready')

      try {
        const today = toLocalIsoDate()
        const report = reopened.getRangeReport(
          `${today.slice(0, 7)}-01`,
          today
        )
        assert.equal(report.collectedRevenue, 950)
        assert.equal(report.subscriptionPayments, 2)
        assert.equal(report.newSubscriptions, 2)
        assert.equal(report.renewals, 1)
        assert.equal(report.expenses, 75)
        assert.equal(report.netRevenue, 875)
      } finally {
        reopened.close()
      }
    })

    runTest('subscription history snapshots persist across a restart', () => {
      const lifecycleDbPath = join(
        TEST_ROOT,
        'lifecycle',
        'lifecycle.db'
      )
      assert.equal(existsSync(lifecycleDbPath), true)

      const reopened = new GymProDatabase(lifecycleDbPath)
      assert.equal(reopened.initialize().state, 'ready')

      const inspection = createDatabaseConnection(lifecycleDbPath)

      try {
        const rows = inspection
          .prepare(
            'SELECT plan_name, duration_days FROM subscriptions ORDER BY id ASC'
          )
          .all() as Array<{ plan_name: string; duration_days: number }>
        assert.deepEqual(
          rows.map((row) => [row.plan_name, row.duration_days]),
          [
            ['Half Month', 15],
            ['Renamed Plan', 30]
          ]
        )

        const payments = (
          inspection
            .prepare('SELECT COUNT(*) AS count FROM payments')
            .get() as { count: number }
        ).count
        assert.equal(payments, 2)
      } finally {
        inspection.close()
        reopened.close()
      }
    })
  } finally {
    closeResources()
  }

  if (failed === 0) {
    rmSync(TEST_ROOT, { recursive: true, force: true })
  }
}

function main(): void {
  console.log(`GYM PRO database integration tests — ${PHASE} phase`)
  console.log(`Test database: ${TEST_DB_PATH}`)

  if (PHASE === 'seed') {
    seedPhase()
  } else {
    verifyPersistencePhase()
  }

  console.log(`\n${passed} passed, ${failed} failed`)

  if (failed > 0 && existsSync(TEST_ROOT)) {
    console.error(`Test artifacts retained for inspection: ${TEST_ROOT}`)
  }

  app.exit(failed === 0 ? 0 : 1)
}

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')

app
  .whenReady()
  .then(main)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error)
    app.exit(1)
  })
