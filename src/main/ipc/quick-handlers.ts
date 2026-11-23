import { ipcMain } from 'electron'
import type { QuickRegisterInput, QuickRenewInput } from '../../shared/analytics'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { assertTrustedIpcSender } from '../security'

export function registerQuickIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.members.quickRegister, (event, rawInput: unknown) => {
    assertTrustedIpcSender(event)
    try {
      if (typeof rawInput !== 'object' || rawInput === null) {
        throw new Error('Registration data is invalid.')
      }
      const input = rawInput as Record<string, unknown>

      if (typeof input.fullName !== 'string' || !input.fullName.trim()) {
        throw new Error('Full name is required.')
      }
      if (typeof input.phone !== 'string' || !input.phone.trim()) {
        throw new Error('Phone number is required.')
      }
      if (typeof input.planId !== 'number' || !Number.isInteger(input.planId) || input.planId <= 0) {
        throw new Error('Plan is required.')
      }
      if (typeof input.startDate !== 'string') throw new Error('Start date is required.')
      if (typeof input.paymentMethod !== 'string' || !input.paymentMethod.trim()) {
        throw new Error('Payment method is required.')
      }
      if (typeof input.paymentDate !== 'string') throw new Error('Payment date is required.')

      const quickInput: QuickRegisterInput = {
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        planId: input.planId,
        startDate: input.startDate,
        paymentMethod: input.paymentMethod.trim(),
        paymentDate: input.paymentDate,
        notes:
          input.notes === null || input.notes === undefined || input.notes === ''
            ? null
            : String(input.notes).trim() || null
      }

      return getDatabaseService().quickRegisterMember(quickInput)
    } catch (error) {
      console.error('[GYM PRO] Quick registration failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Registration could not be completed.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.subscriptions.quickRenew, (event, rawInput: unknown) => {
    assertTrustedIpcSender(event)
    try {
      if (typeof rawInput !== 'object' || rawInput === null) {
        throw new Error('Renewal data is invalid.')
      }
      const input = rawInput as Record<string, unknown>

      if (typeof input.memberId !== 'number' || !Number.isInteger(input.memberId) || input.memberId <= 0) {
        throw new Error('Member is required.')
      }
      if (typeof input.planId !== 'number' || !Number.isInteger(input.planId) || input.planId <= 0) {
        throw new Error('Plan is required.')
      }
      if (typeof input.paymentMethod !== 'string' || !input.paymentMethod.trim()) {
        throw new Error('Payment method is required.')
      }
      if (typeof input.paymentDate !== 'string') throw new Error('Payment date is required.')

      const quickInput: QuickRenewInput = {
        memberId: input.memberId,
        planId: input.planId,
        paymentMethod: input.paymentMethod.trim(),
        paymentDate: input.paymentDate,
        startDate:
          input.startDate === null || input.startDate === undefined || input.startDate === ''
            ? null
            : String(input.startDate),
        notes:
          input.notes === null || input.notes === undefined || input.notes === ''
            ? null
            : String(input.notes).trim() || null
      }

      return getDatabaseService().quickRenewSubscription(quickInput)
    } catch (error) {
      console.error('[GYM PRO] Quick renewal failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Renewal could not be completed.')
    }
  })
}
