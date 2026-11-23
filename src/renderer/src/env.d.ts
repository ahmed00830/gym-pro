/// <reference types="vite/client" />

import type { GymProApi } from '@shared/ipc'

declare global {
  interface Window {
    gymPro: GymProApi
  }
}

export {}
