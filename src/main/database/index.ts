import { app } from 'electron'
import { join } from 'node:path'
import type { DatabaseInitializationStatus } from '../../shared/database'
import { GymProDatabase } from './GymProDatabase'

export const DATABASE_FILE_NAME = 'gym-pro.db'

let databaseService: GymProDatabase | null = null

/**
 * Resolves the database inside Electron's per-user data directory. It must
 * never live beside the installed application, in the project source tree, or
 * in a directory writable by the renderer.
 */
export function resolveDatabasePath(
  userDataPath: string = app.getPath('userData')
): string {
  return join(userDataPath, DATABASE_FILE_NAME)
}

export function getDatabaseService(): GymProDatabase {
  if (!databaseService) {
    databaseService = new GymProDatabase(resolveDatabasePath())
  }

  return databaseService
}

export function initializeDatabaseService(): DatabaseInitializationStatus {
  return getDatabaseService().initialize()
}

export function closeDatabaseService(): void {
  databaseService?.close()
  databaseService = null
}
