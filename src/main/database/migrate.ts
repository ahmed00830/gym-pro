import { createHash } from 'node:crypto'
import type { DatabaseMigrationInfo } from '../../shared/database'
import {
  getSchemaVersion,
  type SqliteDatabase
} from './connection'
import { MIGRATIONS, type Migration } from './migrations'

interface AppliedMigrationRow {
  version: number
  name: string
  checksum: string
  applied_at: string
}

export interface MigrationRunResult {
  fromVersion: number
  toVersion: number
  appliedMigrations: DatabaseMigrationInfo[]
  history: DatabaseMigrationInfo[]
}

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
`

function migrationChecksum(migration: Migration): string {
  return createHash('sha256')
    .update(`${migration.version}:${migration.name}:${migration.sql}`)
    .digest('hex')
}

function validateMigrationList(migrations: readonly Migration[]): void {
  let previousVersion = 0

  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(`Invalid database migration version: ${migration.version}`)
    }

    if (migration.version <= previousVersion) {
      throw new Error('Database migrations must be unique and ordered by version.')
    }

    if (!migration.name.trim()) {
      throw new Error(`Database migration ${migration.version} has no name.`)
    }

    previousVersion = migration.version
  }
}

export function listAppliedMigrations(
  database: SqliteDatabase
): DatabaseMigrationInfo[] {
  const hasMetadataTable = database
    .prepare(
      `SELECT 1 AS present
       FROM sqlite_master
       WHERE type = 'table' AND name = 'schema_migrations'`
    )
    .get()

  if (!hasMetadataTable) return []

  return (
    database
      .prepare(
        `SELECT version, name, applied_at
         FROM schema_migrations
         ORDER BY version ASC`
      )
      .all() as AppliedMigrationRow[]
  ).map((row) => ({
    version: row.version,
    name: row.name,
    appliedAt: row.applied_at
  }))
}

/**
 * Applies pending migrations transactionally and verifies previously applied
 * migrations. Each migration and its version marker commit atomically.
 */
export function runMigrations(
  database: SqliteDatabase,
  migrations: readonly Migration[] = MIGRATIONS
): MigrationRunResult {
  validateMigrationList(migrations)
  database.exec(MIGRATIONS_TABLE_SQL)

  const fromVersion = getSchemaVersion(database)
  const appliedRows = database
    .prepare(
      `SELECT version, name, checksum, applied_at
       FROM schema_migrations
       ORDER BY version ASC`
    )
    .all() as AppliedMigrationRow[]

  const latestAppliedVersion = appliedRows.at(-1)?.version ?? 0

  if (fromVersion !== latestAppliedVersion) {
    throw new Error(
      `Database schema version ${fromVersion} does not match migration history ${latestAppliedVersion}.`
    )
  }

  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration])
  )
  const appliedByVersion = new Map(
    appliedRows.map((migration) => [migration.version, migration])
  )

  for (const applied of appliedRows) {
    if (applied.version > fromVersion) {
      throw new Error(
        `Database contains an unexpected future migration: ${applied.version}.`
      )
    }

    const knownMigration = migrationsByVersion.get(applied.version)

    if (!knownMigration) {
      throw new Error(
        `Database migration ${applied.version} is not present in this build.`
      )
    }

    if (knownMigration.name !== applied.name) {
      throw new Error(
        `Database migration ${applied.version} name does not match this build.`
      )
    }

    if (migrationChecksum(knownMigration) !== applied.checksum) {
      throw new Error(
        `Database migration ${applied.version} checksum does not match this build.`
      )
    }
  }

  for (const migration of migrations) {
    if (
      migration.version <= fromVersion &&
      !appliedByVersion.has(migration.version)
    ) {
      throw new Error(
        `Database migration ${migration.version} is missing from migration history.`
      )
    }
  }

  const pendingMigrations = migrations.filter(
    (migration) => migration.version > fromVersion
  )
  const appliedVersions: number[] = []
  const insertMigration = database.prepare(
    `INSERT INTO schema_migrations (version, name, checksum)
     VALUES (?, ?, ?)`
  )

  for (const migration of pendingMigrations) {
    const applyMigration = database.transaction(() => {
      database.exec(migration.sql)
      insertMigration.run(
        migration.version,
        migration.name,
        migrationChecksum(migration)
      )
      // SQLite does not support bound parameters in PRAGMA statements. The
      // version is validated above as a positive integer from our own code.
      database.pragma(`user_version = ${migration.version}`)
    })

    applyMigration()
    appliedVersions.push(migration.version)
  }

  const history = listAppliedMigrations(database)
  const appliedSet = new Set(appliedVersions)

  return {
    fromVersion,
    toVersion: getSchemaVersion(database),
    appliedMigrations: history.filter((migration) =>
      appliedSet.has(migration.version)
    ),
    history
  }
}
