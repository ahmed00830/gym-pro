import { useEffect, useState } from 'react'
import {
  hrefFor,
  parseHash,
  type AppRoute
} from '../lib/routes'

export function useHashRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseHash(window.location.hash)
  )

  useEffect(() => {
    if (!window.location.hash.startsWith('#/')) {
      window.history.replaceState(null, '', hrefFor('dashboard'))
      setRoute(parseHash(hrefFor('dashboard')))
    }

    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [route.memberId, route.name])

  return route
}
