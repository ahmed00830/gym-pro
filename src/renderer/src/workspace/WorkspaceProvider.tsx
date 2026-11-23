import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { WorkspaceSnapshot } from '@shared/analytics'

type WorkspaceStatus = 'loading' | 'ready' | 'error'

interface WorkspaceContextValue {
  status: WorkspaceStatus
  snapshot: WorkspaceSnapshot | null
  error: string | null
  refreshing: boolean
  refresh: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const WorkspaceDataContext = createContext<WorkspaceSnapshot | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null)
  const [status, setStatus] = useState<WorkspaceStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setStatus('loading')
    setError(null)

    const api = window.gymPro?.analytics

    if (!api) {
      setStatus('error')
      setError('The GYM PRO analytics bridge is unavailable.')
      return
    }

    api
      .getSnapshot()
      .then((data) => {
        if (!isCurrent) return
        setSnapshot(data)
        setStatus('ready')
      })
      .catch((reason: unknown) => {
        if (!isCurrent) return
        setStatus('error')
        setError(
          reason instanceof Error
            ? reason.message
            : 'Workspace data could not be loaded.'
        )
      })

    return () => {
      isCurrent = false
    }
  }, [requestKey])

  const refresh = useCallback(() => {
    setRequestKey((key) => key + 1)
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      status,
      snapshot,
      error,
      refreshing: status === 'loading' && snapshot !== null,
      refresh
    }),
    [error, refresh, snapshot, status]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      <WorkspaceDataContext.Provider value={snapshot}>
        {children}
      </WorkspaceDataContext.Provider>
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider.')
  }

  return context
}

/** Available only inside the data provider, which requires a loaded snapshot. */
export function useWorkspaceData(): WorkspaceSnapshot {
  const snapshot = useContext(WorkspaceDataContext)

  if (!snapshot) {
    throw new Error('Workspace data is not ready.')
  }

  return snapshot
}
