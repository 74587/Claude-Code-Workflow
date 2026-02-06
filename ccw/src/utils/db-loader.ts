/**
 * Database Loader - Centralized better-sqlite3 loading with native module error handling
 * Catches NODE_MODULE_VERSION mismatch errors and provides actionable fix instructions
 */

let warningShown = false;

function showNativeModuleWarning(error: Error): void {
  if (warningShown) return;
  warningShown = true;

  const isVersionMismatch = error.message?.includes('NODE_MODULE_VERSION') ||
    (error as any).code === 'ERR_DLOPEN_FAILED';

  if (isVersionMismatch) {
    console.error(
      '\n[CCW] better-sqlite3 native module version mismatch.\n' +
      '  The module was compiled for a different Node.js version.\n' +
      '  Fix: run one of the following commands:\n' +
      '    npm rebuild better-sqlite3\n' +
      '    npm install better-sqlite3 --build-from-source\n'
    );
  }
}

/**
 * Load better-sqlite3 Database constructor with error handling.
 * Returns the Database class or null if loading fails.
 */
export function loadDatabase(): typeof import('better-sqlite3') | null {
  try {
    // Use dynamic import via require for native module
    const Database = require('better-sqlite3');
    return Database;
  } catch (error: any) {
    showNativeModuleWarning(error);
    return null;
  }
}

/**
 * Create a database instance with error handling.
 * Returns the database instance or null if creation fails.
 */
export function createDatabase(dbPath: string, options?: any): any | null {
  const Database = loadDatabase();
  if (!Database) return null;
  try {
    return new Database(dbPath, options);
  } catch (error: any) {
    showNativeModuleWarning(error);
    return null;
  }
}
