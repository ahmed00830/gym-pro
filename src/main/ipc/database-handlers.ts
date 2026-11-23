import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { assertTrustedIpcSender } from '../security'

/**
 * Registers the only database operations available to the renderer:
 * health, initialization status, and read-only database metadata. There are
 * deliberately no query, execute, file, or connection methods.
 */
export function registerDatabaseIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.database.healthCheck, (event) => {
    assertTrustedIpcSender(event)
    return getDatabaseService().healthCheck()
  })

  ipcMain.handle(IPC_CHANNELS.database.getInitializationStatus, (event) => {
    assertTrustedIpcSender(event)
    return getDatabaseService().getInitializationStatus()
  })

  ipcMain.handle(IPC_CHANNELS.database.getInfo, (event) => {
    assertTrustedIpcSender(event)

    try {
      return getDatabaseService().getInfo()
    } catch (error) {
      console.error('[GYM PRO] Database information request failed:', error)
      throw new Error('Database information is unavailable.')
    }
  })
}
