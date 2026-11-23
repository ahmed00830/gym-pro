import { app, ipcMain } from 'electron'
import { IPC_CHANNELS, type AppInfo } from '../../shared/ipc'
import { assertTrustedIpcSender } from '../security'

function getAppInfo(): AppInfo {
  return {
    name: app.getName(),
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged
  }
}

export function registerAppIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.app.getInfo, (event) => {
    assertTrustedIpcSender(event)
    return getAppInfo()
  })
}
