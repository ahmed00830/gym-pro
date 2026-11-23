import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { assertTrustedIpcSender } from '../security'
import {
  validateMemberId,
  validateMemberInput
} from '../members/validate'

export function registerMemberIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.members.create, (event, rawInput: unknown) => {
    assertTrustedIpcSender(event)

    try {
      const input = validateMemberInput(rawInput)
      return getDatabaseService().createMember(input)
    } catch (error) {
      console.error('[GYM PRO] Member creation request failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Member could not be created.'
      )
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.members.update,
    (event, rawId: unknown, rawInput: unknown) => {
      assertTrustedIpcSender(event)

      try {
        const id = validateMemberId(rawId)
        const input = validateMemberInput(rawInput)
        return getDatabaseService().updateMember(id, input)
      } catch (error) {
        console.error('[GYM PRO] Member update request failed:', error)
        throw new Error(
          error instanceof Error ? error.message : 'Member could not be updated.'
        )
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.members.delete, (event, rawId: unknown) => {
    assertTrustedIpcSender(event)

    try {
      const id = validateMemberId(rawId)
      return getDatabaseService().deleteMember(id)
    } catch (error) {
      console.error('[GYM PRO] Member deletion request failed:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Member could not be deleted.'
      )
    }
  })
}
