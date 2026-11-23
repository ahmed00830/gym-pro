import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getDatabaseService } from '../database'
import { assertTrustedIpcSender } from '../security'
import {
  validateFreezeInput,
  validateSubscriptionId,
  validateSubscriptionInput
} from '../subscriptions/validate'

export function registerSubscriptionIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.subscriptions.create, (event, rawInput: unknown) => {
    assertTrustedIpcSender(event)
    try {
      const input = validateSubscriptionInput(rawInput)
      return getDatabaseService().createSubscription(input)
    } catch (error) {
      console.error('[GYM PRO] Subscription creation failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Subscription could not be created.')
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.subscriptions.freeze,
    (event, rawId: unknown, startDate: unknown, endDate: unknown, reason: unknown) => {
      assertTrustedIpcSender(event)
      try {
        const id = validateSubscriptionId(rawId)
        const validated = validateFreezeInput({
          startDate,
          endDate,
          reason
        })
        return getDatabaseService().freezeSubscription(
          id,
          validated.startDate,
          validated.endDate,
          validated.reason
        )
      } catch (error) {
        console.error('[GYM PRO] Freeze failed:', error)
        throw new Error(error instanceof Error ? error.message : 'Subscription could not be frozen.')
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.subscriptions.resume, (event, rawId: unknown, resumeDate: unknown) => {
    assertTrustedIpcSender(event)
    try {
      const id = validateSubscriptionId(rawId)
      if (typeof resumeDate !== 'string') throw new Error('Resume date is required.')
      return getDatabaseService().resumeSubscription(id, resumeDate)
    } catch (error) {
      console.error('[GYM PRO] Resume failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Subscription could not be resumed.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.subscriptions.cancel, (event, rawId: unknown) => {
    assertTrustedIpcSender(event)
    try {
      const id = validateSubscriptionId(rawId)
      return getDatabaseService().cancelSubscription(id)
    } catch (error) {
      console.error('[GYM PRO] Cancellation failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Subscription could not be cancelled.')
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.subscriptions.recordPayment,
    (
      event,
      subscriptionId: unknown,
      amount: unknown,
      method: unknown,
      paymentDate: unknown,
      notes: unknown
    ) => {
      assertTrustedIpcSender(event)
      try {
        const id = validateSubscriptionId(subscriptionId)
        if (typeof amount !== 'number' || amount <= 0) {
          throw new Error('Payment amount must be positive.')
        }
        if (typeof method !== 'string' || !method.trim()) {
          throw new Error('Payment method is required.')
        }
        if (typeof paymentDate !== 'string') {
          throw new Error('Payment date is required.')
        }
        const cleanNotes =
          notes === null || notes === undefined || notes === ''
            ? null
            : String(notes)

        // Need member id from subscription; fetch via service? We'll get from DB.
        return getDatabaseService().recordSubscriptionPayment(
          id,
          amount,
          method.trim(),
          paymentDate,
          cleanNotes
        )
      } catch (error) {
        console.error('[GYM PRO] Payment recording failed:', error)
        throw new Error(error instanceof Error ? error.message : 'Payment could not be recorded.')
      }
    }
  )
}
