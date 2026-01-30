// ========================================
// Translation Validation Script
// ========================================
// Checks that en/ and zh/ translation files have matching keys

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

interface TranslationEntry {
  key: string;
  path: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingKeys: {
    en: string[];
    zh: string[];
  };
  extraKeys: {
    en: string[];
    zh: string[];
  };
}

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOCALES_DIR = join(__dirname, '../src/locales');
const SUPPORTED_LOCALES = ['en', 'zh'] as const;

/**
 * Recursively get all translation keys from a nested object
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenObject(value as Record<string, unknown>, fullKey));
    } else if (typeof value === 'string') {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Load and parse a JSON file
 */
function loadJsonFile(filePath: string): Record<string, unknown> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return {};
  }
}

/**
 * Get all translation keys for a locale
 */
function getLocaleKeys(locale: string): string[] {
  const localeDir = join(LOCALES_DIR, locale);
  const keys: string[] = [];

  try {
    const files = readdirSync(localeDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = join(localeDir, file);
      const content = loadJsonFile(filePath);
      keys.push(...flattenObject(content));
    }
  } catch (error) {
    console.error(`Error reading locale directory for ${locale}:`, error);
  }

  return keys;
}

/**
 * Compare translation keys between locales
 */
function compareTranslations(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    missingKeys: { en: [], zh: [] },
    extraKeys: { en: [], zh: [] },
  };

  // Get keys for each locale
  const enKeys = getLocaleKeys('en');
  const zhKeys = getLocaleKeys('zh');

  // Sort for comparison
  enKeys.sort();
  zhKeys.sort();

  // Find keys missing in Chinese
  for (const key of enKeys) {
    if (!zhKeys.includes(key)) {
      result.missingKeys.zh.push(key);
      result.isValid = false;
    }
  }

  // Find keys missing in English
  for (const key of zhKeys) {
    if (!enKeys.includes(key)) {
      result.missingKeys.en.push(key);
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Display validation results
 */
function displayResults(result: ValidationResult): void {
  console.log('\n=== Translation Validation Report ===\n');

  if (result.isValid) {
    console.log('Status: PASSED');
    console.log('All translation keys are synchronized between en/ and zh/ locales.\n');
  } else {
    console.log('Status: FAILED');
    console.log('Translation keys are not synchronized.\n');
  }

  // Display missing keys
  if (result.missingKeys.zh.length > 0) {
    console.log(`Keys missing in zh/ (${result.missingKeys.zh.length}):`);
    result.missingKeys.zh.forEach((key) => console.log(`  - ${key}`));
    console.log('');
  }

  if (result.missingKeys.en.length > 0) {
    console.log(`Keys missing in en/ (${result.missingKeys.en.length}):`);
    result.missingKeys.en.forEach((key) => console.log(`  - ${key}`));
    console.log('');
  }

  // Display warnings
  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((warning) => console.log(`  ⚠️  ${warning}`));
    console.log('');
  }

  // Display errors
  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach((error) => console.log(`  ❌ ${error}`));
    console.log('');
  }

  console.log('=====================================\n');
}

/**
 * Main validation function
 */
function main(): void {
  console.log('Validating translations...\n');

  // Check if locale directories exist
  for (const locale of SUPPORTED_LOCALES) {
    const localePath = join(LOCALES_DIR, locale);
    // Note: In a real script, you'd use fs.existsSync here
    // For now, we'll let the error be caught in getLocaleKeys
  }

  // Compare translations
  const result = compareTranslations();

  // Display results
  displayResults(result);

  // Exit with appropriate code
  process.exit(result.isValid ? 0 : 1);
}

// Run the validation
main();
