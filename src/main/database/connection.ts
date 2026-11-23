import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export type SqliteDatabase = Database.Database

const BUSY_TIMEOUT_MS = 5_000

/**
 * Opens and configures a SQLite connection for the GYM PRO main process.
 *
 * Foreign keys are enabled on every connection (they are a per-connection
 * SQLite setting), WAL provides reliable local concurrency, and a busy timeout
 * prevents transient lock failures. This function is never imported by the
 * renderer or preload layer.
 */
export function createDatabaseConnection(filePath: string): SqliteDatabase {
  const absolutePath = resolve(filePath)
  mkdirSync(dirname(absolutePath), { recursive: true })

  const database = new Database(absolutePath, {
    timeout: BUSY_TIMEOUT_MS
  })

  try {
    database.pragma('journal_mode = WAL')
    database.pragma('synchronous = NORMAL')
    database.pragma('foreign_keys = ON')
    database.pragma('busy_timeout = 5000')
    database.pragma('temp_store = MEMORY')
    database.pragma('cache_size = -8192')

    const foreignKeysEnabled = database.pragma('foreign_keys', {
      simple: true
    })

    if (foreignKeysEnabled !== 1) {
      throw new Error('SQLite foreign key enforcement could not be enabled.')
    }

    return database
  } catch (error) {
    database.close()
    throw error
  }
}

export function getSchemaVersion(database: SqliteDatabase): number {
  return database.pragma('user_version', { simple: true }) as number
}

export function getJournalMode(database: SqliteDatabase): string {
  return database.pragma('journal_mode', { simple: true }) as string
}

export function getForeignKeysEnabled(database: SqliteDatabase): boolean {
  return database.pragma('foreign_keys', { simple: true }) === 1
}
