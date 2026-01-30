import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initMessages, getInitialLocale, getMessages, type Locale } from './lib/i18n'

async function bootstrapApplication() {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Failed to find the root element')

  // Initialize translation messages
  await initMessages()

  // Determine initial locale from browser/storage
  const locale: Locale = getInitialLocale()

  // Get messages for the initial locale
  const messages = getMessages(locale)

  const root = createRoot(rootElement)
  root.render(
    <StrictMode>
      <App locale={locale} messages={messages} />
    </StrictMode>
  )
}

bootstrapApplication().catch((error) => {
  console.error('Failed to bootstrap application:', error)
})
