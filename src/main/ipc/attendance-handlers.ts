import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { assertTrustedIpcSender } from '../security'

export function registerAttendanceIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.attendance.register, (event, rawId: unknown) => {
    assertTrustedIpcSender(event)

    if (typeof rawId !== 'number' || !Number.isInteger(rawId) || rawId <= 0) {
      throw new Error('Member number is invalid.')
    }

    try {
      return getDatabaseService().registerAttendance(rawId)
    } catch (error) {
      console.error('[GYM PRO] Attendance registration failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Attendance could not be registered.')
    }
  })
}
