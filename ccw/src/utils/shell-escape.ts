/**
 * Cross-platform shell argument escaping utilities.
 *
 * Provides proper escaping for command-line arguments when using spawn({ shell: true })
 * on different platforms:
 * - Windows: cmd.exe metacharacter handling with proper quote escaping
 * - Unix (Linux/macOS): POSIX shell escaping with single quotes
 */

/**
 * Escape a command-line argument for Windows cmd.exe.
 * Follows Microsoft C/C++ runtime argv parsing rules.
 *
 * Rules:
 * 1. Arguments containing spaces, tabs, or quotes must be quoted
 * 2. Backslashes are literal unless followed by a quote
 * 3. To include a literal quote, use \"
 * 4. Backslashes before a quote must be doubled: \\" produces \"
 * 5. Trailing backslashes must be doubled when the arg is quoted
 *
 * @param arg - The argument to escape
 * @returns Properly escaped argument safe for Windows command line
 */
export function escapeWindowsArg(arg: string): string {
  if (arg === '') return '""';

  // Normalize newlines to spaces to prevent cmd.exe issues
  arg = arg.replace(/\r?\n/g, ' ');

  // Check if the argument needs quoting
  // Characters that require quoting: space, tab, double quote, or backslash
  const needsQuoting = /[ \t"\\]/.test(arg);

  if (!needsQuoting) {
    // No special characters - return as is
    return arg;
  }

  // Build the escaped string with proper quoting
  let result = '"';

  for (let i = 0; i < arg.length; i++) {
    // Count consecutive backslashes
    let backslashes = 0;
    while (i < arg.length && arg[i] === '\\') {
      backslashes++;
      i++;
    }

    if (i === arg.length) {
      // Trailing backslashes: double them all (they precede the closing quote)
      result += '\\'.repeat(backslashes * 2);
      break;
    }

    if (arg[i] === '"') {
      // Backslashes followed by a quote: double the backslashes and escape the quote
      result += '\\'.repeat(backslashes * 2 + 1) + '"';
    } else {
      // Backslashes not followed by a quote: they are literal
      result += '\\'.repeat(backslashes) + arg[i];
    }
  }

  result += '"';
  return result;
}

/**
 * Escape a command-line argument for Unix shells (bash, sh, zsh).
 * Uses single quotes which treat all characters literally except single quote itself.
 *
 * Strategy:
 * - Wrap argument in single quotes
 * - Replace any single quotes with: '\'' (end quote, escaped quote, start quote)
 *
 * @param arg - The argument to escape
 * @returns Properly escaped argument safe for Unix shell
 */
export function escapeUnixArg(arg: string): string {
  if (arg === '') return "''";

  // If no special characters, return as-is
  // Safe characters: alphanumeric, hyphen, underscore, dot, forward slash, colon
  if (/^[a-zA-Z0-9_.\/:@=-]+$/.test(arg)) {
    return arg;
  }

  // Use single quotes and escape any single quotes within
  // 'arg' -> 'arg'\''s' for "arg's"
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Escape a command-line argument for the current platform.
 * Automatically selects the appropriate escaping method based on OS.
 *
 * @param arg - The argument to escape
 * @returns Properly escaped argument for the current platform's shell
 */
export function escapeShellArg(arg: string): string {
  if (process.platform === 'win32') {
    return escapeWindowsArg(arg);
  }
  return escapeUnixArg(arg);
}

/**
 * Check if we need shell escaping on the current platform.
 * Windows always needs escaping when shell: true due to cmd.exe.
 * Unix typically doesn't need escaping when shell: false.
 *
 * @returns true if shell escaping should be applied
 */
export function needsShellEscaping(): boolean {
  return process.platform === 'win32';
}
