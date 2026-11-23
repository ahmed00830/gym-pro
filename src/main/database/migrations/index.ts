import { coreSchemaMigration } from './001-core-schema'
import { systemTablesMigration } from './002-system-tables'
import { memberPhotoMigration } from './003-member-photo'
import { subscriptionFreezesMigration } from './004-subscription-freezes'
import { attendanceUniqueMigration } from './005-attendance-unique'
import { memberNumbersMigration } from './006-member-numbers'
import { subscriptionHistorySnapshotsMigration } from './007-subscription-history-snapshots'
import { expensesHardeningMigration } from './008-expenses-hardening'
import { expenseCategoriesMigration } from './009-expense-categories'
import type { Migration } from './types'

/**
 * Immutable, ordered database migrations. Never edit a migration that has
 * been released; add a new migration instead. The migration runner verifies a
 * SHA-256 checksum for every applied migration.
 */
export const MIGRATIONS: readonly Migration[] = Object.freeze([
  coreSchemaMigration,
  systemTablesMigration,
  memberPhotoMigration,
  subscriptionFreezesMigration,
  attendanceUniqueMigration,
  memberNumbersMigration,
  subscriptionHistorySnapshotsMigration,
  expensesHardeningMigration,
  expenseCategoriesMigration
])

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version

export type { Migration }
