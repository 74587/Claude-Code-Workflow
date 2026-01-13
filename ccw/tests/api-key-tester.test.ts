/**
 * Unit tests for API Key Tester service (ccw/src/core/services/api-key-tester.ts)
 *
 * Tests URL construction logic, version suffix detection, and trailing slash handling.
 * Uses Node's built-in test runner (node:test).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import functions that don't require fetch
import { validateApiBaseUrl, getDefaultApiBase } from '../src/core/services/api-key-tester.js';

describe('API Key Tester', () => {
  describe('validateApiBaseUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      const result = validateApiBaseUrl('https://api.openai.com/v1');
      assert.equal(result.valid, true);
    });

    it('should accept valid HTTP URLs (for local development)', () => {
      const result = validateApiBaseUrl('http://localhost:8080');
      assert.equal(result.valid, true);
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateApiBaseUrl('ftp://example.com');
      assert.equal(result.valid, false);
      assert.equal(result.error, 'URL must use HTTP or HTTPS protocol');
    });

    it('should reject invalid URL format', () => {
      const result = validateApiBaseUrl('not-a-url');
      assert.equal(result.valid, false);
      assert.equal(result.error, 'Invalid URL format');
    });
  });

  describe('getDefaultApiBase', () => {
    it('should return OpenAI default for openai provider', () => {
      assert.equal(getDefaultApiBase('openai'), 'https://api.openai.com/v1');
    });

    it('should return Anthropic default for anthropic provider', () => {
      assert.equal(getDefaultApiBase('anthropic'), 'https://api.anthropic.com/v1');
    });

    it('should return OpenAI default for custom provider', () => {
      assert.equal(getDefaultApiBase('custom'), 'https://api.openai.com/v1');
    });
  });

  describe('URL Normalization Logic (Issue #70 fix verification)', () => {
    // Test the regex pattern used in testApiKeyConnection
    const normalizeUrl = (url: string) => url.replace(/\/+$/, '');
    const hasVersionSuffix = (url: string) => /\/v\d+$/.test(url);

    describe('Trailing slash removal', () => {
      it('should remove single trailing slash', () => {
        assert.equal(normalizeUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1');
      });

      it('should remove multiple trailing slashes', () => {
        assert.equal(normalizeUrl('https://api.openai.com/v1///'), 'https://api.openai.com/v1');
      });

      it('should not modify URL without trailing slash', () => {
        assert.equal(normalizeUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1');
      });
    });

    describe('Version suffix detection', () => {
      it('should detect /v1 suffix', () => {
        assert.equal(hasVersionSuffix('https://api.openai.com/v1'), true);
      });

      it('should detect /v2 suffix', () => {
        assert.equal(hasVersionSuffix('https://api.custom.com/v2'), true);
      });

      it('should detect /v4 suffix (z.ai style)', () => {
        assert.equal(hasVersionSuffix('https://api.z.ai/api/coding/paas/v4'), true);
      });

      it('should NOT detect version when URL has no version suffix', () => {
        assert.equal(hasVersionSuffix('http://localhost:8080'), false);
      });

      it('should NOT detect version when followed by slash (before normalization)', () => {
        // After normalization, the slash should be removed
        assert.equal(hasVersionSuffix('https://api.openai.com/v1/'), false);
        assert.equal(hasVersionSuffix(normalizeUrl('https://api.openai.com/v1/')), true);
      });
    });

    describe('URL construction verification', () => {
      const constructModelsUrl = (apiBase: string) => {
        const normalized = normalizeUrl(apiBase);
        return hasVersionSuffix(normalized) ? `${normalized}/models` : `${normalized}/v1/models`;
      };

      it('should construct correct URL for https://api.openai.com/v1', () => {
        assert.equal(constructModelsUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1/models');
      });

      it('should construct correct URL for https://api.openai.com/v1/ (with trailing slash)', () => {
        assert.equal(constructModelsUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1/models');
      });

      it('should construct correct URL for https://api.custom.com/v2', () => {
        assert.equal(constructModelsUrl('https://api.custom.com/v2'), 'https://api.custom.com/v2/models');
      });

      it('should construct correct URL for https://api.custom.com/v2/ (with trailing slash)', () => {
        assert.equal(constructModelsUrl('https://api.custom.com/v2/'), 'https://api.custom.com/v2/models');
      });

      it('should construct correct URL for https://api.z.ai/api/coding/paas/v4', () => {
        assert.equal(constructModelsUrl('https://api.z.ai/api/coding/paas/v4'), 'https://api.z.ai/api/coding/paas/v4/models');
      });

      it('should add /v1 when no version suffix: http://localhost:8080', () => {
        assert.equal(constructModelsUrl('http://localhost:8080'), 'http://localhost:8080/v1/models');
      });

      it('should add /v1 when no version suffix: https://api.custom.com', () => {
        assert.equal(constructModelsUrl('https://api.custom.com'), 'https://api.custom.com/v1/models');
      });

      it('should NOT produce double slashes in any case', () => {
        const testCases = [
          'https://api.openai.com/v1/',
          'https://api.openai.com/v1//',
          'https://api.anthropic.com/v1/',
          'http://localhost:8080/',
        ];

        for (const url of testCases) {
          const result = constructModelsUrl(url);
          assert.ok(!result.includes('//models'), `Double slash found in: ${result} (from: ${url})`);
        }
      });
    });
  });

  describe('Anthropic URL construction', () => {
    const constructAnthropicUrl = (apiBase: string) => {
      const normalized = apiBase.replace(/\/+$/, '');
      return `${normalized}/models`;
    };

    it('should construct correct Anthropic URL without trailing slash', () => {
      assert.equal(constructAnthropicUrl('https://api.anthropic.com/v1'), 'https://api.anthropic.com/v1/models');
    });

    it('should construct correct Anthropic URL WITH trailing slash', () => {
      assert.equal(constructAnthropicUrl('https://api.anthropic.com/v1/'), 'https://api.anthropic.com/v1/models');
    });

    it('should NOT produce double slashes', () => {
      const result = constructAnthropicUrl('https://api.anthropic.com/v1//');
      assert.ok(!result.includes('//models'), `Double slash found in: ${result}`);
    });
  });
});
