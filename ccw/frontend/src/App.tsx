// ========================================
// App Component
// ========================================
// Root application component with Router provider

import { RouterProvider } from 'react-router-dom';
import { router } from './router';

/**
 * Root App component
 * Provides routing and global providers
 */
function App() {
  return <RouterProvider router={router} />;
}

export default App;
