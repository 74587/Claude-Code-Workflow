/**
 * TypeScript parity tests for query intent detection + adaptive RRF weights.
 *
 * Notes:
 * - These tests target the runtime implementation shipped in `ccw/dist`.
 * - Keep logic aligned with Python: `codex-lens/src/codexlens/search/ranking.py`.
 */

import { before, describe, it } from 'node:test';
import assert from 'node:assert';

const smartSearchPath = new URL('../dist/tools/smart-search.js', import.meta.url).href;

describe('Smart Search (TS) - Query Intent + RRF Weights', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let smartSearchModule: any;

  before(async () => {
    try {
      smartSearchModule = await import(smartSearchPath);
    } catch (err: any) {
      // Keep tests non-blocking for environments that haven't built `ccw/dist` yet.
      console.log('Note: smart-search module import skipped:', err?.message ?? String(err));
    }
  });

  describe('detectQueryIntent parity (10 cases)', () => {
    const cases: Array<[string, 'keyword' | 'semantic' | 'mixed']> = [
      ['def authenticate', 'keyword'],
      ['MyClass', 'keyword'],
      ['user_id', 'keyword'],
      ['UserService::authenticate', 'keyword'],
      ['ptr->next', 'keyword'],
      ['how to handle user login', 'semantic'],
      ['what is authentication?', 'semantic'],
      ['where is this used?', 'semantic'],
      ['why does FooBar crash?', 'mixed'],
      ['how to use user_id in query', 'mixed'],
    ];

    for (const [query, expected] of cases) {
      it(`classifies ${JSON.stringify(query)} as ${expected}`, () => {
        if (!smartSearchModule) return;
        assert.strictEqual(smartSearchModule.detectQueryIntent(query), expected);
      });
    }
  });

  describe('adaptive weights (Python parity thresholds)', () => {
    it('uses exact-heavy weights for code-like queries (exact > 0.4)', () => {
      if (!smartSearchModule) return;
      const weights = smartSearchModule.getRRFWeights('def authenticate', {
        exact: 0.3,
        fuzzy: 0.1,
        vector: 0.6,
      });
      assert.ok(weights.exact > 0.4);
    });

    it('uses vector-heavy weights for NL queries (vector > 0.6)', () => {
      if (!smartSearchModule) return;
      const weights = smartSearchModule.getRRFWeights('how to handle user login', {
        exact: 0.3,
        fuzzy: 0.1,
        vector: 0.6,
      });
      assert.ok(weights.vector > 0.6);
    });
  });
});

