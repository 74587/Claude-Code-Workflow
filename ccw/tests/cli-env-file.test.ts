/**
 * Unit tests for CLI env file loading mechanism
 *
 * Tests parseEnvFile and loadEnvFile functions without calling the actual CLI
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

// Set test CCW home before importing module
const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-env-file-test-'));
process.env.CCW_DATA_DIR = TEST_CCW_HOME;

// Import from dist (built version)
const cliExecutorPath = new URL('../dist/tools/cli-executor-core.js', import.meta.url).href;

describe('Env File Loading Mechanism', async () => {
  let parseEnvFile: (content: string) => Record<string, string>;
  let loadEnvFile: (envFilePath: string) => Record<string, string>;
  let testTempDir: string;

  before(async () => {
    const mod = await import(cliExecutorPath);
    parseEnvFile = mod.parseEnvFile;
    loadEnvFile = mod.loadEnvFile;
    testTempDir = mkdtempSync(join(tmpdir(), 'env-test-'));
  });

  after(() => {
    // Cleanup test directories
    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true });
    }
    if (existsSync(TEST_CCW_HOME)) {
      rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    }
  });

  describe('parseEnvFile', () => {
    it('should parse simple KEY=value pairs', () => {
      const content = `API_KEY=abc123
SECRET=mysecret`;
      const result = parseEnvFile(content);
      assert.equal(result['API_KEY'], 'abc123');
      assert.equal(result['SECRET'], 'mysecret');
    });

    it('should handle double-quoted values', () => {
      const content = `API_KEY="value with spaces"
PATH="/usr/local/bin"`;
      const result = parseEnvFile(content);
      assert.equal(result['API_KEY'], 'value with spaces');
      assert.equal(result['PATH'], '/usr/local/bin');
    });

    it('should handle single-quoted values', () => {
      const content = `API_KEY='value with spaces'
NAME='John Doe'`;
      const result = parseEnvFile(content);
      assert.equal(result['API_KEY'], 'value with spaces');
      assert.equal(result['NAME'], 'John Doe');
    });

    it('should skip comments', () => {
      const content = `# This is a comment
API_KEY=value
# Another comment
SECRET=test`;
      const result = parseEnvFile(content);
      assert.equal(Object.keys(result).length, 2);
      assert.equal(result['API_KEY'], 'value');
      assert.equal(result['SECRET'], 'test');
    });

    it('should skip empty lines', () => {
      const content = `
API_KEY=value

SECRET=test

`;
      const result = parseEnvFile(content);
      assert.equal(Object.keys(result).length, 2);
    });

    it('should handle values with equals signs', () => {
      const content = `DATABASE_URL=postgresql://user:pass@host/db?sslmode=require`;
      const result = parseEnvFile(content);
      assert.equal(result['DATABASE_URL'], 'postgresql://user:pass@host/db?sslmode=require');
    });

    it('should handle Windows-style line endings (CRLF)', () => {
      const content = `API_KEY=value\r\nSECRET=test\r\n`;
      const result = parseEnvFile(content);
      assert.equal(result['API_KEY'], 'value');
      assert.equal(result['SECRET'], 'test');
    });

    it('should trim whitespace around keys and values', () => {
      const content = `  API_KEY  =  value
  SECRET = test  `;
      const result = parseEnvFile(content);
      assert.equal(result['API_KEY'], 'value');
      assert.equal(result['SECRET'], 'test');
    });

    it('should skip lines without equals sign', () => {
      const content = `API_KEY=value
INVALID_LINE
SECRET=test`;
      const result = parseEnvFile(content);
      assert.equal(Object.keys(result).length, 2);
      assert.equal(result['INVALID_LINE'], undefined);
    });

    it('should handle empty values', () => {
      const content = `EMPTY_VALUE=
ANOTHER=test`;
      const result = parseEnvFile(content);
      assert.equal(result['EMPTY_VALUE'], '');
      assert.equal(result['ANOTHER'], 'test');
    });

    it('should handle mixed format content', () => {
      const content = `# Gemini API Configuration
GEMINI_API_KEY="sk-gemini-xxx"

# OpenAI compatible settings
OPENAI_API_BASE='https://api.example.com/v1'
OPENAI_API_KEY=abc123

# Feature flags
ENABLE_DEBUG=true`;
      const result = parseEnvFile(content);
      assert.equal(result['GEMINI_API_KEY'], 'sk-gemini-xxx');
      assert.equal(result['OPENAI_API_BASE'], 'https://api.example.com/v1');
      assert.equal(result['OPENAI_API_KEY'], 'abc123');
      assert.equal(result['ENABLE_DEBUG'], 'true');
      assert.equal(Object.keys(result).length, 4);
    });
  });

  describe('loadEnvFile', () => {
    it('should load env file from absolute path', () => {
      const envPath = join(testTempDir, 'test.env');
      writeFileSync(envPath, 'API_KEY=test_value\nSECRET=123');

      const result = loadEnvFile(envPath);
      assert.equal(result['API_KEY'], 'test_value');
      assert.equal(result['SECRET'], '123');
    });

    it('should return empty object for non-existent file', () => {
      const result = loadEnvFile('/non/existent/path/.env');
      assert.deepEqual(result, {});
    });

    it('should expand ~ to home directory', () => {
      // Create .env-test in home directory for testing
      const homeEnvPath = join(homedir(), '.ccw-env-test');
      writeFileSync(homeEnvPath, 'HOME_TEST_KEY=home_value');

      try {
        const result = loadEnvFile('~/.ccw-env-test');
        assert.equal(result['HOME_TEST_KEY'], 'home_value');
      } finally {
        // Cleanup
        if (existsSync(homeEnvPath)) {
          rmSync(homeEnvPath);
        }
      }
    });

    it('should handle relative paths', () => {
      const envPath = join(testTempDir, 'relative.env');
      writeFileSync(envPath, 'RELATIVE_KEY=rel_value');

      // Save and change cwd
      const originalCwd = process.cwd();
      try {
        process.chdir(testTempDir);
        const result = loadEnvFile('./relative.env');
        assert.equal(result['RELATIVE_KEY'], 'rel_value');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle empty file', () => {
      const envPath = join(testTempDir, 'empty.env');
      writeFileSync(envPath, '');

      const result = loadEnvFile(envPath);
      assert.deepEqual(result, {});
    });

    it('should handle file with only comments', () => {
      const envPath = join(testTempDir, 'comments.env');
      writeFileSync(envPath, '# Just a comment\n# Another comment\n');

      const result = loadEnvFile(envPath);
      assert.deepEqual(result, {});
    });
  });

  describe('Integration scenario: Gemini CLI env file', () => {
    it('should correctly parse typical Gemini .env file', () => {
      const geminiEnvContent = `# Gemini CLI Environment Configuration
# Created by CCW Dashboard

# Google AI API Key
GOOGLE_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Optional: Custom API endpoint
# GOOGLE_API_BASE=https://generativelanguage.googleapis.com/v1beta

# Model configuration
GEMINI_MODEL=gemini-2.5-pro

# Rate limiting
GEMINI_RATE_LIMIT=60
`;
      const envPath = join(testTempDir, '.gemini-env');
      writeFileSync(envPath, geminiEnvContent);

      const result = loadEnvFile(envPath);
      assert.equal(result['GOOGLE_API_KEY'], 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      assert.equal(result['GEMINI_MODEL'], 'gemini-2.5-pro');
      assert.equal(result['GEMINI_RATE_LIMIT'], '60');
      assert.equal(result['GOOGLE_API_BASE'], undefined); // Commented out
    });

    it('should correctly parse typical Qwen .env file', () => {
      const qwenEnvContent = `# Qwen CLI Environment Configuration

# DashScope API Key (Alibaba Cloud)
DASHSCOPE_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# OpenAI-compatible endpoint settings
OPENAI_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Model selection
QWEN_MODEL=qwen2.5-coder-32b
`;
      const envPath = join(testTempDir, '.qwen-env');
      writeFileSync(envPath, qwenEnvContent);

      const result = loadEnvFile(envPath);
      assert.equal(result['DASHSCOPE_API_KEY'], 'sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      assert.equal(result['OPENAI_API_BASE'], 'https://dashscope.aliyuncs.com/compatible-mode/v1');
      assert.equal(result['QWEN_MODEL'], 'qwen2.5-coder-32b');
    });
  });
});
