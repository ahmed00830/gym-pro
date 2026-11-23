import { statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import type {
  AnalyticsRangeReport,
  AttendanceRecord,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseInput,
  ExpenseRecord,
  MemberInput,
  MemberRecord,
  PaymentMethodBreakdown,
  PaymentRecord,
  PlanInput,
  PlanRecord,
  QuickRegisterInput,
  QuickRegisterResult,
  QuickRenewInput,
  SubscriptionInput,
  SubscriptionRecord,
  WorkspaceSnapshot
} from '../../shared/analytics'
import type {
  DatabaseHealthCheck,
  DatabaseInfo,
  DatabaseInitializationStatus,
  DatabaseMigrationInfo,
  DatabaseState
} from '../../shared/database'
import {
  createDatabaseConnection,
  getForeignKeysEnabled,
  getJournalMode,
  getSchemaVersion,
  type SqliteDatabase
} from './connection'
import {
  addDaysToLocalIsoDate,
  isValidLocalIsoDate,
  isValidLocalIsoTime,
  toLocalIsoDate,
  toLocalIsoTime,
  toUtcIsoTimestamp
} from './date-time'
import { LATEST_SCHEMA_VERSION } from './migrations'
import { runMigrations } from './migrate'
import { readWorkspaceSnapshot } from './snapshot'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function requireTrimmed(
  value: unknown,
  label: string,
  maxLength: number
): string {
  const trimmed = String(value ?? '').trim()

  if (!trimmed) {
    throw new Error(`${label} is required.`)
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${label} is too long.`)
  }

  return trimmed
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)
}

/**
 * Owns the single SQLite connection used by the main process. A raw database
 * handle is never returned from this class or exposed over IPC.
 */
export class GymProDatabase {
  readonly filePath: string

  private database: SqliteDatabase | null = null
  private state: DatabaseState = 'pending'
  private error: string | null = null
  private schemaVersion = 0
  private appliedMigrations: DatabaseMigrationInfo[] = []
  private initializedAt: string | null = null

  constructor(filePath: string) {
    this.filePath = resolve(filePath)
  }

  initialize(): DatabaseInitializationStatus {
    if (this.state === 'ready' && this.database) {
      return this.getInitializationStatus()
    }

    this.state = 'pending'
    this.error = null

    let database: SqliteDatabase | null = null

    try {
      database = createDatabaseConnection(this.filePath)
      this.database = database

      const migrationResult = runMigrations(database)

      this.schemaVersion = migrationResult.toVersion
      this.appliedMigrations = migrationResult.history
      this.initializedAt = toUtcIsoTimestamp()
      this.state = 'ready'

      if (migrationResult.appliedMigrations.length > 0) {
        console.info(
          `[GYM PRO] Database migrations applied: ${migrationResult.appliedMigrations
            .map((migration) => `${migration.version}:${migration.name}`)
            .join(', ')}`
        )
      }
    } catch (error) {
      this.state = 'failed'
      this.error = errorMessage(error)

      if (database) {
        try {
          this.schemaVersion = getSchemaVersion(database)
        } catch {
          // Preserve the original initialization error.
        }

        try {
          database.close()
        } catch {
          // Preserve the original initialization error.
        }
      }

      this.database = null
    }

    return this.getInitializationStatus()
  }

  getInitializationStatus(): DatabaseInitializationStatus {
    return {
      state: this.state,
      initialized: this.state === 'ready' && this.database !== null,
      schemaVersion: this.schemaVersion,
      targetSchemaVersion: LATEST_SCHEMA_VERSION,
      appliedMigrations: this.appliedMigrations.map((migration) => ({
        ...migration
      })),
      pendingMigrationCount: Math.max(
        0,
        LATEST_SCHEMA_VERSION - this.schemaVersion
      ),
      error: this.error,
      checkedAt: toUtcIsoTimestamp()
    }
  }

  healthCheck(): DatabaseHealthCheck {
    const checkedAt = toUtcIsoTimestamp()

    if (this.state !== 'ready' || !this.database) {
      return {
        ok: false,
        initialized: false,
        state: this.state,
        schemaVersion: this.schemaVersion,
        targetSchemaVersion: LATEST_SCHEMA_VERSION,
        foreignKeysEnabled: false,
        integrityCheck: 'not-run',
        foreignKeyViolations: 0,
        journalMode: null,
        checkedAt,
        error: this.error ?? 'The database is not initialized.'
      }
    }

    try {
      const quickCheckRows = this.database.pragma('quick_check') as Array<
        Record<string, string>
      >
      const quickCheck =
        quickCheckRows.length === 1 &&
        Object.values(quickCheckRows[0] ?? {})[0] === 'ok'
          ? 'ok'
          : 'failed'
      const foreignKeyViolations = this.database.pragma(
        'foreign_key_check'
      ) as unknown[]
      const schemaVersion = getSchemaVersion(this.database)
      const foreignKeysEnabled = getForeignKeysEnabled(this.database)
      const journalMode = getJournalMode(this.database)

      const ok =
        quickCheck === 'ok' &&
        foreignKeyViolations.length === 0 &&
        foreignKeysEnabled &&
        schemaVersion === LATEST_SCHEMA_VERSION

      return {
        ok,
        initialized: true,
        state: this.state,
        schemaVersion,
        targetSchemaVersion: LATEST_SCHEMA_VERSION,
        foreignKeysEnabled,
        integrityCheck: quickCheck,
        foreignKeyViolations: foreignKeyViolations.length,
        journalMode,
        checkedAt,
        error: ok ? null : 'Database verification did not pass all checks.'
      }
    } catch (error) {
      return {
        ok: false,
        initialized: true,
        state: this.state,
        schemaVersion: this.schemaVersion,
        targetSchemaVersion: LATEST_SCHEMA_VERSION,
        foreignKeysEnabled: false,
        integrityCheck: 'failed',
        foreignKeyViolations: 0,
        journalMode: null,
        checkedAt,
        error: errorMessage(error)
      }
    }
  }

  getInfo(): DatabaseInfo {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const sqliteVersion = (
      this.database
        .prepare('SELECT sqlite_version() AS version')
        .get() as { version: string }
    ).version
    const pageSize = this.database.pragma('page_size', {
      simple: true
    }) as number
    const pageCount = this.database.pragma('page_count', {
      simple: true
    }) as number
    const applicationTableCount = (
      this.database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM sqlite_master
           WHERE type = 'table'
             AND name NOT LIKE 'sqlite_%'
             AND name <> 'schema_migrations'`
        )
        .get() as { count: number }
    ).count
    const fileStats = statSync(this.filePath)

    return {
      engine: 'SQLite',
      sqliteVersion,
      fileName: basename(this.filePath),
      filePath: this.filePath,
      schemaVersion: getSchemaVersion(this.database),
      targetSchemaVersion: LATEST_SCHEMA_VERSION,
      sizeBytes: fileStats.size,
      pageSize,
      pageCount,
      journalMode: getJournalMode(this.database),
      foreignKeysEnabled: getForeignKeysEnabled(this.database),
      applicationTableCount,
      initializedAt: this.initializedAt
    }
  }

  /**
   * Read-only presentation snapshot of the existing schema. The returned
   * object is plain data; no connection, statement, or SQL is exposed.
   */
  getWorkspaceSnapshot(): WorkspaceSnapshot {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      return database.transaction(() => readWorkspaceSnapshot(database))()
    } catch (error) {
      console.error('[GYM PRO] Workspace snapshot query failed:', error)
      throw new Error('Workspace data is unavailable.')
    }
  }

  private mapMemberRow(row: {
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
    status: MemberRecord['status']
    photo_data: string | null
    created_at: string
    updated_at: string
  }): MemberRecord {
    return {
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
    }
  }

  private fetchMember(id: number): MemberRecord {
    const row = this.database
      ?.prepare(
        `SELECT id, member_code, member_number, full_name, phone, secondary_phone, address,
                gender, date_of_birth, registration_date, emergency_contact,
                notes, status, photo_data, created_at, updated_at
         FROM members
         WHERE id = ?`
      )
      .get(id) as
      | {
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
          status: MemberRecord['status']
          photo_data: string | null
          created_at: string
          updated_at: string
        }
      | undefined

    if (!row) {
      throw new Error('Member not found.')
    }

    return this.mapMemberRow(row)
  }

  /**
   * Returns the next permanent membership number. The increment and the
   * member insert share one transaction, so two members can never receive the
   * same number.
   */
  private nextMemberNumber(database: SqliteDatabase): number {
    const row = database
      .prepare('SELECT last_number FROM member_number_sequence WHERE id = 1')
      .get() as { last_number: number } | undefined

    const next = Number(row?.last_number ?? 0) + 1

    database
      .prepare('UPDATE member_number_sequence SET last_number = ? WHERE id = 1')
      .run(next)

    return next
  }

  createMember(input: MemberInput): MemberRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const create = database.transaction(() => {
        const memberNumber = this.nextMemberNumber(database)

        const result = database
          .prepare(
            `INSERT INTO members (
               full_name, phone, secondary_phone, address, gender, date_of_birth,
               registration_date, emergency_contact, notes, status, photo_data,
               member_number
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
          )
          .run(
            input.fullName,
            input.phone,
            input.secondaryPhone,
            input.address,
            input.gender,
            input.dateOfBirth,
            input.registrationDate,
            input.emergencyContact,
            input.notes,
            input.photoData,
            memberNumber
          )

        return Number(result.lastInsertRowid)
      })()

      return this.fetchMember(create)
    } catch (error) {
      console.error('[GYM PRO] Member creation failed:', error)
      throw new Error('Member could not be created.')
    }
  }

  updateMember(id: number, input: MemberInput): MemberRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const result = database
        .prepare(
          `UPDATE members
           SET full_name = ?, phone = ?, secondary_phone = ?, address = ?,
               gender = ?, date_of_birth = ?, registration_date = ?,
               emergency_contact = ?, notes = ?, photo_data = ?
           WHERE id = ?`
        )
        .run(
          input.fullName,
          input.phone,
          input.secondaryPhone,
          input.address,
          input.gender,
          input.dateOfBirth,
          input.registrationDate,
          input.emergencyContact,
          input.notes,
          input.photoData,
          id
        )

      if (result.changes === 0) {
        throw new Error('Member not found.')
      }

      return this.fetchMember(id)
    } catch (error) {
      console.error('[GYM PRO] Member update failed:', error)
      throw new Error('Member could not be updated.')
    }
  }

  deleteMember(id: number): { archived: boolean; deleted: boolean } {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const relatedCount = (
        database
          .prepare(
            `SELECT
               (SELECT COUNT(*) FROM subscriptions WHERE member_id = ?) +
               (SELECT COUNT(*) FROM payments WHERE member_id = ?) +
               (SELECT COUNT(*) FROM attendance WHERE member_id = ?) AS value`
          )
          .get(id, id, id) as { value: number }
      ).value

      if (relatedCount > 0) {
        const result = database
          .prepare(
            `UPDATE members
             SET status = 'archived'
             WHERE id = ? AND status <> 'archived'`
          )
          .run(id)

        if (result.changes === 0) {
          const exists = database
            .prepare('SELECT 1 FROM members WHERE id = ?')
            .get(id)

          if (!exists) throw new Error('Member not found.')
        }

        return { archived: true, deleted: false }
      }

      const result = database
        .prepare('DELETE FROM members WHERE id = ?')
        .run(id)

      if (result.changes === 0) {
        throw new Error('Member not found.')
      }

      return { archived: false, deleted: true }
    } catch (error) {
      console.error('[GYM PRO] Member deletion failed:', error)
      throw new Error('Member could not be deleted.')
    }
  }

  private fetchPlan(id: number): PlanRecord {
    const row = this.database
      ?.prepare(
        `SELECT id, name, duration_days, price, description, is_active,
                (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.status = 'active') AS active_subscribers
         FROM membership_plans p
         WHERE id = ?`
      )
      .get(id) as
      | {
          id: number
          name: string
          duration_days: number
          price: number
          description: string | null
          is_active: number
          active_subscribers: number
        }
      | undefined

    if (!row) throw new Error('Plan not found.')

    return {
      id: row.id,
      name: row.name,
      durationDays: row.duration_days,
      price: row.price,
      description: row.description,
      isActive: row.is_active === 1,
      activeSubscribers: Number(row.active_subscribers)
    }
  }

  createPlan(input: PlanInput): PlanRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const result = database
        .prepare(
          `INSERT INTO membership_plans (name, duration_days, price, description, is_active)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          input.name,
          input.durationDays,
          input.price,
          input.description,
          input.isActive ? 1 : 0
        )

      return this.fetchPlan(Number(result.lastInsertRowid))
    } catch (error) {
      console.error('[GYM PRO] Plan creation failed:', error)
      throw new Error('Plan could not be created.')
    }
  }

  updatePlan(id: number, input: PlanInput): PlanRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const result = database
        .prepare(
          `UPDATE membership_plans
           SET name = ?, duration_days = ?, price = ?, description = ?, is_active = ?
           WHERE id = ?`
        )
        .run(
          input.name,
          input.durationDays,
          input.price,
          input.description,
          input.isActive ? 1 : 0,
          id
        )

      if (result.changes === 0) throw new Error('Plan not found.')

      return this.fetchPlan(id)
    } catch (error) {
      console.error('[GYM PRO] Plan update failed:', error)
      throw new Error('Plan could not be updated.')
    }
  }

  setPlanActive(id: number, isActive: boolean): PlanRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const result = database
        .prepare('UPDATE membership_plans SET is_active = ? WHERE id = ?')
        .run(isActive ? 1 : 0, id)

      if (result.changes === 0) throw new Error('Plan not found.')

      return this.fetchPlan(id)
    } catch (error) {
      console.error('[GYM PRO] Plan activation failed:', error)
      throw new Error('Plan could not be updated.')
    }
  }

  private fetchSubscription(id: number): SubscriptionRecord {
    const row = this.database
      ?.prepare(
        `SELECT s.id, s.member_id, m.member_number, m.member_code, m.full_name AS member_name,
                s.plan_id,
                COALESCE(s.plan_name, p.name) AS plan_name,
                COALESCE(s.duration_days, p.duration_days) AS duration_days,
                s.start_date, s.end_date,
                s.price, s.discount, s.final_price, s.status,
                s.freeze_start_date, s.freeze_end_date, s.freeze_reason
         FROM subscriptions s
         JOIN members m ON m.id = s.member_id
         JOIN membership_plans p ON p.id = s.plan_id
         WHERE s.id = ?`
      )
      .get(id) as
      | {
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
        }
      | undefined

    if (!row) throw new Error('Subscription not found.')

    const paidRow = this.database
      ?.prepare(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE subscription_id = ?'
      )
      .get(id) as { total: number } | undefined

    const paidAmount = Number(paidRow?.total ?? 0)

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
  }

  createSubscription(input: SubscriptionInput): SubscriptionRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    const create = database.transaction(() => {
      const member = database
        .prepare('SELECT id FROM members WHERE id = ?')
        .get(input.memberId)
      if (!member) throw new Error('Member not found.')

      const plan = database
        .prepare(
          'SELECT id, name, duration_days, price FROM membership_plans WHERE id = ?'
        )
        .get(input.planId) as
        | { id: number; name: string; duration_days: number; price: number }
        | undefined
      if (!plan) throw new Error('Plan not found.')

      const finalPrice = Math.round((input.price - input.discount) * 100) / 100

      if (input.paymentAmount < finalPrice) {
        throw new Error('Full payment is required. Partial payments are not allowed.')
      }

      if (input.paymentAmount > finalPrice) {
        throw new Error('Payment amount exceeds the subscription price.')
      }

      const result = database
        .prepare(
          `INSERT INTO subscriptions (
             member_id, plan_id, start_date, end_date, price, discount,
             final_price, status, plan_name, duration_days
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        )
        .run(
          input.memberId,
          input.planId,
          input.startDate,
          input.endDate,
          input.price,
          input.discount,
          finalPrice,
          plan.name,
          plan.duration_days
        )

      const subscriptionId = Number(result.lastInsertRowid)

      if (input.paymentAmount > 0) {
        database
          .prepare(
            `INSERT INTO payments (
               member_id, subscription_id, amount, payment_method, payment_date, notes
             ) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            input.memberId,
            subscriptionId,
            Math.round(input.paymentAmount * 100) / 100,
            input.paymentMethod,
            input.paymentDate,
            input.paymentNotes
          )
      }

      return subscriptionId
    })

    try {
      const subscriptionId = create()
      return this.fetchSubscription(subscriptionId)
    } catch (error) {
      console.error('[GYM PRO] Subscription creation failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Subscription could not be created.'
      )
    }
  }

  freezeSubscription(
    id: number,
    startDate: string,
    endDate: string | null,
    reason: string | null
  ): SubscriptionRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const subscription = database
        .prepare('SELECT id, status FROM subscriptions WHERE id = ?')
        .get(id) as { id: number; status: string } | undefined

      if (!subscription) throw new Error('Subscription not found.')

      if (subscription.status === 'cancelled' || subscription.status === 'completed') {
        throw new Error('This subscription cannot be frozen.')
      }

      // Prevent overlapping freeze periods.
      const overlap = database
        .prepare(
          `SELECT 1
           FROM subscription_freezes
           WHERE subscription_id = ?
             AND start_date <= COALESCE(?, '9999-12-31')
             AND COALESCE(end_date, '9999-12-31') >= ?`
        )
        .get(id, endDate, startDate)

      if (overlap) {
        throw new Error('Freeze period overlaps an existing freeze.')
      }

      const alreadyFrozen = database
        .prepare(
          `SELECT 1 FROM subscription_freezes
           WHERE subscription_id = ? AND end_date IS NULL`
        )
        .get(id)

      if (alreadyFrozen) {
        throw new Error('This subscription is already frozen.')
      }

      const freeze = database.transaction(() => {
        database
          .prepare(
            `INSERT INTO subscription_freezes (subscription_id, start_date, end_date, reason)
             VALUES (?, ?, ?, ?)`
          )
          .run(id, startDate, endDate, reason)

        database
          .prepare(
            `UPDATE subscriptions
             SET status = 'frozen',
                 freeze_start_date = ?,
                 freeze_end_date = ?,
                 freeze_reason = ?
             WHERE id = ?`
          )
          .run(startDate, endDate, reason, id)
      })

      freeze()
      return this.fetchSubscription(id)
    } catch (error) {
      console.error('[GYM PRO] Freeze failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Subscription could not be frozen.')
    }
  }

  resumeSubscription(id: number, resumeDate: string): SubscriptionRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const subscription = database
        .prepare(
          `SELECT id, status, end_date, freeze_start_date, freeze_end_date
           FROM subscriptions WHERE id = ?`
        )
        .get(id) as
        | {
            id: number
            status: string
            end_date: string
            freeze_start_date: string | null
            freeze_end_date: string | null
          }
        | undefined

      if (!subscription) throw new Error('Subscription not found.')
      if (subscription.status !== 'frozen' || !subscription.freeze_start_date) {
        throw new Error('This subscription is not frozen.')
      }

      const freezeEnd = resumeDate
      const frozenDays = daysBetween(subscription.freeze_start_date, freezeEnd) + 1

      const newEndDate = addDaysToLocalIsoDate(subscription.end_date, frozenDays)

      const resume = database.transaction(() => {
        database
          .prepare(
            `UPDATE subscription_freezes
             SET end_date = ?
             WHERE subscription_id = ? AND end_date IS NULL`
          )
          .run(freezeEnd, id)

        database
          .prepare(
            `UPDATE subscriptions
             SET status = 'active',
                 end_date = ?,
                 freeze_start_date = NULL,
                 freeze_end_date = NULL,
                 freeze_reason = NULL
             WHERE id = ?`
          )
          .run(newEndDate, id)
      })

      resume()
      return this.fetchSubscription(id)
    } catch (error) {
      console.error('[GYM PRO] Resume failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Subscription could not be resumed.')
    }
  }

  cancelSubscription(id: number): SubscriptionRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const result = database
        .prepare(
          `UPDATE subscriptions
           SET status = 'cancelled'
           WHERE id = ?`
        )
        .run(id)

      if (result.changes === 0) throw new Error('Subscription not found.')

      return this.fetchSubscription(id)
    } catch (error) {
      console.error('[GYM PRO] Cancellation failed:', error)
      throw new Error('Subscription could not be cancelled.')
    }
  }

  recordSubscriptionPayment(
    subscriptionId: number,
    amount: number,
    method: string,
    paymentDate: string,
    notes: string | null
  ): PaymentRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const subscription = database
        .prepare('SELECT id, member_id FROM subscriptions WHERE id = ?')
        .get(subscriptionId) as { id: number; member_id: number } | undefined

      if (!subscription) throw new Error('Subscription not found.')

      const paidRow = database
        .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE subscription_id = ?')
        .get(subscriptionId) as { total: number }
      const currentPaid = Number(paidRow?.total ?? 0)
      const subscriptionRow = database
        .prepare('SELECT final_price FROM subscriptions WHERE id = ?')
        .get(subscriptionId) as { final_price: number }
      const balance = Math.round((subscriptionRow.final_price - currentPaid) * 100) / 100

      if (Math.round(amount * 100) / 100 !== balance) {
        throw new Error('Only full payment of the remaining balance is allowed.')
      }

      const result = database
        .prepare(
          `INSERT INTO payments (member_id, subscription_id, amount, payment_method, payment_date, notes)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(subscription.member_id, subscriptionId, amount, method, paymentDate, notes)

      const payment = database
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
           WHERE p.id = ?`
        )
        .get(Number(result.lastInsertRowid)) as {
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
      }

      return {
        id: payment.id,
        memberId: payment.member_id,
        memberNumber: payment.member_number,
        subscriptionId: payment.subscription_id,
        memberCode: payment.member_code,
        memberName: payment.member_name,
        planName: payment.plan_name,
        paymentType: Number(payment.prior_subscriptions ?? 0) > 0 ? 'renewal' : 'new',
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        paymentDate: payment.payment_date,
        notes: payment.notes,
        createdAt: payment.created_at
      }
    } catch (error) {
      console.error('[GYM PRO] Payment recording failed:', error)
      throw new Error('Payment could not be recorded.')
    }
  }

  quickRegisterMember(input: QuickRegisterInput): QuickRegisterResult {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const memberResult = database.transaction(() => {
        const plan = database
          .prepare('SELECT id, name, duration_days, price FROM membership_plans WHERE id = ? AND is_active = 1')
          .get(input.planId) as { id: number; name: string; duration_days: number; price: number } | undefined

        if (!plan) throw new Error('Plan not found or inactive.')

        const memberNumber = this.nextMemberNumber(database)

        const memberInsert = database
          .prepare(
            `INSERT INTO members (full_name, phone, notes, status, member_number)
             VALUES (?, ?, ?, 'active', ?)`
          )
          .run(input.fullName, input.phone, input.notes, memberNumber)

        const memberId = Number(memberInsert.lastInsertRowid)

        const endDate = addDaysToLocalIsoDate(input.startDate, plan.duration_days)

        const subscriptionInsert = database
          .prepare(
            `INSERT INTO subscriptions (member_id, plan_id, start_date, end_date, price, discount, final_price, status, plan_name, duration_days)
             VALUES (?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?)`
          )
          .run(memberId, plan.id, input.startDate, endDate, plan.price, plan.price, plan.name, plan.duration_days)

        const subscriptionId = Number(subscriptionInsert.lastInsertRowid)

        database
          .prepare(
            `INSERT INTO payments (member_id, subscription_id, amount, payment_method, payment_date, notes)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            memberId,
            subscriptionId,
            plan.price,
            input.paymentMethod,
            input.paymentDate,
            input.notes
          )

        database
          .prepare(
            `UPDATE subscriptions SET status = 'active' WHERE id = ?`
          )
          .run(subscriptionId)

        return { memberId, subscriptionId, endDate }
      })()

      return {
        member: this.fetchMember(memberResult.memberId),
        subscription: this.fetchSubscription(memberResult.subscriptionId)
      }
    } catch (error) {
      console.error('[GYM PRO] Quick registration failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Member could not be registered.')
    }
  }

  quickRenewSubscription(input: QuickRenewInput): SubscriptionRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const plan = database
        .prepare('SELECT id, name, duration_days, price FROM membership_plans WHERE id = ? AND is_active = 1')
        .get(input.planId) as { id: number; name: string; duration_days: number; price: number } | undefined

      if (!plan) throw new Error('Plan not found or inactive.')

      const member = database
        .prepare('SELECT id FROM members WHERE id = ?')
        .get(input.memberId)
      if (!member) throw new Error('Member not found.')

      const latest = database
        .prepare(
          `SELECT end_date FROM subscriptions
           WHERE member_id = ?
           ORDER BY end_date DESC, id DESC
           LIMIT 1`
        )
        .get(input.memberId) as { end_date: string } | undefined

      const today = toLocalIsoDate()
      let startDate = input.startDate

      if (!startDate) {
        if (latest && latest.end_date >= today) {
          startDate = addDaysToLocalIsoDate(latest.end_date, 1)
        } else {
          startDate = today
        }
      }

      const endDate = addDaysToLocalIsoDate(startDate, plan.duration_days)

      const renew = database.transaction(() => {
        const subscriptionInsert = database
          .prepare(
            `INSERT INTO subscriptions (member_id, plan_id, start_date, end_date, price, discount, final_price, status, plan_name, duration_days)
             VALUES (?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?)`
          )
          .run(input.memberId, plan.id, startDate, endDate, plan.price, plan.price, plan.name, plan.duration_days)

        const subscriptionId = Number(subscriptionInsert.lastInsertRowid)

        database
          .prepare(
            `INSERT INTO payments (member_id, subscription_id, amount, payment_method, payment_date, notes)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(input.memberId, subscriptionId, plan.price, input.paymentMethod, input.paymentDate, input.notes)

        database
          .prepare(
            `UPDATE subscriptions SET status = 'active' WHERE id = ?`
          )
          .run(subscriptionId)

        return subscriptionId
      })

      const subscriptionId = renew()
      return this.fetchSubscription(subscriptionId)
    } catch (error) {
      console.error('[GYM PRO] Quick renewal failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Subscription could not be renewed.')
    }
  }

  registerAttendance(memberId: number): AttendanceRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database
    const today = toLocalIsoDate()

    try {
      const member = database
        .prepare('SELECT id, member_code, full_name FROM members WHERE id = ?')
        .get(memberId) as { id: number; member_code: string; full_name: string } | undefined

      if (!member) throw new Error('Member not found.')

      const subscription = database
        .prepare(
          `SELECT status, end_date, freeze_start_date, freeze_end_date
           FROM subscriptions
           WHERE member_id = ?
           ORDER BY end_date DESC, id DESC
           LIMIT 1`
        )
        .get(memberId) as
        | {
            status: string
            end_date: string
            freeze_start_date: string | null
            freeze_end_date: string | null
          }
        | undefined

      if (!subscription) throw new Error('No active subscription found.')

      let effectiveStatus = subscription.status
      if (effectiveStatus === 'cancelled' || effectiveStatus === 'completed') {
        effectiveStatus = 'inactive'
      } else if (
        subscription.freeze_start_date &&
        (subscription.freeze_end_date === null ||
          subscription.freeze_end_date >= today)
      ) {
        effectiveStatus = 'frozen'
      } else if (subscription.end_date < today) {
        effectiveStatus = 'expired'
      }

      if (effectiveStatus !== 'active') {
        if (effectiveStatus === 'expired') {
          throw new Error(`Subscription expired on ${subscription.end_date}.`)
        }

        throw new Error(`Subscription is ${effectiveStatus}.`)
      }

      const existing = database
        .prepare(
          'SELECT id FROM attendance WHERE member_id = ? AND check_in_date = ?'
        )
        .get(memberId, today)

      if (existing) {
        throw new Error('Attendance already registered today.')
      }

      const time = toLocalIsoTime()
      const result = database
        .prepare(
          `INSERT INTO attendance (member_id, check_in_date, check_in_time)
           VALUES (?, ?, ?)`
        )
        .run(memberId, today, time)

      const record = database
        .prepare(
          `SELECT a.id, a.member_id, m.member_number, m.member_code, m.full_name AS member_name,
                  a.check_in_date, a.check_in_time, a.created_at
           FROM attendance a
           JOIN members m ON m.id = a.member_id
           WHERE a.id = ?`
        )
        .get(Number(result.lastInsertRowid)) as {
        id: number
        member_id: number
        member_number: number
        member_code: string
        member_name: string
        check_in_date: string
        check_in_time: string
        created_at: string
      }

      return {
        id: record.id,
        memberId: record.member_id,
        memberNumber: record.member_number,
        memberCode: record.member_code,
        memberName: record.member_name,
        checkInDate: record.check_in_date,
        checkInTime: record.check_in_time,
        createdAt: record.created_at
      }
    } catch (error) {
      console.error('[GYM PRO] Attendance registration failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Attendance could not be registered.')
    }
  }

  /**
   * Financial summary for a selected date range. Revenue counts recorded
   * (completed) payments only; pending or unpaid transactions are never
   * included. The whole report is read inside one transaction.
   */
  getRangeReport(from: string, to: string): AnalyticsRangeReport {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    if (!isValidLocalIsoDate(from) || !isValidLocalIsoDate(to)) {
      throw new Error('The report range contains an invalid date.')
    }

    if (from > to) {
      throw new Error('The start of the report range must not be after its end.')
    }

    if (daysBetween(from, to) > 3660) {
      throw new Error('The report range is too large.')
    }

    const database = this.database

    try {
      return database.transaction(() => {
        const collected = database
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
             FROM payments
             WHERE payment_date BETWEEN ? AND ?`
          )
          .get(from, to) as { total: number; count: number }

        const newSubscriptions = (
          database
            .prepare(
              `SELECT COUNT(DISTINCT p.subscription_id) AS count
               FROM payments p
               WHERE p.payment_date BETWEEN ? AND ?
                 AND p.subscription_id IS NOT NULL`
            )
            .get(from, to) as { count: number }
        ).count

        const renewals = (
          database
            .prepare(
              `SELECT COUNT(DISTINCT p.subscription_id) AS count
               FROM payments p
               JOIN subscriptions s ON s.id = p.subscription_id
               WHERE p.payment_date BETWEEN ? AND ?
                 AND EXISTS (
                   SELECT 1
                   FROM subscriptions earlier
                   WHERE earlier.member_id = s.member_id
                     AND (
                       earlier.start_date < s.start_date
                       OR (earlier.start_date = s.start_date AND earlier.id < s.id)
                     )
                 )`
            )
            .get(from, to) as { count: number }
        ).count

        const expenses = (
          database
            .prepare(
              `SELECT COALESCE(SUM(amount), 0) AS total
               FROM expenses
               WHERE expense_date BETWEEN ? AND ?`
            )
            .get(from, to) as { total: number }
        ).total

        const paymentMethods = database
          .prepare(
            `SELECT payment_method AS method, COUNT(*) AS count,
                    COALESCE(SUM(amount), 0) AS total
             FROM payments
             WHERE payment_date BETWEEN ? AND ?
             GROUP BY payment_method
             ORDER BY total DESC, method ASC`
          )
          .all(from, to) as PaymentMethodBreakdown[]

        return {
          from,
          to,
          collectedRevenue: Number(collected.total),
          subscriptionPayments: Number(collected.count),
          newSubscriptions: Number(newSubscriptions),
          renewals: Number(renewals),
          expenses: Number(expenses),
          netRevenue:
            Math.round((Number(collected.total) - Number(expenses)) * 100) / 100,
          paymentMethods
        }
      })()
    } catch (error) {
      console.error('[GYM PRO] Range report failed:', error)
      throw new Error('The range report is unavailable.')
    }
  }

  /**
   * Appends an entry to the activity log inside the current transaction, so
   * the audit trail can never record a change that did not happen.
   */
  private activityLog(
    action: string,
    entityType: string,
    entityId: number,
    details: Record<string, unknown>
  ): void {
    if (!this.database) return

    this.database
      .prepare(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
         VALUES (NULL, ?, ?, ?, ?)`
      )
      .run(action, entityType, entityId, JSON.stringify(details))
  }

  private mapExpenseRow(row: {
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
  }): ExpenseRecord {
    return {
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
    }
  }

  private fetchExpense(id: number): ExpenseRecord {
    const row = this.database
      ?.prepare(
        `SELECT id, description, category, amount, payment_method,
                expense_date, expense_time, recorded_by, status, notes, created_at
         FROM expenses
         WHERE id = ?`
      )
      .get(id) as
      | {
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
        }
      | undefined

    if (!row) {
      throw new Error('Expense not found.')
    }

    return this.mapExpenseRow(row)
  }

  private validateExpenseInput(input: ExpenseInput): void {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Expense amount must be greater than zero.')
    }

    if (!isValidLocalIsoDate(input.expenseDate)) {
      throw new Error('Expense date is invalid.')
    }

    if (input.expenseTime !== null && !isValidLocalIsoTime(input.expenseTime)) {
      throw new Error('Expense time is invalid.')
    }
  }

  private expenseCategoryRow(
    key: string
  ):
    | {
        id: number
        key: string
        name_ar: string
        name_en: string
        is_active: number
        sort_order: number
      }
    | undefined {
    return this.database
      ?.prepare(
        `SELECT id, key, name_ar, name_en, is_active, sort_order
         FROM expense_categories
         WHERE key = ?`
      )
      .get(key) as
      | {
          id: number
          key: string
          name_ar: string
          name_en: string
          is_active: number
          sort_order: number
        }
      | undefined
  }

  private mapExpenseCategoryRow(row: {
    key: string
    name_ar: string
    name_en: string
    is_active: number
    sort_order: number
  }): ExpenseCategory {
    return {
      key: row.key,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      isActive: row.is_active === 1,
      sortOrder: row.sort_order
    }
  }

  private fetchExpenseCategory(key: string): ExpenseCategory {
    const row = this.expenseCategoryRow(key)

    if (!row) {
      throw new Error('Expense category not found.')
    }

    return this.mapExpenseCategoryRow(row)
  }

  createExpense(input: ExpenseInput): ExpenseRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      this.validateExpenseInput(input)

      const create = database.transaction(() => {
        const category = database
          .prepare('SELECT key FROM expense_categories WHERE key = ? AND is_active = 1')
          .get(input.category) as { key: string } | undefined

        if (!category) {
          throw new Error('Unknown or inactive expense category.')
        }

        const result = database
          .prepare(
            `INSERT INTO expenses (
               description, category, amount, payment_method,
               expense_date, expense_time, recorded_by, notes, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
          )
          .run(
            requireTrimmed(input.description, 'Description', 500),
            input.category,
            Math.round(input.amount * 100) / 100,
            requireTrimmed(input.paymentMethod, 'Payment method', 80),
            input.expenseDate,
            input.expenseTime ?? toLocalIsoTime(),
            input.recordedBy?.trim() || null,
            input.notes?.trim() || null
          )

        const id = Number(result.lastInsertRowid)

        this.activityLog('expense.create', 'expense', id, { input })

        return id
      })()

      return this.fetchExpense(create)
    } catch (error) {
      console.error('[GYM PRO] Expense creation failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Expense could not be created.'
      )
    }
  }

  updateExpense(id: number, input: ExpenseInput): ExpenseRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      this.validateExpenseInput(input)

      const update = database.transaction(() => {
        const before = database
          .prepare('SELECT * FROM expenses WHERE id = ?')
          .get(id)

        if (!before) throw new Error('Expense not found.')

        const row = before as { status: string }

        if (row.status === 'archived') {
          throw new Error('An archived expense cannot be edited.')
        }

        const category = database
          .prepare('SELECT key FROM expense_categories WHERE key = ? AND is_active = 1')
          .get(input.category) as { key: string } | undefined

        if (!category) {
          throw new Error('Unknown or inactive expense category.')
        }

        database
          .prepare(
            `UPDATE expenses
             SET description = ?, category = ?, amount = ?, payment_method = ?,
                 expense_date = ?, expense_time = ?, recorded_by = ?, notes = ?
             WHERE id = ?`
          )
          .run(
            requireTrimmed(input.description, 'Description', 500),
            input.category,
            Math.round(input.amount * 100) / 100,
            requireTrimmed(input.paymentMethod, 'Payment method', 80),
            input.expenseDate,
            input.expenseTime ?? toLocalIsoTime(),
            input.recordedBy?.trim() || null,
            input.notes?.trim() || null,
            id
          )

        this.activityLog('expense.update', 'expense', id, { before, input })

        return id
      })()

      return this.fetchExpense(update)
    } catch (error) {
      console.error('[GYM PRO] Expense update failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Expense could not be updated.'
      )
    }
  }

  archiveExpense(id: number): ExpenseRecord {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database

    try {
      const archive = database.transaction(() => {
        const before = database
          .prepare('SELECT * FROM expenses WHERE id = ?')
          .get(id) as
          | { status: string }
          | undefined

        if (!before) throw new Error('Expense not found.')

        if (before.status === 'archived') {
          throw new Error('Expense is already archived.')
        }

        database
          .prepare("UPDATE expenses SET status = 'archived' WHERE id = ?")
          .run(id)

        this.activityLog('expense.archive', 'expense', id, { before })

        return id
      })()

      return this.fetchExpense(archive)
    } catch (error) {
      console.error('[GYM PRO] Expense archival failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Expense could not be archived.'
      )
    }
  }

  createExpenseCategory(input: ExpenseCategoryInput): ExpenseCategory {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database
    const key = input.key.trim().toLowerCase()

    if (!/^[a-z0-9_]{2,40}$/.test(key)) {
      throw new Error('Category key must be 2-40 lowercase letters, digits, or underscores.')
    }

    const nameAr = requireTrimmed(input.nameAr, 'Arabic name', 80)
    const nameEn = requireTrimmed(input.nameEn, 'English name', 80)

    try {
      const create = database.transaction(() => {
        const result = database
          .prepare(
            `INSERT INTO expense_categories (key, name_ar, name_en, sort_order)
             VALUES (?, ?, ?, 100)`
          )
          .run(key, nameAr, nameEn)

        this.activityLog(
          'expense.category.create',
          'expense_category',
          Number(result.lastInsertRowid),
          { key, nameAr, nameEn }
        )

        return key
      })()

      return this.fetchExpenseCategory(create)
    } catch (error) {
      console.error('[GYM PRO] Category creation failed:', error)

      const message = String(error)

      if (/UNIQUE/i.test(message)) {
        throw new Error('A category with this key already exists.')
      }

      throw new Error('Expense category could not be created.')
    }
  }

  setExpenseCategoryActive(key: string, isActive: boolean): ExpenseCategory {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database
    const existing = this.expenseCategoryRow(key.trim().toLowerCase())

    if (!existing) {
      throw new Error('Expense category not found.')
    }

    const update = database.transaction(() => {
      database
        .prepare('UPDATE expense_categories SET is_active = ? WHERE key = ?')
        .run(isActive ? 1 : 0, existing.key)

      this.activityLog(
        'expense.category.set_active',
        'expense_category',
        existing.id,
        { key: existing.key, isActive }
      )
    })

    update()
    return this.fetchExpenseCategory(existing.key)
  }

  renameExpenseCategory(
    key: string,
    nameAr: string,
    nameEn: string
  ): ExpenseCategory {
    if (this.state !== 'ready' || !this.database) {
      throw new Error(this.error ?? 'The database is not initialized.')
    }

    const database = this.database
    const existing = this.expenseCategoryRow(key.trim().toLowerCase())

    if (!existing) {
      throw new Error('Expense category not found.')
    }

    const cleanAr = requireTrimmed(nameAr, 'Arabic name', 80)
    const cleanEn = requireTrimmed(nameEn, 'English name', 80)

    const rename = database.transaction(() => {
      database
        .prepare(
          'UPDATE expense_categories SET name_ar = ?, name_en = ? WHERE key = ?'
        )
        .run(cleanAr, cleanEn, existing.key)

      this.activityLog(
        'expense.category.rename',
        'expense_category',
        existing.id,
        { key: existing.key, nameAr: cleanAr, nameEn: cleanEn }
      )
    })

    rename()
    return this.fetchExpenseCategory(existing.key)
  }

  close(): void {
    if (!this.database) {
      return
    }

    try {
      this.database.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      // Closing the connection is more important than a best-effort checkpoint.
    }

    this.database.close()
    this.database = null
    this.state = 'closed'
  }
}
