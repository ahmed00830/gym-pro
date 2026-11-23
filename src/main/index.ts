import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import { closeDatabaseService, initializeDatabaseService } from './database'
import { registerAnalyticsIpcHandlers } from './ipc/analytics-handlers'
import { registerAppIpcHandlers } from './ipc/app-handlers'
import { registerAttendanceIpcHandlers } from './ipc/attendance-handlers'
import { registerDatabaseIpcHandlers } from './ipc/database-handlers'
import { registerExpenseIpcHandlers } from './ipc/expense-handlers'
import { registerMemberIpcHandlers } from './ipc/member-handlers'
import { registerPlanIpcHandlers } from './ipc/plan-handlers'
import { registerQuickIpcHandlers } from './ipc/quick-handlers'
import { registerSubscriptionIpcHandlers } from './ipc/subscription-handlers'
import { applySecurityPolicies } from './security'
import { createMainWindow } from './window'

// Isolated development/test hook: when GYM_PRO_USER_DATA is set, the app uses
// that directory for the entire user-data profile (database, localStorage and
// caches) instead of Electron's default folder. It is never set in
// production builds, so installed users are unaffected.
if (process.env.GYM_PRO_USER_DATA) {
  app.setPath('userData', process.env.GYM_PRO_USER_DATA)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
let mainWindow: BrowserWindow | null = null

function openMainWindow(): BrowserWindow {
  const window = createMainWindow()

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })

  mainWindow = window
  return window
}

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  // Enforce Chromium's OS-level sandbox for every renderer.
  app.enableSandbox()

  app.on('second-instance', () => {
    if (!mainWindow) return

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.gympro.desktop')

    // GYM PRO ships a dark-only interface. Sync the native window chrome.
    nativeTheme.themeSource = 'dark'

    applySecurityPolicies()
    registerAppIpcHandlers()
    registerAttendanceIpcHandlers()
    registerExpenseIpcHandlers()
    registerDatabaseIpcHandlers()
    registerAnalyticsIpcHandlers()
    registerMemberIpcHandlers()
    registerPlanIpcHandlers()
    registerQuickIpcHandlers()
    registerSubscriptionIpcHandlers()

    const databaseStatus = initializeDatabaseService()

    if (databaseStatus.state === 'ready') {
      console.info(
        `[GYM PRO] Database ready (schema v${databaseStatus.schemaVersion}).`
      )
    } else {
      console.error(
        `[GYM PRO] Database initialization failed: ${
          databaseStatus.error ?? 'Unknown error'
        }`
      )
    }

    // The application menu is a development aid only.
    if (app.isPackaged) {
      Menu.setApplicationMenu(null)
    }

    openMainWindow()
    console.info('[GYM PRO] Application ready.')

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        openMainWindow()
      }
    })
  })

  app.on('before-quit', () => {
    closeDatabaseService()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
