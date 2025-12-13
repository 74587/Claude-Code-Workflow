import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Safely read a JSON file
 * @param filePath - Path to JSON file
 * @returns Parsed JSON or null on error
 */
export function readJsonFile(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Safely read a text file
 * @param filePath - Path to text file
 * @returns File contents or null on error
 */
export function readTextFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Write content to a file
 * @param filePath - Path to file
 * @param content - Content to write
 */
export function writeTextFile(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Check if a path exists
 * @param filePath - Path to check
 * @returns True if path exists
 */
export function pathExists(filePath: string): boolean {
  return existsSync(filePath);
}
