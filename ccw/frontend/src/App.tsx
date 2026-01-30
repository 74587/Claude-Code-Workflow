// ========================================
// App Component
// ========================================
// Root application component with Router provider

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { router } from './router';
import queryClient from './lib/query-client';
import type { Locale } from './lib/i18n';

interface AppProps {
  locale: Locale;
  messages: Record<string, string>;
}

/**
 * Root App component
 * Provides routing and global providers
 */
function App({ locale, messages }: AppProps) {
  return (
    <IntlProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </IntlProvider>
  );
}

export default App;
