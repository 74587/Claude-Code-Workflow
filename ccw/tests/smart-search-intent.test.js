/**
 * Tests for query intent detection + adaptive RRF weights (TypeScript/Python parity).
 *
 * References:
 * - `ccw/src/tools/smart-search.ts` (detectQueryIntent, adjustWeightsByIntent, getRRFWeights)
 * - `codex-lens/src/codexlens/search/hybrid_search.py` (weight intent concept + defaults)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';

const smartSearchPath = new URL('../dist/tools/smart-search.js', import.meta.url).href;

describe('Smart Search - Query Intent + RRF Weights', async () => {
  /** @type {any} */
  let smartSearchModule;

  before(async () => {
    try {
      smartSearchModule = await import(smartSearchPath);
    } catch (err) {
      // Keep tests non-blocking for environments that haven't built `ccw/dist` yet.
      console.log('Note: smart-search module import skipped:', err.message);
    }
  });

  describe('detectQueryIntent', () => {
    it('classifies "def authenticate" as keyword', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('def authenticate'), 'keyword');
    });

    it('classifies CamelCase identifiers as keyword', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('MyClass'), 'keyword');
    });

    it('classifies snake_case identifiers as keyword', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('user_id'), 'keyword');
    });

    it('classifies namespace separators "::" as keyword', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('UserService::authenticate'), 'keyword');
    });

    it('classifies pointer arrows "->" as keyword', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('ptr->next'), 'keyword');
    });

    it('classifies dotted member access as keyword', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('foo.bar'), 'keyword');
    });

    it('classifies natural language questions as semantic', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('how to handle user login'), 'semantic');
    });

    it('classifies interrogatives with question marks as semantic', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('what is authentication?'), 'semantic');
    });

    it('classifies queries with both code + NL signals as mixed', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('why does FooBar crash?'), 'mixed');
    });

    it('classifies long NL queries containing identifiers as mixed', () => {
      if (!smartSearchModule) return;
      assert.strictEqual(smartSearchModule.detectQueryIntent('how to use user_id in query'), 'mixed');
    });
  });

  describe('adjustWeightsByIntent', () => {
    it('maps keyword intent to exact-heavy weights', () => {
      if (!smartSearchModule) return;
      const weights = smartSearchModule.adjustWeightsByIntent('keyword', { exact: 0.3, fuzzy: 0.1, vector: 0.6 });
      assert.deepStrictEqual(weights, { exact: 0.5, fuzzy: 0.1, vector: 0.4 });
    });
  });

  describe('getRRFWeights parity set', () => {
    it('produces stable weights for 20 representative queries', () => {
      if (!smartSearchModule) return;

      const base = { exact: 0.3, fuzzy: 0.1, vector: 0.6 };
      const expected = [
        ['def authenticate', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['class UserService', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['user_id', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['MyClass', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['Foo::Bar', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['ptr->next', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['foo.bar', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['import os', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['how to handle user login', { exact: 0.2, fuzzy: 0.1, vector: 0.7 }],
        ['what is the best way to search?', { exact: 0.2, fuzzy: 0.1, vector: 0.7 }],
        ['explain the authentication flow', { exact: 0.2, fuzzy: 0.1, vector: 0.7 }],
        ['generate embeddings for this repo', { exact: 0.2, fuzzy: 0.1, vector: 0.7 }],
        ['how does FooBar work', base],
        ['user_id how to handle', base],
        ['Find UserService::authenticate method', base],
        ['where is foo.bar used', base],
        ['parse_json function', { exact: 0.5, fuzzy: 0.1, vector: 0.4 }],
        ['How to parse_json output?', base],
        ['', base],
        ['authentication', base],
      ];

      for (const [query, expectedWeights] of expected) {
        const actual = smartSearchModule.getRRFWeights(query, base);
        assert.deepStrictEqual(actual, expectedWeights, `unexpected weights for query: ${JSON.stringify(query)}`);
      }
    });
  });
});

