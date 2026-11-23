import { useCallback, useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'

type AppInfoStatus = 'loading' | 'ready' | 'error'

interface AppInfoState {
  status: AppInfoStatus
  data: AppInfo | null
  error: string | null
}

export interface AppInfoResult extends AppInfoState {
  reload: () => void
}

const initialState: AppInfoState = {
  status: 'loading',
  data: null,
  error: null
}

export function useAppInfo(): AppInfoResult {
  const [state, setState] = useState<AppInfoState>(initialState)
  const [requestKey, setRequestKey] = useState(0)

  const reload = useCallback(() => {
    setState(initialState)
    setRequestKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let isCurrent = true
    const api = window.gymPro?.app

    if (!api) {
      setState({
        status: 'error',
        data: null,
        error: 'The GYM PRO preload bridge is unavailable.'
      })
      return
    }

    api
      .getInfo()
      .then((data) => {
        if (isCurrent) {
          setState({ status: 'ready', data, error: null })
        }
      })
      .catch((error: unknown) => {
        console.error('[GYM PRO] Failed to read application info:', error)

        if (isCurrent) {
          setState({
            status: 'error',
            data: null,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [requestKey])

  return { ...state, reload }
}
