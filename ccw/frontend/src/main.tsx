import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import 'xterm/css/xterm.css'
import { loadMessagesForLocale, getInitialLocale } from './lib/i18n'
import { logWebVitals } from './lib/webVitals'

/**
 * Initialize CSRF token by fetching from backend
 * This ensures the CSRF cookie is set before any mutating API calls
 */
async function initCsrfToken() {
  try {
    // Fetch CSRF token from backend - this sets the XSRF-TOKEN cookie
    await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
    })
  } catch (error) {
    // Log error but don't block app initialization
    console.error('Failed to initialize CSRF token:', error)
  }
}

async function bootstrapApplication() {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Failed to find the root element')

  // Parallelize CSRF token fetch and locale detection (independent operations)
  const [, locale] = await Promise.all([
    initCsrfToken(),
    getInitialLocale()
  ])

  // Load only the active locale's messages (lazy load secondary on demand)
  const messages = await loadMessagesForLocale(locale)

  const root = createRoot(rootElement)
  root.render(
    <StrictMode>
      <App locale={locale} messages={messages} />
    </StrictMode>
  )

  // Initialize Web Vitals monitoring (LCP, FID, CLS)
  // Logs metrics to console in development; extend to analytics in production
  logWebVitals()
}

bootstrapApplication().catch((error) => {
  console.error('Failed to bootstrap application:', error)
})
