import { app, session } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Absolute URL of the production renderer directory. In development the
 * renderer is served by Vite and identified by its dev-server origin.
 */
function rendererDirectoryUrl(): string {
  return pathToFileURL(join(__dirname, '../renderer/')).href
}

export function isTrustedRendererUrl(candidate: string): boolean {
  if (!candidate) return false

  try {
    const url = new URL(candidate)
    const devServerUrl = process.env['ELECTRON_RENDERER_URL']

    if (devServerUrl) {
      return url.origin === new URL(devServerUrl).origin
    }

    return url.protocol === 'file:' && url.href.startsWith(rendererDirectoryUrl())
  } catch {
    return false
  }
}

export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? ''

  if (!isTrustedRendererUrl(senderUrl)) {
    throw new Error('Blocked IPC invocation from an untrusted renderer.')
  }
}

/**
 * Applies process-wide security defaults. Must run after `app.whenReady()`
 * and before the first window is created.
 */
export function applySecurityPolicies(): void {
  // GYM PRO needs no device permissions. Deny everything until a future
  // feature explicitly requires and validates a permission.
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)

  app.on('web-contents-created', (_event, contents) => {
    // No popups or secondary windows.
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))

    // Keep the renderer on its own trusted origin.
    contents.on('will-navigate', (event, navigationUrl) => {
      if (!isTrustedRendererUrl(navigationUrl)) {
        event.preventDefault()
      }
    })

    contents.on('will-redirect', (event, navigationUrl) => {
      if (!isTrustedRendererUrl(navigationUrl)) {
        event.preventDefault()
      }
    })

    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })
}
