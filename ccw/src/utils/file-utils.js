import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Safely read a JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Object|null} - Parsed JSON or null on error
 */
export function readJsonFile(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Safely read a text file
 * @param {string} filePath - Path to text file
 * @returns {string|null} - File contents or null on error
 */
export function readTextFile(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Write content to a file
 * @param {string} filePath - Path to file
 * @param {string} content - Content to write
 */
export function writeTextFile(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Check if a path exists
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
export function pathExists(filePath) {
  return existsSync(filePath);
}
