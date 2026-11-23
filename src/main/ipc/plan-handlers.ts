import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { assertTrustedIpcSender } from '../security'
import { validatePlanId, validatePlanInput } from '../plans/validate'

export function registerPlanIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.plans.create, (event, rawInput: unknown) => {
    assertTrustedIpcSender(event)
    try {
      const input = validatePlanInput(rawInput)
      return getDatabaseService().createPlan(input)
    } catch (error) {
      console.error('[GYM PRO] Plan creation failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Plan could not be created.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.plans.update, (event, rawId: unknown, rawInput: unknown) => {
    assertTrustedIpcSender(event)
    try {
      const id = validatePlanId(rawId)
      const input = validatePlanInput(rawInput)
      return getDatabaseService().updatePlan(id, input)
    } catch (error) {
      console.error('[GYM PRO] Plan update failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Plan could not be updated.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.plans.setActive, (event, rawId: unknown, isActive: unknown) => {
    assertTrustedIpcSender(event)
    try {
      const id = validatePlanId(rawId)
      if (typeof isActive !== 'boolean') throw new Error('Plan status is invalid.')
      return getDatabaseService().setPlanActive(id, isActive)
    } catch (error) {
      console.error('[GYM PRO] Plan activation failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Plan could not be updated.')
    }
  })
}
