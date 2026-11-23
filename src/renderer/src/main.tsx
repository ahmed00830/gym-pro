import '@fontsource-variable/readex-pro'
import '@fontsource-variable/space-grotesk'
import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initializeLocale } from './i18n'

initializeLocale()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Unable to find the React root element.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
