/**
 * Windows cmd.exe argument escaping for spawn({ shell: true }).
 *
 * This utility escapes cmd.exe metacharacters using caret (^) so that user
 * controlled input cannot inject additional commands.
 */

const WINDOWS_METACHARS = /[&|<>()%!"]/g;

export function escapeWindowsArg(arg: string): string {
  if (arg === '') return '""';

  // Normalize newlines to spaces to prevent cmd.exe from
  // misinterpreting multiline arguments (breaks argument parsing)
  let sanitizedArg = arg.replace(/\r?\n/g, ' ');

  // Escape caret first to avoid double-escaping when prefixing other metachars.
  let escaped = sanitizedArg.replace(/\^/g, '^^');

  // Escape cmd.exe metacharacters with caret.
  escaped = escaped.replace(WINDOWS_METACHARS, '^$&');

  // Wrap whitespace-containing args in double quotes.
  if (/\s/.test(escaped)) {
    escaped = `"${escaped}"`;
  }

  return escaped;
}

