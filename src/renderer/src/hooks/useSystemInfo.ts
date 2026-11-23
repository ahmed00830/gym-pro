import { useCallback, useEffect, useState } from 'react'
import type {
  DatabaseHealthCheck,
  DatabaseInfo
} from '@shared/database'
import type { AppInfo } from '@shared/ipc'

interface SystemInfoState {
  status: 'loading' | 'ready' | 'error'
  appInfo: AppInfo | null
  databaseInfo: DatabaseInfo | null
  health: DatabaseHealthCheck | null
  error: string | null
}

const initialState: SystemInfoState = {
  status: 'loading',
  appInfo: null,
  databaseInfo: null,
  health: null,
  error: null
}

export function useSystemInfo(): SystemInfoState & { reload: () => void } {
  const [state, setState] = useState<SystemInfoState>(initialState)
  const [requestKey, setRequestKey] = useState(0)

  const reload = useCallback(() => {
    setRequestKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let isCurrent = true
    setState(initialState)

    const appApi = window.gymPro?.app
    const databaseApi = window.gymPro?.database

    if (!appApi || !databaseApi) {
      setState({
        ...initialState,
        status: 'error',
        error: 'The GYM PRO bridge is unavailable.'
      })
      return
    }

    Promise.all([
      appApi.getInfo(),
      databaseApi.getInfo(),
      databaseApi.healthCheck()
    ])
      .then(([appInfo, databaseInfo, health]) => {
        if (!isCurrent) return
        setState({
          status: 'ready',
          appInfo,
          databaseInfo,
          health,
          error: null
        })
      })
      .catch((reason: unknown) => {
        if (!isCurrent) return
        setState({
          ...initialState,
          status: 'error',
          error:
            reason instanceof Error
              ? reason.message
              : 'System information could not be loaded.'
        })
      })

    return () => {
      isCurrent = false
    }
  }, [requestKey])

  return { ...state, reload }
}
