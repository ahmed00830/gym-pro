import { ipcMain } from 'electron'
import type { AnalyticsRangeReport, WorkspaceSnapshot } from '../../shared/analytics'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { isValidLocalIsoDate } from '../database/date-time'
import { assertTrustedIpcSender } from '../security'

function validateRangeReportInput(rawFrom: unknown, rawTo: unknown): { from: string; to: string } {
  if (typeof rawFrom !== 'string' || typeof rawTo !== 'string') {
    throw new Error('The report range must be two ISO dates.')
  }

  const from = rawFrom.trim()
  const to = rawTo.trim()

  if (!isValidLocalIsoDate(from) || !isValidLocalIsoDate(to)) {
    throw new Error('The report range contains an invalid date.')
  }

  if (from > to) {
    throw new Error('The start of the report range must not be after its end.')
  }

  const spanDays = Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) /
      86_400_000
  )

  if (spanDays > 3660) {
    throw new Error('The report range is too large.')
  }

  return { from, to }
}

/**
 * Analytics handlers. The snapshot takes no caller input; the range report
 * validates its two ISO dates before any SQL runs. The renderer still has no
 * query, execute, or connection method.
 */
export function registerAnalyticsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.analytics.getSnapshot, (event) => {
    assertTrustedIpcSender(event)

    try {
      return getDatabaseService().getWorkspaceSnapshot() as WorkspaceSnapshot
    } catch (error) {
      console.error('[GYM PRO] Analytics snapshot request failed:', error)
      throw new Error('Workspace data is unavailable.')
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.analytics.getRangeReport,
    (event, rawFrom: unknown, rawTo: unknown) => {
      assertTrustedIpcSender(event)

      try {
        const { from, to } = validateRangeReportInput(rawFrom, rawTo)
        return getDatabaseService().getRangeReport(from, to) as AnalyticsRangeReport
      } catch (error) {
        console.error('[GYM PRO] Range report request failed:', error)
        throw new Error(
          error instanceof Error ? error.message : 'The range report is unavailable.'
        )
      }
    }
  )
}
