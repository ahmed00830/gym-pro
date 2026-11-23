import { I18nProvider } from './i18n'
import { AppShell } from './components/layout/AppShell'
import { WorkspaceProvider } from './workspace/WorkspaceProvider'

export function App() {
  return (
    <I18nProvider>
      <WorkspaceProvider>
        <AppShell />
      </WorkspaceProvider>
    </I18nProvider>
  )
}
