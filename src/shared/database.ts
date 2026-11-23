/**
 * Database contracts shared by the Electron main process, preload bridge, and
 * renderer. These types deliberately contain no SQL, connection objects, or
 * filesystem handles.
 */

export type DatabaseState = 'pending' | 'ready' | 'failed' | 'closed'

export interface DatabaseMigrationInfo {
  version: number
  name: string
  appliedAt: string
}

export interface DatabaseInitializationStatus {
  state: DatabaseState
  initialized: boolean
  schemaVersion: number
  targetSchemaVersion: number
  appliedMigrations: DatabaseMigrationInfo[]
  pendingMigrationCount: number
  error: string | null
  checkedAt: string
}

export interface DatabaseHealthCheck {
  ok: boolean
  initialized: boolean
  state: DatabaseState
  schemaVersion: number
  targetSchemaVersion: number
  foreignKeysEnabled: boolean
  integrityCheck: 'ok' | 'failed' | 'not-run'
  foreignKeyViolations: number
  journalMode: string | null
  checkedAt: string
  error: string | null
}

export interface DatabaseInfo {
  engine: 'SQLite'
  sqliteVersion: string
  fileName: string
  filePath: string
  schemaVersion: number
  targetSchemaVersion: number
  sizeBytes: number
  pageSize: number
  pageCount: number
  journalMode: string
  foreignKeysEnabled: boolean
  applicationTableCount: number
  initializedAt: string | null
}

/** Approved database operations exposed through `window.gymPro.database`. */
export interface DatabaseApi {
  healthCheck: () => Promise<DatabaseHealthCheck>
  getInitializationStatus: () => Promise<DatabaseInitializationStatus>
  getInfo: () => Promise<DatabaseInfo>
}
